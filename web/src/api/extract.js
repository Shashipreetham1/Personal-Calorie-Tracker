import { upload } from './client.js';

/**
 * @typedef {object} ExtractedDraft
 * @property {string} foodName
 * @property {number} quantity
 * @property {string | null} unit
 * @property {number} calories
 * @property {number} proteinG
 * @property {number} carbsG
 * @property {number} fatG
 * @property {Record<string, number>} micros
 * @property {'photo'} source
 * @property {number} confidence  0–1, per item.
 */

/**
 * Extracts nutrition information from a photo.
 *
 * Returns drafts to review; **nothing is saved** until `createEntry`.
 *
 * @param {File} file  JPEG, PNG or WebP, at most 5MB.
 * @param {{ type?: 'label' | 'plate' }} [options]  Omit to let the model decide.
 * @returns {Promise<{ sourceType: 'label'|'plate', isEstimate: boolean, confidence: number,
 *   notes: string, drafts: ExtractedDraft[] }>}
 */
export function extractFromImage(file, { type } = {}) {
  return upload('/extract/image', { field: 'image', file, query: type ? { type } : {} });
}
