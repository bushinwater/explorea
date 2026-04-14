-- Migration: add icon column to interest_tags
ALTER TABLE interest_tags
    ADD COLUMN IF NOT EXISTS icon VARCHAR(100);

-- Seed icons for existing tags
UPDATE interest_tags SET icon = 'park'           WHERE name = 'Priroda';
UPDATE interest_tags SET icon = 'hiking'          WHERE name = 'Avantura';
UPDATE interest_tags SET icon = 'spa'             WHERE name = 'Wellness';
UPDATE interest_tags SET icon = 'restaurant'      WHERE name = 'Hrana';
UPDATE interest_tags SET icon = 'museum'          WHERE name = 'Kultura';
UPDATE interest_tags SET icon = 'nightlife'        WHERE name = 'Noćni život';
UPDATE interest_tags SET icon = 'family_restroom'  WHERE name = 'Porodični odmor';
UPDATE interest_tags SET icon = 'sports'           WHERE name = 'Sport';
UPDATE interest_tags SET icon = 'photo_camera'     WHERE name = 'Fotografija';
UPDATE interest_tags SET icon = 'account_balance'  WHERE name = 'Istorija';
