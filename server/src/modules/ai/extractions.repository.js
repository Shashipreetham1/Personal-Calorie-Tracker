import { query } from '../../db/pool.js';

/**
 * The extractions audit trail.
 *
 * Rows are written before and after each AI call, so a crash mid-request still
 * leaves evidence that it happened. This is the only thing AI output is ever
 * written to directly — food_entries is reached solely by the user confirming
 * a draft through the normal entries endpoint.
 */

/**
 * Opens an audit row for an attempt about to be made.
 *
 * @param {number} userId
 * @param {'label' | 'plate' | 'pdf'} sourceType
 * @returns {Promise<number>} The new extraction's id.
 */
export async function startExtraction(userId, sourceType) {
  const { rows } = await query(
    `INSERT INTO extractions (user_id, source_type, status)
     VALUES ($1, $2, 'pending')
     RETURNING id`,
    [userId, sourceType],
  );

  return rows[0].id;
}

/**
 * Records the outcome.
 *
 * `rawResponse` is stored exactly as the model returned it, before any mapping
 * to application shapes. When a user reports "it read the calories wrong", this
 * is the only record of what was actually said — the drafts themselves are
 * discarded unless confirmed.
 *
 * @param {number} userId  Scopes the update, so one user cannot alter another's audit row.
 * @param {number} extractionId
 * @param {{ status: 'success' | 'failed', rawResponse: unknown }} outcome
 * @returns {Promise<void>}
 */
export async function finishExtraction(userId, extractionId, { status, rawResponse }) {
  await query(
    `UPDATE extractions
        SET status = $3, raw_response = $4
      WHERE id = $2 AND user_id = $1`,
    [userId, extractionId, status, rawResponse === undefined ? null : JSON.stringify(rawResponse)],
  );
}
