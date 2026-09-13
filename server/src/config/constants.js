/** Values shared across modules. Kept here so no magic strings leak into SQL. */

/** Meal buckets a food entry can belong to. Mirrors the food_entries CHECK constraint. */
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

/** How an entry got into the database. Mirrors the food_entries CHECK constraint. */
export const ENTRY_SOURCES = ['manual', 'photo', 'chat', 'import'];

/** Pagination defaults, applied to every list endpoint. */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

/** Machine-readable error codes returned in the `error.code` response field. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_TIMEOUT: 'AI_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

/** Image types accepted by the photo extraction endpoint. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** What an extraction was performed on. Mirrors the extractions CHECK constraint. */
export const EXTRACTION_SOURCE_TYPES = ['label', 'plate', 'pdf'];
