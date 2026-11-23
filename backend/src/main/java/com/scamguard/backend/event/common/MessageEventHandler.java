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

@Component
public class MessageEventHandler implements EventHandler {

    @Override
    public boolean supports(String scenarioId, String eventName) {
        return "MESSAGE_VIEWED".equals(eventName);
    }

    @Override
    public EventResult handle(EventContext context) {

        String targetId = context.targetId();
        JsonNode content = context.content();
        JsonNode state = context.state();

        JsonNode message = findById(
                content.path("messages"),
                targetId
        );

        if (!containsId(
                state.path("unlockedMessageIds"),
                targetId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "아직 확인할 수 없는 메시지입니다."
            );
        }

        JsonNode selectedText = state
                .path("selectedVariants")
                .path(targetId);

        if (!selectedText.isTextual()) {
            throw new IllegalStateException(
                    "세션에 선택된 메시지 문구가 없습니다: " + targetId
            );
        }

        Map<String, Object> interaction = new LinkedHashMap<>();

        interaction.put("id", targetId);
        interaction.put(
                "senderId",
                message.path("senderId").asText()
        );
        interaction.put(
                "channel",
                message.path("channel").asText()
        );
        interaction.put(
                "sentAt",
                message.path("sentAt").asText()
        );
        interaction.put(
                "text",
                selectedText.asText()
        );

        return new EventResult(interaction);
    }

    private JsonNode findById(JsonNode messages, String targetId) {

        if (messages.isArray()) {
            for (JsonNode message : messages) {
                if (targetId.equals(message.path("id").asText())) {
                    return message;
                }
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "존재하지 않는 메시지 ID입니다: " + targetId
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
}