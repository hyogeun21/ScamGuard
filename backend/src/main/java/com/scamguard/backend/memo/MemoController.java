
package com.scamguard.backend.memo;

import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
public class MemoController {

    private final MemoService memoService;

    public MemoController(MemoService memoService) {
        this.memoService = memoService;
    }

    @PutMapping("/{sessionId}/memo")
    public Map<String, Object> saveMemo(
            @PathVariable UUID sessionId,
            @Valid @RequestBody MemoRequest request
    ) {
        return memoService.saveMemo(
                sessionId,
                request.memoText()
        );
    }

    @GetMapping("/{sessionId}/memo")
    public Map<String, Object> getMemo(
            @PathVariable UUID sessionId
    ) {
        return memoService.getMemo(sessionId);
    }

    public record MemoRequest(
            @NotNull
            @Size(max = 5000)
            String memoText
    ) {}
}