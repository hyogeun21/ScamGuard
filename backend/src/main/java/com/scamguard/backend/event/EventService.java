package com.scamguard.backend.event;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private final List<EventHandler> eventHandlers;


    private void applySettlementUpdates(
            UUID sessionId,
            String eventName,
            String targetId,
            JsonNode effects,
            ObjectNode state
    ) {
        JsonNode updates = effects.path("settlementUpdates");

        if (updates.isMissingNode()) {
            return;
        }

        if (!updates.isArray()) {
            throw new IllegalStateException(
                    "정산 변경 데이터가 배열이 아닙니다."
            );
        }

        for (JsonNode update : updates) {

            String settlementId =
                    update.path("settlementId").asText();

            String settlementStatus =
                    update.path("settlementStatus").asText();

            JsonNode paidAmountNode =
                    update.path("paidAmount");

            JsonNode requiredCorrectResult =
                    update.path("requiredCorrectResult");

            if (settlementId.isBlank()
                    || !List.of(
                    "PENDING",
                    "AVAILABLE",
                    "PAID",
                    "BLOCKED"
            ).contains(settlementStatus)
                    || !paidAmountNode.isIntegralNumber()
                    || !paidAmountNode.canConvertToInt()
                    || paidAmountNode.asInt() < 0) {

                throw new IllegalStateException(
                        "정산 변경 데이터가 올바르지 않습니다: "
                                + settlementId
                );
            }

            if (!requiredCorrectResult.isMissingNode()) {

                if (!requiredCorrectResult.isBoolean()) {
                    throw new IllegalStateException(
                            "requiredCorrectResult는 boolean이어야 합니다."
                    );
                }

                if (!"WORK_TASK_COMPLETED".equals(eventName)) {
                    throw new IllegalStateException(
                            "업무 검수 이벤트가 아닌 곳에서 정답 조건을 사용했습니다."
                    );
                }

                JsonNode taskResult = state
                        .path("completedTaskResults")
                        .path(targetId);

                JsonNode correctNode =
                        taskResult.path("correct");

                if (!correctNode.isBoolean()) {
                    throw new IllegalStateException(
                            "검수 정답 기록을 찾을 수 없습니다: "
                                    + targetId
                    );
                }

                boolean actualCorrect =
                        correctNode.asBoolean();

                boolean expectedCorrect =
                        requiredCorrectResult.asBoolean();

                if (actualCorrect != expectedCorrect) {
                    continue;
                }
            }

            int updatedRows = jdbcTemplate.update(
                    """
                    UPDATE session_settlement
                    SET settlement_status = ?,
                        paid_amount = ?,
                        updated_at = now()
                    WHERE session_id = ?
                      AND settlement_id = ?
                      AND task_id = ?
                    """,
                    settlementStatus,
                    paidAmountNode.asInt(),
                    sessionId,
                    settlementId,
                    targetId
            );

            if (updatedRows != 1) {
                throw new IllegalStateException(
                        "정산 변경 대상을 찾을 수 없습니다: "
                                + settlementId
                );
            }
        }
    }


    private void applyWithdrawalPolicyUpdate(
            JsonNode effects,
            ObjectNode state
    ) {
        JsonNode policyUpdate =
                effects.path("withdrawalPolicyUpdate");

        if (policyUpdate.isMissingNode()) {
            return;
        }

        if (!policyUpdate.isObject()) {
            throw new IllegalStateException(
                    "출금 정책 변경 데이터가 올바르지 않습니다."
            );
        }

        JsonNode existingPolicy =
                state.path("withdrawalPolicy");

        if (!existingPolicy.isObject()) {
            throw new IllegalStateException(
                    "현재 출금 정책이 존재하지 않습니다."
            );
        }

        ObjectNode policy =
                (ObjectNode) existingPolicy;

        policy.setAll((ObjectNode) policyUpdate);
    }


    private List<Map<String, Object>> getSessionSettlements(
            UUID sessionId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    settlement_id,
                    task_id,
                    settlement_status,
                    paid_amount
                FROM session_settlement
                WHERE session_id = ?
                ORDER BY settlement_id
                """,
                (rs, rowNum) -> {
                    Map<String, Object> settlement =
                            new LinkedHashMap<>();

                    settlement.put(
                            "id",
                            rs.getString("settlement_id")
                    );

                    settlement.put(
                            "taskId",
                            rs.getString("task_id")
                    );

                    settlement.put(
                            "settlementStatus",
                            rs.getString("settlement_status")
                    );

                    settlement.put(
                            "paidAmount",
                            rs.getInt("paid_amount")
                    );

                    return settlement;
                },
                sessionId
        );
    }

    public EventService(
            JdbcTemplate jdbcTemplate,
            JsonMapper jsonMapper,
            List<EventHandler> eventHandlers
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
        this.eventHandlers = eventHandlers;
    }

    @Transactional
    public Map<String, Object> processEvent(
            UUID eventId,
            UUID sessionId,
            String eventName,
            String targetId,
            Long elapsedMs,
            String selectedResult
    ) {
        List<SessionData> sessions = jdbcTemplate.query(
                """
                SELECT
                    ps.status,
                    sc.scenario_id,
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
                        rs.getString("scenario_id"),
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

        List<ExistingEvent> existingEvents = jdbcTemplate.query(
                """
                SELECT
                    session_id,
                    event_name,
                    target_id,
                    elapsed_ms,
                    event_data::text AS event_data
                FROM action_event
                WHERE event_id = ?
                """,
                (rs, rowNum) -> {
                    Object elapsedValue =
                            rs.getObject("elapsed_ms");

                    Long savedElapsedMs =
                            elapsedValue == null
                                    ? null
                                    : ((Number) elapsedValue).longValue();

                    return new ExistingEvent(
                            (UUID) rs.getObject("session_id"),
                            rs.getString("event_name"),
                            rs.getString("target_id"),
                            savedElapsedMs,
                            rs.getString("event_data")
                    );
                },
                eventId
        );

        if (!existingEvents.isEmpty()) {
            ExistingEvent existing = existingEvents.get(0);

            JsonNode previousEventData = jsonMapper.readTree(
                    existing.eventData()
            );

            JsonNode previousSelectedResult =
                    previousEventData.path("selectedResult");

            String savedSelectedResult =
                    previousSelectedResult.isMissingNode()
                            ? null
                            : previousSelectedResult.asText();

            boolean sameRequest =
                    sessionId.equals(existing.sessionId())
                            && eventName.equals(existing.eventName())
                            && targetId.equals(existing.targetId())
                            && Objects.equals(
                                    elapsedMs,
                                    existing.elapsedMs()
                            )
                            && Objects.equals(
                                    selectedResult,
                                    savedSelectedResult
                            );

            if (!sameRequest) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "동일 eventId에 다른 요청 데이터가 사용되었습니다."
                );
            }

            return restoreEventResponse(
                    eventId,
                    existing.eventData()
            );
        }

        if (!"IN_PROGRESS".equals(session.status())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "진행 중인 게임 세션이 아닙니다."
            );
        }

        ObjectNode state =
                (ObjectNode) jsonMapper.readTree(
                        session.stateData()
                );

        JsonNode content =
                jsonMapper.readTree(
                        session.content()
                );

        String currentStepId =
                session.currentStepId();

        if (currentStepId == null || currentStepId.isBlank()) {
            throw new IllegalStateException(
                    "현재 게임 단계가 없습니다."
            );
        }

        EventHandler handler = findHandler(
                session.scenarioId(),
                eventName
        );

        EventContext context = new EventContext(
                sessionId,
                session.scenarioId(),
                eventName,
                targetId,
                selectedResult,
                content,
                state
        );

        EventResult eventResult =
                handler.handle(context);

        Map<String, Object> interaction =
                eventResult.interaction();

        List<Map<String, Object>> newlyUnlockedMessages =
                new ArrayList<>();

        JsonNode selectedVariants =
                state.path("selectedVariants");

        for (JsonNode trigger : content.path("triggers")) {

            if (!"ACTION_COMPLETED".equals(
                    trigger.path("conditionType").asText()
            )) {
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

            if ("SIDE".equals(session.scenarioId())) {
                applySettlementUpdates(
                        sessionId,
                        eventName,
                        targetId,
                        effects,
                        state
                );

                applyWithdrawalPolicyUpdate(
                        effects,
                        state
                );
            }

            unlockIds(
                    state,
                    effects,
                    "unlockedMessageIds",
                    "unlockMessageIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            unlockIds(
                    state,
                    effects,
                    "unlockedQuestionIds",
                    "unlockQuestionIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            unlockIds(
                    state,
                    effects,
                    "unlockedPageIds",
                    "unlockPageIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            unlockIds(
                    state,
                    effects,
                    "unlockedInquiryIds",
                    "unlockInquiryIds",
                    content,
                    selectedVariants,
                    newlyUnlockedMessages
            );

            if ("SIDE".equals(session.scenarioId())) {
                unlockIds(
                        state,
                        effects,
                        "unlockedTaskIds",
                        "unlockTaskIds",
                        content,
                        selectedVariants,
                        newlyUnlockedMessages
                );
            }

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

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "eventId",
                eventId.toString()
        );

        response.put(
                "sequenceNo",
                sequenceNo
        );

        response.put(
                "currentStepId",
                currentStepId
        );

        response.put(
                "interaction",
                interaction
        );

        response.put(
                "unlockedMessageIds",
                state.path("unlockedMessageIds")
        );

        response.put(
                "newlyUnlockedMessages",
                newlyUnlockedMessages
        );

        if ("SIDE".equals(session.scenarioId())) {
            response.put(
                    "unlockedTaskIds",
                    state.path("unlockedTaskIds")
            );

            response.put(
                    "settlements",
                    getSessionSettlements(sessionId)
            );

            response.put(
                    "withdrawalPolicy",
                    state.path("withdrawalPolicy")
            );
        }

        ObjectNode eventData =
                jsonMapper.createObjectNode();

        eventData.put("eventName", eventName);
        eventData.put("targetId", targetId);

        if (selectedResult != null) {
            eventData.put("selectedResult", selectedResult);
        }

        eventData.set(
                "response",
                jsonMapper.valueToTree(response)
        );

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

        return response;
    }

    private EventHandler findHandler(
            String scenarioId,
            String eventName
    ) {
        EventHandler matchedHandler = null;

        for (EventHandler handler : eventHandlers) {

            if (!handler.supports(scenarioId, eventName)) {
                continue;
            }

            if (matchedHandler != null) {
                throw new IllegalStateException(
                        "이벤트 Handler가 중복 등록되었습니다: "
                                + scenarioId + "/" + eventName
                );
            }

            matchedHandler = handler;
        }

        if (matchedHandler == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "지원하지 않는 이벤트입니다: " + eventName
            );
        }

        return matchedHandler;
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
        ArrayNode unlocked =
                getOrCreateArray(state, stateField);

        JsonNode ids =
                effects.path(effectField);

        if (ids.isMissingNode()) {
            return;
        }

        if (!ids.isArray()) {
            throw new IllegalStateException(
                    "트리거 해금 정보가 올바르지 않습니다."
                            + effectField
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
                        content.path("messages"),
                        id
                );

                Map<String, Object> messageInteraction =
                        createMessageInteraction(
                                message,
                                selectedVariants
                        );

                newlyUnlockedMessages.add(
                        messageInteraction
                );
            }
        }
    }

    private Map<String, Object> createMessageInteraction(
            JsonNode message,
            JsonNode selectedVariants
    ) {
        String id = message.path("id").asText();

        JsonNode selectedText =
                selectedVariants.path(id);

        if (!selectedText.isTextual()) {
            throw new IllegalStateException(
                    "세션의 선택된 문구가 없습니다: " + id
            );
        }

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put("id", id);

        result.put(
                "senderId",
                message.path("senderId").asText()
        );

        result.put(
                "channel",
                message.path("channel").asText()
        );

        result.put(
                "sentAt",
                message.path("sentAt").asText()
        );

        result.put(
                "text",
                selectedText.asText()
        );

        return result;
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

    private boolean containsId(
            JsonNode array,
            String id
    ) {
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
                if (id.equals(
                        item.path("id").asText()
                )) {
                    return item;
                }
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "존재하지 않는 콘텐츠 ID입니다: " + id
        );
    }

    private Map<String, Object> restoreEventResponse(
            UUID eventId,
            String eventDataJson
    ) {
        JsonNode eventData =
                jsonMapper.readTree(eventDataJson);

        JsonNode savedResponse =
                eventData.path("response");

        if (!savedResponse.isObject()) {
            throw new IllegalStateException(
                    "기존 이벤트의 응답 데이터가 없습니다: "
                            + eventId
            );
        }

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put(
                "eventId",
                savedResponse.path("eventId").asText()
        );

        response.put(
                "sequenceNo",
                savedResponse.path("sequenceNo").asInt()
        );

        response.put(
                "currentStepId",
                savedResponse.path("currentStepId").asText()
        );

        response.put(
                "interaction",
                savedResponse.path("interaction")
        );

        response.put(
                "unlockedMessageIds",
                savedResponse.path("unlockedMessageIds")
        );

        response.put(
                "newlyUnlockedMessages",
                savedResponse.path("newlyUnlockedMessages")
        );

        if (savedResponse.has("unlockedTaskIds")) {
            response.put(
                    "unlockedTaskIds",
                    savedResponse.path("unlockedTaskIds")
            );
        }

        if (savedResponse.has("settlements")) {
            response.put(
                    "settlements",
                    savedResponse.path("settlements")
            );
        }

        if (savedResponse.has("withdrawalPolicy")) {
            response.put(
                    "withdrawalPolicy",
                    savedResponse.path("withdrawalPolicy")
            );
        }

        return response;
    }

    private record SessionData(
            String status,
            String scenarioId,
            String currentStepId,
            String stateData,
            String content
    ) {}

    private record ExistingEvent(
            UUID sessionId,
            String eventName,
            String targetId,
            Long elapsedMs,
            String eventData
    ) {}
}