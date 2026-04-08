-- Migracija: dodavanje search_vector kolone i trigera za tabelu activities
-- Potrebno pokrenuti ako je baza podignuta pre ove izmene (commit 502823a)

ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE INDEX IF NOT EXISTS idx_activities_search_vector
    ON activities USING GIN (search_vector);

CREATE OR REPLACE TRIGGER trg_activities_search_vector
BEFORE INSERT OR UPDATE OF name, description ON activities
FOR EACH ROW EXECUTE FUNCTION sync_search_vector();

-- Populisanje search_vector za postojece redove
UPDATE activities
SET search_vector =
    setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;
