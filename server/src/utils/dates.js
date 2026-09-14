/**
 * Calendar-date helpers.
 *
 * A day the user picked (a goal's effective date, a report range) is handled as
 * a "YYYY-MM-DD" string, never a Date: a Date is an instant and drags a
 * timezone with it, which is how a goal dated the 13th renders as the 12th.
 */

/**
 * Today in the server's timezone, as YYYY-MM-DD.
 *
 * "Today" is the server's day — in Docker, UTC. Per-user timezones are listed
 * in the README as future work.
 *
 * @returns {string}
 */
export function todayISODate() {
  return toISODate(new Date());
}

/**
 * Formats a Date as a calendar date in the server's timezone.
 *
 * Uses local getters, not `toISOString().slice(0, 10)` — that converts to UTC
 * first and returns the wrong day for half of every day.
 *
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Whole days between two calendar dates, inclusive of both ends.
 *
 * Compared as UTC midnights so a DST transition cannot skew the count.
 *
 * @param {string} from  YYYY-MM-DD
 * @param {string} to    YYYY-MM-DD
 * @returns {number}
 */
export function daysBetweenInclusive(from, to) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  return Math.round((end - start) / MS_PER_DAY) + 1;
}
