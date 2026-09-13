import * as extractionsRepository from './extractions.repository.js';
import { generateJson } from './gemini.client.js';
import { imageExtractionSchema } from './ai.schemas.js';
import { promptForType } from './extraction.prompts.js';
import { toDraftEntry } from './drafts.js';
import { logger } from '../../utils/logger.js';

/**
 * Photo extraction.
 *
 * The contract, and the reason this returns rather than saves: **nothing here
 * writes to food_entries**. The model produces a draft, the user reviews it,
 * and the user confirms it through the normal `POST /api/entries` path with
 * `source: 'photo'`. Nutrition data the user never looked at should not end up
 * in their history, however confident the model sounded.
 */

/**
 * Extracts nutrition information from a photo and returns drafts.
 *
 * @param {number} userId
 * @param {{ buffer: Buffer, mimeType: string }} image  Already size- and
 *   type-checked by the upload middleware, before any model call is made.
 * @param {{ type?: 'label' | 'plate' }} [options]
 * @returns {Promise<{ extractionId: number, sourceType: string, isEstimate: boolean,
 *   confidence: number, notes: string, drafts: object[] }>}
 * @throws {AppError} Distinct errors for timeout, rate limiting, and an
 *   unusable reply — never a generic 500.
 */
export async function extractFromImage(userId, image, { type } = {}) {
  // The audit row is opened first so an attempt that times out still leaves a
  // trace. `type` may be absent, in which case the model decides; the row is
  // labelled with the caller's hint, or 'plate' as the more common default.
  const extractionId = await extractionsRepository.startExtraction(userId, type ?? 'plate');

  try {
    const { data, raw } = await generateJson({
      systemInstruction: promptForType(type),
      schema: imageExtractionSchema,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: image.mimeType, data: image.buffer.toString('base64') } },
            { text: 'Extract the nutrition information from this image.' },
          ],
        },
      ],
    });

    await extractionsRepository.finishExtraction(userId, extractionId, {
      status: 'success',
      rawResponse: raw,
    });

    return {
      extractionId,
      sourceType: data.source_type,
      // A label transcription is not an estimate; a plate always is. Trusting
      // the model's own flag would let a hallucinated `false` suppress the
      // UI's warning on a photo of food.
      isEstimate: data.source_type === 'plate' ? true : data.is_estimate,
      confidence: data.confidence,
      notes: data.notes,
      drafts: data.items.map((item) => toDraftEntry(item, { source: 'photo' })),
    };
  } catch (error) {
    // The failure is recorded with whatever detail we have, then rethrown
    // unchanged — the client still gets the specific error from the client
    // module, not a generic one.
    await extractionsRepository
      .finishExtraction(userId, extractionId, {
        status: 'failed',
        rawResponse: { error: error.message, code: error.code, details: error.details ?? null },
      })
      .catch((auditError) => {
        logger.error('Could not record a failed extraction', { message: auditError.message });
      });

    throw error;
  }
}
