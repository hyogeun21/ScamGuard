ALTER TABLE scenario_case
ADD CONSTRAINT chk_case_type
CHECK (case_type IN ('NORMAL', 'SCAM'));

ALTER TABLE scenario_case
ADD CONSTRAINT chk_difficulty
CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD'));

ALTER TABLE play_evaluation
ADD CONSTRAINT chk_score
CHECK (score BETWEEN 0 AND 100);

ALTER TABLE play_session
ADD CONSTRAINT chk_session_status
CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED'));

ALTER TABLE play_decision
ADD CONSTRAINT chk_judgment
CHECK (judgment IN ('NORMAL', 'SCAM'));

ALTER TABLE ai_feedback
ADD CONSTRAINT chk_feedback_source
CHECK (feedback_source IN ('AI', 'FALLBACK'));

ALTER TABLE action_event
ADD CONSTRAINT chk_sequence_no
CHECK (sequence_no > 0);

ALTER TABLE action_event
ADD CONSTRAINT chk_elapsed_ms
CHECK (elapsed_ms >= 0);

ALTER TABLE play_session
ADD CONSTRAINT chk_session_time
CHECK (completed_at IS NULL OR completed_at >= started_at);

ALTER TABLE session_settlement
ADD CONSTRAINT chk_session_settlement_status
CHECK (
    settlement_status IN (
        'PENDING',
        'AVAILABLE',
        'PAID',
        'BLOCKED'
    )
);

ALTER TABLE session_settlement
ADD CONSTRAINT chk_session_settlement_paid_amount
CHECK (paid_amount >= 0);