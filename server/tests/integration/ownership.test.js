import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDatabase, closeDatabase } from '../helpers/database.js';

/**
 * One user must never reach another user's data.
 *
 * Tested through the HTTP layer rather than the services, because that is the
 * surface an attacker actually has: real cookies, real routes, real middleware.
 * A service-level test would prove the service is careful while saying nothing
 * about whether the route reaches it correctly.
 *
 * The expected status for someone else's row is **404, not 403**. A 403 would
 * confirm the row exists, which is itself a disclosure — "not yours" and "not
 * there" must be indistinguishable from outside.
 */

const app = createApp();

/** Signs up and returns an agent that keeps the session cookie. */
async function signIn(label) {
  const agent = request.agent(app);
  const email = `${label}-${Math.random().toString(36).slice(2, 8)}@example.test`;

  const response = await agent
    .post('/api/auth/signup')
    .send({ email, password: 'correct-horse-battery', name: label });

  expect(response.status).toBe(201);

  return { agent, user: response.body };
}

let alice;
let bob;
let aliceEntryId;
let aliceGoalId;

beforeAll(async () => {
  await resetDatabase();

  alice = await signIn('alice');
  bob = await signIn('bob');

  const entry = await alice.agent.post('/api/entries').send({
    consumedAt: '2026-03-02T12:00:00Z',
    mealType: 'lunch',
    foodName: "Alice's private lunch",
    quantity: 1,
    unit: 'plate',
    calories: 650,
    proteinG: 30,
    carbsG: 80,
    fatG: 20,
    micros: { iron_mg: 3 },
  });
  expect(entry.status).toBe(201);
  aliceEntryId = entry.body.id;

  const goal = await alice.agent.post('/api/goals').send({
    effectiveFrom: '2026-03-02',
    dailyCalories: 2100,
    proteinG: 150,
    carbsG: 200,
    fatG: 70,
  });
  expect(goal.status).toBe(201);
  aliceGoalId = goal.body.id;

  await alice.agent.post('/api/chat/history'); // no-op; history is a GET
});

afterAll(closeDatabase);

describe('reading another user data', () => {
  it("does not include Alice's entries in Bob's list", async () => {
    const response = await bob.agent.get('/api/entries');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
  });

  it("does not leak Alice's entries through a wide date filter", async () => {
    const response = await bob.agent.get('/api/entries?from=2020-01-01&to=2026-12-31');

    expect(response.body.pagination.total).toBe(0);
  });

  it("does not give Bob Alice's current goal", async () => {
    const response = await bob.agent.get('/api/goals/current');

    expect(response.status).toBe(404);
  });

  it("does not include Alice's goals in Bob's history", async () => {
    const response = await bob.agent.get('/api/goals');

    expect(response.body.data).toEqual([]);
  });

  it("does not include Alice's data in Bob's reports", async () => {
    const response = await bob.agent.get(
      '/api/reports/calorie-trend?from=2026-03-01&to=2026-03-05',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.every((day) => day.calories === 0)).toBe(true);
  });

  it("does not include Alice's micronutrients in Bob's summary", async () => {
    const response = await bob.agent.get('/api/reports/micros?from=2026-03-01&to=2026-03-05');

    expect(response.body.data).toEqual([]);
  });

  it("does not include Alice's chat messages in Bob's history", async () => {
    const response = await bob.agent.get('/api/chat/history');

    expect(response.body.pagination.total).toBe(0);
  });
});

describe('modifying another user data', () => {
  it("returns 404, not 403, when Bob patches Alice's entry", async () => {
    const response = await bob.agent
      .patch(`/api/entries/${aliceEntryId}`)
      .send({ calories: 1 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it("returns 404, not 403, when Bob deletes Alice's entry", async () => {
    const response = await bob.agent.delete(`/api/entries/${aliceEntryId}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('gives the same 404 for an id that does not exist anywhere', async () => {
    // Identical responses are the point: the status must not distinguish
    // "someone else's" from "nonexistent".
    const existing = await bob.agent.patch(`/api/entries/${aliceEntryId}`).send({ calories: 1 });
    const missing = await bob.agent.patch('/api/entries/99999999').send({ calories: 1 });

    expect(missing.status).toBe(existing.status);
    expect(missing.body.error.code).toBe(existing.body.error.code);
    expect(missing.body.error.message).toBe(existing.body.error.message);
  });

  it("leaves Alice's entry completely untouched after Bob's attempts", async () => {
    const response = await alice.agent.get('/api/entries');

    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      id: aliceEntryId,
      foodName: "Alice's private lunch",
      calories: 650,
    });
  });

  it("cannot be tricked by putting someone else's user id in the body", async () => {
    // userId comes from the JWT and nothing else; a body field named userId is
    // not part of any schema and must be ignored rather than honoured.
    const response = await bob.agent.post('/api/entries').send({
      userId: alice.user.id,
      user_id: alice.user.id,
      consumedAt: '2026-03-02T12:00:00Z',
      mealType: 'dinner',
      foodName: 'Planted by Bob',
      quantity: 1,
      calories: 100,
    });

    expect(response.status).toBe(201);
    expect(response.body.userId).toBe(bob.user.id);

    const aliceEntries = await alice.agent.get('/api/entries');
    expect(aliceEntries.body.data.some((entry) => entry.foodName === 'Planted by Bob')).toBe(false);
  });
});

describe('without a session', () => {
  const anonymous = () => request(app);

  it.each([
    ['get', '/api/entries'],
    ['post', '/api/entries'],
    ['get', '/api/goals'],
    ['post', '/api/goals'],
    ['get', '/api/goals/current'],
    ['get', '/api/reports/calorie-trend'],
    ['get', '/api/reports/macros'],
    ['get', '/api/reports/micros'],
    ['get', '/api/reports/goal-vs-actual'],
    ['get', '/api/chat/history'],
    ['post', '/api/chat'],
    ['post', '/api/extract/image'],
    ['post', '/api/import/pdf'],
    ['post', '/api/import/confirm'],
    ['get', '/api/auth/me'],
  ])('%s %s requires authentication', async (method, path) => {
    const response = await anonymous()[method](path);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('cannot reach an entry with a forged cookie', async () => {
    const response = await anonymous()
      .patch(`/api/entries/${aliceEntryId}`)
      .set('Cookie', 'ct_token=not.a.real.token')
      .send({ calories: 1 });

    expect(response.status).toBe(401);
  });

  it("still cannot read Alice's goal id directly", async () => {
    const response = await anonymous().get(`/api/goals/${aliceGoalId}`);

    // There is no such route at all — goals are only ever listed for the
    // authenticated user.
    expect([401, 404]).toContain(response.status);
  });
});
