package com.scamguard.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StopReason;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class FeedbackClient {
    private static final ObjectMapper JSON = new ObjectMapper()
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final JsonSchema INPUT = schema("input.schema.json");
    private static final JsonSchema OUTPUT = schema("feedback.schema.json");
    private static final String PROMPT = resource("feedback-prompt.txt");

    private final AnthropicClient client;
    private final String model;

    public FeedbackClient(AnthropicClient client, String model) {
        this.client = client;
        this.model = model;
    }

    public String generateJson(String inputJson) throws IOException {
        return JSON.writeValueAsString(generate(inputJson));
    }

    public JsonNode generate(String inputJson) throws IOException {
        JsonNode input = JSON.readTree(inputJson);
        validate(INPUT, input, "평가 입력");
        if (input.get("decisionCorrect").booleanValue() !=
                input.get("userJudgment").equals(input.get("correctJudgment"))) {
            throw new IllegalArgumentException("판정과 정오가 일치하지 않습니다.");
        }
        Set<Action> performed = new HashSet<>();
        for (JsonNode action : input.get("actions")) {
            performed.add(new Action(action.get("eventName").asText(), action.get("targetId").textValue()));
        }
        for (JsonNode fact : input.get("verifiedFacts")) {
            if (!performed.contains(new Action(fact.get("eventName").asText(), fact.get("sourceId").asText()))) {
                throw new IllegalArgumentException("확인 사실에 대응하는 행동 기록이 없습니다.");
            }
        }
        var request = MessageCreateParams.builder()
                .model(model)
                .maxTokens(1200)
                .system(PROMPT)
                .addUserMessage(JSON.writeValueAsString(input))
                .build();
        var response = client.messages().create(request);
        if (response.stopReason().filter(StopReason.END_TURN::equals).isEmpty()) {
            throw new IllegalStateException("피드백 생성이 정상 종료되지 않았습니다.");
        }
        List<String> blocks = response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(block -> block.text())
                .toList();
        if (blocks.size() != 1) {
            throw new IllegalStateException("피드백 텍스트 블록 수가 올바르지 않습니다.");
        }
        JsonNode feedback = JSON.readTree(blocks.getFirst());
        validate(OUTPUT, feedback, "피드백");
        return feedback;
    }

    private static void validate(JsonSchema schema, JsonNode value, String label) {
        if (value == null || value.isMissingNode() || !schema.validate(value).isEmpty()) {
            throw new IllegalArgumentException(label + " 형식이 올바르지 않습니다.");
        }
    }

    private static JsonSchema schema(String name) {
        return JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012).getSchema(resource(name));
    }

    private static String resource(String name) {
        try (InputStream stream = FeedbackClient.class.getResourceAsStream("/" + name)) {
            if (stream == null) {
                throw new IllegalStateException("리소스 누락 " + name);
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(name, e);
        }
    }

    private record Action(String eventName, String targetId) {}
}
