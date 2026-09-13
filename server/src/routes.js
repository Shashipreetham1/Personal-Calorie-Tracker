import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { goalsRouter } from './modules/goals/goals.routes.js';
import { entriesRouter } from './modules/entries/entries.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { extractRouter } from './modules/ai/extract.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { importRouter } from './modules/ai/import.routes.js';

/**
 * Single mount point for every module router. `app.js` knows about this file
 * only, so adding a module never means touching application setup.
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/goals', goalsRouter);
apiRouter.use('/entries', entriesRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/extract', extractRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/import', importRouter);
