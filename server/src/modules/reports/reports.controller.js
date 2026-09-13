import * as reportsService from './reports.service.js';

/**
 * GET /api/reports/calorie-trend?from&to
 *
 * @type {import('express').RequestHandler}
 */
export async function getCalorieTrend(req, res) {
  const report = await reportsService.getCalorieTrend(req.user.id, req.validated.query);
  res.status(200).json(report);
}

/**
 * GET /api/reports/macros?from&to&granularity=day|week
 *
 * @type {import('express').RequestHandler}
 */
export async function getMacroBreakdown(req, res) {
  const report = await reportsService.getMacroBreakdown(req.user.id, req.validated.query);
  res.status(200).json(report);
}

/**
 * GET /api/reports/micros?from&to
 *
 * @type {import('express').RequestHandler}
 */
export async function getMicroSummary(req, res) {
  const report = await reportsService.getMicroSummary(req.user.id, req.validated.query);
  res.status(200).json(report);
}

/**
 * GET /api/reports/goal-vs-actual?from&to
 *
 * @type {import('express').RequestHandler}
 */
export async function getGoalVsActual(req, res) {
  const report = await reportsService.getGoalVsActual(req.user.id, req.validated.query);
  res.status(200).json(report);
}
