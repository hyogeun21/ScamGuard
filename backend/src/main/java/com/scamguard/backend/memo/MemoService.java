package com.scamguard.backend.memo;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MemoService {

    private final JdbcTemplate jdbcTemplate;

    public MemoService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public Map<String, Object> saveMemo(
            UUID sessionId,
            String memoText
    ) {

        List<SessionInfo> sessions = jdbcTemplate.query(
                """
                SELECT ps.status, pss.current_step_id
                FROM play_session_state pss
                JOIN play_session ps
                    ON ps.session_id = pss.session_id
                WHERE pss.session_id = ?
                FOR UPDATE OF pss
                """,
                (rs, rowNum) -> new SessionInfo(
                        rs.getString("status"),
                        rs.getString("current_step_id")
                ),
                sessionId
        );

        if (sessions.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "세션이 존재하지 않습니다."
            );
        }

        SessionInfo session = sessions.get(0);

        if (!"IN_PROGRESS".equals(session.status())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "진행 중인 게임에서만 메모를 저장할 수 있습니다."
            );
        }

        jdbcTemplate.update(
                """
                UPDATE play_session_state
                SET memo_text = ?,
                    updated_at = NOW()
                WHERE session_id = ?
                """,
                memoText,
                sessionId
        );

        Integer lastSequenceNo = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(MAX(sequence_no), 0)
                FROM action_event
                WHERE session_id = ?
                """,
                Integer.class,
                sessionId
        );

        int sequenceNo = lastSequenceNo + 1;

        UUID eventId = UUID.randomUUID();

        jdbcTemplate.update(
                """
                INSERT INTO action_event (
                    event_id,
                    session_id,
                    event_name,
                    object_id,
                    step_id,
                    target_id,
                    event_data,
                    sequence_no,
                    received_at
                )
                VALUES (
                    ?, ?, 'NOTE_SAVED',
                    'NOTEBOOK', ?, NULL,
                    '{}'::jsonb, ?, NOW()
                )
                """,
                eventId,
                sessionId,
                session.currentStepId(),
                sequenceNo
        );

        return Map.of(
                "sessionId", sessionId.toString(),
                "memoText", memoText,
                "eventId", eventId.toString(),
                "sequenceNo", sequenceNo,
                "saved", true
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getMemo(UUID sessionId) {

        List<MemoInfo> memos = jdbcTemplate.query(
                """
                SELECT ps.status, pss.memo_text
                FROM play_session_state pss
                JOIN play_session ps
                    ON ps.session_id = pss.session_id
                WHERE pss.session_id = ?
                """,
                (rs, rowNum) -> new MemoInfo(
                        rs.getString("status"),
                        rs.getString("memo_text")
                ),
                sessionId
        );

        if (memos.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "세션이 존재하지 않습니다."
            );
        }

        MemoInfo memo = memos.get(0);

        if (!"IN_PROGRESS".equals(memo.status())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "진행 중인 게임에서만 메모를 조회할 수 있습니다."
            );
        }

        return Map.of(
                "sessionId", sessionId.toString(),
                "memoText", memo.memoText()
        );
    }

    private record SessionInfo(
            String status,
            String currentStepId
    ) {}

    private record MemoInfo(
            String status,
            String memoText
    ) {}
}