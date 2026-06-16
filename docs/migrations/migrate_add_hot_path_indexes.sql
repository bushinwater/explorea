-- Migration: add hot-path indexes used by admin list / stats / cleanup queries.
-- Date: 2026-06-15
--
-- Why each index exists is explained next to its CREATE statement. All
-- statements are idempotent (IF NOT EXISTS) and wrapped in a single
-- transaction, so re-running the file is safe.

BEGIN;

-- 1. popularity_logs: bulk 30-day scan per entity type.
--
-- The existing ix_pop_logs_lookup (entity_type, entity_id, user_id, source,
-- created_at) is fine for the per-row "did anyone click X recently?" case,
-- but the admin-panel list pages have moved to a pre-aggregation pattern:
--
--    SELECT DISTINCT entity_id
--    FROM   popularity_logs
--    WHERE  entity_type = 'activity'
--      AND  created_at  >= now() - interval '30 days';
--
-- That query wants (entity_type, created_at) as the leading columns; the
-- existing index has two unrelated columns between them so it falls back
-- to a much wider scan. Adding the trailing entity_id makes the index
-- index-only-scan-eligible (Postgres can satisfy the SELECT entirely from
-- the index without touching the heap).
CREATE INDEX IF NOT EXISTS ix_pop_logs_entity_time
    ON popularity_logs (entity_type, created_at DESC, entity_id);

-- 2. submission_queue: lookups by destination_id and by (destination_id, status).
--
-- Two hot paths need this:
--   a) The destination-restore guard (AdminPlace/Event/Activity RestoreAsync)
--      and SoftDeleteCleanupService both delete or count rows where
--      destination_id IN (...). Without an index this is a seq scan of the
--      whole queue.
--   b) Owner / TO stats pages count by (destination_id, status) buckets.
--
-- The composite covers both (destination_id-only queries can use the
-- leading-column prefix), so we don't need a separate single-column index.
CREATE INDEX IF NOT EXISTS ix_submission_queue_dest_status
    ON submission_queue (destination_id, status);

-- 3. places / events / activities: find soft-deleted rows by deleted_at.
--
-- The existing idx_*_destination indexes are partial WHERE is_deleted = false,
-- which means they explicitly EXCLUDE the soft-deleted rows. The cleanup
-- background service queries the opposite half:
--
--    WHERE is_deleted = TRUE AND deleted_at < now() - interval '30 days';
--
-- Without a partial index on the deleted half, the daily cleanup tick has
-- to seq-scan the whole table. These three indexes are tiny (only the
-- deleted rows, which are <1% of the table) and target exactly that query.
CREATE INDEX IF NOT EXISTS ix_places_deleted_at
    ON places (deleted_at)
    WHERE is_deleted = TRUE;

CREATE INDEX IF NOT EXISTS ix_events_deleted_at
    ON events (deleted_at)
    WHERE is_deleted = TRUE;

CREATE INDEX IF NOT EXISTS ix_activities_deleted_at
    ON activities (deleted_at)
    WHERE is_deleted = TRUE;

CREATE INDEX IF NOT EXISTS ix_destinations_deleted_at
    ON destinations (deleted_at)
    WHERE is_deleted = TRUE;

-- 4. users: same shape as the entity tables.
--
-- UserPurgeService runs `WHERE deleted_at IS NOT NULL AND deleted_at < cutoff`
-- once a day. Negligible cost today, but the partial index keeps the daily
-- tick instant as the table grows.
CREATE INDEX IF NOT EXISTS ix_users_deleted_at
    ON users (deleted_at)
    WHERE deleted_at IS NOT NULL;

COMMIT;

-- After applying, verify with:
--   \d popularity_logs
--   \d submission_queue
--   SELECT indexname FROM pg_indexes WHERE schemaname='public'
--    AND indexname LIKE 'ix_%' ORDER BY indexname;
