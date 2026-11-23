package com.scamguard.backend.event.scenario;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.scamguard.backend.event.EventContext;
import com.scamguard.backend.event.EventHandler;
import com.scamguard.backend.event.EventResult;

import tools.jackson.databind.JsonNode;

@Component
public class SettlementEventHandler implements EventHandler {

    private final JdbcTemplate jdbcTemplate;

    public SettlementEventHandler(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public boolean supports(String scenarioId, String eventName) {
        return "SIDE".equals(scenarioId)
                && "SETTLEMENT_VIEWED".equals(eventName);
    }

    @Override
    public EventResult handle(EventContext context) {

        String targetId = context.targetId();

        boolean defined = false;

        JsonNode settlements = context.content().path("settlements");

        for (JsonNode settlement : settlements) {
            if (targetId.equals(settlement.path("id").asText())) {
                defined = true;
                break;
            }
        }

        if (!defined) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "존재하지 않는 정산 ID입니다."
            );
        }

        List<Map<String, Object>> rows = jdbcTemplate.query(
                """
                SELECT
                    settlement_id,
                    task_id,
                    settlement_status,
                    paid_amount
                FROM session_settlement
                WHERE session_id = ?
                  AND settlement_id = ?
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();

                    row.put("id", rs.getString("settlement_id"));
                    row.put("taskId", rs.getString("task_id"));
                    row.put(
                            "settlementStatus",
                            rs.getString("settlement_status")
                    );
                    row.put("paidAmount", rs.getInt("paid_amount"));

                    return row;
                },
                context.sessionId(),
                targetId
        );

        if (rows.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "현재 세션의 정산 내역을 찾을 수 없습니다."
            );
        }

        return new EventResult(rows.get(0));
    }
}