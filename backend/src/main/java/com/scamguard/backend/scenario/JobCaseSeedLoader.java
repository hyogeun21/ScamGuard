package com.scamguard.backend.scenario;

import java.nio.charset.StandardCharsets;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
@ConditionalOnProperty(
        name = "scamguard.seed.job-enabled",
        havingValue = "true"
)
public class JobCaseSeedLoader implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;
    private final TransactionTemplate transactionTemplate;

    public JobCaseSeedLoader(
            JdbcTemplate jdbcTemplate,
            JsonMapper jsonMapper,
            TransactionTemplate transactionTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
        this.transactionTemplate = transactionTemplate;
    }

    @Override
    public void run(String... args) throws Exception {

        String[] files = {
                "1_normal_easy.json",
                "1_normal_medium.json",
                "1_normal_hard.json",
                "1_scam_easy.json",
                "1_scam_medium.json",
                "1_scam_hard.json"
        };

        transactionTemplate.executeWithoutResult(status -> {
            for (String filename : files) {
                try {
                    updateCase(filename);
                } catch (Exception e) {
                    throw new IllegalStateException(
                            "JSON 저장 실패: " + filename, e
                    );
                }
            }
        });

    }

    private void updateCase(String filename) throws Exception {

        ClassPathResource resource = new ClassPathResource(
                "seed/job/" + filename
        );

        String text;

        try (var input = resource.getInputStream()) {
            text = new String(
                    input.readAllBytes(),
                    StandardCharsets.UTF_8
            );
        }

        JsonNode root = jsonMapper.readTree(text);

        String scenarioId =
                root.path("scenarioId").asText();

        String caseType =
                root.path("caseType").asText();

        String difficulty =
                root.path("difficulty").asText();

        JsonNode content = root.path("content");
        JsonNode evaluationRules =
                root.path("evaluationRules");

        if (!"JOB".equals(scenarioId)
                || content.isMissingNode()
                || evaluationRules.isMissingNode()
                || !content.isObject()
                || !evaluationRules.isObject()) {
            throw new IllegalArgumentException(
                    "JSON 구조가 올바르지 않습니다: " + filename
            );
        }

        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM scenario_case
                WHERE scenario_id = ?
                  AND case_type = ?
                  AND difficulty = ?
                """,
                Integer.class,
                scenarioId,
                caseType,
                difficulty
        );

        if (count == null || count != 1) {
            throw new IllegalStateException(
                    "일치하는 사례가 정확히 1개여야 합니다: "
                            + filename + " (현재 " + count + "개)"
            );
        }

        int updated = jdbcTemplate.update(
                """
                UPDATE scenario_case
                SET content = CAST(? AS jsonb),
                    evaluation_rules = CAST(? AS jsonb),
                    is_active = true
                WHERE scenario_id = ?
                  AND case_type = ?
                  AND difficulty = ?
                """,
                content.toString(),
                evaluationRules.toString(),
                scenarioId,
                caseType,
                difficulty
        );

        if (updated != 1) {
            throw new IllegalStateException(
                    "업데이트된 행 개수 오류: " + filename
            );
        }

    }
}