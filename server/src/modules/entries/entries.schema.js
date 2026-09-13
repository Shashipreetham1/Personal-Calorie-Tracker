import { z } from 'zod';
import { MEAL_TYPES, ENTRY_SOURCES } from '../../config/constants.js';
import { paginationQuerySchema } from '../../utils/pagination.js';

/** Bounds mirror the CHECK constraints in migration 003 and numeric(10,2). */
const ENTRY_LIMITS = {
  MAX_NAME_LENGTH: 200,
  MAX_UNIT_LENGTH: 50,
  MAX_QUANTITY: 100_000,
  MAX_NUTRITION: 100_000,
  MAX_MICRO_KEYS: 50,
  MAX_MICRO_KEY_LENGTH: 64,
};

/**
 * Clock skew allowed on `consumedAt`.
 *
 * "Not in the future" is checked against the server clock, but a browser a few
 * seconds ahead would have its perfectly ordinary "I ate this just now" entry
 * rejected. A minute of tolerance removes that failure without letting anyone
 * log tomorrow's lunch.
 */
const FUTURE_TOLERANCE_MS = 60_000;

/**
 * Micronutrients: an open-ended map of name → amount.
 *
 * Keys are lowercased and trimmed so the Phase 6 micro report, which sums by
 * key, cannot split "Iron_mg" and "iron_mg" into two rows. Values must be
 * positive — a micronutrient the food does not contain is omitted, not zeroed —
 * and finite, since `Infinity` would pass a plain `.positive()` check.
 */
const microsSchema = z
  .record(
    z.string().trim().min(1).max(ENTRY_LIMITS.MAX_MICRO_KEY_LENGTH),
    z.number().finite('Micronutrient amounts must be a finite number').positive('Micronutrient amounts must be greater than zero'),
  )
  .refine((micros) => Object.keys(micros).length <= ENTRY_LIMITS.MAX_MICRO_KEYS, {
    message: `At most ${ENTRY_LIMITS.MAX_MICRO_KEYS} micronutrients per entry`,
  })
  .transform((micros) =>
    Object.fromEntries(Object.entries(micros).map(([key, value]) => [key.trim().toLowerCase(), value])),
  );

/** A nutrition amount in grams or kcal: non-negative and bounded. */
const nutritionAmountSchema = z
  .number()
  .nonnegative('Nutrition values cannot be negative')
  .max(ENTRY_LIMITS.MAX_NUTRITION, `Nutrition values must be at most ${ENTRY_LIMITS.MAX_NUTRITION}`);

/**
 * Field definitions, shared by create and update.
 *
 * Written out once rather than deriving the update schema with `.partial()`:
 * partial-ing a field that carries a `.default()` produces surprising results,
 * and an explicit list makes the two request shapes obvious side by side.
 */
const entryFields = {
  consumedAt: z.coerce
    .date('Provide a valid date and time')
    .refine((date) => date.getTime() <= Date.now() + FUTURE_TOLERANCE_MS, {
      message: 'You cannot log food in the future',
    }),

  mealType: z.enum(MEAL_TYPES, `Meal type must be one of: ${MEAL_TYPES.join(', ')}`),

  foodName: z
    .string()
    .trim()
    .min(1, 'Food name is required')
    .max(ENTRY_LIMITS.MAX_NAME_LENGTH, `Food name must be at most ${ENTRY_LIMITS.MAX_NAME_LENGTH} characters`),

  quantity: z
    .number()
    .positive('Quantity must be greater than zero')
    .max(ENTRY_LIMITS.MAX_QUANTITY, `Quantity must be at most ${ENTRY_LIMITS.MAX_QUANTITY}`),

  unit: z.string().trim().max(ENTRY_LIMITS.MAX_UNIT_LENGTH).nullish(),

  calories: nutritionAmountSchema,
  proteinG: nutritionAmountSchema,
  carbsG: nutritionAmountSchema,
  fatG: nutritionAmountSchema,

  micros: microsSchema,

  source: z.enum(ENTRY_SOURCES, `Source must be one of: ${ENTRY_SOURCES.join(', ')}`),
};

/**
 * Body of `POST /api/entries`.
 *
 * Also the contract for the Phase 8 `log_meal` chat tool and the confirm step
 * of photo extraction and PDF import — every path into food_entries validates
 * against this one schema.
 */
export const createEntrySchema = z.object({
  // Defaults to now, so "log 2 rotis" needs no timestamp from the user.
  consumedAt: entryFields.consumedAt.default(() => new Date()),
  mealType: entryFields.mealType,
  foodName: entryFields.foodName,
  quantity: entryFields.quantity,
  unit: entryFields.unit,
  calories: entryFields.calories,
  proteinG: entryFields.proteinG.default(0),
  carbsG: entryFields.carbsG.default(0),
  fatG: entryFields.fatG.default(0),
  micros: entryFields.micros.default({}),
  source: entryFields.source.default('manual'),
});

/**
 * Body of `PATCH /api/entries/:id`. Every field optional, but not all of them:
 * an empty patch is a mistake worth reporting rather than a no-op 200.
 *
 * `micros` is replaced wholesale, not merged — sending `{}` clears them.
 */
export const updateEntrySchema = z
  .object({
    consumedAt: entryFields.consumedAt.optional(),
    mealType: entryFields.mealType.optional(),
    foodName: entryFields.foodName.optional(),
    quantity: entryFields.quantity.optional(),
    unit: entryFields.unit,
    calories: entryFields.calories.optional(),
    proteinG: entryFields.proteinG.optional(),
    carbsG: entryFields.carbsG.optional(),
    fatG: entryFields.fatG.optional(),
    micros: entryFields.micros.optional(),
    source: entryFields.source.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Provide at least one field to update',
  });

/**
 * Query of `GET /api/entries`.
 *
 * `from`/`to` are calendar dates, and the range is inclusive of both ends — a
 * user picking 1–7 September expects the 7th's dinner included, so the
 * repository compares against the day *after* `to`.
 */
export const listEntriesQuerySchema = paginationQuerySchema
  .extend({
    from: z.iso.date('Use the format YYYY-MM-DD').optional(),
    to: z.iso.date('Use the format YYYY-MM-DD').optional(),
    mealType: entryFields.mealType.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });

/** Path params for the routes that address a single entry. */
export const entryIdParamSchema = z.object({
  id: z.coerce.number('Entry id must be a number').int().positive(),
});

/** @typedef {z.infer<typeof createEntrySchema>} CreateEntryInput */
/** @typedef {z.infer<typeof updateEntrySchema>} UpdateEntryInput */
