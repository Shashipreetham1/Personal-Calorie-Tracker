import * as entriesRepository from './entries.repository.js';
import { AppError } from '../../utils/AppError.js';
import { paginate, paginatedResponse } from '../../utils/pagination.js';

/**
 * Records a food entry.
 *
 * Called by `POST /api/entries`, the Phase 8 `log_meal` chat tool, and the
 * confirm step of photo extraction and PDF import. Plain arguments in, plain
 * data out — no `req`, no `res`, so every path shares this one implementation.
 *
 * @param {number} userId
 * @param {import('./entries.schema.js').CreateEntryInput} input
 * @returns {Promise<ReturnType<typeof entriesRepository.insertEntry>>}
 */
export async function create(userId, input) {
  return entriesRepository.insertEntry(userId, input);
}

/**
 * Paginated, filtered entries for a user, newest first.
 *
 * @param {number} userId
 * @param {{ page?: number, limit?: number, from?: string, to?: string, mealType?: string }} queryParams
 * @returns {Promise<{ data: unknown[], pagination: { page: number, limit: number, total: number, hasNext: boolean } }>}
 */
export async function list(userId, queryParams = {}) {
  const { page, limit, offset } = paginate(queryParams);
  const filters = {
    from: queryParams.from,
    to: queryParams.to,
    mealType: queryParams.mealType,
  };

  const [data, total] = await Promise.all([
    entriesRepository.listEntries(userId, filters, { limit, offset }),
    entriesRepository.countEntries(userId, filters),
  ]);

  return paginatedResponse(data, { page, limit, total });
}

/**
 * Updates an entry the user owns.
 *
 * @param {number} userId
 * @param {number} entryId
 * @param {import('./entries.schema.js').UpdateEntryInput} patch
 * @returns {Promise<ReturnType<typeof entriesRepository.updateEntry>>}
 * @throws {AppError} 404 when the entry does not exist OR belongs to someone
 *   else — deliberately indistinguishable, so the API never confirms the
 *   existence of another user's data.
 */
export async function update(userId, entryId, patch) {
  const entry = await entriesRepository.updateEntry(userId, entryId, patch);

  if (!entry) throw AppError.notFound('Entry not found');

  return entry;
}

/**
 * Deletes an entry the user owns.
 *
 * @param {number} userId
 * @param {number} entryId
 * @returns {Promise<void>}
 * @throws {AppError} 404 when the entry does not exist or is not the user's.
 */
export async function remove(userId, entryId) {
  const deleted = await entriesRepository.deleteEntry(userId, entryId);

  if (!deleted) throw AppError.notFound('Entry not found');
}
