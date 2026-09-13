import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetDatabase, createTestUser, closeDatabase } from '../helpers/database.js';
import * as entriesService from '../../src/modules/entries/entries.service.js';
import * as goalsService from '../../src/modules/goals/goals.service.js';
import * as reportsService from '../../src/modules/reports/reports.service.js';

/**
 * Report SQL, against a real database.
 *
 * These queries are the hardest part of the project — a gap-filled date series,
 * a LATERAL join resolving a different goal per day, JSONB aggregation across
 * ragged keys — and none of it can be tested against a mock.
 */

/** Fixed dates so nothing depends on when the suite runs. */
const DAY_1 = '2026-03-02'; // a Monday
const DAY_2 = '2026-03-03';
const GAP_DAY = '2026-03-04'; // deliberately left empty
const DAY_4 = '2026-03-05';
const RANGE = { from: DAY_1, to: DAY_4 };

let user;
let otherUser;

/** Logs an entry at midday UTC, matching the day boundaries the reports use. */
function logEntry(userId, day, overrides = {}) {
  return entriesService.create(userId, {
    consumedAt: new Date(`${day}T12:00:00Z`),
    mealType: 'lunch',
    foodName: 'Test meal',
    quantity: 1,
    unit: 'plate',
    calories: 500,
    proteinG: 30,
    carbsG: 60,
    fatG: 15,
    micros: {},
    source: 'manual',
    ...overrides,
  });
}

beforeAll(async () => {
  await resetDatabase();
  user = await createTestUser('reports');
  otherUser = await createTestUser('reports-other');

  await logEntry(user.id, DAY_1, { calories: 500, proteinG: 30, micros: { iron_mg: 2, sodium_mg: 300 } });
  await logEntry(user.id, DAY_1, { calories: 300, proteinG: 10, micros: { iron_mg: 1.5, calcium_mg: 200 } });
  await logEntry(user.id, DAY_2, { calories: 700, proteinG: 40, micros: { sodium_mg: 450, vitamin_c_mg: 12 } });
  // GAP_DAY: nothing at all.
  await logEntry(user.id, DAY_4, { calories: 900, proteinG: 55, micros: { calcium_mg: 150 } });

  // The other user's data must never appear in the first user's reports.
  await logEntry(otherUser.id, DAY_1, { calories: 9999, micros: { iron_mg: 999 } });

  // Two goals, changing mid-range: 2000 from DAY_1, then 1800 from DAY_4.
  await goalsService.create(user.id, {
    effectiveFrom: DAY_1,
    dailyCalories: 2000,
    proteinG: 150,
    carbsG: 200,
    fatG: 67,
  });
  await goalsService.create(user.id, {
    effectiveFrom: DAY_4,
    dailyCalories: 1800,
    proteinG: 160,
    carbsG: 170,
    fatG: 55,
  });
});

afterAll(closeDatabase);

describe('calorie trend', () => {
  it('returns a row for every day in the range', async () => {
    const report = await reportsService.getCalorieTrend(user.id, RANGE);

    expect(report.data.map((day) => day.day)).toEqual([DAY_1, DAY_2, GAP_DAY, DAY_4]);
  });

  it('returns a ZERO row for a day with no entries, rather than omitting it', async () => {
    // Without generate_series gap filling, this day simply would not appear and
    // a chart would draw a straight line from DAY_2 to DAY_4, quietly claiming
    // an intake that never happened.
    const report = await reportsService.getCalorieTrend(user.id, RANGE);
    const gap = report.data.find((day) => day.day === GAP_DAY);

    expect(gap).toBeDefined();
    expect(gap.calories).toBe(0);
    expect(gap.entryCount).toBe(0);
  });

  it('sums the entries on days that have them', async () => {
    const report = await reportsService.getCalorieTrend(user.id, RANGE);

    expect(report.data.find((day) => day.day === DAY_1)).toMatchObject({
      calories: 800,
      entryCount: 2,
    });
  });

  it('shows none of another user data', async () => {
    const report = await reportsService.getCalorieTrend(otherUser.id, RANGE);

    expect(report.data.find((day) => day.day === DAY_1).calories).toBe(9999);
    expect(report.data.reduce((sum, day) => sum + day.calories, 0)).toBe(9999);
  });

  it('returns a full series of zeros for a user with no data at all', async () => {
    const stranger = await createTestUser('reports-stranger');
    const report = await reportsService.getCalorieTrend(stranger.id, RANGE);

    expect(report.data).toHaveLength(4);
    expect(report.data.every((day) => day.calories === 0)).toBe(true);
  });
});

