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
public class ComputerPageEventHandler implements EventHandler {

    @Override
    public boolean supports(String scenarioId, String eventName) {
        return switch (eventName) {
            case "COMPUTER_PAGE_VIEWED",
                 "DETAIL_VIEWED",
                 "OFFICIAL_INFO_VIEWED" -> true;
            default -> false;
        };
    }

    @Override
    public EventResult handle(EventContext context) {

        String eventName = context.eventName();
        String targetId = context.targetId();
        JsonNode content = context.content();
        JsonNode state = context.state();

        JsonNode page = findById(
                content.path("computerPages"),
                targetId
        );

        String requiredPageType = switch (eventName) {
            case "COMPUTER_PAGE_VIEWED" -> "GENERAL";
            case "DETAIL_VIEWED" -> "DETAIL";
            case "OFFICIAL_INFO_VIEWED" -> "OFFICIAL";
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "지원하지 않는 컴퓨터 페이지 이벤트입니다."
            );
        };

        String actualPageType = page.path("pageType").asText();

        if (actualPageType.isBlank()) {
            throw new IllegalStateException(
                    "시나리오 JSON에 pageType이 없습니다: " + targetId
            );
        }

        if (!requiredPageType.equals(actualPageType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "이벤트 이름과 페이지 유형이 일치하지 않습니다."
            );
        }

        if (!containsId(
                state.path("unlockedPageIds"),
                targetId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "아직 확인할 수 없는 컴퓨터 페이지입니다."
            );
        }

        Map<String, Object> interaction = new LinkedHashMap<>();

        interaction.put("id", targetId);
        interaction.put("pageType", actualPageType);
        interaction.put(
                "title",
                page.path("title").asText()
        );
        interaction.put(
                "sourceLabel",
                page.path("sourceLabel").asText()
        );
        interaction.put(
                "body",
                page.path("body").asText()
        );

        return new EventResult(interaction);
    }

    private JsonNode findById(JsonNode pages, String targetId) {

        if (pages.isArray()) {
            for (JsonNode page : pages) {
                if (targetId.equals(page.path("id").asText())) {
                    return page;
                }
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "존재하지 않는 컴퓨터 페이지 ID입니다: " + targetId
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