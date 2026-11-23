package com.scamguard.backend.feedback;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(
            FeedbackService feedbackService
    ) {
        this.feedbackService = feedbackService;
    }

    @PostMapping("/{sessionId}/feedback")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> generateFeedback(
            @PathVariable UUID sessionId
    ) {
        return feedbackService.generateFeedback(sessionId);
    }
}