describe('macro breakdown', () => {
  it('fills gaps the same way as the calorie trend', async () => {
    const report = await reportsService.getMacroBreakdown(user.id, { ...RANGE, granularity: 'day' });
    const gap = report.data.find((bucket) => bucket.bucket === GAP_DAY);

    expect(gap).toMatchObject({ proteinG: 0, carbsG: 0, fatG: 0, entryCount: 0 });
  });

  it('sums each macro independently', async () => {
    const report = await reportsService.getMacroBreakdown(user.id, { ...RANGE, granularity: 'day' });

    expect(report.data.find((bucket) => bucket.bucket === DAY_1)).toMatchObject({
      proteinG: 40,
      carbsG: 120,
      fatG: 30,
    });
  });

  it('groups by week without double counting or losing rows', async () => {
    const daily = await reportsService.getMacroBreakdown(user.id, { ...RANGE, granularity: 'day' });
    const weekly = await reportsService.getMacroBreakdown(user.id, { ...RANGE, granularity: 'week' });

    const dailyTotal = daily.data.reduce((sum, bucket) => sum + bucket.calories, 0);
    const weeklyTotal = weekly.data.reduce((sum, bucket) => sum + bucket.calories, 0);

    expect(weeklyTotal).toBe(dailyTotal);
    expect(weekly.data.reduce((sum, bucket) => sum + bucket.entryCount, 0)).toBe(4);
  });

  it('excludes data outside the range even when a week bucket extends past it', async () => {
    // DAY_2 to DAY_4 starts mid-week, so the first weekly bucket begins on the
    // preceding Monday — which is DAY_1, whose 800 kcal must NOT be counted.
    const report = await reportsService.getMacroBreakdown(user.id, {
      from: DAY_2,
      to: DAY_4,
      granularity: 'week',
    });

    const total = report.data.reduce((sum, bucket) => sum + bucket.calories, 0);

    expect(total).toBe(1600); // 700 + 900, not 2400.
  });
});

describe('micronutrient summary', () => {
  it('sums across entries whose JSONB key sets differ', async () => {
    // iron appears in two entries, calcium in two different ones, vitamin C in
    // one. Nothing shares a full key set, which is what makes the unnesting
    // worth testing.
    const report = await reportsService.getMicroSummary(user.id, RANGE);
    const totals = Object.fromEntries(report.data.map((row) => [row.key, row.total]));

    expect(totals).toEqual({
      iron_mg: 3.5,
      sodium_mg: 750,
      calcium_mg: 350,
      vitamin_c_mg: 12,
    });
  });

  it('counts how many entries contributed to each micronutrient', async () => {
    const report = await reportsService.getMicroSummary(user.id, RANGE);
    const iron = report.data.find((row) => row.key === 'iron_mg');

    expect(iron.entryCount).toBe(2);
  });

  it('orders by total, largest first', async () => {
    const report = await reportsService.getMicroSummary(user.id, RANGE);
    const totals = report.data.map((row) => row.total);

    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it('returns nothing for a range with no entries, rather than zero rows', async () => {
    const report = await reportsService.getMicroSummary(user.id, { from: GAP_DAY, to: GAP_DAY });

    expect(report.data).toEqual([]);
  });

  it('does not mix in another user micronutrients', async () => {
    const report = await reportsService.getMicroSummary(user.id, RANGE);
    const iron = report.data.find((row) => row.key === 'iron_mg');

    // The other user logged 999mg of iron on the same day.
    expect(iron.total).toBe(3.5);
  });
});

describe('goal vs actual', () => {
  it('picks the goal that applied on each day when the goal changes mid-range', async () => {
    // The whole point of append-only dated goals: DAY_1 to GAP_DAY are governed
    // by the 2000 kcal goal, DAY_4 by the 1800 one set that day.
    const report = await reportsService.getGoalVsActual(user.id, RANGE);
    const byDay = Object.fromEntries(report.data.map((day) => [day.day, day.goalCalories]));

    expect(byDay).toEqual({
      [DAY_1]: 2000,
      [DAY_2]: 2000,
      [GAP_DAY]: 2000,
      [DAY_4]: 1800,
    });
  });

  it('carries the macro targets of the applicable goal too', async () => {
    const report = await reportsService.getGoalVsActual(user.id, RANGE);

    expect(report.data.find((day) => day.day === DAY_2)).toMatchObject({ goalProteinG: 150 });
    expect(report.data.find((day) => day.day === DAY_4)).toMatchObject({ goalProteinG: 160 });
  });

  it('reports a day with no entries as zero actual, with the goal still attached', async () => {
    const report = await reportsService.getGoalVsActual(user.id, RANGE);

    expect(report.data.find((day) => day.day === GAP_DAY)).toMatchObject({
      actualCalories: 0,
      entryCount: 0,
      goalCalories: 2000,
    });
  });

  it('returns a null goal before the first goal existed, never zero', async () => {
    // A zero would draw a target line along the axis and read as "your goal was
    // nothing", when the truth is that there was no goal yet.
    const report = await reportsService.getGoalVsActual(user.id, {
      from: '2026-02-25',
      to: DAY_1,
    });

    const before = report.data.filter((day) => day.day < DAY_1);

    expect(before.length).toBeGreaterThan(0);
    expect(before.every((day) => day.goalCalories === null)).toBe(true);
  });

  it('breaks a same-date tie with the later goal', async () => {
    const tied = await createTestUser('reports-tie');
    await goalsService.create(tied.id, {
      effectiveFrom: DAY_1,
      dailyCalories: 2000,
      proteinG: 100,
      carbsG: 100,
      fatG: 50,
    });
    await goalsService.create(tied.id, {
      effectiveFrom: DAY_1,
      dailyCalories: 2400,
      proteinG: 120,
      carbsG: 120,
      fatG: 60,
    });

    const report = await reportsService.getGoalVsActual(tied.id, { from: DAY_1, to: DAY_1 });

    expect(report.data[0].goalCalories).toBe(2400);
  });

  it('matches the calorie trend for the same days', async () => {
    const [trend, goalReport] = await Promise.all([
      reportsService.getCalorieTrend(user.id, RANGE),
      reportsService.getGoalVsActual(user.id, RANGE),
    ]);

    expect(goalReport.data.map((day) => day.actualCalories)).toEqual(
      trend.data.map((day) => day.calories),
    );
  });
});
