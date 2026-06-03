-- Add country_id to users for super_admin and tourist_organization roles
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS country_id INT REFERENCES countries(id);

-- Set Serbia (id=1) for all existing superadmins and TOs
UPDATE users
SET country_id = 1
WHERE role_id IN (
    SELECT id FROM roles WHERE name IN ('super_admin', 'tourist_organization')
);
