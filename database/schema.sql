
CREATE TABLE IF NOT EXISTS action_event
(
  event_id    uuid        NOT NULL,
  session_id  uuid        NOT NULL,
  event_name  varchar     NOT NULL,
  object_id   varchar    ,
  step_id     varchar    ,
  target_id   varchar    ,
  event_data  jsonb       NOT NULL,
  sequence_no integer     NOT NULL,
  elapsed_ms  bigint     ,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS ai_feedback
(
  feedback_id     uuid        NOT NULL,
  evaluation_id   uuid        NOT NULL UNIQUE,
  summary         text        NOT NULL,
  strengths       jsonb       NOT NULL,
  improvements    jsonb       NOT NULL,
  recommendation  text        NOT NULL,
  feedback_source varchar     NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  prevention_tips jsonb       NOT NULL,
  PRIMARY KEY (feedback_id)
);

CREATE TABLE IF NOT EXISTS play_decision
(
  decision_id     uuid        NOT NULL,
  session_id      uuid        NOT NULL UNIQUE,
  judgment        varchar     NOT NULL,
  response_action varchar     NOT NULL,
  reason          text        NOT NULL,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id)
);

CREATE TABLE IF NOT EXISTS play_evaluation
(
  evaluation_id    uuid        NOT NULL,
  session_id       uuid        NOT NULL UNIQUE,
  decision_correct boolean     NOT NULL,
  score            integer     NOT NULL,
  completed_checks jsonb       NOT NULL,
  missed_checks    jsonb       NOT NULL,
  risk_actions     jsonb       NOT NULL,
  outcome          varchar     NOT NULL,
  evaluated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evaluation_id)
);

CREATE TABLE IF NOT EXISTS play_session
(
  session_id   uuid        NOT NULL,
  user_id      uuid       ,
  case_id      uuid        NOT NULL,
  status       varchar     NOT NULL DEFAULT 'IN_PROGRESS',
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (session_id)
);

CREATE TABLE IF NOT EXISTS play_session_state
(
  session_id      uuid        NOT NULL,
  current_step_id varchar    ,
  state_data      jsonb       NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id)
);

CREATE TABLE IF NOT EXISTS scenario
(
  scenario_id varchar NOT NULL,
  title       varchar NOT NULL,
  description text   ,
  is_active   boolean NOT NULL DEFAULT true,
  PRIMARY KEY (scenario_id)
);

CREATE TABLE IF NOT EXISTS scenario_case
(
  case_id          uuid    NOT NULL,
  scenario_id      varchar NOT NULL,
  case_type        varchar NOT NULL,
  difficulty       varchar NOT NULL,
  content          jsonb   NOT NULL,
  evaluation_rules jsonb   NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (case_id)
);

ALTER TABLE scenario_case DROP CONSTRAINT IF EXISTS FK_scenario_TO_scenario_case;
ALTER TABLE scenario_case
  ADD CONSTRAINT FK_scenario_TO_scenario_case
    FOREIGN KEY (scenario_id)
    REFERENCES scenario (scenario_id)
    ON DELETE NO ACTION;

ALTER TABLE play_session DROP CONSTRAINT IF EXISTS FK_scenario_case_TO_play_session;
ALTER TABLE play_session
  ADD CONSTRAINT FK_scenario_case_TO_play_session
    FOREIGN KEY (case_id)
    REFERENCES scenario_case (case_id)
    ON DELETE NO ACTION;

ALTER TABLE action_event DROP CONSTRAINT IF EXISTS FK_play_session_TO_action_event;
ALTER TABLE action_event
  ADD CONSTRAINT FK_play_session_TO_action_event
    FOREIGN KEY (session_id)
    REFERENCES play_session (session_id)
    ON DELETE NO ACTION;

ALTER TABLE play_decision DROP CONSTRAINT IF EXISTS FK_play_session_TO_play_decision;
ALTER TABLE play_decision
  ADD CONSTRAINT FK_play_session_TO_play_decision
    FOREIGN KEY (session_id)
    REFERENCES play_session (session_id)
    ON DELETE NO ACTION;

ALTER TABLE play_evaluation DROP CONSTRAINT IF EXISTS FK_play_session_TO_play_evaluation;
ALTER TABLE play_evaluation
  ADD CONSTRAINT FK_play_session_TO_play_evaluation
    FOREIGN KEY (session_id)
    REFERENCES play_session (session_id)
    ON DELETE NO ACTION;

ALTER TABLE ai_feedback DROP CONSTRAINT IF EXISTS FK_play_evaluation_TO_ai_feedback;
ALTER TABLE ai_feedback
  ADD CONSTRAINT FK_play_evaluation_TO_ai_feedback
    FOREIGN KEY (evaluation_id)
    REFERENCES play_evaluation (evaluation_id)
    ON DELETE NO ACTION;

ALTER TABLE play_session_state DROP CONSTRAINT IF EXISTS FK_play_session_TO_play_session_state;
ALTER TABLE play_session_state
  ADD CONSTRAINT FK_play_session_TO_play_session_state
    FOREIGN KEY (session_id)
    REFERENCES play_session (session_id)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_action_event_session_sequence
  ON action_event (session_id ASC, sequence_no ASC);