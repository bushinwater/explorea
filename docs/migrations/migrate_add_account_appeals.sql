CREATE TABLE IF NOT EXISTS account_appeals (
    id          SERIAL PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES users(id),
    email       VARCHAR(255) NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    message     TEXT,
    status      VARCHAR(50)  NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id)
);

-- one pending appeal per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_appeals_one_per_user
    ON account_appeals(user_id) WHERE (status = 'pending');

CREATE INDEX IF NOT EXISTS idx_account_appeals_status
    ON account_appeals(status);
