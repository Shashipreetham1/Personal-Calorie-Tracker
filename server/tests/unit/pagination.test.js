import { describe, it, expect } from 'vitest';
import { paginate, paginatedResponse, paginationQuerySchema } from '../../src/utils/pagination.js';

describe('paginate', () => {
  it('defaults to the first page with the standard limit', () => {
    expect(paginate()).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('computes the offset from page and limit', () => {
    expect(paginate({ page: 3, limit: 25 })).toEqual({ page: 3, limit: 25, offset: 50 });
  });

  it('caps the limit rather than rejecting an over-eager request', () => {
    expect(paginate({ limit: 5000 }).limit).toBe(100);
  });

  it('coerces nonsense to the defaults instead of producing a negative offset', () => {
    expect(paginate({ page: -4, limit: 0 })).toEqual({ page: 1, limit: 20, offset: 0 });
  });
});

describe('paginationQuerySchema', () => {
  it('clamps a large limit, matching paginate()', () => {
    // The HTTP path and a direct service call must agree; a chat tool asking
    // for 500 rows should behave exactly like ?limit=500.
    expect(paginationQuerySchema.parse({ limit: '500' }).limit).toBe(100);
  });

  it('rejects values that are mistakes rather than optimism', () => {
    expect(paginationQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 'abc' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
  });
});

describe('paginatedResponse', () => {
  it('reports hasNext true when more rows remain', () => {
    const page = paginatedResponse([1, 2], { page: 1, limit: 2, total: 5 });

    expect(page.pagination).toEqual({ page: 1, limit: 2, total: 5, hasNext: true });
  });

  it('reports hasNext false on the exact boundary', () => {
    // 4 of 4 seen: the classic off-by-one, where an empty extra page is offered.
    expect(paginatedResponse([3, 4], { page: 2, limit: 2, total: 4 }).pagination.hasNext).toBe(false);
  });

  it('reports hasNext false on the last partial page', () => {
    expect(paginatedResponse([5], { page: 3, limit: 2, total: 5 }).pagination.hasNext).toBe(false);
  });

  it('keeps the total when a page beyond the end comes back empty', () => {
    const page = paginatedResponse([], { page: 99, limit: 20, total: 5 });

    expect(page.data).toEqual([]);
    expect(page.pagination.total).toBe(5);
    expect(page.pagination.hasNext).toBe(false);
  });

  it('handles an empty result set', () => {
    expect(paginatedResponse([], { page: 1, limit: 20, total: 0 }).pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      hasNext: false,
    });
  });
});
