-- Admin dashboard support tables.
-- Safe to run multiple times on PostgreSQL.

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(160) NOT NULL,
    message varchar(1200) NOT NULL,
    link_url varchar(1000) NULL,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_notifications_user_id_created_at
ON notifications (user_id, created_at);

CREATE TABLE IF NOT EXISTS admin_activity_log (
    id uuid PRIMARY KEY,
    type varchar(80) NOT NULL,
    description varchar(500) NOT NULL,
    created_at timestamptz NOT NULL,
    actor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_admin_activity_log_created_at
ON admin_activity_log (created_at DESC);