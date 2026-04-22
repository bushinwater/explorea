ALTER TABLE submission_queue
ADD COLUMN IF NOT EXISTS request_payload jsonb;