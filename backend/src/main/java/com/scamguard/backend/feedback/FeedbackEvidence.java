package com.scamguard.backend.feedback;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import tools.jackson.databind.JsonNode;

final class FeedbackEvidence {
    static List<Map<String, String>> verifiedFacts(JsonNode content, List<Action> actions) {
        Set<Source> viewed = actions.stream()
                .map(action -> new Source(action.eventName(), action.targetId()))
                .collect(Collectors.toSet());

        return content.path("evidence").valueStream()
                .filter(evidence -> evidence.path("sourceId").isString() && evidence.path("fact").isString())
                .map(evidence -> {
                    String id = evidence.path("sourceId").asText();
                    String event = eventFor(content, evidence.path("sourceType").asText(), id);
                    String fact = evidence.path("fact").asText();
                    if (event == null || fact.isBlank() || !viewed.contains(new Source(event, id))) {
                        return null;
                    }
                    return Map.of("sourceId", id, "eventName", event, "fact", fact);
                })
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private static String eventFor(JsonNode content, String kind, String id) {
        return switch (kind) {
            case "MESSAGE" -> "MESSAGE_VIEWED";
            case "PHONE_INQUIRY" -> "PHONE_INQUIRY_SELECTED";
            case "QUESTION" -> "QUESTION_SELECTED";
            case "SETTLEMENT" -> "SETTLEMENT_VIEWED";
            case "COMPUTER_PAGE" -> content.path("computerPages").valueStream()
                    .filter(page -> id.equals(page.path("id").asText()))
                    .findFirst()
                    .map(page -> switch (page.path("pageType").asText()) {
                        case "GENERAL" -> "COMPUTER_PAGE_VIEWED";
                        case "DETAIL" -> "DETAIL_VIEWED";
                        case "OFFICIAL" -> "OFFICIAL_INFO_VIEWED";
                        default -> null;
                    })
                    .orElse(null);
            default -> null;
        };
    }

    record Action(String eventName, String targetId, int sequenceNo) {}

    private record Source(String eventName, String targetId) {}
}
