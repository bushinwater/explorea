import type { ReportQueueItem } from '../../reports/admin-reports.models';

const STORAGE_KEY = 'reports_pending_queue';

/**
 * Appends items to the persisted Reports Builder queue (kept in sessionStorage).
 * Lets users accumulate reports from multiple entity preview panels without
 * losing what was already queued.
 */
export function appendToReportsQueue(newItems: ReportQueueItem[]): void {
  if (!newItems.length) return;
  let existing: ReportQueueItem[] = [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) existing = parsed;
    }
  } catch {
    existing = [];
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...newItems]));
  } catch {
    /* quota errors are non-fatal */
  }
}
