import { query } from '../../db/pool.js';

/** Columns every read returns, in one place so the shapes cannot drift apart. */
const ENTRY_COLUMNS = `
  id, user_id, consumed_at, meal_type, food_name, quantity, unit,
  calories, protein_g, carbs_g, fat_g, micros, source, created_at
`;

/**
 * Maps a food_entries row to the API shape (snake_case → camelCase).
 *
 * @param {Record<string, unknown>} row
 * @returns {{ id: number, userId: number, consumedAt: Date, mealType: string, foodName: string,
 *   quantity: number, unit: string | null, calories: number, proteinG: number, carbsG: number,
 *   fatG: number, micros: Record<string, number>, source: string, createdAt: Date }}
 */
function toEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    consumedAt: row.consumed_at,
    mealType: row.meal_type,
    foodName: row.food_name,
    quantity: row.quantity,
    unit: row.unit,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    micros: row.micros,
    source: row.source,
    createdAt: row.created_at,
  };
}

/**
 * Builds the WHERE clause shared by the list and count queries.
 *
 * Only placeholder *positions* are ever written into the SQL string; every
 * value goes through the parameter array, so a filter value cannot alter the
 * statement no matter what it contains.
 *
 * @param {number} userId
 * @param {{ from?: string, to?: string, mealType?: string }} filters
 * @returns {{ whereClause: string, params: unknown[] }}
 */
