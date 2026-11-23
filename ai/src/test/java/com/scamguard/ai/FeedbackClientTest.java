package com.scamguard.ai;

import static org.junit.jupiter.api.Assertions.*;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class FeedbackClientTest {
    private final ObjectMapper json = new ObjectMapper();
    private final AtomicReference<JsonNode> request = new AtomicReference<>();
    private final AtomicReference<String> keyHeader = new AtomicReference<>();
    private final AtomicReference<String> versionHeader = new AtomicReference<>();
    private HttpServer server;
    private AnthropicClient sdk;
    private FeedbackClient client;
    private ObjectNode input;
    private ObjectNode output;
    private String stopReason = "end_turn";
    private String responseText;

    @BeforeEach
    void setUp() throws IOException {
        input = (ObjectNode) json.readTree(Files.readString(Path.of("examples/job.json")));
        output = json.createObjectNode();
        output.put("summary", "공식 안내와 다른 제출 경로를 확인하고 사기로 판단했습니다.");
        output.putArray("strengths").add("메시지와 공식 서류 안내를 대조했습니다.");
        output.putArray("improvements").add("공식 인사팀의 접수 경로도 확인해 보세요.");
        output.put("recommendation", "회사 홈페이지에서 찾은 인사팀 연락처로 접수 방법을 확인하세요.");
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            request.set(json.readTree(exchange.getRequestBody()));
            keyHeader.set(exchange.getRequestHeaders().getFirst("x-api-key"));
            versionHeader.set(exchange.getRequestHeaders().getFirst("anthropic-version"));
            byte[] body = json.writeValueAsBytes(Map.of(
                    "id", "msg_test", "type", "message", "role", "assistant", "model", "claude-sonnet-5",
                    "content", List.of(Map.of("type", "text", "text", responseText)),
                    "stop_reason", stopReason, "usage", Map.of("input_tokens", 100, "output_tokens", 60)));
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var stream = exchange.getResponseBody()) {
                stream.write(body);
            }
        });
        server.start();
        sdk = AnthropicOkHttpClient.builder().apiKey("local-test")
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort()).maxRetries(0).build();
        client = new FeedbackClient(sdk, "claude-sonnet-5");
        responseText = output.toString();
    }

    @AfterEach
    void tearDown() {
        sdk.close();
        server.stop(0);
    }

    @Test
    void sendsServerEvaluationAndReadsFourFields() throws IOException {
        assertEquals(output, client.generate(input.toString()));
        assertEquals("local-test", keyHeader.get());
        assertEquals("2023-06-01", versionHeader.get());
        JsonNode body = request.get();
        assertEquals("claude-sonnet-5", body.path("model").asText());
        assertTrue(body.path("system").asText().contains("verifiedFacts"));
        assertEquals(input, json.readTree(body.at("/messages/0/content").asText()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "extra", "wrongType", "empty", "blankItem", "trailing", "duplicate"})
    void rejectsInvalidFeedback(String kind) {
        switch (kind) {
            case "missing" -> output.remove("recommendation");
            case "extra" -> output.put("score", 0);
            case "wrongType" -> output.put("strengths", "확인");
            case "empty" -> output.putArray("improvements");
            case "blankItem" -> output.putArray("strengths").add("  ");
            case "trailing" -> responseText = output + " {}";
            case "duplicate" -> responseText = output.toString().replaceFirst("\\{", "{\"summary\":\"다른 평가\",");
        }
        if (!kind.equals("trailing") && !kind.equals("duplicate")) {
            responseText = output.toString();
        }
        assertThrows(Exception.class, () -> client.generate(input.toString()));
        assertNotNull(request.get());
    }

    @Test
    void rejectsTruncatedGeneration() {
        stopReason = "max_tokens";
        assertThrows(IllegalStateException.class, () -> client.generate(input.toString()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"source", "event", "verdict", "schema"})
    void rejectsInconsistentInputBeforeCallingClaude(String kind) {
        ObjectNode fact = (ObjectNode) input.at("/verifiedFacts/0");
        switch (kind) {
            case "source" -> fact.put("sourceId", "JOB_CALL_003");
            case "event" -> fact.put("eventName", "PHONE_INQUIRY_SELECTED");
            case "verdict" -> input.put("decisionCorrect", false);
            case "schema" -> input.remove("actions");
        }
        assertThrows(IllegalArgumentException.class, () -> client.generate(input.toString()));
        assertNull(request.get());
    }
}
