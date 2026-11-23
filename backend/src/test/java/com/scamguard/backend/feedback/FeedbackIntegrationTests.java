package com.scamguard.backend.feedback;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.scamguard.backend.decision.DecisionService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Transactional
@EnabledIfEnvironmentVariable(named = "SCAMGUARD_FEEDBACK_DB_TEST", matches = "true")
@Import(FeedbackIntegrationTests.ProviderConfig.class)
class FeedbackIntegrationTests {
    private static final JsonMapper JSON = new JsonMapper();
    private static final String VALID_FEEDBACK = """
            {"summary":"평가를 확인했습니다.","strengths":["조사 기록을 확인했습니다."],
             "improvements":["공식 확인 절차를 점검하세요."],"recommendation":"공식 연락처로 문의하세요."}
            """;

    @Autowired private JdbcTemplate db;
    @Autowired private FeedbackController feedback;
    @Autowired private DecisionService decisions;
    @Autowired private ProviderStub provider;

    static Stream<JsonNode> scenarios() throws IOException {
        return resource("/feedback/cases.json").valueStream();
    }

    @ParameterizedTest(name = "{index}")
    @MethodSource("scenarios")
    void sendsPersistedEvaluationAndReturnsSavedFeedback(JsonNode testCase) throws IOException {
        provider.mode = "success";
        UUID session = evaluate(testCase, testCase.path("reason").asText() + " learner@example.invalid");
        int priorCalls = provider.calls.get();
        Map<String, Object> response = feedback.generateFeedback(session);

        assertEquals("AI", response.get("feedbackSource"));
        assertEquals("평가를 확인했습니다.", response.get("summary"));
        assertEquals(response, feedback.generateFeedback(session));
        assertEquals(priorCalls + 1, provider.calls.get());
        assertEquals(1, db.queryForObject("""
                SELECT count(*) FROM ai_feedback f
                JOIN play_evaluation e ON f.evaluation_id=e.evaluation_id WHERE e.session_id=?
                """, Integer.class, session));

        assertTrue(provider.lastRequest.path("system").asText().contains("verifiedFacts"));
        JsonNode input = JSON.readTree(provider.lastRequest.at("/messages/0/content").asText());
        assertEquals(testCase.path("scenarioId"), input.path("scenarioId"));
        assertEquals(testCase.path("caseType"), input.path("correctJudgment"));
        assertEquals(testCase.path("judgment"), input.path("userJudgment"));
        assertEquals(testCase.path("score").intValue(), input.path("score").intValue());
        assertEquals(testCase.path("responseAction"), input.path("responseAction"));
        assertEquals(testCase.path("checked").intValue(), input.path("completedChecks").size());
        assertEquals(testCase.path("checked").intValue(), input.path("actions").size());
        assertEquals(testCase.path("reason").asText() + " [가림]", input.path("reason").asText());
        Set<String> visited = input.path("actions").valueStream()
                .map(action -> action.path("targetId").asText())
                .collect(Collectors.toSet());
        assertFalse(input.path("verifiedFacts").isEmpty());
        assertTrue(input.path("verifiedFacts").valueStream()
                .allMatch(fact -> visited.contains(fact.path("sourceId").asText())));
        assertTrue(input.path("missedChecks").valueStream()
                .noneMatch(check -> input.path("verifiedFacts").valueStream()
                        .anyMatch(fact -> fact.path("sourceId").equals(check.path("targetId")))));
    }

    @ParameterizedTest
    @ValueSource(strings = {"unauthorized", "rate-limit", "unavailable", "invalid-json", "timeout"})
    void persistsFallbackOnProviderFailure(String mode) throws IOException {
        provider.mode = mode;
        JsonNode testCase = resource("/feedback/cases.json").get(2);
        UUID session = evaluate(testCase, testCase.path("reason").asText());
        int priorCalls = provider.calls.get();

        Map<String, Object> response = feedback.generateFeedback(session);
        assertEquals("FALLBACK", response.get("feedbackSource"));
        assertTrue(response.get("summary").toString().contains("올바르게"));
        assertTrue(response.get("improvements").toString().contains("대응을 선택했습니다"));
        assertTrue(response.get("recommendation").toString().contains("인사팀"));
        assertEquals(response, feedback.generateFeedback(session));
        assertEquals(priorCalls + 1, provider.calls.get());
    }

    @Test
    void skipsProviderWhenDisabledOrKeyIsMissing() throws IOException {
        try {
            assertTrue(new ClaudeFeedback(false, "test", "test", Duration.ofSeconds(1)).generate("{}").isEmpty());
            assertTrue(new ClaudeFeedback(true, "", "test", Duration.ofSeconds(1)).generate("{}").isEmpty());
        } finally {
            provider.mode = "success";
        }
    }

