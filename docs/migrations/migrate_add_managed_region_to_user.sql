ALTER TABLE users
ADD COLUMN IF NOT EXISTS managed_region_id INT;

ALTER TABLE users
ADD CONSTRAINT fk_users_managed_region FOREIGN KEY (managed_region_id) REFERENCES regions (id);