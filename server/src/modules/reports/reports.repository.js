import { query } from '../../db/pool.js';

/**
 * Report SQL. Two rules shape every query here:
 *
 * 1. Aggregation happens in Postgres, never in JavaScript.
 * 2. Time series come from `generate_series` LEFT JOINed to the data, so a day
 *    with no entries is a zero row rather than a missing one — otherwise a
 *    chart joins Monday straight to Wednesday and hides the gap.
 *
 * Day boundaries are the database's (UTC in Docker).
 */

/**
 * Daily calorie totals across the range, including days with no entries.
 *
 * @param {number} userId
 * @param {{ from: string, to: string }} range  Inclusive YYYY-MM-DD bounds.
 * @returns {Promise<{ day: string, calories: number, entryCount: number }[]>}
 */
export async function getCalorieTrend(userId, { from, to }) {
  const { rows } = await query(
    `SELECT series.day::date                          AS day,
            ROUND(COALESCE(SUM(e.calories), 0), 2)    AS calories,
            COUNT(e.id)                               AS entry_count
       FROM generate_series($2::date, $3::date, INTERVAL '1 day') AS series(day)
       -- LEFT JOIN, with the user filter in the ON clause rather than WHERE:
       -- in WHERE it would discard the generated rows that have no match and
       -- undo the gap filling entirely.
       LEFT JOIN food_entries e
              ON e.user_id = $1
             AND e.consumed_at >= series.day
             AND e.consumed_at < series.day + INTERVAL '1 day'
      GROUP BY series.day
      ORDER BY series.day`,
    [userId, from, to],
  );

  return rows.map((row) => ({
    day: row.day,
    calories: row.calories,
    entryCount: row.entry_count,
  }));
}

/**
 * Macro totals per day or per week, including empty buckets.
 *
 * @param {number} userId
 * @param {{ from: string, to: string, granularity: 'day' | 'week' }} options
 * @returns {Promise<{ bucket: string, calories: number, proteinG: number, carbsG: number, fatG: number, entryCount: number }[]>}
 */
export async function getMacroBreakdown(userId, { from, to, granularity }) {
  const step = granularity === 'week' ? '1 week' : '1 day';

  const { rows } = await query(
    // The series starts at the truncated bucket containing `from` — for weeks
    // that is the preceding Monday, so the first week is a whole bucket rather
    // than a stub. Entries are still restricted to the requested range by the
    // final two ON conditions, so that earlier Monday contributes nothing it
    // should not: the bucket is wide, the data inside it is not.
    `SELECT series.bucket::date                        AS bucket,
            ROUND(COALESCE(SUM(e.calories), 0), 2)     AS calories,
            ROUND(COALESCE(SUM(e.protein_g), 0), 2)    AS protein_g,
            ROUND(COALESCE(SUM(e.carbs_g), 0), 2)      AS carbs_g,
            ROUND(COALESCE(SUM(e.fat_g), 0), 2)        AS fat_g,
            COUNT(e.id)                                AS entry_count
       FROM generate_series(
              date_trunc($4, $2::timestamp),
              $3::timestamp,
              $5::interval
            ) AS series(bucket)
       LEFT JOIN food_entries e
              ON e.user_id = $1
             AND e.consumed_at >= series.bucket
             AND e.consumed_at < series.bucket + $5::interval
             AND e.consumed_at >= $2::date
             AND e.consumed_at < ($3::date + INTERVAL '1 day')
      GROUP BY series.bucket
      ORDER BY series.bucket`,
    [userId, from, to, granularity, step],
  );

  return rows.map((row) => ({
    bucket: row.bucket,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    entryCount: row.entry_count,
  }));
}

/**
 * Micronutrient totals across the range, summed per micronutrient.
 *
 * `micros` keys differ from row to row, so there is no fixed column set to SUM.
 * `jsonb_each_text` expands each entry's object into (key, value) rows — via
 * CROSS JOIN LATERAL, so it sees that row's own `micros` — which GROUP BY can
 * then sum by key. Values arrive as text, hence the numeric cast; the regex
 * guard skips a non-numeric value rather than letting it abort the report.
 *
 * No gap filling: this is a period summary, not a time series.
 *
 * @param {number} userId
 * @param {{ from: string, to: string }} range
 * @returns {Promise<{ key: string, total: number, entryCount: number }[]>}
 */
