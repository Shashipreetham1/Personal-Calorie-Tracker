import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { createGoalSchema, listGoalsQuerySchema } from './goals.schema.js';
import * as goalsController from './goals.controller.js';

export const goalsRouter = Router();

// Every goals route is user-scoped; the user id comes from the JWT only.
goalsRouter.use(requireAuth);

goalsRouter.post('/', validate({ body: createGoalSchema }), asyncHandler(goalsController.create));

// Declared before nothing else can shadow it — `/current` is a literal path,
// not an id, so it must not be reachable as a parameterised route later.
goalsRouter.get('/current', asyncHandler(goalsController.getCurrent));

goalsRouter.get('/', validate({ query: listGoalsQuerySchema }), asyncHandler(goalsController.list));
