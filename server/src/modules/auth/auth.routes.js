import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { signupSchema, loginSchema } from './auth.schema.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/signup', validate({ body: signupSchema }), asyncHandler(authController.signup));
authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