    private UUID evaluate(JsonNode testCase, String reason) throws IOException {
        UUID caseId = UUID.randomUUID();
        UUID session = UUID.randomUUID();
        String type = testCase.path("caseType").asText();
        String scenario = testCase.path("scenarioId").asText();
        JsonNode scenarioData = testCase.has("facts")
                ? syntheticCase(testCase)
                : resource("/seed/" + scenario.toLowerCase(java.util.Locale.ROOT) + "/1_"
                        + type.toLowerCase(java.util.Locale.ROOT) + "_easy.json");
        JsonNode rules = scenarioData.path("evaluationRules");
        db.update("INSERT INTO scenario (scenario_id, title) VALUES (?, ?) ON CONFLICT DO NOTHING", scenario, scenario);
        db.update("""
                INSERT INTO scenario_case (case_id, scenario_id, case_type, difficulty, content, evaluation_rules)
                VALUES (?, ?, ?, 'EASY', CAST(? AS jsonb), CAST(? AS jsonb))
                """, caseId, scenario, type, scenarioData.path("content").toString(), rules.toString());
        db.update("INSERT INTO play_session (session_id, case_id) VALUES (?, ?)", session, caseId);
        db.update("INSERT INTO play_session_state (session_id, state_data) VALUES (?, '{}'::jsonb)", session);
        for (int i = 0; i < testCase.path("checked").intValue(); i++) {
            JsonNode check = rules.path("investigationChecks").get(i);
            db.update("""
                    INSERT INTO action_event (event_id, session_id, event_name, target_id, event_data, sequence_no)
                    VALUES (?, ?, ?, ?, '{}'::jsonb, ?)
                    """, UUID.randomUUID(), session, check.path("eventName").asText(),
                    check.path("targetId").asText(), i + 1);
        }
        var result = decisions.submitDecision(session, testCase.path("judgment").asText(),
                testCase.path("responseAction").asText(), reason);
        assertEquals(testCase.path("score").intValue(), result.get("score"));
        return session;
    }

    private JsonNode syntheticCase(JsonNode testCase) {
        return JSON.valueToTree(Map.of(
                "content", Map.of(
                        "computerPages", List.of(Map.of("id", "page", "pageType", "OFFICIAL")),
                        "preventionTips", List.of("직접 찾은 공식 경로로 확인하세요."),
                        "evidence", List.of(
                                Map.of("sourceId", "message", "sourceType", "MESSAGE", "fact", testCase.at("/facts/0").asText()),
                                Map.of("sourceId", "page", "sourceType", "COMPUTER_PAGE", "fact", testCase.at("/facts/1").asText())
                        )),
                "evaluationRules", Map.of(
                        "judgmentScore", 30,
                        "investigationChecks", List.of(
                                Map.of("eventName", "MESSAGE_VIEWED", "targetId", "message", "score", 20),
                                Map.of("eventName", "OFFICIAL_INFO_VIEWED", "targetId", "page", "score", 20)
                        ),
                        "responseScores", Map.of("CONTINUE_OFFICIAL", 30, "STOP_AND_REPORT", 30, "TRANSFER_UNVERIFIED", 0)
                )));
    }

    private static JsonNode resource(String name) throws IOException {
        try (InputStream stream = FeedbackIntegrationTests.class.getResourceAsStream(name)) {
            return JSON.readTree(stream);
        }
    }

    @TestConfiguration
    static class ProviderConfig {
        @Bean(destroyMethod = "close")
        ProviderStub providerStub() throws IOException {
            return new ProviderStub();
        }

        @Bean
        @Primary
        ClaudeFeedback stubClaudeFeedback(ProviderStub stub) {
            var client = AnthropicOkHttpClient.builder().apiKey("test").baseUrl(stub.url())
                    .timeout(Duration.ofMillis(850)).maxRetries(0).build();
            return new ClaudeFeedback(client, "claude-sonnet-5");
        }
    }

    static final class ProviderStub implements AutoCloseable {
        private final HttpServer server;
        private final java.util.concurrent.ExecutorService executor =
                java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor();
        final AtomicInteger calls = new AtomicInteger();
        volatile JsonNode lastRequest;
        volatile String mode = "success";

        ProviderStub() throws IOException {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.setExecutor(executor);
            server.createContext("/v1/messages", exchange -> {
                try (exchange) {
                    calls.incrementAndGet();
                    lastRequest = JSON.readTree(exchange.getRequestBody());
                    String responseMode = mode;
                    int status = switch (responseMode) {
                        case "unauthorized" -> 401;
                        case "rate-limit" -> 429;
                        case "unavailable" -> 503;
                        default -> 200;
                    };
                    if ("timeout".equals(responseMode)) {
                        try {
                            Thread.sleep(Duration.ofSeconds(2));
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                    }
                    String payload = status == 200 ? JSON.writeValueAsString(Map.of(
                            "id", "msg_stub", "type", "message", "role", "assistant", "model", "claude-sonnet-5",
                            "content", List.of(Map.of("type", "text", "text",
                                    "invalid-json".equals(responseMode) ? "{}" : VALID_FEEDBACK)),
                            "stop_reason", "end_turn", "usage", Map.of("input_tokens", 100, "output_tokens", 60)))
                            : "{\"type\":\"error\",\"error\":{\"type\":\"api_error\",\"message\":\"stub failure\"}}";
                    byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(status, bytes.length);
                    exchange.getResponseBody().write(bytes);
                }
            });
            server.start();
        }

        String url() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }

        @Override
        public void close() {
            server.stop(0);
            executor.shutdownNow();
        }
    }
}
