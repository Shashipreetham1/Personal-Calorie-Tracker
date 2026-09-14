import { z } from 'zod';
import * as entriesService from '../entries/entries.service.js';
import * as goalsService from '../goals/goals.service.js';
import * as reportsService from '../reports/reports.service.js';
import { createEntrySchema } from '../entries/entries.schema.js';
import { createGoalSchema } from '../goals/goals.schema.js';
import { MEAL_TYPES } from '../../config/constants.js';
import { todayISODate, toISODate } from '../../utils/dates.js';
import { toGeminiJsonSchema } from '../ai/jsonSchema.js';

/**
 * The seven chat tools.
 *
 * Every one is a thin wrapper over a service the REST controllers already call:
 * `log_meal` runs `entriesService.create`, the same function behind
 * `POST /api/entries`. There is no business logic in this file — if a tool
 * needs behaviour that does not exist, the service should grow, not the tool.
 *
 * Argument schemas are reused from the modules that own them, so a rule added
 * to an endpoint applies to natural language for free.
 */

/** Arguments for `log_meal`: the create-entry contract, minus the source. */
const logMealSchema = createEntrySchema
  .omit({ source: true })
  .describe('Details of the food to log');

/** Arguments for `get_entries`: the listing filters, without the envelope noise. */
const getEntriesSchema = z.object({
  from: z.iso.date().optional().describe('Start date, YYYY-MM-DD'),
  to: z.iso.date().optional().describe('End date, YYYY-MM-DD, inclusive'),
  mealType: z.enum(MEAL_TYPES).optional().describe('Restrict to one meal'),
  limit: z.number().int().positive().max(50).optional().describe('How many entries to return'),
});

/** Arguments for `get_goals`. */
const getGoalsSchema = z.object({
  limit: z.number().int().positive().max(50).optional().describe('How many past goals to return'),
});

/** Arguments for `daily_progress`. */
const dailyProgressSchema = z.object({
  date: z.iso.date().optional().describe('The day to report on, YYYY-MM-DD. Defaults to today.'),
});

/** Arguments for `weekly_summary`. */
const weeklySummarySchema = z.object({
  from: z.iso.date().optional().describe('Start of the period. Defaults to seven days ago.'),
  to: z.iso.date().optional().describe('End of the period. Defaults to today.'),
});

/** Arguments for `answer_nutrition_question`. */
const nutritionQuestionSchema = z.object({
  question: z.string().trim().min(1).max(500).describe("The user's nutrition question"),
});

/**
 * The date seven days ago (inclusive of today makes seven days).
 *
 * @returns {string} YYYY-MM-DD
 */
function sevenDaysAgoISODate() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return toISODate(date);
}

/**
 * @typedef {object} ChatTool
 * @property {string} name
 * @property {string} description  Shown to the model; it decides from this alone.
 * @property {import('zod').ZodType} parameters
 * @property {(userId: number, args: object) => Promise<unknown>} handler
 * @property {(result: any, args: any) => string} [summarise]  Short line for the UI card.
 */

