import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { withTransaction, closePool } from './pool.js';
import { logger } from '../utils/logger.js';
import { toISODate } from '../utils/dates.js';
import * as authRepository from '../modules/auth/auth.repository.js';
import * as goalsRepository from '../modules/goals/goals.repository.js';
import * as entriesRepository from '../modules/entries/entries.repository.js';
import { createGoalSchema } from '../modules/goals/goals.schema.js';
import { createEntrySchema } from '../modules/entries/entries.schema.js';
import { DEMO_USER, DEMO_GOALS, EMPTY_DAYS_AGO, FOODS, MEAL_SCHEDULE, SOURCE_WEIGHTS } from './seed.data.js';

/** Three weeks of history, ending today. */
const DAYS_OF_HISTORY = 21;

/** bcrypt cost, matching the auth service. */
const BCRYPT_ROUNDS = 10;

/**
 * Deterministic PRNG (mulberry32).
 *
 * `Math.random()` would make every seed run produce different data, so a bug
 * visible in one reviewer's charts could not be reproduced. A fixed seed means
 * `npm run seed` always yields the same three weeks.
 *
 * @param {number} seed
 * @returns {() => number} Generator of floats in [0, 1).
 */
function createRandom(seed) {
  let state = seed;

  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260913);

/** @param {unknown[]} items */
function pick(items) {
  return items[Math.floor(random() * items.length)];
}

/** Picks a `source` using SOURCE_WEIGHTS. */
function pickSource() {
  const total = SOURCE_WEIGHTS.reduce((sum, option) => sum + option.weight, 0);
  let threshold = random() * total;

  for (const option of SOURCE_WEIGHTS) {
    threshold -= option.weight;
    if (threshold <= 0) return option.source;
  }

  return 'manual';
}

/**
 * Scales a nutrition figure by ±`spread`, rounded to one decimal.
 *
 * Real portions vary. Without this every "Poha with peanuts" would be exactly
 * 270 kcal and the calorie trend would be a flat line of repeated values.
 *
 * @param {number} value
 * @param {number} [spread]
 * @returns {number}
 */
function vary(value, spread = 0.15) {
  const factor = 1 + (random() * 2 - 1) * spread;
  return Math.round(value * factor * 10) / 10;
}

/**
 * A Date at the given clock time, `daysAgo` days before today.
 *
 * @param {number} daysAgo
 * @param {number} hour
 * @param {number} minute
 * @returns {Date}
 */
