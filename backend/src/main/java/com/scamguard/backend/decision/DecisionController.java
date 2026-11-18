package com.scamguard.backend.decision;

import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
public class DecisionController {

    private final DecisionService decisionService;

    public DecisionController(
            DecisionService decisionService
    ) {
        this.decisionService = decisionService;
    }

    @PostMapping("/{sessionId}/decision")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> submitDecision(
            @PathVariable UUID sessionId,
            @Valid @RequestBody DecisionRequest request
    ) {
        return decisionService.submitDecision(
                sessionId,
                request.judgment(),
                request.responseAction(),
                request.reason()
        );
    }

    public record DecisionRequest(

            @NotBlank
            @Pattern(regexp = "NORMAL|SCAM")
            String judgment,

            @NotBlank
            @Pattern(
                    regexp = "CONTINUE_OFFICIAL|VERIFY_OFFICIAL"
                            + "|STOP_AND_REPORT|SUBMIT_UNVERIFIED"
            )
            String responseAction,

            @NotBlank
            @Size(max = 2000)
            String reason

    ) {}
}