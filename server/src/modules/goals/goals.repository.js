import { query } from '../../db/pool.js';

/** Columns every read returns, in one place so the shapes cannot drift apart. */
const GOAL_COLUMNS = `
  id, user_id, effective_from, daily_calories,
  protein_g, carbs_g, fat_g, weight_goal_kg, created_at
`;

/**
 * Maps a goals row to the API shape (snake_case → camelCase).
 *
 * `effectiveFrom` stays a "YYYY-MM-DD" string — see the DATE type parser in
 * db/pool.js for why it must not become a Date.
 *
 * @param {Record<string, unknown>} row
 * @returns {{ id: number, userId: number, effectiveFrom: string, dailyCalories: number,
 *   proteinG: number, carbsG: number, fatG: number, weightGoalKg: number | null, createdAt: Date }}
 */
function toGoal(row) {
  return {
    id: row.id,
    userId: row.user_id,
    effectiveFrom: row.effective_from,
    dailyCalories: row.daily_calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    weightGoalKg: row.weight_goal_kg,
    createdAt: row.created_at,
  };
}

/**
 * Appends a goal. Goals are never updated — see migration 002.
 *
 * @param {number} userId  From the JWT. Never from the request body.
 * @param {{ effectiveFrom: string, dailyCalories: number, proteinG: number,
 *   carbsG: number, fatG: number, weightGoalKg?: number | null }} input
 * @param {{ query: Function }} [client]  Optional transaction client.
 * @returns {Promise<ReturnType<typeof toGoal>>}
 */
export async function insertGoal(userId, input, client) {
  const { rows } = await query(
    `INSERT INTO goals (user_id, effective_from, daily_calories, protein_g, carbs_g, fat_g, weight_goal_kg)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${GOAL_COLUMNS}`,
    [
      userId,
      input.effectiveFrom,
      input.dailyCalories,
      input.proteinG,
      input.carbsG,
      input.fatG,
      input.weightGoalKg ?? null,
    ],
    client,
  );

  return toGoal(rows[0]);
}

/**
 * The goal in effect on a given day: the most recent row dated on or before it.
 *
 * Ordering by `id DESC` as well as `effective_from DESC` matters — a user may
 * set two goals for the same date, and the later insert is the one that counts.
 *
 * @param {number} userId
 * @param {string} [onDate]  YYYY-MM-DD. Defaults to the database's current date.
 * @returns {Promise<ReturnType<typeof toGoal> | null>}
 */
export async function findEffectiveOn(userId, onDate) {
  const { rows } = await query(
    `SELECT ${GOAL_COLUMNS}
       FROM goals
      WHERE user_id = $1
        AND effective_from <= COALESCE($2::date, CURRENT_DATE)
      ORDER BY effective_from DESC, id DESC
      LIMIT 1`,
    [userId, onDate ?? null],
  );

  return rows.length === 0 ? null : toGoal(rows[0]);
}

/**
 * One page of a user's goal history, newest first.
 *
 * Unlike `findEffectiveOn`, this includes future-dated rows: history is the
 * full audit trail, not just what applies today.
 *
 * @param {number} userId
 * @param {{ limit: number, offset: number }} pagination
 * @returns {Promise<ReturnType<typeof toGoal>[]>}
 */
export async function listGoals(userId, { limit, offset }) {
  const { rows } = await query(
    `SELECT ${GOAL_COLUMNS}
       FROM goals
      WHERE user_id = $1
      ORDER BY effective_from DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return rows.map(toGoal);
}

/**
 * Total goals for the user, for the pagination envelope.
 *
 * A separate COUNT rather than a `COUNT(*) OVER()` window: the window returns
 * no row at all when the requested page is past the end, which would report
 * total 0 for a user who does have goals.
 *
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function countGoals(userId) {
  const { rows } = await query('SELECT COUNT(*) AS total FROM goals WHERE user_id = $1', [userId]);

  return rows[0].total;
}
