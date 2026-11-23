package com.scamguard.backend.event;

import java.util.Map;

public record EventResult(
        Map<String, Object> interaction
) {
}