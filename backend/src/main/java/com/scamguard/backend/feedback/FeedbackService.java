package com.scamguard.backend.feedback;

import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.scamguard.backend.feedback.FeedbackEvidence.Action;
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
public class FeedbackService {

    private static final Logger LOG = LoggerFactory.getLogger(FeedbackService.class);
    private static final Set<String> RISKY_CHOICES = Set.of("SUBMIT_UNVERIFIED", "TRANSFER_UNVERIFIED");
    private static final Pattern PRIVATE_TEXT = Pattern.compile(
            "[\\w.%+\\-]+@[\\w.\\-]+\\.[A-Za-z]{2,}|(?<!\\d)\\d(?:[ -]?\\d){6,}(?!\\d)");

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;
    private final ClaudeFeedback claude;

    public FeedbackService(JdbcTemplate jdbcTemplate, JsonMapper jsonMapper, ClaudeFeedback claude) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
        this.claude = claude;
    }

    @Transactional
    public Map<String, Object> generateFeedback(UUID sessionId) {

        List<String> statuses = jdbcTemplate.query(
                """
                SELECT status
                FROM play_session
                WHERE session_id = ?
                FOR UPDATE
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
                    "게임을 완료한 후 피드백을 요청할 수 있습니다."
            );
        }

        List<Map<String, Object>> existing = jdbcTemplate.query(
                """
                SELECT
                    af.feedback_id,
                    af.summary,
                    af.strengths::text AS strengths,
                    af.improvements::text AS improvements,
                    af.recommendation,
                    af.feedback_source,
                    af.prevention_tips::text AS prevention_tips
                FROM ai_feedback af
                JOIN play_evaluation pe
                    ON pe.evaluation_id = af.evaluation_id
                WHERE pe.session_id = ?
                """,
                (rs, rowNum) -> toResponse(
                        sessionId,
                        UUID.fromString(rs.getString("feedback_id")),
                        rs.getString("summary"),
                        jsonMapper.readTree(rs.getString("strengths")),
                        jsonMapper.readTree(rs.getString("improvements")),
                        rs.getString("recommendation"),
                        jsonMapper.readTree(rs.getString("prevention_tips")),
                        rs.getString("feedback_source")
                ),
                sessionId
        );

        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        List<FeedbackData> dataList = jdbcTemplate.query(
                """
                SELECT
                    pe.evaluation_id,
                    pe.decision_correct,
                    pe.score,
                    pe.completed_checks::text AS completed_checks,
                    pe.missed_checks::text AS missed_checks,
                    pe.risk_actions::text AS risk_actions,
                    pd.judgment,
                    pd.response_action,
                    pd.reason,
                    sc.scenario_id,
                    sc.case_type,
                    sc.content::text AS content
                FROM play_evaluation pe
                JOIN play_decision pd
                    ON pd.session_id = pe.session_id
                JOIN play_session ps
                    ON ps.session_id = pe.session_id
                JOIN scenario_case sc
                    ON sc.case_id = ps.case_id
                WHERE pe.session_id = ?
                """,
                (rs, rowNum) -> new FeedbackData(
                        UUID.fromString(rs.getString("evaluation_id")),
                        rs.getBoolean("decision_correct"),
                        rs.getInt("score"),
                        rs.getString("completed_checks"),
                        rs.getString("missed_checks"),
                        rs.getString("risk_actions"),
                        rs.getString("judgment"),
                        rs.getString("response_action"),
                        rs.getString("reason"),
                        rs.getString("scenario_id"),
                        rs.getString("case_type"),
                        rs.getString("content")
                ),
                sessionId
        );

        if (dataList.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "평가 결과가 존재하지 않습니다."
            );
        }

        FeedbackData data = dataList.get(0);

        List<Action> actions = jdbcTemplate.query(
                """
                SELECT event_name, target_id, sequence_no
                FROM action_event
                WHERE session_id = ?
                ORDER BY sequence_no
                """,
                (rs, rowNum) -> new Action(rs.getString("event_name"),
                        rs.getString("target_id"), rs.getInt("sequence_no")),
                sessionId
        );

        JsonNode content = jsonMapper.readTree(data.content());

        JsonNode preventionTips =
                content.path("preventionTips");

        if (!preventionTips.isArray()) {
            preventionTips = jsonMapper.readTree("[]");
        }

        FeedbackResult result = createFallback(data);
        try {
            var response = claude.generate(createInput(data, actions, content));
            if (response.isPresent()) {
                JsonNode feedback = jsonMapper.readTree(response.get());
                result = new FeedbackResult(
                        feedback.path("summary").asText(),
                        feedback.path("strengths").valueStream().map(JsonNode::asText).toList(),
                        feedback.path("improvements").valueStream().map(JsonNode::asText).toList(),
                        feedback.path("recommendation").asText(),
                        "AI"
                );
            }
        } catch (java.io.IOException | RuntimeException ex) {
            LOG.warn("Claude 피드백 생성 실패. 기본 해설을 사용합니다. ({})", ex.getClass().getSimpleName());
        }

        UUID feedbackId = UUID.randomUUID();

        jdbcTemplate.update(
                """
                INSERT INTO ai_feedback (
                    feedback_id,
                    evaluation_id,
                    summary,
                    strengths,
                    improvements,
                    recommendation,
                    feedback_source,
                    prevention_tips
                )
                VALUES (
                    ?, ?, ?,
                    CAST(? AS jsonb),
                    CAST(? AS jsonb),
                    ?, ?,
                    CAST(? AS jsonb)
                )
                """,
                feedbackId,
                data.evaluationId(),
                result.summary(),
                jsonMapper.writeValueAsString(result.strengths()),
                jsonMapper.writeValueAsString(result.improvements()),
                result.recommendation(),
                result.source(),
                jsonMapper.writeValueAsString(preventionTips)
        );

        return toResponse(
                sessionId,
                feedbackId,
                result.summary(),
                jsonMapper.readTree(
                        jsonMapper.writeValueAsString(result.strengths())
                ),
                jsonMapper.readTree(
                        jsonMapper.writeValueAsString(result.improvements())
                ),
                result.recommendation(),
                preventionTips,
                result.source()
        );
    }

    private String createInput(FeedbackData data, List<Action> actions, JsonNode content) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("scenarioId", data.scenarioId());
        input.put("correctJudgment", data.caseType());
        input.put("userJudgment", data.judgment());
        input.put("decisionCorrect", data.correct());
        input.put("score", data.score());
        input.put("responseAction", data.responseAction());
        input.put("reason", PRIVATE_TEXT.matcher(data.reason() == null ? "" : data.reason()).replaceAll("[가림]"));
        input.put("completedChecks", jsonMapper.readTree(data.completedChecks()));
        input.put("missedChecks", jsonMapper.readTree(data.missedChecks()));
        input.put("riskActions", jsonMapper.readTree(data.riskActions()));
        input.put("actions", actions);
        input.put("verifiedFacts", FeedbackEvidence.verifiedFacts(content, actions));
        return jsonMapper.writeValueAsString(input);
    }

    private FeedbackResult createFallback(
            FeedbackData data
    ) {
        String summary = data.correct()
                ? "사기 여부를 올바르게 판단했습니다. 조사 과정도 함께 점검해 보세요."
                : "이번 사례의 판단은 정답과 달랐습니다. 확인하지 않은 단서를 다시 살펴보세요.";

        List<String> strengths = new ArrayList<>();
        List<String> improvements = new ArrayList<>();

        if (data.correct()) {
            strengths.add("사기 여부를 올바르게 구분했습니다.");
        } else {
            improvements.add("정상 사례와 사기 사례의 차이를 다시 확인하세요.");
        }

        JsonNode completed =
                jsonMapper.readTree(data.completedChecks());

        JsonNode missed =
                jsonMapper.readTree(data.missedChecks());

        if (!completed.isEmpty()) {
            strengths.add("평가에 반영되는 조사 행동을 수행했습니다.");
        }

        if (!missed.isEmpty()) {
            improvements.add(
                    "확인하지 못한 중요 조사 항목이 있습니다."
            );
        }

        if (strengths.isEmpty()) {
            strengths.add("최종 판단과 대응 행동을 제출했습니다.");
        }

        if (RISKY_CHOICES.contains(data.responseAction())) {
            improvements.addFirst("확인되지 않은 경로로 제출하거나 송금하는 대응을 선택했습니다.");
        } else if (!jsonMapper.readTree(data.riskActions()).isEmpty()) {
            improvements.addFirst("위험 행동 기록이 있습니다. 공식 경로를 확인하기 전에는 거래나 정보 제출을 보류하세요.");
        }

        if (improvements.isEmpty()) {
            improvements.add(
                    "다른 확인 경로도 활용해 판단 근거를 강화하세요."
            );
        }

        String recommendation = switch (data.scenarioId()) {
            case "JOB" -> "회사 공식 홈페이지에서 인사팀 연락처를 찾아 서류 접수 경로를 확인하세요.";
            case "SIDE" -> "입금 전에 공식 고객지원에서 보증금 요구와 정산 조건을 확인하세요.";
            case "INV" -> "송금 전에 직접 찾은 금융회사 대표번호로 담당자와 입금 경로를 확인하세요.";
            case "TRAVEL" -> "예약 플랫폼 앱에서 예약 상태와 추가 결제 요청을 확인하세요.";
            default -> "중요한 요청은 공식 홈페이지나 공식 연락처로 별도 확인하세요.";
        };
        return new FeedbackResult(
                summary,
                strengths,
                improvements,
                recommendation,
                "FALLBACK"
        );
    }

    private Map<String, Object> toResponse(
            UUID sessionId,
            UUID feedbackId,
            String summary,
            JsonNode strengths,
            JsonNode improvements,
            String recommendation,
            JsonNode preventionTips,
            String source
    ) {
        return Map.of(
                "sessionId", sessionId.toString(),
                "feedbackId", feedbackId.toString(),
                "summary", summary,
                "strengths", strengths,
                "improvements", improvements,
                "recommendation", recommendation,
                "preventionTips", preventionTips,
                "feedbackSource", source
        );
    }

    private record FeedbackData(
            UUID evaluationId,
            boolean correct,
            int score,
            String completedChecks,
            String missedChecks,
            String riskActions,
            String judgment,
            String responseAction,
            String reason,
            String scenarioId,
            String caseType,
            String content
    ) {}

    private record FeedbackResult(
            String summary,
            List<String> strengths,
            List<String> improvements,
            String recommendation,
            String source
    ) {}
}