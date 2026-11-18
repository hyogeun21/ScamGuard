package com.scamguard.backend.event;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class EventService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public EventService(
            JdbcTemplate jdbcTemplate,
            JsonMapper jsonMapper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
    }

    @Transactional
    public Map<String, Object> processEvent(
            UUID sessionId,
            String eventName,
            String targetId,
            Long elapsedMs
    ) {
        List<SessionData> sessions = jdbcTemplate.query(
                """
                SELECT
                    ps.status,
                    pss.current_step_id,
                    pss.state_data::text AS state_data,
                    sc.content::text AS content
                FROM play_session_state pss
                JOIN play_session ps
                    ON ps.session_id = pss.session_id
                JOIN scenario_case sc
                    ON sc.case_id = ps.case_id
                WHERE pss.session_id = ?
                FOR UPDATE OF pss
                """,
                (rs, rowNum) -> new SessionData(
                        rs.getString("status"),
                        rs.getString("current_step_id"),
                        rs.getString("state_data"),
                        rs.getString("content")
                ),
                sessionId
        );

        if (sessions.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "게임 세션을 찾을 수 없습니다."
            );
        }

        SessionData session = sessions.get(0);

        if (!"IN_PROGRESS".equals(session.status())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "진행 중인 게임 세션이 아닙니다."
            );
        }

        ObjectNode state =
                (ObjectNode) jsonMapper.readTree(session.stateData());

        JsonNode content =
                jsonMapper.readTree(session.content());

        String currentStepId = session.currentStepId();

        if (currentStepId == null || currentStepId.isBlank()) {
            throw new IllegalStateException(
                    "현재 게임 단계가 없습니다."
            );
        }

        String collectionName;
        String unlockedField;
        String usedField = null;

        switch (eventName) {
            case "MESSAGE_VIEWED" -> {
                collectionName = "messages";
                unlockedField = "unlockedMessageIds";
            }
            case "QUESTION_SELECTED" -> {
                collectionName = "questions";
                unlockedField = "unlockedQuestionIds";
                usedField = "usedQuestionIds";
            }
            case "COMPUTER_PAGE_VIEWED" -> {
                collectionName = "computerPages";
                unlockedField = "unlockedPageIds";
            }
            case "PHONE_INQUIRY_SELECTED" -> {
                collectionName = "phoneInquiries";
                unlockedField = "unlockedInquiryIds";
                usedField = "usedInquiryIds";
            }
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "지원하지 않는 이벤트입니다."
            );
        }

        JsonNode selectedItem = findById(
                content.path(collectionName),
                targetId
        );

        if (!containsId(state.path(unlockedField), targetId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "아직 이용할 수 없는 콘텐츠입니다."
            );
        }

        if (usedField != null) {
            ArrayNode usedIds = getOrCreateArray(
                    state, usedField
            );

            if (containsId(usedIds, targetId)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "이미 선택한 항목입니다."
                );
            }

            usedIds.add(targetId);
        }

        JsonNode selectedVariants =
                state.path("selectedVariants");

        Map<String, Object> interaction =
                createInteraction(
                        eventName,
                        selectedItem,
                        selectedVariants
                );

        List<Map<String, Object>> newlyUnlockedMessages =
                new ArrayList<>();

        for (JsonNode trigger : content.path("triggers")) {

            if (!"ACTION_COMPLETED".equals(
                    trigger.path("conditionType").asText())) {
                continue;
            }

            JsonNode when = trigger.path("when");

            boolean matches =
                    eventName.equals(
                            when.path("eventName").asText()
                    )
                            && targetId.equals(
                            when.path("targetId").asText()
                    )
                            && currentStepId.equals(
                            when.path("stepId").asText()
                    );

            if (!matches) {
                continue;
            }

            JsonNode effects = trigger.path("effects");

            unlockIds(
                    state, effects,
                    "unlockedMessageIds",
                    "unlockMessageIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            unlockIds(
                    state, effects,
                    "unlockedQuestionIds",
                    "unlockQuestionIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            unlockIds(
                    state, effects,
                    "unlockedPageIds",
                    "unlockPageIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            unlockIds(
                    state, effects,
                    "unlockedInquiryIds",
                    "unlockInquiryIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            String nextStepId =
                    effects.path("nextStepId").asText();

            if (!nextStepId.isBlank()) {
                currentStepId = nextStepId;
                state.put("currentStepId", nextStepId);
            }
        }

        Integer sequenceNo = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(MAX(sequence_no), 0) + 1
                FROM action_event
                WHERE session_id = ?
                """,
                Integer.class,
                sessionId
        );

        UUID eventId = UUID.randomUUID();

        ObjectNode eventData = jsonMapper.createObjectNode();
        eventData.put("eventName", eventName);
        eventData.put("targetId", targetId);

        jdbcTemplate.update(
                """
                INSERT INTO action_event (
                    event_id,
                    session_id,
                    event_name,
                    object_id,
                    step_id,
                    target_id,
                    event_data,
                    sequence_no,
                    elapsed_ms
                )
                VALUES (
                    ?, ?, ?, NULL, ?, ?,
                    CAST(? AS jsonb), ?, ?
                )
                """,
                eventId,
                sessionId,
                eventName,
                session.currentStepId(),
                targetId,
                eventData.toString(),
                sequenceNo,
                elapsedMs
        );

        jdbcTemplate.update(
                """
                UPDATE play_session_state
                SET current_step_id = ?,
                    state_data = CAST(? AS jsonb),
                    updated_at = now()
                WHERE session_id = ?
                """,
                currentStepId,
                state.toString(),
                sessionId
        );

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put("eventId", eventId.toString());
        response.put("sequenceNo", sequenceNo);
        response.put("currentStepId", currentStepId);
        response.put("interaction", interaction);
        response.put(
                "unlockedMessageIds",
                state.path("unlockedMessageIds")
        );
        response.put(
                "newlyUnlockedMessages",
                newlyUnlockedMessages
        );

        return response;
    }

    private Map<String, Object> createInteraction(
            String eventName,
            JsonNode item,
            JsonNode selectedVariants
    ) {
        Map<String, Object> result =
                new LinkedHashMap<>();

        String id = item.path("id").asText();
        result.put("id", id);

        switch (eventName) {
            case "MESSAGE_VIEWED" -> {
                result.put(
                        "senderId",
                        item.path("senderId").asText()
                );
                result.put(
                        "channel",
                        item.path("channel").asText()
                );
                result.put(
                        "sentAt",
                        item.path("sentAt").asText()
                );
                result.put(
                        "text",
                        selectedText(selectedVariants, id)
                );
            }
            case "QUESTION_SELECTED" -> {
                result.put(
                        "prompt",
                        item.path("prompt").asText()
                );
                result.put(
                        "responderId",
                        item.path("responderId").asText()
                );
                result.put(
                        "answer",
                        selectedText(selectedVariants, id)
                );
            }
            case "COMPUTER_PAGE_VIEWED" -> {
                result.put(
                        "title",
                        item.path("title").asText()
                );
                result.put(
                        "sourceLabel",
                        item.path("sourceLabel").asText()
                );
                result.put(
                        "body",
                        item.path("body").asText()
                );
            }
            case "PHONE_INQUIRY_SELECTED" -> {
                result.put(
                        "contactActorId",
                        item.path("contactActorId").asText()
                );
                result.put(
                        "questionText",
                        item.path("questionText").asText()
                );
                result.put(
                        "answer",
                        selectedText(selectedVariants, id)
                );
            }
            default -> throw new IllegalArgumentException(
                    "지원하지 않는 이벤트"
            );
        }

        return result;
    }

    private String selectedText(
            JsonNode selectedVariants,
            String id
    ) {
        JsonNode value = selectedVariants.path(id);

        if (!value.isTextual()) {
            throw new IllegalStateException(
                    "세션의 선택된 문구가 없습니다: " + id
            );
        }

        return value.asText();
    }

    private void unlockIds(
            ObjectNode state,
            JsonNode effects,
            String stateField,
            String effectField,
            JsonNode content,
            JsonNode selectedVariants,
            List<Map<String, Object>> newlyUnlockedMessages
    ) {
        ArrayNode unlocked = getOrCreateArray(
                state, stateField
        );

        JsonNode ids = effects.path(effectField);

        if (!ids.isArray()) {
            throw new IllegalStateException(
                    "트리거 해금 정보가 올바르지 않습니다."
            );
        }

        for (JsonNode idNode : ids) {
            String id = idNode.asText();

            if (containsId(unlocked, id)) {
                continue;
            }

            unlocked.add(id);

            if ("unlockedMessageIds".equals(stateField)) {
                JsonNode message = findById(
                        content.path("messages"), id
                );

                newlyUnlockedMessages.add(
                        createInteraction(
                                "MESSAGE_VIEWED",
                                message,
                                selectedVariants
                        )
                );
            }
        }
    }

    private ArrayNode getOrCreateArray(
            ObjectNode state,
            String field
    ) {
        JsonNode existing = state.path(field);

        if (existing.isMissingNode()) {
            ArrayNode array =
                    jsonMapper.createArrayNode();

            state.set(field, array);
            return array;
        }

        if (!existing.isArray()) {
            throw new IllegalStateException(
                    "상태 데이터 오류: " + field
            );
        }

        return (ArrayNode) existing;
    }

    private boolean containsId(JsonNode array, String id) {
        if (!array.isArray()) {
            return false;
        }

        for (JsonNode value : array) {
            if (id.equals(value.asText())) {
                return true;
            }
        }

        return false;
    }

    private JsonNode findById(
            JsonNode items,
            String id
    ) {
        if (items.isArray()) {
            for (JsonNode item : items) {
                if (id.equals(item.path("id").asText())) {
                    return item;
                }
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "존재하지 않는 콘텐츠 ID입니다: " + id
        );
    }

    private record SessionData(
            String status,
            String currentStepId,
            String stateData,
            String content
    ) {}
}