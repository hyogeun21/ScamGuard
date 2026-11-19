package com.scamguard.backend.scenario;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

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
    public void run(String... args) {
        String[] files = {
                "2_normal_easy.json",
                "2_normal_medium.json",
                "2_normal_hard.json",
                "2_scam_easy.json",
                "2_scam_medium.json",
                "2_scam_hard.json"
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

        String scenarioId = root.path("scenarioId").asText();
        String caseType = root.path("caseType").asText();
        String difficulty = root.path("difficulty").asText();

        JsonNode content = root.path("content");
        JsonNode evaluationRules = root.path("evaluationRules");

        String companyName = content.path("scenarioData")
                .path("jobPosting")
                .path("companyName")
                .asText();

        if (!"JOB".equals(scenarioId)
                || !("NORMAL".equals(caseType)
                || "SCAM".equals(caseType))
                || !("EASY".equals(difficulty)
                || "MEDIUM".equals(difficulty)
                || "HARD".equals(difficulty))
                || !content.isObject()
                || !evaluationRules.isObject()
                || !"한빛IT솔루션".equals(companyName)) {

            throw new IllegalArgumentException(
                    "JSON 구조 또는 기업 정보가 올바르지 않습니다: "
                            + filename
            );
        }

        UUID caseId = findCaseId(
                filename,
                scenarioId,
                caseType,
                difficulty,
                companyName
        );

        int updated = jdbcTemplate.update(
                """
                UPDATE scenario_case
                SET content = CAST(? AS jsonb),
                    evaluation_rules = CAST(? AS jsonb),
                    is_active = true
                WHERE case_id = ?
                """,
                content.toString(),
                evaluationRules.toString(),
                caseId
        );

        if (updated != 1) {
            throw new IllegalStateException(
                    "업데이트된 행 개수 오류: "
                            + filename
                            + " (현재 " + updated + "개)"
            );
        }
    }

    private UUID findCaseId(
            String filename,
            String scenarioId,
            String caseType,
            String difficulty,
            String companyName
    ) {

        List<UUID> registeredIds = jdbcTemplate.query(
                """
                SELECT case_id
                FROM scenario_case
                WHERE scenario_id = ?
                  AND case_type = ?
                  AND difficulty = ?
                  AND content #>> '{scenarioData,jobPosting,companyName}' = ?
                """,
                (rs, rowNum) ->
                        rs.getObject("case_id", UUID.class),
                scenarioId,
                caseType,
                difficulty,
                companyName
        );

        if (registeredIds.size() == 1) {
            return registeredIds.get(0);
        }

        if (registeredIds.size() > 1) {
            throw new IllegalStateException(
                    "같은 기업의 사례가 중복 등록되어 있습니다: "
                            + filename
            );
        }

        List<UUID> emptyIds = jdbcTemplate.query(
                """
                SELECT case_id
                FROM scenario_case
                WHERE scenario_id = ?
                  AND case_type = ?
                  AND difficulty = ?
                  AND content = '{}'::jsonb
                  AND evaluation_rules = '{}'::jsonb
                """,
                (rs, rowNum) ->
                        rs.getObject("case_id", UUID.class),
                scenarioId,
                caseType,
                difficulty
        );

        if (emptyIds.size() != 1) {
            throw new IllegalStateException(
                    "빈 사례가 정확히 1개여야 합니다: "
                            + filename
                            + " (현재 " + emptyIds.size() + "개)"
            );
        }

        return emptyIds.get(0);
    }
}