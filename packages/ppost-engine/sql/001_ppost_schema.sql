-- PPOST engine tables (PostgreSQL). Mirrors src/model/types.ts.
CREATE TYPE answer_t   AS ENUM ('YES','NO','UNKNOWN');
CREATE TYPE status_t   AS ENUM ('DRAFT','IN_REVIEW','APPROVED','ARCHIVED');
CREATE TYPE source_t   AS ENUM ('SOURCE_FACT','HUMAN_DECISION','AI_SUGGESTION','RULE','ASSUMPTION');
CREATE TYPE sector_t   AS ENUM ('HUMAN_WELLNESS','HOUSING','ENVIRONMENT','ECONOMY','CRITICAL_INFRASTRUCTURE','GOVERNANCE');
CREATE TYPE horizon_t  AS ENUM ('IMMEDIATE','MID_TERM','LONG_TERM');
CREATE TYPE severity_t AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');

CREATE TABLE disasters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hazard_types TEXT[] NOT NULL CHECK (array_length(hazard_types,1) >= 1),
  location TEXT NOT NULL,
  declared_at DATE,                      -- nullable: may be unknown
  active_sectors sector_t[] NOT NULL DEFAULT '{HUMAN_WELLNESS,HOUSING,ENVIRONMENT,ECONOMY,CRITICAL_INFRASTRUCTURE}'
);

CREATE TABLE priorities (
  id TEXT PRIMARY KEY,
  disaster_id TEXT REFERENCES disasters(id),
  rank INT NOT NULL CHECK (rank BETWEEN 1 AND 20),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (disaster_id, rank)
);

-- shared columns repeated per table for simplicity
CREATE TABLE problems (
  id TEXT PRIMARY KEY, disaster_id TEXT NOT NULL REFERENCES disasters(id),
  priority_id TEXT NOT NULL REFERENCES priorities(id),
  sector sector_t NOT NULL, severity severity_t NOT NULL,
  title TEXT NOT NULL, description TEXT, owner TEXT,
  source source_t NOT NULL, status status_t NOT NULL DEFAULT 'DRAFT',
  from_unknown_question_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE objectives (
  id TEXT PRIMARY KEY, disaster_id TEXT NOT NULL REFERENCES disasters(id),
  horizon horizon_t NOT NULL,
  title TEXT NOT NULL, description TEXT, owner TEXT,
  source source_t NOT NULL, status status_t NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE objective_problems (            -- objective can address many problems
  objective_id TEXT REFERENCES objectives(id), problem_id TEXT REFERENCES problems(id),
  PRIMARY KEY (objective_id, problem_id)
);

CREATE TABLE strategies (
  id TEXT PRIMARY KEY, disaster_id TEXT NOT NULL REFERENCES disasters(id),
  objective_id TEXT NOT NULL REFERENCES objectives(id),
  title TEXT NOT NULL, description TEXT, owner TEXT,
  source source_t NOT NULL, status status_t NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tactics (
  id TEXT PRIMARY KEY, disaster_id TEXT NOT NULL REFERENCES disasters(id),
  strategy_id TEXT NOT NULL REFERENCES strategies(id),
  primary_priority_id TEXT NOT NULL REFERENCES priorities(id),   -- cost counted once here
  secondary_priority_ids TEXT[] NOT NULL DEFAULT '{}',
  sector sector_t NOT NULL,
  five_w1h JSONB NOT NULL DEFAULT '{}',                         -- who/what/when/where/why/how
  success_measure TEXT, safety_precaution BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT NOT NULL, description TEXT, owner TEXT,
  source source_t NOT NULL, status status_t NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assessment_answers (
  disaster_id TEXT REFERENCES disasters(id), question_id TEXT,
  answer answer_t NOT NULL,                   -- UNKNOWN is stored, never coerced
  notes TEXT, answered_by TEXT, answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (disaster_id, question_id)
);

CREATE TABLE verification_tasks (
  id TEXT PRIMARY KEY, disaster_id TEXT REFERENCES disasters(id),
  question_id TEXT NOT NULL, title TEXT NOT NULL, assigned_role TEXT NOT NULL,
  due_in_hours INT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED'))
);