/** @type {ChatTool[]} */
export const CHAT_TOOLS = [
  {
    name: 'log_meal',
    description:
      'Record something the user ate. Use whenever they mention eating or drinking something. ' +
      'Always include mealType (breakfast, lunch, dinner or snacks) and your best estimate of ' +
      'calories and macros if the user does not state them.',
    parameters: logMealSchema,
    handler: (userId, args) => entriesService.create(userId, { ...args, source: 'chat' }),
    summarise: (entry) =>
      `Logged ${entry.quantity}${entry.unit ? ` ${entry.unit}` : ''} ${entry.foodName} — ${entry.calories} cal`,
  },
  {
    name: 'get_entries',
    description:
      'List what the user has eaten, optionally filtered by date range and meal type. ' +
      'Use for questions like "what did I eat yesterday" or "show my lunches this week".',
    parameters: getEntriesSchema,
    handler: (userId, args) => entriesService.list(userId, args),
    summarise: (page) => `Found ${page.pagination.total} entr${page.pagination.total === 1 ? 'y' : 'ies'}`,
  },
  {
    name: 'set_goal',
    description:
      'Set or change the user\'s nutrition targets. Creates a new dated goal; previous goals are ' +
      'kept as history. Requires dailyCalories and the three macro targets in grams.',
    parameters: createGoalSchema,
    handler: (userId, args) => goalsService.create(userId, args),
    summarise: (goal) =>
      `Goal set: ${goal.dailyCalories} cal, ${goal.proteinG}g protein from ${goal.effectiveFrom}`,
  },
  {
    name: 'get_goals',
    description:
      "Get the user's current nutrition goal and the history of previous goals with their effective dates.",
    parameters: getGoalsSchema,
    handler: async (userId, args) => {
      // Two service calls, no new logic: the current goal may not exist yet,
      // which is a normal state rather than an error to report to the model.
      const [history, current] = await Promise.all([
        goalsService.list(userId, args),
        goalsService.getCurrent(userId).catch(() => null),
      ]);

      return { current, history: history.data, total: history.pagination.total };
    },
    summarise: (result) =>
      result.current ? `Current goal: ${result.current.dailyCalories} cal/day` : 'No goal set yet',
  },
  {
    name: 'daily_progress',
    description:
      'How the user is doing against their goal on a given day: calories and macros consumed ' +
      'versus target. Use for "how am I doing today" or "did I hit my protein yesterday".',
    parameters: dailyProgressSchema,
    handler: async (userId, args) => {
      const day = args.date ?? todayISODate();
      // The goal-vs-actual report already resolves the goal that applied on a
      // given day and joins it to that day's totals. A single-day range is
      // exactly this question, so there is nothing to reimplement.
      const report = await reportsService.getGoalVsActual(userId, { from: day, to: day });

      return report.data[0] ?? { day, entryCount: 0 };
    },
    summarise: (day) =>
      `${day.day}: ${day.actualCalories ?? 0}${day.goalCalories ? ` of ${day.goalCalories}` : ''} cal`,
  },
  {
    name: 'weekly_summary',
    description:
      'Summarise a period (default: the last seven days) — daily calorie trend, macro totals, ' +
      'top micronutrients, and how each day compared to the goal.',
    parameters: weeklySummarySchema,
    handler: async (userId, args) => {
      const range = { from: args.from ?? sevenDaysAgoISODate(), to: args.to ?? todayISODate() };

      // Deliberately the report services, not a fresh query: the model narrates
      // the same gap-filled, goal-aware SQL the charts are drawn from, instead
      // of counting rows itself and disagreeing with the Reports screen.
      const [trend, macros, micros, goalVsActual] = await Promise.all([
        reportsService.getCalorieTrend(userId, range),
        reportsService.getMacroBreakdown(userId, { ...range, granularity: 'day' }),
        reportsService.getMicroSummary(userId, range),
        reportsService.getGoalVsActual(userId, range),
      ]);

      const daysLogged = trend.data.filter((day) => day.entryCount > 0).length;
      const totalCalories = trend.data.reduce((sum, day) => sum + day.calories, 0);

      return {
        range,
        daysInRange: trend.data.length,
        daysLogged,
        totalCalories: Math.round(totalCalories),
        // Averaged over days actually logged: dividing by seven when the user
        // logged three days would understate their intake by more than half.
        averageCaloriesPerLoggedDay: daysLogged ? Math.round(totalCalories / daysLogged) : 0,
        dailyCalories: trend.data,
        dailyMacros: macros.data,
        topMicros: micros.data.slice(0, 8),
        goalComparison: goalVsActual.data,
      };
    },
    summarise: (summary) =>
      `${summary.range.from} to ${summary.range.to}: ${summary.daysLogged} days logged, ` +
      `${summary.averageCaloriesPerLoggedDay} cal/day average`,
  },
  {
    name: 'answer_nutrition_question',
    description:
      'Use for general nutrition questions ("is paneer high in protein?", "how much fibre do I need?"). ' +
      'Returns the user\'s own goal and recent intake so the answer can be personalised. ' +
      'Answer from your nutrition knowledge using that context.',
    parameters: nutritionQuestionSchema,
    handler: async (userId, args) => {
      // The model answers; this supplies the user-specific context it cannot
      // know, so general advice lands against real numbers.
      const range = { from: sevenDaysAgoISODate(), to: todayISODate() };
      const [goal, trend] = await Promise.all([
        goalsService.getCurrent(userId).catch(() => null),
        reportsService.getCalorieTrend(userId, range),
      ]);

      const logged = trend.data.filter((day) => day.entryCount > 0);

      return {
        question: args.question,
        currentGoal: goal,
        recentAverageCalories: logged.length
          ? Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / logged.length)
          : null,
        daysLoggedLastWeek: logged.length,
        guidance:
          'Answer the question using your own nutrition knowledge. Refer to the context above ' +
          'where it is relevant. Do not present estimates as medical advice.',
      };
    },
    summarise: () => 'Checked your goal and recent intake',
  },
];

/** Tools by name, for dispatching a function call. */
const TOOLS_BY_NAME = new Map(CHAT_TOOLS.map((tool) => [tool.name, tool]));

/**
 * Gemini function declarations, generated from the Zod schemas above.
 *
 * Generated rather than hand-written for the same reason the extraction
 * response schema is: a hand-maintained copy would drift from the validation
 * the moment either side changed, and the drift would show up as the model
 * confidently sending arguments the service rejects.
 *
 * @returns {{ functionDeclarations: object[] }[]}
 */
export function buildToolDeclarations() {
  return [
    {
      functionDeclarations: CHAT_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: toGeminiJsonSchema(tool.parameters, { io: 'input' }),
      })),
    },
  ];
}

/**
 * Runs one tool call on behalf of a user.
 *
 * Never throws. A failure is returned to the model as structured data so it can
 * tell the user what went wrong and carry on — a thrown error would kill the
 * whole turn, and "the app crashed" is a worse answer than "I could not log
 * that because the quantity has to be greater than zero".
 *
 * @param {number} userId  From the JWT. The model never supplies this.
 * @param {{ name: string, args: object }} call
 * @returns {Promise<{ ok: true, result: unknown, summary: string } | { ok: false, error: object }>}
 */
export async function executeTool(userId, { name, args }) {
  const tool = TOOLS_BY_NAME.get(name);

  if (!tool) {
    return { ok: false, error: { message: `Unknown tool "${name}".`, code: 'UNKNOWN_TOOL' } };
  }

  // Arguments are validated with the same schema the REST endpoint uses, so
  // the model cannot talk the service into accepting something a user could not.
  const parsed = tool.parameters.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        message: 'The arguments were not valid.',
        code: 'VALIDATION_ERROR',
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      },
    };
  }

  try {
    const result = await tool.handler(userId, parsed.data);
    return { ok: true, result, summary: tool.summarise?.(result, parsed.data) ?? `${name} completed` };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error.message ?? 'The action failed.',
        code: error.code ?? 'TOOL_ERROR',
        details: error.details ?? undefined,
      },
    };
  }
}
