import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { uploadImage } from '../../middleware/upload.js';
import { extractImageQuerySchema } from './ai.schemas.js';
import * as extractController from './extract.controller.js';

export const extractRouter = Router();

extractRouter.use(requireAuth);

// Order matters: authenticate, then validate the query, then accept the upload,
// and only then reach the controller that spends money on a model call. The
// cheap checks all happen first.
extractRouter.post(
  '/image',
  validate({ query: extractImageQuerySchema }),
  uploadImage,
  asyncHandler(extractController.extractImage),
);
