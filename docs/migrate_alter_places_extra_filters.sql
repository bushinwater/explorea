ALTER TABLE places
ADD COLUMN extra_filters jsonb DEFAULT NULL;

ALTER TABLE destinations
ADD COLUMN extra_filters jsonb DEFAULT NULL;

ALTER TABLE events
ADD COLUMN extra_filters jsonb DEFAULT NULL;

ALTER TABLE activities
ADD COLUMN extra_filters jsonb DEFAULT NULL;