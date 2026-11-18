
package com.scamguard.backend.session;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
public class SessionService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public SessionService(
            JdbcTemplate jdbcTemplate,
            JsonMapper jsonMapper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
    }

    @Transactional
    public Map<String, Object> startSession(String scenarioId) {

        Boolean active = jdbcTemplate.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM scenario
                    WHERE scenario_id = ?
                      AND is_active = true
                )
                """,
                Boolean.class,
                scenarioId
        );

        if (!Boolean.TRUE.equals(active)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "선택할 수 없는 시나리오입니다."
            );
        }

        List<SelectedCase> cases = jdbcTemplate.query(
                """
                SELECT case_id, content::text AS content
                FROM scenario_case
                WHERE scenario_id = ?
                  AND is_active = true
                ORDER BY random()
                LIMIT 1
                """,
                (rs, rowNum) -> new SelectedCase(
                        rs.getObject("case_id", UUID.class),
                        rs.getString("content")
                ),
                scenarioId
        );

        if (cases.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "실행 가능한 사례가 없습니다."
            );
        }

        SelectedCase selectedCase = cases.get(0);

        JsonNode content = jsonMapper.readTree(
                selectedCase.content()
        );

        JsonNode initialState = content.path("initialState");

        if (!initialState.isObject()) {
            throw new IllegalStateException(
                    "initialState가 올바르지 않습니다."
            );
        }

        String currentStepId = initialState
                .path("currentStepId")
                .asText();

        if (currentStepId.isBlank()) {
            throw new IllegalStateException(
                    "초기 단계 ID가 없습니다."
            );
        }

        ObjectNode state =
                (ObjectNode) initialState.deepCopy();

        ObjectNode selectedVariants =
                jsonMapper.createObjectNode();

        selectVariants(
                content.path("messages"),
                "textVariants",
                selectedVariants
        );

        selectVariants(
                content.path("questions"),
                "answerVariants",
                selectedVariants
        );

        selectVariants(
                content.path("phoneInquiries"),
                "answerVariants",
                selectedVariants
        );

        state.set("selectedVariants", selectedVariants);

        UUID sessionId = UUID.randomUUID();

        jdbcTemplate.update(
                """
                INSERT INTO play_session (
                    session_id,
                    case_id
                )
                VALUES (?, ?)
                """,
                sessionId,
                selectedCase.caseId()
        );

        jdbcTemplate.update(
                """
                INSERT INTO play_session_state (
                    session_id,
                    current_step_id,
                    state_data
                )
                VALUES (?, ?, CAST(? AS jsonb))
                """,
                sessionId,
                currentStepId,
                state.toString()
        );

        List<Map<String, Object>> initialMessages =
                new ArrayList<>();

        JsonNode unlockedIds =
                initialState.path("unlockedMessageIds");

        if (!unlockedIds.isArray()) {
            throw new IllegalStateException(
                    "unlockedMessageIds가 올바르지 않습니다."
            );
        }

        for (JsonNode idNode : unlockedIds) {

            String messageId = idNode.asText();

            JsonNode message = findById(
                    content.path("messages"),
                    messageId
            );

            Map<String, Object> response =
                    new LinkedHashMap<>();

            response.put("id", messageId);
            response.put(
                    "senderId",
                    message.path("senderId").asText()
            );
            response.put(
                    "channel",
                    message.path("channel").asText()
            );
            response.put(
                    "sentAt",
                    message.path("sentAt").asText()
            );
            response.put(
                    "text",
                    selectedVariants.path(messageId).asText()
            );

            initialMessages.add(response);
        }

        return Map.of(
                "sessionId", sessionId.toString(),
                "scenarioId", scenarioId,
                "currentStepId", currentStepId,
                "jobPosting",
                content.path("scenarioData")
                        .path("jobPosting"),
                "messages", initialMessages
        );
    }

    private void selectVariants(
            JsonNode items,
            String variantField,
            ObjectNode selectedVariants
    ) {
        if (!items.isArray()) {
            throw new IllegalStateException(
                    "콘텐츠 배열이 올바르지 않습니다."
            );
        }

        for (JsonNode item : items) {

            String id = item.path("id").asText();
            JsonNode variants = item.path(variantField);

            if (id.isBlank()
                    || !variants.isArray()
                    || variants.isEmpty()) {
                throw new IllegalStateException(
                        "문구 데이터가 올바르지 않습니다: " + id
                );
            }

            int index = ThreadLocalRandom.current()
                    .nextInt(variants.size());

            selectedVariants.put(
                    id,
                    variants.get(index).asText()
            );
        }
    }

    private JsonNode findById(JsonNode items, String id) {

        if (!items.isArray()) {
            throw new IllegalStateException(
                    "메시지 목록이 올바르지 않습니다."
            );
        }

        for (JsonNode item : items) {
            if (id.equals(item.path("id").asText())) {
                return item;
            }
        }

        throw new IllegalStateException(
                "메시지를 찾을 수 없습니다: " + id
        );
    }

    private record SelectedCase(
            UUID caseId,
            String content
    ) {}
}