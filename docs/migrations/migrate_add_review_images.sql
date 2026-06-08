-- Adds a table for storing review images (up to 5 per review, validated app-side).
-- Images live on Cloudinary; we only store the secure URL + sort order.

CREATE TABLE IF NOT EXISTS review_images (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id   uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    image_url   text NOT NULL,
    sort_order  int  NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id);
