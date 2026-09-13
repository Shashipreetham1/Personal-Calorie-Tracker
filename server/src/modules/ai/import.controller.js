import * as pdfService from './pdf.service.js';

/**
 * POST /api/import/pdf → 200 with drafts.
 *
 * Saves nothing. The client reviews the rows and posts the ones it wants to
 * `/api/import/confirm`.
 *
 * @type {import('express').RequestHandler}
 */
export async function importPdf(req, res) {
  const result = await pdfService.importFromPdf(req.user.id, {
    buffer: req.file.buffer,
    mimeType: req.file.detectedMimeType,
  });

  res.status(200).json(result);
}

/**
 * POST /api/import/confirm → 201 when anything was imported, 200 when nothing was.
 *
 * A mixed result is a success, not a failure: the response reports what landed
 * and what did not, so the client can show the rejected rows for correction
 * without losing the accepted ones.
 *
 * @type {import('express').RequestHandler}
 */
export async function confirmImport(req, res) {
  const result = await pdfService.confirmImport(req.user.id, req.validated.body.entries);

  res.status(result.imported > 0 ? 201 : 200).json(result);
}
