-- Add country_id FK to regions table so each region belongs to a country
ALTER TABLE regions
    ADD COLUMN IF NOT EXISTS country_id INT REFERENCES countries(id);

-- Assign existing regions (id 1-5) to Serbia (country id 1)
UPDATE regions SET country_id = 1 WHERE id BETWEEN 1 AND 5;
