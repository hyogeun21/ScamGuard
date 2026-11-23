package com.scamguard.backend.result;

import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
public class ResultController {

    private final ResultService resultService;

    public ResultController(
            ResultService resultService
    ) {
        this.resultService = resultService;
    }

    @GetMapping("/{sessionId}/result")
    public Map<String, Object> getResult(
            @PathVariable UUID sessionId
    ) {
        return resultService.getResult(sessionId);
    }
}