import * as extractionService from './extraction.service.js';

/**
 * POST /api/extract/image?type=label|plate
 *
 * Returns drafts for the user to review. Saves nothing — the client confirms
 * via `POST /api/entries` with `source: 'photo'`.
 *
 * @type {import('express').RequestHandler}
 */
export async function extractImage(req, res) {
  const result = await extractionService.extractFromImage(
    req.user.id,
    { buffer: req.file.buffer, mimeType: req.file.detectedMimeType },
    { type: req.validated.query.type },
  );

  res.status(200).json(result);
}
