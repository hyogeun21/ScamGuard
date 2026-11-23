package com.scamguard.ai;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

public final class FeedbackSample {
    public static void main(String[] args) {
        if (args.length != 1) {
            System.err.println("평가 입력 JSON 파일 경로를 지정하세요.");
            System.exit(2);
        }
        String key = System.getenv("ANTHROPIC_API_KEY");
        if (key == null || key.isBlank()) {
            System.err.println("ANTHROPIC_API_KEY 설정이 필요합니다.");
            System.exit(2);
        }
        String model = System.getenv().getOrDefault("ANTHROPIC_MODEL", "claude-sonnet-5");
        var client = AnthropicOkHttpClient.builder().apiKey(key)
                .timeout(Duration.ofSeconds(20)).maxRetries(0).build();
        int status = 0;
        try {
            var feedback = new FeedbackClient(client, model).generate(Files.readString(Path.of(args[0])));
            System.out.println(feedback.toPrettyString());
        } catch (Exception e) {
            System.err.println("피드백 생성 실패 (" + e.getClass().getSimpleName() + ")");
            status = 1;
        } finally {
            client.close();
        }
        System.exit(status);
    }
}
