ALTER TABLE events
ADD COLUMN IF NOT EXISTS recurs_annually boolean NOT NULL DEFAULT false;