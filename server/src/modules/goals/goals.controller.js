import * as goalsService from './goals.service.js';

/**
 * POST /api/goals → 201 with the new goal.
 *
 * The body carries a `warning` field (null when the macros reconcile) rather
 * than failing the request — see `reconcileMacros`.
 *
 * @type {import('express').RequestHandler}
 */
export async function create(req, res) {
  const goal = await goalsService.create(req.user.id, req.validated.body);
  res.status(201).json(goal);
}

/**
 * GET /api/goals/current → 200 with the goal in effect today,
 * or 404 when the user has not set one yet.
 *
 * @type {import('express').RequestHandler}
 */
export async function getCurrent(req, res) {
  const goal = await goalsService.getCurrent(req.user.id);
  res.status(200).json(goal);
}

/**
 * GET /api/goals?page&limit → 200 with paginated history, newest first.
 *
 * @type {import('express').RequestHandler}
 */
export async function list(req, res) {
  const page = await goalsService.list(req.user.id, req.validated.query);
  res.status(200).json(page);
}
