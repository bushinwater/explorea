ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS marketing_emails_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_report_topics VARCHAR(255) NOT NULL DEFAULT 'reviews,events,system',
ADD COLUMN IF NOT EXISTS notification_priority VARCHAR(30) NOT NULL DEFAULT 'all',
ADD COLUMN IF NOT EXISTS notification_delivery_frequency_days INTEGER NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS notification_delivery_hour INTEGER NOT NULL DEFAULT 9,
ADD COLUMN IF NOT EXISTS notification_reports_last_sent_at TIMESTAMPTZ NULL;
