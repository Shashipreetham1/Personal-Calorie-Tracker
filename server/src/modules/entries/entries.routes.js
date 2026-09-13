import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  createEntrySchema,
  updateEntrySchema,
  listEntriesQuerySchema,
  entryIdParamSchema,
} from './entries.schema.js';
import * as entriesController from './entries.controller.js';

export const entriesRouter = Router();

// Every entries route is user-scoped; the user id comes from the JWT only.
entriesRouter.use(requireAuth);

entriesRouter.post('/', validate({ body: createEntrySchema }), asyncHandler(entriesController.create));

entriesRouter.get('/', validate({ query: listEntriesQuerySchema }), asyncHandler(entriesController.list));

entriesRouter.patch(
  '/:id',
  validate({ params: entryIdParamSchema, body: updateEntrySchema }),
  asyncHandler(entriesController.update),
);

entriesRouter.delete(
  '/:id',
  validate({ params: entryIdParamSchema }),
  asyncHandler(entriesController.remove),
);