function buildWhereClause(userId, { from, to, mealType } = {}) {
  const conditions = ['user_id = $1'];
  const params = [userId];

  if (from) {
    params.push(from);
    conditions.push(`consumed_at >= $${params.length}::date`);
  }

  if (to) {
    // Compared against the start of the following day so the whole of `to` is
    // included — `consumed_at <= to::date` would silently drop that day's meals,
    // because a date casts to midnight.
    params.push(to);
    conditions.push(`consumed_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  if (mealType) {
    params.push(mealType);
    conditions.push(`meal_type = $${params.length}`);
  }

  return { whereClause: conditions.join(' AND '), params };
}

/** Column order shared by the single-row and bulk inserts. */
const INSERT_COLUMNS =
  'user_id, consumed_at, meal_type, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, micros, source';

/**
 * Values for one row, in INSERT_COLUMNS order.
 *
 * @param {number} userId
 * @param {import('./entries.schema.js').CreateEntryInput} input
 * @returns {unknown[]}
 */
function toInsertValues(userId, input) {
  return [
    userId,
    input.consumedAt,
    input.mealType,
    input.foodName,
    input.quantity,
    input.unit ?? null,
    input.calories,
    input.proteinG,
    input.carbsG,
    input.fatG,
    input.micros,
    input.source,
  ];
}

/**
 * Inserts an entry.
 *
 * @param {number} userId  From the JWT. Never from the request body.
 * @param {import('./entries.schema.js').CreateEntryInput} input
 * @param {{ query: Function }} [client]  Optional transaction client.
 * @returns {Promise<ReturnType<typeof toEntry>>}
 */
export async function insertEntry(userId, input, client) {
  const { rows } = await query(
    `INSERT INTO food_entries (${INSERT_COLUMNS})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${ENTRY_COLUMNS}`,
    toInsertValues(userId, input),
    client,
  );

  return toEntry(rows[0]);
}

/**
 * Postgres caps a statement at 65535 bound parameters. At 12 per row that is
 * ~5400 rows; batching well below it keeps statements a sane size and the
 * limit unreachable.
 */
const INSERT_BATCH_SIZE = 500;

/**
 * Inserts many entries in as few statements as possible.
 *
 * Used by the seed script and by the PDF import, which needs all rows to
 * land or none — pass a transaction client and the caller controls that.
 *
 * @param {number} userId
 * @param {import('./entries.schema.js').CreateEntryInput[]} inputs
 * @param {{ query: Function }} [client]  Optional transaction client.
 * @returns {Promise<ReturnType<typeof toEntry>[]>}
 */
export async function insertEntries(userId, inputs, client) {
  const inserted = [];

  for (let start = 0; start < inputs.length; start += INSERT_BATCH_SIZE) {
    const batch = inputs.slice(start, start + INSERT_BATCH_SIZE);
    const params = [];
    const rowPlaceholders = batch.map((input) => {
      const values = toInsertValues(userId, input);
      const placeholders = values.map((_, index) => `$${params.length + index + 1}`);
      params.push(...values);
      return `(${placeholders.join(', ')})`;
    });

    const { rows } = await query(
      `INSERT INTO food_entries (${INSERT_COLUMNS})
       VALUES ${rowPlaceholders.join(', ')}
       RETURNING ${ENTRY_COLUMNS}`,
      params,
      client,
    );

    inserted.push(...rows.map(toEntry));
  }

  return inserted;
}

/**
 * One page of entries matching the filters, newest first.
 *
 * @param {number} userId
 * @param {{ from?: string, to?: string, mealType?: string }} filters
 * @param {{ limit: number, offset: number }} pagination
 * @returns {Promise<ReturnType<typeof toEntry>[]>}
 */
export async function listEntries(userId, filters, { limit, offset }) {
  const { whereClause, params } = buildWhereClause(userId, filters);

  const { rows } = await query(
    `SELECT ${ENTRY_COLUMNS}
       FROM food_entries
      WHERE ${whereClause}
      ORDER BY consumed_at DESC, id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return rows.map(toEntry);
}

/**
 * Total entries matching the SAME filters as `listEntries`, for the pagination
 * envelope. Both call `buildWhereClause`, so the two can never disagree.
 *
 * @param {number} userId
 * @param {{ from?: string, to?: string, mealType?: string }} filters
 * @returns {Promise<number>}
 */
export async function countEntries(userId, filters) {
  const { whereClause, params } = buildWhereClause(userId, filters);

  const { rows } = await query(
    `SELECT COUNT(*) AS total FROM food_entries WHERE ${whereClause}`,
    params,
  );

  return rows[0].total;
}

/** Maps API field names to their columns. The only place this mapping exists for writes. */
const UPDATABLE_COLUMNS = {
  consumedAt: 'consumed_at',
  mealType: 'meal_type',
  foodName: 'food_name',
  quantity: 'quantity',
  unit: 'unit',
  calories: 'calories',
  proteinG: 'protein_g',
  carbsG: 'carbs_g',
  fatG: 'fat_g',
  micros: 'micros',
  source: 'source',
};

/**
 * Updates the given fields of one entry.
 *
 * `user_id = $n` in the WHERE clause IS the ownership check: another user's row
 * does not match, giving the same "no row" result as an id that does not exist
 * — which is what makes the 404 honest rather than a disguised 403.
 *
 * Column names come from UPDATABLE_COLUMNS, never from the request.
 *
 * @param {number} userId
 * @param {number} entryId
 * @param {import('./entries.schema.js').UpdateEntryInput} patch
 * @returns {Promise<ReturnType<typeof toEntry> | null>} null when no such entry belongs to the user.
 */
export async function updateEntry(userId, entryId, patch) {
  const assignments = [];
  const params = [];

  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (!(field in patch)) continue;
    params.push(patch[field] ?? null);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return null;

  params.push(entryId, userId);

  const { rows } = await query(
    `UPDATE food_entries
        SET ${assignments.join(', ')}
      WHERE id = $${params.length - 1} AND user_id = $${params.length}
      RETURNING ${ENTRY_COLUMNS}`,
    params,
  );

  return rows.length === 0 ? null : toEntry(rows[0]);
}

/**
 * Deletes one entry, scoped to its owner.
 *
 * @param {number} userId
 * @param {number} entryId
 * @returns {Promise<boolean>} false when no such entry belongs to the user.
 */
export async function deleteEntry(userId, entryId) {
  const { rowCount } = await query('DELETE FROM food_entries WHERE id = $1 AND user_id = $2', [
    entryId,
    userId,
  ]);

  return rowCount > 0;
}
