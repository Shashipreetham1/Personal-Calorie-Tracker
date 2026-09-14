import { request, upload } from './client.js';

/**
 * @typedef {object} ImportDraft
 * @property {string} consumedAt  ISO timestamp read from the document.
 * @property {'breakfast'|'lunch'|'dinner'|'snacks'} mealType
 * @property {string} foodName
 * @property {number} quantity
 * @property {string | null} unit
 * @property {number} calories
 * @property {number} proteinG
 * @property {number} carbsG
 * @property {number} fatG
 * @property {Record<string, number>} micros
 */

/**
 * Parses a food diary PDF into draft entries. **Saves nothing.**
 *
 * @param {File} file  A PDF, at most 5MB.
 * @returns {Promise<{ extractionId: number, rowsDetected: number, notes: string, drafts: ImportDraft[] }>}
 */
export function importPdf(file) {
  return upload('/import/pdf', { field: 'file', file });
}

/**
 * Imports the rows the user reviewed and accepted.
 *
 * Each row is validated on its own, so one bad row never costs the user the
 * rest — rejections come back with their position and reason.
 *
 * @param {ImportDraft[]} entries
 * @returns {Promise<{ imported: number, rejected: number, entries: object[],
 *   rejectedRows: { index: number, foodName: string | null, errors: { field: string, message: string }[] }[] }>}
 */
export function confirmImport(entries) {
  return request('/import/confirm', { method: 'POST', body: { entries } });
}
