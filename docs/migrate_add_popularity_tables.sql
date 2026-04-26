-- Migration: create popularity_logs and user_interest_scores tables
-- Date: 2026-04-26

CREATE TABLE IF NOT EXISTS popularity_logs (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    session_id  VARCHAR(64),
    entity_type VARCHAR(20) NOT NULL,
    entity_id   UUID        NOT NULL,
    source      VARCHAR(10) NOT NULL DEFAULT 'click',
    points      SMALLINT    NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_popularity_logs_user_entity
    ON popularity_logs (user_id, entity_type, entity_id, source, created_at);

CREATE INDEX IF NOT EXISTS idx_popularity_logs_session_entity
    ON popularity_logs (session_id, entity_type, entity_id, source, created_at);

CREATE TABLE IF NOT EXISTS user_interest_scores (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_tag_id INT  NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    score           INT  NOT NULL DEFAULT 0,
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, interest_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interest_scores_user
    ON user_interest_scores (user_id, score DESC);
