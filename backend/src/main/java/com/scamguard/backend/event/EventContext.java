package com.scamguard.backend.event;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

public record EventContext(
        String scenarioId,
        String eventName,
        String targetId,
        JsonNode content,
        ObjectNode state
) {
}