function timestampDaysAgo(daysAgo, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * A breakfast logged 30 minutes ago, for the case above.
 *
 * @param {number} now  Epoch milliseconds.
 * @returns {import('../modules/entries/entries.schema.js').CreateEntryInput}
 */
function buildFallbackBreakfast(now) {
  const food = FOODS.breakfast[0];

  return createEntrySchema.parse({
    consumedAt: new Date(now - 30 * 60 * 1000),
    mealType: 'breakfast',
    foodName: food.name,
    quantity: food.quantity,
    unit: food.unit,
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    micros: food.micros,
    source: 'manual',
  });
}

/**
 * Builds the demo entries.
 *
 * Every generated row is parsed through `createEntrySchema` — the same schema
 * the REST endpoint uses — so the seed cannot introduce data the API itself
 * would reject. A failure here is a bug in the catalogue, and says so.
 *
 * @returns {{ entries: import('../modules/entries/entries.schema.js').CreateEntryInput[], emptyDates: string[] }}
 */
function buildEntries() {
  const entries = [];
  const emptyDates = [];
  const now = Date.now();

  for (let daysAgo = DAYS_OF_HISTORY - 1; daysAgo >= 0; daysAgo -= 1) {
    const date = timestampDaysAgo(daysAgo, 12, 0);
    const entriesBeforeThisDay = entries.length;

    // Deliberate gaps: days with no entries at all. The reports must return a
    // zero row for these rather than skipping them, which is exactly what the
    // generate_series gap-filling in Phase 6 is for.
    if (EMPTY_DAYS_AGO.includes(daysAgo)) {
      emptyDates.push(toISODate(date));
      continue;
    }

    for (const meal of MEAL_SCHEDULE) {
      if (random() > meal.probability) continue;

      const consumedAt = timestampDaysAgo(daysAgo, meal.hour, meal.minute);

      // Today is only partly eaten. Seeding tonight's dinner at 08:00 would be
      // logging food in the future, which the API rightly rejects — and a
      // half-finished current day is what the Today screen should show anyway.
      if (consumedAt.getTime() > now) continue;

      const food = pick(FOODS[meal.mealType]);
      const micros = Object.fromEntries(
        Object.entries(food.micros).map(([key, value]) => [key, vary(value, 0.2)]),
      );

      const candidate = {
        consumedAt,
        mealType: meal.mealType,
        foodName: food.name,
        quantity: food.quantity,
        unit: food.unit,
        calories: vary(food.calories),
        proteinG: vary(food.proteinG),
        carbsG: vary(food.carbsG),
        fatG: vary(food.fatG),
        micros,
        source: pickSource(),
      };

      const result = createEntrySchema.safeParse(candidate);
      if (!result.success) {
        throw new Error(
          `Seed generated an entry the API would reject (${food.name}): ` +
            result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; '),
        );
      }

      entries.push(result.data);
    }

    // Seeded in the small hours, no meal time has passed yet and the Today
    // screen would open blank — which reads as a broken app rather than a new
    // day. One early breakfast keeps the demo meaningful at any hour. (The
    // deliberately empty days above are what demonstrate the empty state.)
    if (daysAgo === 0 && entries.length === entriesBeforeThisDay) {
      entries.push(buildFallbackBreakfast(now));
    }
  }

  return { entries, emptyDates };
}

/**
 * Builds the demo goals, validated the same way.
 *
 * @returns {import('../modules/goals/goals.schema.js').CreateGoalInput[]}
 */
function buildGoals() {
  return DEMO_GOALS.map(({ daysAgo, ...goal }) => {
    const result = createGoalSchema.safeParse({
      ...goal,
      effectiveFrom: toISODate(timestampDaysAgo(daysAgo, 12, 0)),
    });

    if (!result.success) {
      throw new Error(
        `Seed generated an invalid goal: ${result.error.issues.map((i) => i.message).join('; ')}`,
      );
    }

    return result.data;
  });
}

/**
 * Replaces the demo account and all of its data.
 *
 * Re-runnable by design: deleting the demo user cascades to their goals and
 * entries, so `npm run seed` twice leaves the same state as running it once.
 * Only the demo account is touched — any account you signed up with by hand
 * survives.
 *
 * @returns {Promise<{ user: { id: number, email: string }, goalCount: number, entryCount: number, emptyDates: string[] }>}
 */
export async function seed() {
  const goals = buildGoals();
  const { entries, emptyDates } = buildEntries();
  const passwordHash = await bcrypt.hash(DEMO_USER.password, BCRYPT_ROUNDS);

  // One transaction: a failure halfway through leaves no half-seeded account.
  return withTransaction(async (client) => {
    const { rowCount } = await client.query('DELETE FROM users WHERE email = $1', [DEMO_USER.email]);
    if (rowCount > 0) logger.info(`Removed the previous ${DEMO_USER.email} account and its data`);

    const user = await authRepository.insertUser(
      { email: DEMO_USER.email, passwordHash, name: DEMO_USER.name },
      client,
    );

    for (const goal of goals) {
      await goalsRepository.insertGoal(user.id, goal, client);
    }

    await entriesRepository.insertEntries(user.id, entries, client);

    return { user, goalCount: goals.length, entryCount: entries.length, emptyDates };
  });
}

/**
 * Prints what was created, including the login a reviewer needs.
 *
 * @param {Awaited<ReturnType<typeof seed>>} result
 */
function reportSeedResult({ user, goalCount, entryCount, emptyDates }) {
  const lines = [
    '',
    '  Seed complete',
    `    user      ${user.email} / ${DEMO_USER.password}  (id ${user.id})`,
    `    goals     ${goalCount}  (${DEMO_GOALS.map((g) => `${g.dailyCalories} kcal from ${g.daysAgo}d ago`).join(', ')})`,
    `    entries   ${entryCount} across ${DAYS_OF_HISTORY} days`,
    `    no data   ${emptyDates.join(', ')}  (left empty on purpose, to prove reports fill gaps)`,
    '',
  ];

  logger.info(lines.join('\n'));
}

// CLI entry point: `npm run seed`.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seed()
    .then(async (result) => {
      reportSeedResult(result);
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      logger.error(`Seed failed: ${error.message}`);
      await closePool().catch(() => {});
      process.exit(1);
    });
}
