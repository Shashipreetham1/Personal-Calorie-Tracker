/**
 * Wraps an async controller so a rejected promise reaches the error middleware.
 *
 * Every controller is wrapped in this. That is what keeps try/catch out of the
 * route and controller files entirely — there is exactly one place that turns
 * an error into a response.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>} handler
 * @returns {import('express').RequestHandler}
 */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
