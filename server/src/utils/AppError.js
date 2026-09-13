import { ERROR_CODES } from '../config/constants.js';

/**
 * The only error type the application throws deliberately.
 *
 * Anything else reaching the error middleware is treated as a bug and reported
 * as a 500 with its message hidden, so internals never leak to clients.
 */
export class AppError extends Error {
  /**
   * @param {string} message  Human-readable message, safe to show the user.
   * @param {number} statusCode  HTTP status to respond with.
   * @param {string} code  Machine-readable code from ERROR_CODES.
   * @param {unknown} [details]  Optional structured detail (e.g. field errors).
   */
  constructor(message, statusCode, code, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    /** Distinguishes expected failures from programmer errors. */
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Invalid request', details) {
    return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(message, 401, ERROR_CODES.UNAUTHORIZED);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(message, 403, ERROR_CODES.FORBIDDEN);
  }

  /**
   * Also used when a row exists but belongs to another user: revealing that a
   * resource exists but is not yours leaks data, so ownership failures are 404s.
   */
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, ERROR_CODES.NOT_FOUND);
  }

  static conflict(message = 'Resource already exists') {
    return new AppError(message, 409, ERROR_CODES.CONFLICT);
  }

  static payloadTooLarge(message = 'Payload too large') {
    return new AppError(message, 413, ERROR_CODES.PAYLOAD_TOO_LARGE);
  }

  static unsupportedMediaType(message = 'Unsupported media type') {
    return new AppError(message, 415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);
  }

  static tooManyRequests(message = 'Too many requests, please try again shortly') {
    return new AppError(message, 429, ERROR_CODES.RATE_LIMITED);
  }

  /**
   * The AI provider answered, but with something unusable — malformed JSON, or
   * JSON that failed our own validation. 502 rather than 500: the fault is
   * upstream, and the caller can reasonably retry.
   */
  static badGateway(message = 'The AI service returned an unusable response', details) {
    return new AppError(message, 502, ERROR_CODES.AI_INVALID_RESPONSE, details);
  }

  /** The AI provider did not answer in time. */
  static gatewayTimeout(message = 'The AI service took too long to respond') {
    return new AppError(message, 504, ERROR_CODES.AI_TIMEOUT);
  }

  /** AI features are not configured (no API key). */
  static aiUnavailable(message = 'AI features are not configured on this server') {
    return new AppError(message, 503, ERROR_CODES.AI_UNAVAILABLE);
  }

  static internal(message = 'Something went wrong') {
    return new AppError(message, 500, ERROR_CODES.INTERNAL_ERROR);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', details) {
    return new AppError(message, 503, ERROR_CODES.SERVICE_UNAVAILABLE, details);
  }
}
