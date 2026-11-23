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
public class PhoneEventHandler implements EventHandler {

    @Override
    public boolean supports(String scenarioId, String eventName) {
        return switch (eventName) {
            case "PHONE_CALL_STARTED",
                 "PHONE_INQUIRY_SELECTED" -> true;
            default -> false;
        };
    }

    @Override
    public EventResult handle(EventContext context) {

        return switch (context.eventName()) {
            case "PHONE_CALL_STARTED" ->
                    handlePhoneCallStarted(context);

            case "PHONE_INQUIRY_SELECTED" ->
                    handlePhoneInquirySelected(context);

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "지원하지 않는 전화 이벤트입니다."
            );
        };
    }

    private EventResult handlePhoneCallStarted(
            EventContext context
    ) {
        String targetId = context.targetId();
        JsonNode content = context.content();
        JsonNode state = context.state();

        JsonNode actor = findById(
                content.path("actors"),
                targetId
        );

        if (!"OFFICIAL_HR".equals(
                actor.path("role").asText()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "공식 전화 문의 대상이 아닙니다."
            );
        }

        boolean available = false;

        for (JsonNode inquiry : content.path("phoneInquiries")) {
            boolean sameContact = targetId.equals(
                    inquiry.path("contactActorId").asText()
            );

            boolean unlocked = containsId(
                    state.path("unlockedInquiryIds"),
                    inquiry.path("id").asText()
            );

            if (sameContact && unlocked) {
                available = true;
                break;
            }
        }

        if (!available) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "현재 통화할 수 없는 대상입니다."
            );
        }

        Map<String, Object> interaction = new LinkedHashMap<>();

        interaction.put("id", targetId);
        interaction.put("contactActorId", targetId);
        interaction.put(
                "displayName",
                actor.path("displayName").asText()
        );
        interaction.put(
                "role",
                actor.path("role").asText()
        );

        return new EventResult(interaction);
    }

    private EventResult handlePhoneInquirySelected(
            EventContext context
    ) {
        String targetId = context.targetId();
        JsonNode content = context.content();
        ObjectNode state = context.state();

        JsonNode inquiry = findById(
                content.path("phoneInquiries"),
                targetId
        );

        if (!containsId(
                state.path("unlockedInquiryIds"),
                targetId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "아직 선택할 수 없는 전화 문의입니다."
            );
        }

        ArrayNode usedInquiryIds = getOrCreateArray(
                state,
                "usedInquiryIds"
        );

        if (containsId(usedInquiryIds, targetId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 선택한 전화 문의입니다."
            );
        }

        JsonNode selectedAnswer = state
                .path("selectedVariants")
                .path(targetId);

        if (!selectedAnswer.isTextual()) {
            throw new IllegalStateException(
                    "세션에 선택된 전화 답변이 없습니다: " + targetId
            );
        }

        usedInquiryIds.add(targetId);
        Map<String, Object> interaction = new LinkedHashMap<>();

        interaction.put("id", targetId);
        interaction.put(
                "contactActorId",
                inquiry.path("contactActorId").asText()
        );
        interaction.put(
                "questionText",
                inquiry.path("questionText").asText()
        );
        interaction.put(
                "answer",
                selectedAnswer.asText()
        );

        return new EventResult(interaction);
    }

    private JsonNode findById(
            JsonNode items,
            String targetId
    ) {
        if (items.isArray()) {
            for (JsonNode item : items) {
                if (targetId.equals(item.path("id").asText())) {
                    return item;
                }
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "존재하지 않는 콘텐츠 ID입니다: " + targetId
        );
    }

    private boolean containsId(
            JsonNode ids,
            String targetId
    ) {
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