-- Data fix: Novi Sad city + destination were saved with region_id = 3
-- (Južna Srbija). Novi Sad is in Vojvodina (region_id = 5). The bad data
-- showed up in the place-create modal as a region "flip": the geographic
-- /api/region-by-coords endpoint correctly picked Vojvodina, then the
-- destination fuzzy-match arrived a moment later and overwrote it with the
-- destination's stored (wrong) region_id.
--
-- The frontend race is fixed in code (region-by-coords now wins ties); this
-- migration is the data half of the same fix.
--
-- Date: 2026-06-16

BEGIN;

UPDATE cities
   SET region_id = 5
 WHERE id = 4
   AND LOWER(name) = 'novi sad'
   AND region_id = 3;

UPDATE destinations
   SET region_id = 5
 WHERE LOWER(name) = 'novi sad'
   AND region_id = 3
   AND is_deleted = false;

COMMIT;

-- Verify:
--   SELECT id, name, region_id FROM cities WHERE LOWER(name) = 'novi sad';
--   SELECT id, name, region_id FROM destinations WHERE LOWER(name) = 'novi sad';
-- Both should report region_id = 5.
