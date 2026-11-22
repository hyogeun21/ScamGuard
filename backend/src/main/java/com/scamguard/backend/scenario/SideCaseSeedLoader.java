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
        name = "scamguard.seed.side-enabled",
        havingValue = "true"
)
public class SideCaseSeedLoader implements CommandLineRunner {

    private static final String SCENARIO_ID = "SIDE";
    private static final String RESOURCE_PATH = "seed/side/";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;
    private final TransactionTemplate transactionTemplate;

    public SideCaseSeedLoader(
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
                "1_normal_easy.json",
                "1_normal_medium.json",
                "1_normal_hard.json",
                "1_scam_easy.json",
                "1_scam_medium.json",
                "1_scam_hard.json",

                "2_normal_easy.json",
                "2_normal_medium.json",
                "2_normal_hard.json",
                "2_scam_easy.json",
                "2_scam_medium.json",
                "2_scam_hard.json",

                "3_normal_easy.json",
                "3_normal_medium.json",
                "3_normal_hard.json",
                "3_scam_easy.json",
                "3_scam_medium.json",
                "3_scam_hard.json"
        };

        transactionTemplate.executeWithoutResult(status -> {
            for (String filename : files) {
                try {
                    updateCase(filename);
                } catch (Exception e) {
                    throw new IllegalStateException(
                            "SIDE JSON 저장 실패: " + filename, e
                    );
                }
            }
        });
    }

    private void updateCase(String filename) throws Exception {

        String companyNumber = filename.split("_")[0];
        String expectedCompanyName = getCompanyName(companyNumber);

        ClassPathResource resource =
                new ClassPathResource(RESOURCE_PATH + filename);

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
                .path("sideJobPosting")
                .path("companyName")
                .asText();

        String expectedFilename =
                companyNumber + "_"
                        + caseType.toLowerCase() + "_"
                        + difficulty.toLowerCase() + ".json";

        if (!SCENARIO_ID.equals(scenarioId)
                || !("NORMAL".equals(caseType)
                || "SCAM".equals(caseType))
                || !("EASY".equals(difficulty)
                || "MEDIUM".equals(difficulty)
                || "HARD".equals(difficulty))
                || !content.isObject()
                || content.isEmpty()
                || !evaluationRules.isObject()
                || evaluationRules.isEmpty()
                || !expectedCompanyName.equals(companyName)
                || !filename.equals(expectedFilename)) {

            throw new IllegalArgumentException(
                    "SIDE JSON 구조, 파일명 또는 기업 정보 오류: "
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
                    evaluation_rules = CAST(? AS jsonb)
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

    private String getCompanyName(String companyNumber) {

        return switch (companyNumber) {
            case "1" -> "온리데이터";
            case "2" -> "한글문서랩";
            case "3" -> "소셜체크";
            default -> throw new IllegalArgumentException(
                    "등록되지 않은 SIDE 기업 번호: "
                            + companyNumber
            );
        };
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
                  AND content #>> '{scenarioData,sideJobPosting,companyName}' = ?
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
                    "같은 기업의 사례가 중복 등록됨: "
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
                    "해당 유형의 빈 SIDE 사례가 정확히 1개여야 합니다: "
                            + filename
                            + " (현재 " + emptyIds.size() + "개)"
            );
        }

        return emptyIds.get(0);
    }
}