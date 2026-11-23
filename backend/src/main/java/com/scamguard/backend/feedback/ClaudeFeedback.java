package com.scamguard.backend.feedback;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.scamguard.ai.FeedbackClient;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import jakarta.annotation.PreDestroy;

@Component
class ClaudeFeedback {
    private final AnthropicClient sdk;
    private final FeedbackClient client;

    @Autowired
    ClaudeFeedback(
            @Value("${scamguard.ai.enabled:false}") boolean enabled,
            @Value("${scamguard.ai.api-key:}") String key,
            @Value("${scamguard.ai.model:claude-sonnet-5}") String model,
            @Value("${scamguard.ai.timeout:20s}") Duration timeout
    ) {
        this(enabled && !key.isBlank()
                ? AnthropicOkHttpClient.builder().apiKey(key).timeout(timeout).maxRetries(0).build()
                : null, model);
    }

    ClaudeFeedback(AnthropicClient sdk, String model) {
        this.sdk = sdk;
        client = sdk == null ? null : new FeedbackClient(sdk, model);
    }

    Optional<String> generate(String input) throws IOException {
        return client == null ? Optional.empty() : Optional.of(client.generateJson(input));
    }

    @PreDestroy
    void close() {
        if (sdk != null) {
            sdk.close();
        }
    }
}
