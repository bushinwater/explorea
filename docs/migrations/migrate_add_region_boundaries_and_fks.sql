-- ============================================================
--  Migracija: granice regija + FK veze za sve entitete
-- ============================================================

-- 1. Kolona za geografske granice regija (PostGIS MultiPolygon)
ALTER TABLE regions
    ADD COLUMN IF NOT EXISTS boundary geography(MultiPolygon, 4326);

-- 2. FK region_id na destinacijama
ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS region_id INT;

ALTER TABLE destinations
    ADD CONSTRAINT fk_destinations_region
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- 3. FK region_id na dogadjajima
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS region_id INT;

ALTER TABLE events
    ADD CONSTRAINT fk_events_region
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- 4. FK region_id na aktivnostima
ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS region_id INT;

ALTER TABLE activities
    ADD CONSTRAINT fk_activities_region
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- 5. FK region_id na objektima
ALTER TABLE places
    ADD COLUMN IF NOT EXISTS region_id INT;

ALTER TABLE places
    ADD CONSTRAINT fk_places_region
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- 6. FK managed_region_id na korisnicima (moze vec postojati od ranije)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS managed_region_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_users_managed_region'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_managed_region
            FOREIGN KEY (managed_region_id) REFERENCES regions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 7. Backfill region_id iz grada (city -> region)
UPDATE destinations d
    SET region_id = c.region_id
    FROM cities c
    WHERE d.city_id = c.id AND d.region_id IS NULL;

UPDATE events e
    SET region_id = c.region_id
    FROM cities c
    WHERE e.city_id = c.id AND e.region_id IS NULL;

UPDATE activities a
    SET region_id = c.region_id
    FROM cities c
    WHERE a.city_id = c.id AND a.region_id IS NULL;

UPDATE places p
    SET region_id = c.region_id
    FROM cities c
    WHERE p.city_id = c.id AND p.region_id IS NULL;

-- 8. Indeksi
CREATE INDEX IF NOT EXISTS idx_destinations_region ON destinations(region_id);
CREATE INDEX IF NOT EXISTS idx_events_region        ON events(region_id);
CREATE INDEX IF NOT EXISTS idx_activities_region    ON activities(region_id);
CREATE INDEX IF NOT EXISTS idx_places_region        ON places(region_id);
CREATE INDEX IF NOT EXISTS idx_users_managed_region ON users(managed_region_id);

-- ============================================================
--  Granice regija — aproksimativni poligoni (lon lat, SRID 4326)
--  Koordinate su razumne aproksimacije; za precizne granice
--  preporucujemo GADM (gadm.org) nivo 1/2 za Srbiju.
-- ============================================================

-- id=1: Šumadija — centralna Srbija (Kragujevac i okolina)
UPDATE regions
    SET boundary = ST_GeomFromText(
        'MULTIPOLYGON(((20.0 43.8, 21.5 43.8, 21.5 44.7, 20.0 44.7, 20.0 43.8)))', 4326
    )::geography
    WHERE id = 1;

-- id=2: Zapadna Srbija — Valjevo, Uzice, Cacak
UPDATE regions
    SET boundary = ST_GeomFromText(
        'MULTIPOLYGON(((18.8 43.0, 20.0 43.0, 20.0 45.0, 18.8 45.0, 18.8 43.0)))', 4326
    )::geography
    WHERE id = 2;

-- id=3: Juzna Srbija — Nis i jug
UPDATE regions
    SET boundary = ST_GeomFromText(
        'MULTIPOLYGON(((20.0 42.2, 23.0 42.2, 23.0 43.8, 20.0 43.8, 20.0 42.2)))', 4326
    )::geography
    WHERE id = 3;

-- id=4: Istocna Srbija — Zajecar, Bor i istok
UPDATE regions
    SET boundary = ST_GeomFromText(
        'MULTIPOLYGON(((21.5 43.8, 23.0 43.8, 23.0 44.7, 21.5 44.7, 21.5 43.8)))', 4326
    )::geography
    WHERE id = 4;

-- id=5: Vojvodina — autonomna pokrajina, severno od Save i Dunava
UPDATE regions
    SET boundary = ST_GeomFromText(
        'MULTIPOLYGON(((18.85 44.7, 23.0 44.7, 23.0 46.2, 18.85 46.2, 18.85 44.7)))', 4326
    )::geography
    WHERE id = 5;
