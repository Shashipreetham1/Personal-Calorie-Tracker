import { z } from 'zod';
import { todayISODate, toISODate, daysBetweenInclusive } from '../../utils/dates.js';

/**
 * Longest range a report may cover.
 *
 * Every report scans and groups the whole range, and the day-granularity ones
 * return a row per day. A year plus a day is generous for a nutrition app and
 * keeps one request from asking the database for a decade of rows.
 */
export const MAX_RANGE_DAYS = 366;

/** Days covered when the caller does not specify a range. */
const DEFAULT_RANGE_DAYS = 30;

/** A calendar date in the query string. */
const rangeDateSchema = z.iso.date('Use the format YYYY-MM-DD').optional();

/**
 * Fills in the last 30 days when either bound is missing.
 *
 * Defaults exist so every report is callable with no parameters at all — handy
 * from curl, and it lets the chat tools ask for "recent" data without
 * inventing dates.
 *
 * @param {{ from?: string, to?: string }} query
 * @returns {{ from: string, to: string }}
 */
function withDefaultRange(query) {
  const to = query.to ?? todayISODate();

  if (query.from) return { from: query.from, to };

  const from = new Date(`${to}T00:00:00`);
  from.setDate(from.getDate() - (DEFAULT_RANGE_DAYS - 1));

  return { from: toISODate(from), to };
}

/**
 * Applies the rules every report range must satisfy.
 *
 * @template {z.ZodTypeAny} T
 * @param {T} schema
 * @returns {T}
 */
function withRangeRules(schema) {
  return schema
    .refine((range) => range.from <= range.to, {
      message: '`from` must be on or before `to`',
      path: ['from'],
    })
    .refine((range) => range.to <= todayISODate(), {
      // A range ending next year would pad the chart with meaningless zero rows.
      message: '`to` cannot be in the future',
      path: ['to'],
    })
    .refine((range) => daysBetweenInclusive(range.from, range.to) <= MAX_RANGE_DAYS, {
      message: `Date range must be at most ${MAX_RANGE_DAYS} days`,
      path: ['from'],
    });
}

/** Shared `?from&to` query. Both bounds are inclusive calendar dates. */
export const reportRangeQuerySchema = withRangeRules(
  z.object({ from: rangeDateSchema, to: rangeDateSchema }).transform(withDefaultRange),
);

/** `?from&to&granularity` — macros can be bucketed by day or by ISO week. */
export const macrosQuerySchema = withRangeRules(
  z
    .object({
      from: rangeDateSchema,
      to: rangeDateSchema,
      granularity: z.enum(['day', 'week']).default('day'),
    })
    .transform((query) => ({ ...withDefaultRange(query), granularity: query.granularity })),
);

/** @typedef {{ from: string, to: string }} ReportRange */
