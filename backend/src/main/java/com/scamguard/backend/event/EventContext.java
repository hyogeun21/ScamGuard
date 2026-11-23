package com.scamguard.backend.event;

import java.util.UUID;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

public record EventContext(
        UUID sessionId,
        String scenarioId,
        String eventName,
        String targetId,
        String selectedResult,
        JsonNode content,
        ObjectNode state
) {
}