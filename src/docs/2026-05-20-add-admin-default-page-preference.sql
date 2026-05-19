ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS default_admin_page VARCHAR(80) NOT NULL DEFAULT 'dashboard';

