import { ZodError } from 'zod';
import { config } from '../config/index.js';
import { ERROR_CODES } from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { formatZodIssues } from './validate.js';

/** Postgres SQLSTATE codes worth translating into a meaningful HTTP status. */
const PG_ERROR_MAP = {
  '23505': () => AppError.conflict('That record already exists'),
  '23503': () => AppError.badRequest('Referenced record does not exist'),
  '23514': () => AppError.badRequest('A value violates a database constraint'),
  '22P02': () => AppError.badRequest('Malformed value in request'),
  '57014': () => AppError.serviceUnavailable('The query took too long and was cancelled'),
};

/**
 * Normalises anything thrown anywhere in the app into an AppError.
 *
 * @param {unknown} error
 * @returns {AppError}
 */
function toAppError(error) {
  if (error instanceof AppError) return error;

  // A Zod failure outside the validate middleware (e.g. parsing an AI response).
  if (error instanceof ZodError) {
    return AppError.badRequest('Validation failed', formatZodIssues(error));
  }

  // express.json() rejecting an oversized or malformed body.
  if (error?.type === 'entity.too.large') {
    return AppError.payloadTooLarge(`Request body exceeds ${config.server.jsonBodyLimit}`);
  }
  if (error?.type === 'entity.parse.failed') {
    return AppError.badRequest('Request body is not valid JSON');
  }

  if (typeof error?.code === 'string' && PG_ERROR_MAP[error.code]) {
    return PG_ERROR_MAP[error.code]();
  }

  // Database unreachable — a real outage, not a client mistake.
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
    return AppError.serviceUnavailable('A dependency is unavailable');
  }

  return AppError.internal();
}

/**
 * The single error-to-response boundary for the whole API.
 *
 * Response shape is identical for every failure:
 * `{ "error": { "code": "...", "message": "...", "details": [...] } }`
 *
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export function errorHandler(error, req, res, next) {
  const appError = toAppError(error);
  const isUnexpected = !(error instanceof AppError) && appError.code === ERROR_CODES.INTERNAL_ERROR;

  // Unexpected failures are logged with their original stack; expected ones
  // (validation, 404s) would only be noise.
  if (isUnexpected) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
      message: error?.message,
      stack: error?.stack,
    });
  }

  const body = {
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  if (appError.details !== undefined) body.error.details = appError.details;
  if (!config.isProduction && isUnexpected) body.error.stack = error?.stack;

  res.status(appError.statusCode).json(body);
}

/** Catch-all for unmatched routes, so a typo returns the standard error shape. */
export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}