export async function getMicroSummary(userId, { from, to }) {
  const { rows } = await query(
    `SELECT micro.key                              AS key,
            ROUND(SUM(micro.value::numeric), 2)    AS total,
            COUNT(DISTINCT e.id)                   AS entry_count
       FROM food_entries e
       CROSS JOIN LATERAL jsonb_each_text(e.micros) AS micro(key, value)
      WHERE e.user_id = $1
        AND e.consumed_at >= $2::date
        AND e.consumed_at < ($3::date + INTERVAL '1 day')
        AND micro.value ~ '^-?[0-9]+(\\.[0-9]+)?$'
      GROUP BY micro.key
      ORDER BY total DESC, micro.key`,
    [userId, from, to],
  );

  return rows.map((row) => ({
    key: row.key,
    total: row.total,
    entryCount: row.entry_count,
  }));
}

/**
 * Each day's actuals against the goal that applied on that day.
 *
 * The LATERAL join resolves a different goal per row in one pass: for each
 * generated day it looks up the most recent goal dated on or before it. A plain
 * join would attach every goal to every day.
 *
 * `goalCalories` is null before the user's first goal — no target existed, and
 * a zero would draw a false target line.
 *
 * @param {number} userId
 * @param {{ from: string, to: string }} range
 * @returns {Promise<object[]>}
 */
export async function getGoalVsActual(userId, { from, to }) {
  const { rows } = await query(
    `SELECT series.day::date                              AS day,
            goal.daily_calories                           AS goal_calories,
            goal.protein_g                                AS goal_protein_g,
            goal.carbs_g                                  AS goal_carbs_g,
            goal.fat_g                                    AS goal_fat_g,
            ROUND(COALESCE(actual.calories, 0), 2)        AS actual_calories,
            ROUND(COALESCE(actual.protein_g, 0), 2)       AS actual_protein_g,
            ROUND(COALESCE(actual.carbs_g, 0), 2)         AS actual_carbs_g,
            ROUND(COALESCE(actual.fat_g, 0), 2)           AS actual_fat_g,
            COALESCE(actual.entry_count, 0)               AS entry_count
       FROM generate_series($2::date, $3::date, INTERVAL '1 day') AS series(day)
       LEFT JOIN LATERAL (
              SELECT g.daily_calories, g.protein_g, g.carbs_g, g.fat_g
                FROM goals g
               WHERE g.user_id = $1
                 AND g.effective_from <= series.day::date
               -- id DESC breaks ties: two goals may share an effective_from,
               -- and the one inserted later is the one that counts.
               ORDER BY g.effective_from DESC, g.id DESC
               LIMIT 1
            ) AS goal ON TRUE
       LEFT JOIN LATERAL (
              SELECT SUM(e.calories)  AS calories,
                     SUM(e.protein_g) AS protein_g,
                     SUM(e.carbs_g)   AS carbs_g,
                     SUM(e.fat_g)     AS fat_g,
                     COUNT(*)         AS entry_count
                FROM food_entries e
               WHERE e.user_id = $1
                 AND e.consumed_at >= series.day
                 AND e.consumed_at < series.day + INTERVAL '1 day'
            ) AS actual ON TRUE
      ORDER BY series.day`,
    [userId, from, to],
  );

  return rows.map((row) => ({
    day: row.day,
    goalCalories: row.goal_calories,
    goalProteinG: row.goal_protein_g,
    goalCarbsG: row.goal_carbs_g,
    goalFatG: row.goal_fat_g,
    actualCalories: row.actual_calories,
    actualProteinG: row.actual_protein_g,
    actualCarbsG: row.actual_carbs_g,
    actualFatG: row.actual_fat_g,
    entryCount: row.entry_count,
  }));
}
