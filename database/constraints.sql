
-- 사례 유형: 정상 또는 사기
ALTER TABLE scenario_case
ADD CONSTRAINT chk_case_type
CHECK (case_type IN ('NORMAL', 'SCAM'));

-- 난이도: 쉬움, 보통, 어려움
ALTER TABLE scenario_case
ADD CONSTRAINT chk_difficulty
CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD'));

-- 평가 점수: 0~100
ALTER TABLE play_evaluation
ADD CONSTRAINT chk_score
CHECK (score BETWEEN 0 AND 100);


-- 게임 진행 상태
ALTER TABLE play_session
ADD CONSTRAINT chk_session_status
CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED'));

-- 사용자의 최종 판단
ALTER TABLE play_decision
ADD CONSTRAINT chk_judgment
CHECK (judgment IN ('NORMAL', 'SCAM'));

-- AI 피드백 생성 방식
ALTER TABLE ai_feedback
ADD CONSTRAINT chk_feedback_source
CHECK (feedback_source IN ('AI', 'FALLBACK'));

-- 행동 로그 순번은 1 이상의 정수
ALTER TABLE action_event
ADD CONSTRAINT chk_sequence_no
CHECK (sequence_no > 0);

ALTER TABLE action_event
ADD CONSTRAINT chk_elapsed_ms
CHECK (elapsed_ms >= 0);

ALTER TABLE play_session
ADD CONSTRAINT chk_session_time
CHECK (completed_at IS NULL OR completed_at >= started_at);