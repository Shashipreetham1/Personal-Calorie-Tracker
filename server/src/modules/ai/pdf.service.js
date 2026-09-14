import * as extractionsRepository from './extractions.repository.js';
import * as entriesRepository from '../entries/entries.repository.js';
import { generateJson } from './gemini.client.js';
import { pdfImportSchema, importRowSchema } from './ai.schemas.js';
import { PDF_IMPORT_PROMPT } from './extraction.prompts.js';
import { toDraftEntry } from './drafts.js';
import { withTransaction } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';

/**
 * Bulk import from a food diary PDF.
 *
 * Same contract as photo extraction: the model proposes, the user disposes.
 * Parsing returns drafts and writes nothing; a separate confirm step does the
 * inserting, on rows the user has actually seen.
 */

/**
 * Reads a food diary PDF and returns draft entries.
 *
 * The bytes go straight to the model. Running a text extractor first would
 * flatten the table into a stream of words, losing the column alignment that
 * says which number is calories and which is protein.
 *
 * @param {number} userId
 * @param {{ buffer: Buffer, mimeType: string }} file  Already size- and
 *   type-checked by the upload middleware, before any model call is made.
 * @returns {Promise<{ extractionId: number, rowsDetected: number, notes: string, drafts: object[] }>}
 * @throws {AppError} Distinct errors for timeout, rate limiting, and an
 *   unusable reply — never a generic 500.
 */
export async function importFromPdf(userId, file) {
  const extractionId = await extractionsRepository.startExtraction(userId, 'pdf');

  try {
    const { data, raw } = await generateJson({
      systemInstruction: PDF_IMPORT_PROMPT,
      schema: pdfImportSchema,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: file.mimeType, data: file.buffer.toString('base64') } },
            { text: 'Extract every food diary row from this document.' },
          ],
        },
      ],
      // A multi-page diary is a bigger job than a single photo, and a timeout
      // here means re-uploading the whole file.
      timeoutMs: 90_000,
    });

    await extractionsRepository.finishExtraction(userId, extractionId, {
      status: 'success',
      rawResponse: raw,
    });

    return {
      extractionId,
      rowsDetected: data.rows_detected,
      notes: data.notes,
      drafts: data.entries.map((entry) => toDraftEntry(entry, { source: 'import' })),
    };
  } catch (error) {
    await extractionsRepository
      .finishExtraction(userId, extractionId, {
        status: 'failed',
        rawResponse: { error: error.message, code: error.code, details: error.details ?? null },
      })
      .catch((auditError) => {
        logger.error('Could not record a failed import', { message: auditError.message });
      });

    throw error;
  }
}

/**
 * Imports the rows the user reviewed and confirmed.
 *
 * Partial failure is the normal case: one misread date should not cost the user
 * the other thirty-nine rows. Each row is validated on its own, the good ones
 * are inserted in a single transaction, and the bad ones come back with their
 * position and reason.
 *
 * @param {number} userId
 * @param {object[]} rows  Unvalidated rows as the client sent them.
 * @returns {Promise<{ imported: number, rejected: number, entries: object[],
 *   rejectedRows: { index: number, foodName: string | null, errors: { field: string, message: string }[] }[] }>}
 */
export async function confirmImport(userId, rows) {
  const valid = [];
  const rejectedRows = [];

  rows.forEach((row, index) => {
    // The same schema the REST endpoint and the chat tool use, so an imported
    // row is held to exactly the rules a typed one is.
    const result = importRowSchema.safeParse(row);

    if (result.success) {
      valid.push({ ...result.data, source: 'import' });
      return;
    }

    rejectedRows.push({
      // The index is what lets the UI highlight the offending row rather than
      // saying "something was wrong somewhere".
      index,
      foodName: typeof row?.foodName === 'string' ? row.foodName : null,
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    });
  });

  const entries = valid.length
    ? await withTransaction((client) => entriesRepository.insertEntries(userId, valid, client))
    : [];

  logger.info('PDF import confirmed', {
    userId,
    imported: entries.length,
    rejected: rejectedRows.length,
  });

  return {
    imported: entries.length,
    rejected: rejectedRows.length,
    entries,
    rejectedRows,
  };
}
