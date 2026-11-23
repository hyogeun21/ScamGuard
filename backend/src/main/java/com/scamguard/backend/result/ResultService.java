package com.scamguard.backend.result;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class ResultService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public ResultService(
            JdbcTemplate jdbcTemplate,
            JsonMapper jsonMapper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getResult(UUID sessionId) {

        List<String> statuses = jdbcTemplate.query(
                """
                SELECT status
                FROM play_session
                WHERE session_id = ?
                """,
                (rs, rowNum) -> rs.getString("status"),
                sessionId
        );

        if (statuses.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "게임 세션을 찾을 수 없습니다."
            );
        }

        if (!"COMPLETED".equals(statuses.get(0))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "게임을 완료한 후 결과를 조회할 수 있습니다."
            );
        }

        List<Map<String, Object>> results = jdbcTemplate.query(
                """
                SELECT
                    ps.session_id,
                    ps.status,
                    ps.completed_at,
    
                    sc.scenario_id,
                    sc.case_type,
                    sc.difficulty,
                    sc.evaluation_rules::text AS evaluation_rules,
    
                    pd.judgment,
                    pd.response_action,
                    pd.reason,
    
                    pe.evaluation_id,
                    pe.decision_correct,
                    pe.score,
                    pe.completed_checks::text AS completed_checks,
                    pe.missed_checks::text AS missed_checks,
                    pe.risk_actions::text AS risk_actions,
                    pe.outcome,
    
                    af.feedback_id,
                    af.summary,
                    af.strengths::text AS strengths,
                    af.improvements::text AS improvements,
                    af.recommendation,
                    af.feedback_source,
                    af.prevention_tips::text AS prevention_tips
    
                FROM play_session ps
    
                JOIN scenario_case sc
                    ON sc.case_id = ps.case_id
    
                JOIN play_decision pd
                    ON pd.session_id = ps.session_id
    
                JOIN play_evaluation pe
                    ON pe.session_id = ps.session_id
    
                LEFT JOIN ai_feedback af
                    ON af.evaluation_id = pe.evaluation_id
    
                WHERE ps.session_id = ?
                """,
                (rs, rowNum) -> {

                    JsonNode rules = jsonMapper.readTree(
                            rs.getString("evaluation_rules")
                    );

                    boolean correct =
                            rs.getBoolean("decision_correct");

                    int totalScore =
                            rs.getInt("score");

                    String responseAction =
                            rs.getString("response_action");

                    int judgmentScore = correct
                            ? rules.path("judgmentScore").asInt()
                            : 0;

                    int responseScore = rules
                            .path("responseScores")
                            .path(responseAction)
                            .asInt();

                    int investigationScore =
                            totalScore - judgmentScore - responseScore;

                    Map<String, Object> decision =
                            new LinkedHashMap<>();

                    decision.put(
                            "judgment",
                            rs.getString("judgment")
                    );

                    decision.put(
                            "correctJudgment",
                            rs.getString("case_type")
                    );

                    decision.put(
                            "decisionCorrect",
                            correct
                    );

                    decision.put(
                            "responseAction",
                            responseAction
                    );

                    decision.put(
                            "reason",
                            rs.getString("reason")
                    );

                    Map<String, Object> evaluation =
                            new LinkedHashMap<>();

                    evaluation.put(
                            "evaluationId",
                            rs.getString("evaluation_id")
                    );

                    evaluation.put(
                            "score",
                            totalScore
                    );

                    evaluation.put(
                            "judgmentScore",
                            judgmentScore
                    );

                    evaluation.put(
                            "investigationScore",
                            investigationScore
                    );

                    evaluation.put(
                            "responseScore",
                            responseScore
                    );

                    evaluation.put(
                            "completedChecks",
                            jsonMapper.readTree(
                                    rs.getString("completed_checks")
                            )
                    );

                    evaluation.put(
                            "missedChecks",
                            jsonMapper.readTree(
                                    rs.getString("missed_checks")
                            )
                    );

                    evaluation.put(
                            "riskActions",
                            jsonMapper.readTree(
                                    rs.getString("risk_actions")
                            )
                    );

                    evaluation.put(
                            "outcome",
                            rs.getString("outcome")
                    );

                    Map<String, Object> feedback = null;

                    if (rs.getString("feedback_id") != null) {

                        feedback = new LinkedHashMap<>();

                        feedback.put(
                                "feedbackId",
                                rs.getString("feedback_id")
                        );

                        feedback.put(
                                "summary",
                                rs.getString("summary")
                        );

                        feedback.put(
                                "strengths",
                                jsonMapper.readTree(
                                        rs.getString("strengths")
                                )
                        );

                        feedback.put(
                                "improvements",
                                jsonMapper.readTree(
                                        rs.getString("improvements")
                                )
                        );

                        feedback.put(
                                "recommendation",
                                rs.getString("recommendation")
                        );

                        feedback.put(
                                "preventionTips",
                                jsonMapper.readTree(
                                        rs.getString("prevention_tips")
                                )
                        );

                        feedback.put(
                                "feedbackSource",
                                rs.getString("feedback_source")
                        );
                    }

                    Map<String, Object> result =
                            new LinkedHashMap<>();

                    result.put(
                            "sessionId",
                            rs.getString("session_id")
                    );

                    result.put(
                            "scenarioId",
                            rs.getString("scenario_id")
                    );

                    result.put(
                            "difficulty",
                            rs.getString("difficulty")
                    );

                    result.put(
                            "status",
                            rs.getString("status")
                    );

                    result.put(
                            "completedAt",
                            rs.getObject(
                                    "completed_at",
                                    java.time.OffsetDateTime.class
                            )
                    );

                    result.put("decision", decision);
                    result.put("evaluation", evaluation);
                    result.put("feedback", feedback);

                    return result;
                },
                sessionId
        );

        if (results.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "완료된 게임의 평가 결과가 없습니다."
            );
        }

        return results.get(0);
    }
}