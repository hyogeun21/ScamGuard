package com.scamguard.backend.session;

import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
public class SessionAbandonController {

    private final SessionAbandonService sessionAbandonService;

    public SessionAbandonController(
            SessionAbandonService sessionAbandonService
    ) {
        this.sessionAbandonService =
                sessionAbandonService;
    }

    @PostMapping("/{sessionId}/abandon")
    public Map<String, Object> abandonSession(
            @PathVariable UUID sessionId
    ) {
        return sessionAbandonService.abandonSession(
                sessionId
        );
    }
}