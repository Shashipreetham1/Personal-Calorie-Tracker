import { request } from './client.js';

/**
 * Report endpoints.
 *
 * Every one aggregates in SQL and returns chart-ready arrays. Ranges are
 * inclusive calendar dates; days with no entries come back as zero rows rather
 * than being omitted, so a chart drawn from the result never joins one day
 * straight to the next across a gap.
 */

/**
 * Daily calorie totals.
 *
 * @param {{ from?: string, to?: string }} range
 * @returns {Promise<{ from: string, to: string, data: { day: string, calories: number, entryCount: number }[] }>}
 */
export function getCalorieTrend(range) {
  return request('/reports/calorie-trend', { query: range });
}

/**
 * Macro totals per day or per ISO week.
 *
 * @param {{ from?: string, to?: string, granularity?: 'day' | 'week' }} options
 * @returns {Promise<{ from: string, to: string, granularity: string,
 *   data: { bucket: string, calories: number, proteinG: number, carbsG: number, fatG: number, entryCount: number }[] }>}
 */
export function getMacroBreakdown(options) {
  return request('/reports/macros', { query: options });
}

/**
 * Micronutrient totals for the range, largest first.
 *
 * @param {{ from?: string, to?: string }} range
 * @returns {Promise<{ from: string, to: string, data: { key: string, total: number, entryCount: number }[] }>}
 */
export function getMicroSummary(range) {
  return request('/reports/micros', { query: range });
}

/**
 * Each day's intake against the goal that applied on that day.
 *
 * `goalCalories` is null for days before the user's first goal — there was no
 * target then, and the chart should show no target line rather than a zero one.
 *
 * @param {{ from?: string, to?: string }} range
 * @returns {Promise<{ from: string, to: string, data: object[] }>}
 */
export function getGoalVsActual(range) {
  return request('/reports/goal-vs-actual', { query: range });
}
