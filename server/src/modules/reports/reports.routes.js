import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { reportRangeQuerySchema, macrosQuerySchema } from './reports.schema.js';
import * as reportsController from './reports.controller.js';

export const reportsRouter = Router();

// Every report is user-scoped; the user id comes from the JWT only.
reportsRouter.use(requireAuth);

reportsRouter.get(
  '/calorie-trend',
  validate({ query: reportRangeQuerySchema }),
  asyncHandler(reportsController.getCalorieTrend),
);

reportsRouter.get(
  '/macros',
  validate({ query: macrosQuerySchema }),
  asyncHandler(reportsController.getMacroBreakdown),
);

reportsRouter.get(
  '/micros',
  validate({ query: reportRangeQuerySchema }),
  asyncHandler(reportsController.getMicroSummary),
);

reportsRouter.get(
  '/goal-vs-actual',
  validate({ query: reportRangeQuerySchema }),
  asyncHandler(reportsController.getGoalVsActual),
);
