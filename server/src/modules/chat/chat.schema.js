import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

/** Body of `POST /api/chat`. */
export const sendMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    // Long enough for a detailed meal description, short enough that a pasted
    // document cannot be smuggled into the prompt.
    .max(2000, 'Message must be at most 2000 characters'),
});

/** Query of `GET /api/chat/history`. */
export const chatHistoryQuerySchema = paginationQuerySchema;
