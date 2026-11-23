package com.scamguard.backend.session;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SessionAbandonService {

    private final JdbcTemplate jdbcTemplate;

    public SessionAbandonService(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public Map<String, Object> abandonSession(
            UUID sessionId
    ) {

        List<String> statuses = jdbcTemplate.query(
                """
                SELECT ps.status
                FROM play_session_state pss
                JOIN play_session ps
                    ON ps.session_id = pss.session_id
                WHERE pss.session_id = ?
                FOR UPDATE OF pss
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

        if (!"IN_PROGRESS".equals(statuses.get(0))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 종료된 게임 세션입니다."
            );
        }

        jdbcTemplate.update(
                """
                UPDATE play_session
                SET status = 'ABANDONED',
                    completed_at = now()
                WHERE session_id = ?
                """,
                sessionId
        );

        return Map.of(
                "sessionId", sessionId.toString(),
                "status", "ABANDONED",
                "message", "게임이 중도 종료되었습니다."
        );
    }
}