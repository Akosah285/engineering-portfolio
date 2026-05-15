export interface IsNewOptions {
  /** Number of days during which a course shows the "New" pill. Default 30. */
  windowDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Strip a Date to UTC midnight for calendar-day arithmetic. */
function toUtcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * True iff a course is "new" at build time — i.e., published within the last
 * `windowDays` calendar days (default 30), inclusive of the boundary.
 *
 * Calendar-day math: a course published "today" is age 0; published yesterday
 * is age 1; etc. Time-of-day is ignored. This is the correct semantics for a
 * publishedAt expressed as a `yyyy-mm-dd` ISO date.
 *
 * - `publishedAt` null/empty (Coming Soon) → false.
 * - Unparseable date strings → false (defensive: garbage in, "not new" out).
 * - Future-dated publications → false.
 *
 * The `now` parameter is required so the result is deterministic at build time
 * (Astro pages can pass `new Date()` once at the top of the route).
 */
export function isNew(
  publishedAt: string | null,
  now: Date,
  opts: IsNewOptions = {},
): boolean {
  if (publishedAt === null || publishedAt === "") return false;

  const ms = Date.parse(publishedAt);
  if (Number.isNaN(ms)) return false;

  const publishedDay = toUtcMidnight(new Date(ms));
  const nowDay = toUtcMidnight(now);

  if (publishedDay > nowDay) return false;

  const windowDays = opts.windowDays ?? 30;
  const ageDays = (nowDay - publishedDay) / DAY_MS;
  return ageDays <= windowDays;
}
