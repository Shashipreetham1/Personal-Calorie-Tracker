import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDatabase, closeDatabase } from '../helpers/database.js';

/**
 * Pagination, against real rows.
 *
 * The helper is unit-tested separately; this checks the part that only a
 * database can answer — that `total` counts every matching row rather than the
 * page, that it respects the same filters as the rows, and that `hasNext` is
 * right at the boundaries where off-by-one errors live.
 *
 * It also pins the project's rule that EVERY list endpoint returns the same
 * envelope, which is easy to state and easy to let slip.
 */

const app = createApp();
const TOTAL_ENTRIES = 25;

let agent;

beforeAll(async () => {
  await resetDatabase();

  agent = request.agent(app);
  const signup = await agent
    .post('/api/auth/signup')
    .send({ email: `pager-${Date.now()}@example.test`, password: 'correct-horse-battery' });
  expect(signup.status).toBe(201);

  // 25 entries: 10 breakfasts and 15 lunches, one per hour so the ordering is
  // deterministic.
  for (let index = 0; index < TOTAL_ENTRIES; index += 1) {
    const response = await agent.post('/api/entries').send({
      consumedAt: new Date(Date.UTC(2026, 2, 2, index % 24, 0, 0)).toISOString(),
      mealType: index < 10 ? 'breakfast' : 'lunch',
      foodName: `Entry ${index}`,
      quantity: 1,
      calories: 100 + index,
    });
    expect(response.status).toBe(201);
  }

  for (let index = 0; index < 3; index += 1) {
    await agent.post('/api/goals').send({
      effectiveFrom: `2026-03-0${index + 1}`,
      dailyCalories: 2000 + index,
      proteinG: 150,
      carbsG: 200,
      fatG: 67,
    });
  }
});

afterAll(closeDatabase);

describe('the pagination envelope', () => {
  it('is identical on every list endpoint', async () => {
    const paths = ['/api/entries', '/api/goals', '/api/chat/history'];

    for (const path of paths) {
      const response = await agent.get(path);

      expect(response.status, path).toBe(200);
      expect(Array.isArray(response.body.data), path).toBe(true);
      expect(Object.keys(response.body).sort(), path).toEqual(['data', 'pagination']);
      expect(Object.keys(response.body.pagination).sort(), path).toEqual([
        'hasNext',
        'limit',
        'page',
        'total',
      ]);
    }
  });

  it('defaults to page 1 with a limit of 20', async () => {
    const response = await agent.get('/api/entries');

    expect(response.body.pagination).toMatchObject({ page: 1, limit: 20, total: TOTAL_ENTRIES });
    expect(response.body.data).toHaveLength(20);
  });
});

describe('boundaries', () => {
  it('reports hasNext true while rows remain', async () => {
    const response = await agent.get('/api/entries?page=1&limit=10');

    expect(response.body.data).toHaveLength(10);
    expect(response.body.pagination).toMatchObject({ total: TOTAL_ENTRIES, hasNext: true });
  });

  it('reports hasNext false on the last partial page', async () => {
    // 25 rows at 10 per page: page 3 holds the last 5.
    const response = await agent.get('/api/entries?page=3&limit=10');

    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination).toMatchObject({ page: 3, total: TOTAL_ENTRIES, hasNext: false });
  });

  it('reports hasNext false when the last page is exactly full', async () => {
    // The classic off-by-one: 25 rows at 5 per page means page 5 ends exactly
    // on the boundary and must not offer an empty page 6.
    const response = await agent.get('/api/entries?page=5&limit=5');

    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination.hasNext).toBe(false);
  });

  it('returns an empty page past the end while still reporting the true total', async () => {
    const response = await agent.get('/api/entries?page=99&limit=10');

    expect(response.body.data).toEqual([]);
    expect(response.body.pagination).toMatchObject({ total: TOTAL_ENTRIES, hasNext: false });
  });

  it('never repeats or drops a row across pages', async () => {
    const [first, second, third] = await Promise.all([
      agent.get('/api/entries?page=1&limit=10'),
      agent.get('/api/entries?page=2&limit=10'),
      agent.get('/api/entries?page=3&limit=10'),
    ]);

    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map((e) => e.id);

    expect(ids).toHaveLength(TOTAL_ENTRIES);
    expect(new Set(ids).size).toBe(TOTAL_ENTRIES);
  });
});

describe('total respects the filters', () => {
  it('counts only the filtered rows, not everything', async () => {
    const response = await agent.get('/api/entries?mealType=breakfast&limit=5');

    expect(response.body.data).toHaveLength(5);
    // 10 breakfasts, not 25 entries: the count query must use the same WHERE
    // clause as the rows, or the pager offers pages that do not exist.
    expect(response.body.pagination.total).toBe(10);
    expect(response.body.pagination.hasNext).toBe(true);
  });

  it('agrees with the rows when a filter matches nothing', async () => {
    const response = await agent.get('/api/entries?mealType=snacks');

    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
    expect(response.body.pagination.hasNext).toBe(false);
  });

  it('counts only the rows inside a date range', async () => {
    const response = await agent.get('/api/entries?from=2020-01-01&to=2020-12-31');

    expect(response.body.pagination.total).toBe(0);
  });
});

describe('limit handling', () => {
  it('clamps an oversized limit rather than rejecting it', async () => {
    const response = await agent.get('/api/entries?limit=5000');

    expect(response.status).toBe(200);
    expect(response.body.pagination.limit).toBe(100);
  });

  it('rejects a limit that is a mistake rather than optimism', async () => {
    for (const query of ['limit=0', 'limit=-5', 'page=abc', 'page=0']) {
      const response = await agent.get(`/api/entries?${query}`);

      expect(response.status, query).toBe(400);
      expect(response.body.error.code, query).toBe('VALIDATION_ERROR');
    }
  });
});

describe('goal history pagination', () => {
  it('paginates goals with the same rules as entries', async () => {
    const response = await agent.get('/api/goals?page=1&limit=2');

    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toMatchObject({ total: 3, hasNext: true });

    const last = await agent.get('/api/goals?page=2&limit=2');

    expect(last.body.data).toHaveLength(1);
    expect(last.body.pagination.hasNext).toBe(false);
  });

  it('lists goals newest first', async () => {
    const response = await agent.get('/api/goals');
    const dates = response.body.data.map((goal) => goal.effectiveFrom);

    expect(dates).toEqual([...dates].sort().reverse());
  });
});
