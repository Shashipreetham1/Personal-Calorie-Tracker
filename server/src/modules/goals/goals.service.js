import * as goalsRepository from './goals.repository.js';
import { AppError } from '../../utils/AppError.js';
import { paginate, paginatedResponse } from '../../utils/pagination.js';

/** Atwater factors: kcal per gram of each macronutrient. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

/** How far macros may drift from the calorie target before it is worth mentioning. */
const RECONCILIATION_TOLERANCE = 0.15;

/**
 * Checks whether the macro targets add up to the calorie target.
 *
 * Returns a warning rather than throwing. People set imperfect goals — a
 * rounded 150g of protein against a 2000 kcal target is a normal thing to
 * want, and refusing to save it would be hostile. The user is told; the user
 * decides.
 *
 * Pure and exported so it can be unit-tested without a database.
 *
 * @param {{ dailyCalories: number, proteinG: number, carbsG: number, fatG: number }} goal
 * @returns {{ derivedCalories: number, differencePercent: number, warning: string | null }}
 */
export function reconcileMacros({ dailyCalories, proteinG, carbsG, fatG }) {
  const derivedCalories =
    proteinG * KCAL_PER_GRAM.protein + carbsG * KCAL_PER_GRAM.carbs + fatG * KCAL_PER_GRAM.fat;

  const difference = (derivedCalories - dailyCalories) / dailyCalories;
  const differencePercent = Math.round(difference * 100);

  if (Math.abs(difference) <= RECONCILIATION_TOLERANCE) {
    return { derivedCalories, differencePercent, warning: null };
  }

  const direction = difference > 0 ? 'more' : 'less';

  return {
    derivedCalories,
    differencePercent,
    warning:
      `Your macro targets work out to ${Math.round(derivedCalories)} kcal, ` +
      `${Math.abs(differencePercent)}% ${direction} than your ${dailyCalories} kcal target. ` +
      'The goal was saved as entered.',
  };
}

/**
 * Records a new goal.
 *
 * Called by both `POST /api/goals` and the `set_goal` chat tool, which
 * is why it takes plain arguments and returns plain data — no `req`, no `res`.
 *
 * @param {number} userId
 * @param {import('./goals.schema.js').CreateGoalInput} input
 * @returns {Promise<ReturnType<typeof goalsRepository.insertGoal> extends Promise<infer G> ? G & { warning: string | null } : never>}
 */
export async function create(userId, input) {
  const goal = await goalsRepository.insertGoal(userId, input);
  const { warning } = reconcileMacros(input);

  return { ...goal, warning };
}

/**
 * The goal that applies today.
 *
 * @param {number} userId
 * @returns {Promise<ReturnType<typeof goalsRepository.findEffectiveOn>>}
 * @throws {AppError} 404 when the user has never set a goal.
 */
export async function getCurrent(userId) {
  const goal = await goalsRepository.findEffectiveOn(userId);

  if (!goal) {
    throw AppError.notFound('No goal has been set yet');
  }

  return goal;
}

/**
 * The goal that applied on a specific day. Used by the goal-vs-actual report
 * and by chat answers about a past date.
 *
 * @param {number} userId
 * @param {string} onDate  YYYY-MM-DD
 * @returns {Promise<ReturnType<typeof goalsRepository.findEffectiveOn>>}
 */
export async function getEffectiveOn(userId, onDate) {
  return goalsRepository.findEffectiveOn(userId, onDate);
}

/**
 * Paginated goal history, newest first.
 *
 * @param {number} userId
 * @param {{ page?: number, limit?: number }} queryParams
 * @returns {Promise<{ data: unknown[], pagination: { page: number, limit: number, total: number, hasNext: boolean } }>}
 */
export async function list(userId, queryParams) {
  const { page, limit, offset } = paginate(queryParams);

  // Rows and count are independent queries; running them together halves the
  // latency of every list endpoint.
  const [data, total] = await Promise.all([
    goalsRepository.listGoals(userId, { limit, offset }),
    goalsRepository.countGoals(userId),
  ]);

  return paginatedResponse(data, { page, limit, total });
}
