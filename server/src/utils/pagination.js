import { z } from 'zod';
import { PAGINATION } from '../config/constants.js';

/**
 * Query schema every paginated list endpoint composes into its own schema.
 *
 * An oversized `limit` is clamped to MAX_LIMIT rather than rejected: asking for
 * 500 rows is a reasonable thing for a client to try, and answering with 100
 * is more useful than a 400. Nonsense (`0`, `-1`, `abc`) is still rejected —
 * those are mistakes, not optimism. The clamp matches `paginate()` below, so
 * the same input behaves identically whether it arrives over HTTP or from a
 * chat tool calling a service directly.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .transform((limit) => Math.min(limit, PAGINATION.MAX_LIMIT))
    .default(PAGINATION.DEFAULT_LIMIT),
});

/**
 * Turns validated query params into the values a repository needs.
 *
 * @param {{ page?: number, limit?: number }} [query]
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function paginate(query = {}) {
  const page = Math.max(1, Math.trunc(Number(query.page) || PAGINATION.DEFAULT_PAGE));
  const requestedLimit = Math.trunc(Number(query.limit) || PAGINATION.DEFAULT_LIMIT);
  const limit = Math.min(Math.max(1, requestedLimit), PAGINATION.MAX_LIMIT);

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * The response envelope shared by every list endpoint in the API.
 *
 * @template T
 * @param {T[]} data  The current page of rows.
 * @param {{ page: number, limit: number, total: number }} meta
 * @returns {{ data: T[], pagination: { page: number, limit: number, total: number, hasNext: boolean } }}
 */
export function paginatedResponse(data, { page, limit, total }) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      hasNext: page * limit < total,
    },
  };
}
