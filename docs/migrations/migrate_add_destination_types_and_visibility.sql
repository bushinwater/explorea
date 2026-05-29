-- ============================================================
-- Migration: destination_types table + destinations columns
--   - destination_types table (mirrors place_types structure)
--   - destinations.type_id FK -> destination_types
--   - destinations.visibility (published/draft/archived/rejected)
--   - destinations.extra_filters (jsonb, nullable)
-- ============================================================

-- 1. destination_types table
CREATE TABLE IF NOT EXISTS destination_types (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    icon       VARCHAR(100),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- 2. Seed default types (safe even without a UNIQUE constraint on name)
INSERT INTO destination_types (name)
SELECT v.name
FROM (VALUES
    ('Kulturni'),
    ('Prirodni'),
    ('Gastronomski'),
    ('Avanturisticki'),
    ('Wellness / Spa'),
    ('Istorijski')
) AS v(name)
WHERE NOT EXISTS (
    SELECT 1 FROM destination_types dt WHERE dt.name = v.name
);

-- 3. Add type_id to destinations
ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS type_id INT
    REFERENCES destination_types (id) ON DELETE SET NULL;

-- 4. Add visibility to destinations
ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'published';

-- 5. Add extra_filters (jsonb, nullable)
ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS extra_filters JSONB;

-- 6. Index for filtering by visibility
CREATE INDEX IF NOT EXISTS idx_destinations_visibility ON destinations (visibility);

-- 7. Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_destinations_type ON destinations (type_id);

-- 8. Backfill NULL visibility values (safety fix for rows added before DEFAULT was set)
UPDATE destinations SET visibility = 'published' WHERE visibility IS NULL;
