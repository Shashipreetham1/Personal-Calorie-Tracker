/**
 * Calendar-date helpers.
 *
 * Dates that represent a day the user picked (a goal's effective date, a report
 * range) are handled as "YYYY-MM-DD" strings throughout, never as Date objects:
 * a Date is an instant and drags a timezone along with it, which is how a goal
 * dated the 13th ends up rendered as the 12th. See the DATE type parser in
 * db/pool.js.
 */

/**
 * Today in the server's timezone, as YYYY-MM-DD.
 *
 * Assumption: "today" is the server's day. In Docker the server runs in UTC, so
 * a user in UTC+5:30 filing an entry at 00:30 local is still on the previous
 * server day. Per-user timezones are listed in the README as future work.
 *
 * @returns {string}
 */
export function todayISODate() {
  return toISODate(new Date());
}

/**
 * Formats a Date as a calendar date in the server's timezone.
 *
 * Built from the local getters rather than `toISOString().slice(0, 10)`, which
 * would convert to UTC first and return the wrong day for half of every day.
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
 * Compared as UTC midnights so daylight-saving transitions cannot make a day
 * 23 or 25 hours long and skew the count.
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
