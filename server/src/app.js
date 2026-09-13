import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { apiRouter } from './routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';

/**
 * Builds the Express application.
 *
 * Exported as a factory (rather than a started server) so tests can mount the
 * app without binding a port.
 *
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  // Behind the compose network / any proxy, trust the forwarded protocol so
  // `secure` cookies work in production.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  app.use(
    cors({
      // Credentials are required (the JWT travels in an httpOnly cookie), so
      // the allow-list must be explicit — `*` is rejected by browsers here.
      origin(origin, callback) {
        // Same-origin and non-browser callers (curl, health probes) send no Origin.
        if (!origin || config.cors.origins.includes(origin)) return callback(null, true);
        return callback(AppError.forbidden(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: config.server.jsonBodyLimit }));
  app.use(cookieParser());

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
