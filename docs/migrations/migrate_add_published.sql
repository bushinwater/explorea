ALTER TABLE events
ADD COLUMN IF NOT EXISTS visibility varchar(20) NOT NULL DEFAULT 'published';

UPDATE events
SET visibility = 'published'
WHERE visibility IS NULL;