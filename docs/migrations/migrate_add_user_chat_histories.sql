CREATE TABLE IF NOT EXISTS user_chat_histories (
    user_id   UUID        PRIMARY KEY,
    messages  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_chat_histories_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
