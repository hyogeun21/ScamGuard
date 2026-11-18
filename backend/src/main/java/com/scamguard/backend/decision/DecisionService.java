package com.scamguard.backend.decision;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class DecisionService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public DecisionService(
            JdbcTemplate jdbcTemplate,
            JsonMapper jsonMapper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
    }

    @Transactional
    public Map<String, Object> submitDecision(
            UUID sessionId,
            String judgment,
            String responseAction,
            String reason
    ) {

        List<SessionInfo> sessions = jdbcTemplate.query(
                """
                SELECT
                    ps.status,
                    sc.case_type,
                    sc.evaluation_rules::text AS evaluation_rules
                FROM play_session_state pss
                JOIN play_session ps
                    ON ps.session_id = pss.session_id
                JOIN scenario_case sc
                    ON sc.case_id = ps.case_id
                WHERE pss.session_id = ?
                FOR UPDATE OF pss
                """,
                (rs, rowNum) -> new SessionInfo(
                        rs.getString("status"),
                        rs.getString("case_type"),
                        rs.getString("evaluation_rules")
                ),
                sessionId
        );

        if (sessions.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "게임 세션을 찾을 수 없습니다."
            );
        }

        SessionInfo session = sessions.get(0);

        if (!"IN_PROGRESS".equals(session.status())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 종료된 게임 세션입니다."
            );
        }

        JsonNode rules =
                jsonMapper.readTree(session.evaluationRules());

        JsonNode responseScores =
                rules.path("responseScores");

        if (!responseScores.isObject()
                || !responseScores.has(responseAction)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "올바르지 않은 대응 행동입니다."
            );
        }

        boolean correct =
                session.caseType().equals(judgment);

        int judgmentScore = correct
                ? rules.path("judgmentScore").asInt()
                : 0;

        List<EventKey> events = jdbcTemplate.query(
                """
                SELECT event_name, target_id
                FROM action_event
                WHERE session_id = ?
                """,
                (rs, rowNum) -> new EventKey(
                        rs.getString("event_name"),
                        rs.getString("target_id")
                ),
                sessionId
        );

        Set<EventKey> performedEvents =
                new HashSet<>(events);

        int investigationScore = 0;

        List<Map<String, Object>> completedChecks =
                new ArrayList<>();

        List<Map<String, Object>> missedChecks =
                new ArrayList<>();

        JsonNode checks = rules.path("investigationChecks");

        if (!checks.isArray()) {
            throw new IllegalStateException(
                    "조사 평가 규칙이 올바르지 않습니다."
            );
        }

        for (JsonNode check : checks) {

            String eventName =
                    check.path("eventName").asText();

            String targetId =
                    check.path("targetId").asText();

            int score = check.path("score").asInt();

            EventKey key = new EventKey(
                    eventName, targetId
            );

            Map<String, Object> checkResult = Map.of(
                    "eventName", eventName,
                    "targetId", targetId,
                    "score", score
            );

            if (performedEvents.contains(key)) {
                investigationScore += score;
                completedChecks.add(checkResult);
            } else {
                missedChecks.add(checkResult);
            }
        }

        int responseScore =
                responseScores.path(responseAction).asInt();

        int totalScore =
                judgmentScore
                        + investigationScore
                        + responseScore;

        if (totalScore < 0 || totalScore > 100) {
            throw new IllegalStateException(
                    "평가 점수가 올바르지 않습니다."
            );
        }

        UUID decisionId = UUID.randomUUID();

        jdbcTemplate.update(
                """
                INSERT INTO play_decision (
                    decision_id,
                    session_id,
                    judgment,
                    response_action,
                    reason
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                decisionId,
                sessionId,
                judgment,
                responseAction,
                reason
        );

        UUID evaluationId = UUID.randomUUID();

        String outcome = correct
                ? "CORRECT"
                : "INCORRECT";

        String riskActions = "[]";

        jdbcTemplate.update(
                """
                INSERT INTO play_evaluation (
                    evaluation_id,
                    session_id,
                    decision_correct,
                    score,
                    completed_checks,
                    missed_checks,
                    risk_actions,
                    outcome
                )
                VALUES (
                    ?, ?, ?, ?,
                    CAST(? AS jsonb),
                    CAST(? AS jsonb),
                    CAST(? AS jsonb),
                    ?
                )
                """,
                evaluationId,
                sessionId,
                correct,
                totalScore,
                jsonMapper.writeValueAsString(completedChecks),
                jsonMapper.writeValueAsString(missedChecks),
                riskActions,
                outcome
        );

        jdbcTemplate.update(
                """
                UPDATE play_session
                SET status = 'COMPLETED',
                    completed_at = now()
                WHERE session_id = ?
                """,
                sessionId
        );

        return Map.of(
                "sessionId", sessionId.toString(),
                "evaluationId", evaluationId.toString(),
                "decisionCorrect", correct,
                "correctJudgment", session.caseType(),
                "score", totalScore,
                "judgmentScore", judgmentScore,
                "investigationScore", investigationScore,
                "responseScore", responseScore,
                "status", "COMPLETED"
        );
    }

    private record SessionInfo(
            String status,
            String caseType,
            String evaluationRules
    ) {}

    private record EventKey(
            String eventName,
            String targetId
    ) {}
}