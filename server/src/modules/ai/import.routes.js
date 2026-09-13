import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { uploadPdf } from '../../middleware/upload.js';
import { confirmImportSchema } from './ai.schemas.js';
import * as importController from './import.controller.js';

export const importRouter = Router();

importRouter.use(requireAuth);

importRouter.post('/pdf', uploadPdf, asyncHandler(importController.importPdf));

importRouter.post(
  '/confirm',
  validate({ body: confirmImportSchema }),
  asyncHandler(importController.confirmImport),
);
