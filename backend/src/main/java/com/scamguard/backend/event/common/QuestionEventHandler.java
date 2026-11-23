package com.scamguard.backend.event.common;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.scamguard.backend.event.EventContext;
import com.scamguard.backend.event.EventHandler;
import com.scamguard.backend.event.EventResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class QuestionEventHandler implements EventHandler {

    @Override
    public boolean supports(String scenarioId, String eventName) {
        return "QUESTION_SELECTED".equals(eventName);
    }

    @Override
    public EventResult handle(EventContext context) {

        String targetId = context.targetId();
        JsonNode content = context.content();
        ObjectNode state = context.state();

        JsonNode question = findById(
                content.path("questions"),
                targetId
        );

        if (!containsId(
                state.path("unlockedQuestionIds"),
                targetId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "아직 선택할 수 없는 질문입니다."
            );
        }

        ArrayNode usedQuestionIds = getOrCreateArray(
                state,
                "usedQuestionIds"
        );

        if (containsId(usedQuestionIds, targetId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 선택한 질문입니다."
            );
        }

        JsonNode selectedAnswer = state
                .path("selectedVariants")
                .path(targetId);

        if (!selectedAnswer.isTextual()) {
            throw new IllegalStateException(
                    "세션에 선택된 질문 답변이 없습니다: " + targetId
            );
        }

        usedQuestionIds.add(targetId);
        Map<String, Object> interaction = new LinkedHashMap<>();

        interaction.put("id", targetId);
        interaction.put(
                "prompt",
                question.path("prompt").asText()
        );
        interaction.put(
                "responderId",
                question.path("responderId").asText()
        );
        interaction.put(
                "answer",
                selectedAnswer.asText()
        );

        return new EventResult(interaction);
    }

    private JsonNode findById(JsonNode questions, String targetId) {

        if (questions.isArray()) {
            for (JsonNode question : questions) {
                if (targetId.equals(question.path("id").asText())) {
                    return question;
                }
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "존재하지 않는 질문 ID입니다: " + targetId
        );
    }

    private boolean containsId(JsonNode ids, String targetId) {

        if (!ids.isArray()) {
            return false;
        }

        for (JsonNode id : ids) {
            if (targetId.equals(id.asText())) {
                return true;
            }
        }

        return false;
    }

    private ArrayNode getOrCreateArray(
            ObjectNode state,
            String field
    ) {
        JsonNode existing = state.path(field);

        if (existing.isMissingNode()) {
            ArrayNode array = state.arrayNode();
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
}