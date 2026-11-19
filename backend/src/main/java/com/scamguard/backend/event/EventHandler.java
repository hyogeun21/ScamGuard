package com.scamguard.backend.event;

public interface EventHandler {

    boolean supports(String scenarioId, String eventName);

    EventResult handle(EventContext context);
}