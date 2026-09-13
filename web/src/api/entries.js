import { request } from './client.js';

/**
 * @typedef {object} Entry
 * @property {number} id
 * @property {string} consumedAt  ISO timestamp.
 * @property {'breakfast'|'lunch'|'dinner'|'snacks'} mealType
 * @property {string} foodName
 * @property {number} quantity
 * @property {string | null} unit
 * @property {number} calories
 * @property {number} proteinG
 * @property {number} carbsG
 * @property {number} fatG
 * @property {Record<string, number>} micros
 * @property {'manual'|'photo'|'chat'|'import'} source
 */

/**
 * @typedef {object} EntryPage
 * @property {Entry[]} data
 * @property {{ page: number, limit: number, total: number, hasNext: boolean }} pagination
 */

/**
 * Lists entries, newest first.
 *
 * `from` and `to` are calendar dates (YYYY-MM-DD) and both ends are inclusive.
 *
 * @param {{ from?: string, to?: string, mealType?: string, page?: number, limit?: number }} [filters]
 * @returns {Promise<EntryPage>}
 */
export function listEntries(filters = {}) {
  return request('/entries', { query: filters });
}

/**
 * Creates an entry.
 *
 * @param {Partial<Entry>} entry  `mealType`, `foodName`, `quantity` and `calories` are required.
 * @returns {Promise<Entry>}
 */
export function createEntry(entry) {
  return request('/entries', { method: 'POST', body: entry });
}

/**
 * Updates the given fields of an entry.
 *
 * @param {number} id
 * @param {Partial<Entry>} patch  At least one field.
 * @returns {Promise<Entry>}
 * @throws {import('./client.js').ApiError} 404 if the entry is not yours.
 */
export function updateEntry(id, patch) {
  return request(`/entries/${id}`, { method: 'PATCH', body: patch });
}

/**
 * Deletes an entry.
 *
 * @param {number} id
 * @returns {Promise<null>}
 * @throws {import('./client.js').ApiError} 404 if the entry is not yours.
 */
export function deleteEntry(id) {
  return request(`/entries/${id}`, { method: 'DELETE' });
}
