import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { todayISODate } from '../../utils/dates.js';

/**
 * Bounds mirror the CHECK constraints in migration 002. Zod produces the
 * friendly message; the constraint is the backstop.
 */
const GOAL_LIMITS = {
  MIN_CALORIES: 500,
  MAX_CALORIES: 10_000,
  MAX_MACRO_GRAMS: 2000,
  MAX_WEIGHT_KG: 500,
};

/** A macro target in grams: non-negative, and bounded so a typo cannot overflow numeric(8,2). */
const macroGramsSchema = z
  .number()
  .nonnegative('Macro targets cannot be negative')
  .max(GOAL_LIMITS.MAX_MACRO_GRAMS, `Macro targets must be at most ${GOAL_LIMITS.MAX_MACRO_GRAMS}g`);

/**
 * Body of `POST /api/goals`.
 *
 * Also the source of truth for the Phase 8 `set_goal` chat tool: the tool
 * validates the model's arguments with this exact schema before calling the
 * service, so natural-language input is held to the same rules as the form.
 */
export const createGoalSchema = z.object({
  // Defaults to today, so "set my calories to 2200" needs no date from the user.
  effectiveFrom: z.iso
    .date('Use the format YYYY-MM-DD')
    .refine((value) => value <= todayISODate(), {
      message: 'Effective date cannot be in the future',
    })
    .default(todayISODate),

  dailyCalories: z
    .number()
    .int('Daily calories must be a whole number')
    .min(GOAL_LIMITS.MIN_CALORIES, `Daily calories must be at least ${GOAL_LIMITS.MIN_CALORIES}`)
    .max(GOAL_LIMITS.MAX_CALORIES, `Daily calories must be at most ${GOAL_LIMITS.MAX_CALORIES}`),

  proteinG: macroGramsSchema,
  carbsG: macroGramsSchema,
  fatG: macroGramsSchema,

  weightGoalKg: z
    .number()
    .positive('Weight goal must be greater than zero')
    .max(GOAL_LIMITS.MAX_WEIGHT_KG, `Weight goal must be at most ${GOAL_LIMITS.MAX_WEIGHT_KG}kg`)
    .nullish(),
});

/** Query of `GET /api/goals` — pagination only; history is never filtered. */
export const listGoalsQuerySchema = paginationQuerySchema;

/** @typedef {z.infer<typeof createGoalSchema>} CreateGoalInput */
