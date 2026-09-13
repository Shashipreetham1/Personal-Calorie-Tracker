import * as entriesService from './entries.service.js';

/**
 * POST /api/entries → 201 with the created entry.
 *
 * @type {import('express').RequestHandler}
 */
export async function create(req, res) {
  const entry = await entriesService.create(req.user.id, req.validated.body);
  res.status(201).json(entry);
}

/**
 * GET /api/entries?from&to&mealType&page&limit → 200, paginated envelope.
 *
 * @type {import('express').RequestHandler}
 */
export async function list(req, res) {
  const page = await entriesService.list(req.user.id, req.validated.query);
  res.status(200).json(page);
}

/**
 * PATCH /api/entries/:id → 200 with the updated entry, or 404.
 *
 * @type {import('express').RequestHandler}
 */
export async function update(req, res) {
  const entry = await entriesService.update(
    req.user.id,
    req.validated.params.id,
    req.validated.body,
  );
  res.status(200).json(entry);
}

/**
 * DELETE /api/entries/:id → 204, or 404.
 *
 * @type {import('express').RequestHandler}
 */
export async function remove(req, res) {
  await entriesService.remove(req.user.id, req.validated.params.id);
  res.status(204).end();
}
