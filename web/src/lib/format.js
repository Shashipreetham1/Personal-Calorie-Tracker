/**
 * Display helpers.
 *
 * Nutrition numbers arrive as floats. Rendering 249.60000000000002 kcal would
 * be absurd, so every number shown to a user passes through here.
 */

/**
 * Rounds to a whole number for display.
 *
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function formatCalories(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

/**
 * Grams, with one decimal only when it says something.
 *
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function formatGrams(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

/**
 * A quantity with its unit, e.g. "2 pieces" or "1".
 *
 * @param {number} quantity
 * @param {string | null} unit
 * @returns {string}
 */
export function formatQuantity(quantity, unit) {
  const amount = formatGrams(quantity);
  return unit ? `${amount} ${unit}` : amount;
}

/**
 * The timezone every date and time in the UI is rendered in.
 *
 * The server aggregates reports by ITS day boundaries (UTC in Docker). Using
 * the viewer's zone instead would put an entry on a different day in History
 * than Reports counts it in — a 20:30 dinner reads as 02:00 the next morning at
 * UTC+5:30. Per-user timezones are listed in the README as future work.
 */
export const DISPLAY_TIMEZONE = 'UTC';

/**
 * The clock time of an ISO timestamp.
 *
 * @param {string} isoTimestamp
 * @returns {string}
 */
export function formatTime(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
  });
}

/**
 * A readable date, e.g. "Sat, 13 Sep".
 *
 * @param {string} isoDateOrTimestamp
 * @returns {string}
 */
export function formatDate(isoDateOrTimestamp) {
  // A plain YYYY-MM-DD is a calendar date, not an instant. Parsing it as UTC
  // midnight and formatting in UTC returns the day that was written; parsing it
  // as local midnight would shift it a day west of Greenwich.
  const date =
    isoDateOrTimestamp.length === 10
      ? new Date(`${isoDateOrTimestamp}T00:00:00Z`)
      : new Date(isoDateOrTimestamp);

  return date.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: DISPLAY_TIMEZONE,
  });
}

/**
 * Today as YYYY-MM-DD, in the display timezone.
 *
 * Deliberately the server's day, not the browser's: "Today" must mean the same
 * range the API filters and reports on, or a user just past midnight would see
 * an empty screen while the server still considers it yesterday.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function toISODate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * An ISO timestamp for a `datetime-local` input value, and back.
 *
 * A `datetime-local` value has no timezone; treating it as local time is what
 * the user means when they type it.
 */
export const datetimeLocal = {
  /**
   * Formats an instant for a `datetime-local` input, in the display timezone —
   * so the time the user sees while adding an entry is the time the listing
   * will show afterwards.
   *
   * @param {Date} date
   * @returns {string}
   */
  from(date) {
    return date.toISOString().slice(0, 16);
  },

  /**
   * Reads a `datetime-local` value back as an instant. The input carries no
   * zone, and it was rendered in the display timezone, so it is read as that.
   *
   * @param {string} value
   * @returns {string} ISO 8601
   */
  toISO(value) {
    return new Date(`${value}:00Z`).toISOString();
  },
};

/** Labels and display order for the four meal buckets. */
export const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

/**
 * Renders an assistant reply as plain text.
 *
 * The model is asked for plain prose but reaches for markdown by habit, and a
 * stray `**Calories:**` in a chat bubble looks broken. Stripping at display
 * time works even on the turn the model forgets. Not a markdown renderer — a
 * parser would be a dependency for a few characters of cleanup.
 *
 * @param {string} text
 * @returns {string}
 */
export function toPlainText(text) {
  if (!text) return '';

  return text
    .replace(/^#{1,6}[ \t]+/gm, '')            // headings
    .replace(/^[ \t]*[*+-][ \t]+/gm, '• ')     // bullets, before the emphasis rules
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // bold
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1') // italics
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .trim();
}
