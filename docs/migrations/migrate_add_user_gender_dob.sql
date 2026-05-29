-- Migration: add gender and date_of_birth to users table
-- Date: 2026-04-08

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS gender             VARCHAR(20),
    ADD COLUMN IF NOT EXISTS date_of_birth      DATE,
    ADD COLUMN IF NOT EXISTS profile_image_url  VARCHAR(500);
