-- Migration: allow overnight working-hour intervals (e.g. 21:00 - 02:00).
--
-- The previous constraint was CHECK (closes_at > opens_at) which made it
-- impossible to enter "21:00 to midnight" because TIME comparison treats
-- 00:00 < 21:00. Bars, clubs, restaurants etc. that work past midnight
-- couldn't be modeled at all.
--
-- New constraint allows any pair where opens != closes; the meaning of
-- "closes_at < opens_at" is "shift wraps to next day", and the IsOpenNow
-- logic in PlacesController + SearchPageRepository is updated in the same
-- branch to look at the previous day's overnight interval too.
--
-- Date: 2026-06-16

BEGIN;

ALTER TABLE place_working_hour_intervals
    DROP CONSTRAINT IF EXISTS place_working_hour_intervals_check;

ALTER TABLE place_working_hour_intervals
    ADD CONSTRAINT place_working_hour_intervals_check
    CHECK (opens_at <> closes_at);

COMMIT;
