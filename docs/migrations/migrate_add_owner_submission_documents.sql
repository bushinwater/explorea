BEGIN;

CREATE TABLE IF NOT EXISTS owner_submission_documents (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type varchar(20) NOT NULL,
    entity_id uuid NOT NULL,
    document_type varchar(40) NOT NULL,
    document_url varchar(1000) NOT NULL,
    file_name varchar(255) NULL,
    content_type varchar(100) NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_owner_submission_documents_entity
    ON owner_submission_documents (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS ix_owner_submission_documents_user_created
    ON owner_submission_documents (user_id, created_at);

COMMIT;
