import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendMessageSchema, chatHistoryQuerySchema } from './chat.schema.js';
import * as chatController from './chat.controller.js';

export const chatRouter = Router();

// The tools act as the authenticated user; the user id comes from the JWT and
// is passed to every tool by the service. The model never sees or supplies it.
chatRouter.use(requireAuth);

chatRouter.post('/', validate({ body: sendMessageSchema }), asyncHandler(chatController.sendMessage));

chatRouter.get(
  '/history',
  validate({ query: chatHistoryQuerySchema }),
  asyncHandler(chatController.getHistory),
);
