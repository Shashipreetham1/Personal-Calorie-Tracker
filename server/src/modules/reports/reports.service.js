import * as reportsRepository from './reports.repository.js';

/**
 * Report services.
 *
 * Each one is a thin pass-through that attaches the resolved range to the
 * result. They stay callable without HTTP because the `weekly_summary`
 * chat tool runs these exact functions — the model narrates real SQL output
 * rather than counting rows itself.
 */

/**
 * Daily calorie totals, with zero rows for days that have no entries.
 *
 * @param {number} userId
 * @param {import('./reports.schema.js').ReportRange} range
 * @returns {Promise<{ from: string, to: string, data: object[] }>}
 */
export async function getCalorieTrend(userId, range) {
  const data = await reportsRepository.getCalorieTrend(userId, range);

  return { ...range, data };
}

/**
 * Macro totals bucketed by day or week.
 *
 * @param {number} userId
 * @param {{ from: string, to: string, granularity: 'day' | 'week' }} options
 * @returns {Promise<{ from: string, to: string, granularity: string, data: object[] }>}
 */
export async function getMacroBreakdown(userId, options) {
  const data = await reportsRepository.getMacroBreakdown(userId, options);

  return { ...options, data };
}

/**
 * Micronutrient totals for the range, largest first.
 *
 * @param {number} userId
 * @param {import('./reports.schema.js').ReportRange} range
 * @returns {Promise<{ from: string, to: string, data: object[] }>}
 */
export async function getMicroSummary(userId, range) {
  const data = await reportsRepository.getMicroSummary(userId, range);

  return { ...range, data };
}

/**
 * Each day's intake against the goal that applied that day.
 *
 * @param {number} userId
 * @param {import('./reports.schema.js').ReportRange} range
 * @returns {Promise<{ from: string, to: string, data: object[] }>}
 */
export async function getGoalVsActual(userId, range) {
  const data = await reportsRepository.getGoalVsActual(userId, range);

  return { ...range, data };
}
