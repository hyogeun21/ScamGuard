package com.scamguard.backend.event;

import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @PostMapping
    public Map<String, Object> createEvent(
            @Valid @RequestBody EventRequest request
    ) {
        return eventService.processEvent(
                request.eventId(),
                request.sessionId(),
                request.eventName(),
                request.targetId(),
                request.elapsedMs(),
                request.selectedResult()
        );
    }

    public record EventRequest(
            @NotNull UUID eventId,
            @NotNull UUID sessionId,
            @NotBlank String eventName,
            @NotBlank String targetId,
            @Min(0) Long elapsedMs,
            String selectedResult
    ) {}
}