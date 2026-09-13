import { request } from './client.js';

/**
 * @typedef {object} Goal
 * @property {number} id
 * @property {string} effectiveFrom  YYYY-MM-DD.
 * @property {number} dailyCalories
 * @property {number} proteinG
 * @property {number} carbsG
 * @property {number} fatG
 * @property {number | null} weightGoalKg
 * @property {string} createdAt
 */

/**
 * The goal in effect today.
 *
 * @returns {Promise<Goal>}
 * @throws {import('./client.js').ApiError} 404 when no goal has been set yet —
 *   an expected first-run state, not a failure. Callers show the empty state.
 */
export function getCurrentGoal() {
  return request('/goals/current');
}

/**
 * Paginated goal history, newest first.
 *
 * @param {{ page?: number, limit?: number }} [pagination]
 * @returns {Promise<{ data: Goal[], pagination: object }>}
 */
export function listGoals(pagination = {}) {
  return request('/goals', { query: pagination });
}

/**
 * Records a new dated goal. Goals are append-only: this never overwrites one.
 *
 * @param {{ dailyCalories: number, proteinG: number, carbsG: number, fatG: number,
 *   effectiveFrom?: string, weightGoalKg?: number | null }} goal
 * @returns {Promise<Goal & { warning: string | null }>} `warning` is set when the
 *   macro targets do not reconcile with the calorie target — advisory, not an error.
 */
export function createGoal(goal) {
  return request('/goals', { method: 'POST', body: goal });
}
