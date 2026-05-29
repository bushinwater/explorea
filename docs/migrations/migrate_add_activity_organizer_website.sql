-- Migration: add organizer_website column to activities table
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS organizer_website VARCHAR(500);
