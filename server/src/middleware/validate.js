import { AppError } from '../utils/AppError.js';

const SOURCES = ['body', 'query', 'params'];

/**
 * Flattens Zod issues into a client-friendly list.
 *
 * @param {import('zod').ZodError} error
 * @returns {{ field: string, message: string }[]}
 */
export function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Middleware factory that validates request parts against Zod schemas.
 *
 * Parsed (coerced, defaulted, stripped) values are written to `req.validated`
 * rather than back onto `req.query`/`req.params`, which are read-only getters
 * in Express 5. Controllers therefore always read `req.validated.*` — if a
 * value is not there, it was never validated.
 *
 * @param {{ body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schemas
 * @returns {import('express').RequestHandler}
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.validated = req.validated ?? {};

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (!result.success) {
        return next(
          AppError.badRequest(`Invalid request ${source}`, formatZodIssues(result.error)),
        );
      }

      req.validated[source] = result.data;
    }

    return next();
  };
}
