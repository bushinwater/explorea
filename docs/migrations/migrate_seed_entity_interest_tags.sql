-- Migration: seed interest tag assignments for all entities
-- Auto-assigns tags based on entity type/category names (ILIKE matching)
-- Idempotent: ON CONFLICT DO NOTHING

-- ============================================================
-- DESTINATIONS
-- Kultura + Fotografija for every destination (universal)
-- Additional tags based on name keywords
-- ============================================================

INSERT INTO destination_interest_tags (destination_id, interest_tag_id)
SELECT d.id, t.id
FROM destinations d
CROSS JOIN interest_tags t
WHERE t.name IN ('Kultura', 'Fotografija')
  AND d.is_deleted = FALSE
ON CONFLICT DO NOTHING;

INSERT INTO destination_interest_tags (destination_id, interest_tag_id)
SELECT d.id, t.id
FROM destinations d
CROSS JOIN interest_tags t
WHERE t.name IN ('Priroda', 'Avantura')
  AND d.is_deleted = FALSE
  AND (
    LOWER(d.name) LIKE '%planina%' OR LOWER(d.name) LIKE '%mountain%'
    OR LOWER(d.name) LIKE '%šuma%'  OR LOWER(d.name) LIKE '%suma%'
    OR LOWER(d.name) LIKE '%park%'  OR LOWER(d.name) LIKE '%jezero%'
    OR LOWER(d.name) LIKE '%reka%'  OR LOWER(d.name) LIKE '%klisura%'
    OR LOWER(d.name) LIKE '%kanjon%' OR LOWER(d.name) LIKE '%pecina%'
    OR LOWER(d.name) LIKE '%pećina%' OR LOWER(d.name) LIKE '%zlatibor%'
    OR LOWER(d.name) LIKE '%kopaonik%' OR LOWER(d.name) LIKE '%tara%'
    OR LOWER(d.name) LIKE '%divčibare%' OR LOWER(d.name) LIKE '%fruška%'
  )
ON CONFLICT DO NOTHING;

INSERT INTO destination_interest_tags (destination_id, interest_tag_id)
SELECT d.id, t.id
FROM destinations d
CROSS JOIN interest_tags t
WHERE t.name IN ('Istorija')
  AND d.is_deleted = FALSE
  AND (
    LOWER(d.name) LIKE '%stari%'    OR LOWER(d.name) LIKE '%grad%'
    OR LOWER(d.name) LIKE '%tvrđava%' OR LOWER(d.name) LIKE '%tvrdjava%'
    OR LOWER(d.name) LIKE '%manastir%' OR LOWER(d.name) LIKE '%fortress%'
    OR LOWER(d.name) LIKE '%kalemegdan%' OR LOWER(d.name) LIKE '%petrovaradin%'
  )
ON CONFLICT DO NOTHING;

INSERT INTO destination_interest_tags (destination_id, interest_tag_id)
SELECT d.id, t.id
FROM destinations d
CROSS JOIN interest_tags t
WHERE t.name = 'Wellness'
  AND d.is_deleted = FALSE
  AND (
    LOWER(d.name) LIKE '%banja%' OR LOWER(d.name) LIKE '%spa%'
    OR LOWER(d.name) LIKE '%vrnjač%' OR LOWER(d.name) LIKE '%sokobanja%'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- PLACES  (join via place_types)
-- ============================================================

-- Accommodation → Wellness + Porodični odmor
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
JOIN place_types pt ON pt.id = p.type_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Wellness', 'Porodični odmor')
  AND p.is_deleted = FALSE
  AND (
    LOWER(pt.name) LIKE '%hotel%'   OR LOWER(pt.name) LIKE '%motel%'
    OR LOWER(pt.name) LIKE '%hostel%' OR LOWER(pt.name) LIKE '%pansion%'
    OR LOWER(pt.name) LIKE '%pension%' OR LOWER(pt.name) LIKE '%vila%'
    OR LOWER(pt.name) LIKE '%villa%'  OR LOWER(pt.name) LIKE '%resort%'
    OR LOWER(pt.name) LIKE '%smeštaj%' OR LOWER(pt.name) LIKE '%apartman%'
    OR LOWER(pt.name) LIKE '%apartment%'
  )
ON CONFLICT DO NOTHING;

-- Restaurants / Cafes → Hrana
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
JOIN place_types pt ON pt.id = p.type_id
CROSS JOIN interest_tags t
WHERE t.name = 'Hrana'
  AND p.is_deleted = FALSE
  AND (
    LOWER(pt.name) LIKE '%restoran%' OR LOWER(pt.name) LIKE '%restaurant%'
    OR LOWER(pt.name) LIKE '%kafić%'  OR LOWER(pt.name) LIKE '%kafic%'
    OR LOWER(pt.name) LIKE '%café%'   OR LOWER(pt.name) LIKE '%cafe%'
    OR LOWER(pt.name) LIKE '%picerija%' OR LOWER(pt.name) LIKE '%pizza%'
    OR LOWER(pt.name) LIKE '%fast food%' OR LOWER(pt.name) LIKE '%pekara%'
    OR LOWER(pt.name) LIKE '%slastičar%'
  )
ON CONFLICT DO NOTHING;

-- Bars / Clubs → Noćni život + Hrana
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
JOIN place_types pt ON pt.id = p.type_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Noćni život', 'Hrana')
  AND p.is_deleted = FALSE
  AND (
    LOWER(pt.name) LIKE '%bar%'   OR LOWER(pt.name) LIKE '%pub%'
    OR LOWER(pt.name) LIKE '%klub%' OR LOWER(pt.name) LIKE '%club%'
    OR LOWER(pt.name) LIKE '%noćni%' OR LOWER(pt.name) LIKE '%nocni%'
    OR LOWER(pt.name) LIKE '%disco%' OR LOWER(pt.name) LIKE '%lounge%'
  )
ON CONFLICT DO NOTHING;

-- Museums / Galleries → Kultura + Istorija
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
JOIN place_types pt ON pt.id = p.type_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Kultura', 'Istorija')
  AND p.is_deleted = FALSE
  AND (
    LOWER(pt.name) LIKE '%muzej%'   OR LOWER(pt.name) LIKE '%museum%'
    OR LOWER(pt.name) LIKE '%galerij%' OR LOWER(pt.name) LIKE '%gallery%'
    OR LOWER(pt.name) LIKE '%izložb%'  OR LOWER(pt.name) LIKE '%exhibit%'
    OR LOWER(pt.name) LIKE '%tvrđava%' OR LOWER(pt.name) LIKE '%church%'
    OR LOWER(pt.name) LIKE '%crkva%'   OR LOWER(pt.name) LIKE '%manastir%'
    OR LOWER(pt.name) LIKE '%monument%' OR LOWER(pt.name) LIKE '%heritage%'
  )
ON CONFLICT DO NOTHING;

-- Spa / Wellness → Wellness
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
JOIN place_types pt ON pt.id = p.type_id
CROSS JOIN interest_tags t
WHERE t.name = 'Wellness'
  AND p.is_deleted = FALSE
  AND (
    LOWER(pt.name) LIKE '%spa%'   OR LOWER(pt.name) LIKE '%wellness%'
    OR LOWER(pt.name) LIKE '%banja%' OR LOWER(pt.name) LIKE '%sauna%'
  )
ON CONFLICT DO NOTHING;

-- Sports / Fitness → Sport
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
JOIN place_types pt ON pt.id = p.type_id
CROSS JOIN interest_tags t
WHERE t.name = 'Sport'
  AND p.is_deleted = FALSE
  AND (
    LOWER(pt.name) LIKE '%sport%'  OR LOWER(pt.name) LIKE '%fitnes%'
    OR LOWER(pt.name) LIKE '%fitness%' OR LOWER(pt.name) LIKE '%gym%'
    OR LOWER(pt.name) LIKE '%bazen%'   OR LOWER(pt.name) LIKE '%stadion%'
    OR LOWER(pt.name) LIKE '%stadium%'
  )
ON CONFLICT DO NOTHING;

-- Parks / Nature → Priroda + Fotografija
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
JOIN place_types pt ON pt.id = p.type_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Priroda', 'Fotografija')
  AND p.is_deleted = FALSE
  AND (
    LOWER(pt.name) LIKE '%park%'    OR LOWER(pt.name) LIKE '%priroda%'
    OR LOWER(pt.name) LIKE '%nature%' OR LOWER(pt.name) LIKE '%beach%'
    OR LOWER(pt.name) LIKE '%plaza%'  OR LOWER(pt.name) LIKE '%viewpoint%'
    OR LOWER(pt.name) LIKE '%vidikovac%' OR LOWER(pt.name) LIKE '%waterfall%'
    OR LOWER(pt.name) LIKE '%vodopad%'
  )
ON CONFLICT DO NOTHING;

-- Fallback: places with no tags yet → Kultura + Fotografija
INSERT INTO place_interest_tags (place_id, interest_tag_id)
SELECT p.id, t.id
FROM places p
CROSS JOIN interest_tags t
WHERE t.name IN ('Kultura', 'Fotografija')
  AND p.is_deleted = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM place_interest_tags pit WHERE pit.place_id = p.id
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- EVENTS  (join via event_types)
-- ============================================================

-- Music / Concert → Noćni život + Kultura
INSERT INTO event_interest_tags (event_id, interest_tag_id)
SELECT e.id, t.id
FROM events e
JOIN event_types et ON et.id = e.type_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Noćni život', 'Kultura')
  AND e.is_deleted = FALSE
  AND (
    LOWER(et.name) LIKE '%muzik%' OR LOWER(et.name) LIKE '%music%'
    OR LOWER(et.name) LIKE '%koncert%' OR LOWER(et.name) LIKE '%concert%'
    OR LOWER(et.name) LIKE '%festival%'
  )
ON CONFLICT DO NOTHING;

-- Theater / Art / Exhibition → Kultura
INSERT INTO event_interest_tags (event_id, interest_tag_id)
SELECT e.id, t.id
FROM events e
JOIN event_types et ON et.id = e.type_id
CROSS JOIN interest_tags t
WHERE t.name = 'Kultura'
  AND e.is_deleted = FALSE
  AND (
    LOWER(et.name) LIKE '%pozorišt%' OR LOWER(et.name) LIKE '%theater%'
    OR LOWER(et.name) LIKE '%theatre%' OR LOWER(et.name) LIKE '%izložb%'
    OR LOWER(et.name) LIKE '%exhibit%' OR LOWER(et.name) LIKE '%art%'
    OR LOWER(et.name) LIKE '%umetnost%' OR LOWER(et.name) LIKE '%film%'
    OR LOWER(et.name) LIKE '%kino%'
  )
ON CONFLICT DO NOTHING;

-- Sports events → Sport
INSERT INTO event_interest_tags (event_id, interest_tag_id)
SELECT e.id, t.id
FROM events e
JOIN event_types et ON et.id = e.type_id
CROSS JOIN interest_tags t
WHERE t.name = 'Sport'
  AND e.is_deleted = FALSE
  AND (
    LOWER(et.name) LIKE '%sport%' OR LOWER(et.name) LIKE '%trka%'
    OR LOWER(et.name) LIKE '%race%' OR LOWER(et.name) LIKE '%maraton%'
    OR LOWER(et.name) LIKE '%marathon%' OR LOWER(et.name) LIKE '%turnir%'
    OR LOWER(et.name) LIKE '%tournament%'
  )
ON CONFLICT DO NOTHING;

-- Food events → Hrana
INSERT INTO event_interest_tags (event_id, interest_tag_id)
SELECT e.id, t.id
FROM events e
JOIN event_types et ON et.id = e.type_id
CROSS JOIN interest_tags t
WHERE t.name = 'Hrana'
  AND e.is_deleted = FALSE
  AND (
    LOWER(et.name) LIKE '%hrana%' OR LOWER(et.name) LIKE '%food%'
    OR LOWER(et.name) LIKE '%gastro%' OR LOWER(et.name) LIKE '%kulinars%'
    OR LOWER(et.name) LIKE '%vino%'   OR LOWER(et.name) LIKE '%wine%'
    OR LOWER(et.name) LIKE '%pivo%'   OR LOWER(et.name) LIKE '%beer%'
  )
ON CONFLICT DO NOTHING;

-- Outdoor / Nature events → Priroda + Avantura
INSERT INTO event_interest_tags (event_id, interest_tag_id)
SELECT e.id, t.id
FROM events e
JOIN event_types et ON et.id = e.type_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Priroda', 'Avantura')
  AND e.is_deleted = FALSE
  AND (
    LOWER(et.name) LIKE '%outdoor%' OR LOWER(et.name) LIKE '%priroda%'
    OR LOWER(et.name) LIKE '%nature%' OR LOWER(et.name) LIKE '%planinari%'
    OR LOWER(et.name) LIKE '%hiking%' OR LOWER(et.name) LIKE '%avantura%'
  )
ON CONFLICT DO NOTHING;

-- Fallback: events with no tags yet → Kultura
INSERT INTO event_interest_tags (event_id, interest_tag_id)
SELECT e.id, t.id
FROM events e
CROSS JOIN interest_tags t
WHERE t.name = 'Kultura'
  AND e.is_deleted = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM event_interest_tags eit WHERE eit.event_id = e.id
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- ACTIVITIES  (join via activity_categories)
-- ============================================================

-- Outdoor / Hiking → Priroda + Avantura
INSERT INTO activity_interest_tags (activity_id, interest_tag_id)
SELECT a.id, t.id
FROM activities a
JOIN activity_categories ac ON ac.id = a.category_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Priroda', 'Avantura')
  AND a.is_deleted = FALSE
  AND (
    LOWER(ac.name) LIKE '%outdoor%'   OR LOWER(ac.name) LIKE '%planinar%'
    OR LOWER(ac.name) LIKE '%hiking%'  OR LOWER(ac.name) LIKE '%priroda%'
    OR LOWER(ac.name) LIKE '%nature%'  OR LOWER(ac.name) LIKE '%avantura%'
    OR LOWER(ac.name) LIKE '%adventure%' OR LOWER(ac.name) LIKE '%trek%'
    OR LOWER(ac.name) LIKE '%rafting%' OR LOWER(ac.name) LIKE '%zipline%'
    OR LOWER(ac.name) LIKE '%climbing%' OR LOWER(ac.name) LIKE '%penjanje%'
  )
ON CONFLICT DO NOTHING;

-- Sports → Sport + Avantura
INSERT INTO activity_interest_tags (activity_id, interest_tag_id)
SELECT a.id, t.id
FROM activities a
JOIN activity_categories ac ON ac.id = a.category_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Sport', 'Avantura')
  AND a.is_deleted = FALSE
  AND (
    LOWER(ac.name) LIKE '%sport%'  OR LOWER(ac.name) LIKE '%fitnes%'
    OR LOWER(ac.name) LIKE '%fitness%' OR LOWER(ac.name) LIKE '%cycling%'
    OR LOWER(ac.name) LIKE '%bicikl%'  OR LOWER(ac.name) LIKE '%plivanje%'
    OR LOWER(ac.name) LIKE '%swimming%' OR LOWER(ac.name) LIKE '%ski%'
    OR LOWER(ac.name) LIKE '%snowboard%'
  )
ON CONFLICT DO NOTHING;

-- Culture / History → Kultura + Istorija
INSERT INTO activity_interest_tags (activity_id, interest_tag_id)
SELECT a.id, t.id
FROM activities a
JOIN activity_categories ac ON ac.id = a.category_id
CROSS JOIN interest_tags t
WHERE t.name IN ('Kultura', 'Istorija')
  AND a.is_deleted = FALSE
  AND (
    LOWER(ac.name) LIKE '%kultura%' OR LOWER(ac.name) LIKE '%culture%'
    OR LOWER(ac.name) LIKE '%istorija%' OR LOWER(ac.name) LIKE '%history%'
    OR LOWER(ac.name) LIKE '%heritage%' OR LOWER(ac.name) LIKE '%tour%'
    OR LOWER(ac.name) LIKE '%tura%'     OR LOWER(ac.name) LIKE '%sightseeing%'
  )
ON CONFLICT DO NOTHING;

-- Family → Porodični odmor
INSERT INTO activity_interest_tags (activity_id, interest_tag_id)
SELECT a.id, t.id
FROM activities a
JOIN activity_categories ac ON ac.id = a.category_id
CROSS JOIN interest_tags t
WHERE t.name = 'Porodični odmor'
  AND a.is_deleted = FALSE
  AND (
    LOWER(ac.name) LIKE '%porodic%' OR LOWER(ac.name) LIKE '%family%'
    OR LOWER(ac.name) LIKE '%deca%'  OR LOWER(ac.name) LIKE '%kids%'
    OR LOWER(ac.name) LIKE '%children%'
  )
ON CONFLICT DO NOTHING;

-- Wellness / Relaxation → Wellness
INSERT INTO activity_interest_tags (activity_id, interest_tag_id)
SELECT a.id, t.id
FROM activities a
JOIN activity_categories ac ON ac.id = a.category_id
CROSS JOIN interest_tags t
WHERE t.name = 'Wellness'
  AND a.is_deleted = FALSE
  AND (
    LOWER(ac.name) LIKE '%wellness%' OR LOWER(ac.name) LIKE '%relax%'
    OR LOWER(ac.name) LIKE '%spa%'   OR LOWER(ac.name) LIKE '%yoga%'
    OR LOWER(ac.name) LIKE '%meditac%'
  )
ON CONFLICT DO NOTHING;

-- Food / Cooking → Hrana
INSERT INTO activity_interest_tags (activity_id, interest_tag_id)
SELECT a.id, t.id
FROM activities a
JOIN activity_categories ac ON ac.id = a.category_id
CROSS JOIN interest_tags t
WHERE t.name = 'Hrana'
  AND a.is_deleted = FALSE
  AND (
    LOWER(ac.name) LIKE '%hrana%'   OR LOWER(ac.name) LIKE '%food%'
    OR LOWER(ac.name) LIKE '%gastro%' OR LOWER(ac.name) LIKE '%kuvar%'
    OR LOWER(ac.name) LIKE '%cooking%' OR LOWER(ac.name) LIKE '%wine%'
    OR LOWER(ac.name) LIKE '%vino%'
  )
ON CONFLICT DO NOTHING;

-- Fallback: activities with no tags yet → Avantura + Priroda
INSERT INTO activity_interest_tags (activity_id, interest_tag_id)
SELECT a.id, t.id
FROM activities a
CROSS JOIN interest_tags t
WHERE t.name IN ('Avantura', 'Priroda')
  AND a.is_deleted = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM activity_interest_tags ait WHERE ait.activity_id = a.id
  )
ON CONFLICT DO NOTHING;
