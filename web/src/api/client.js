/**
 * The single fetch wrapper for the whole app.
 *
 * Components never call `fetch` directly: credentials handling, JSON encoding
 * and error normalisation all live here, so every screen deals with the same
 * `ApiError` shape no matter which endpoint failed.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

/**
 * Builds the absolute URL for a path, applying query parameters.
 *
 * Empty values are dropped rather than sent as `?mealType=`, which the API
 * would reject as an invalid enum.
 *
 * @param {string} path
 * @param {Record<string, unknown>} [query]
 * @returns {URL}
 */
function buildUrl(path, query) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

/** Error thrown for any non-2xx response, carrying the API's error envelope. */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [code]
   * @param {unknown} [details]
   */
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Performs an API request and returns the parsed body.
 *
 * @param {string} path  Path relative to the API base, e.g. `/entries`.
 * @param {{ method?: string, body?: unknown, query?: Record<string, unknown>, signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 * @throws {ApiError} On a non-2xx response or an unreachable server.
 */
export async function request(path, { method = 'GET', body, query, signal } = {}) {
  const url = buildUrl(path, query);

  let response;
  try {
    response = await fetch(url, {
      method,
      // Sends and accepts the httpOnly auth cookie across the SPA/API origins.
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the server. Is the API running?', 0, 'NETWORK_ERROR');
  }

  return readResponse(response);
}

/**
 * Turns a Response into data, or into an ApiError carrying the API's error
 * envelope. The one place a non-2xx becomes a thrown error.
 *
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function readResponse(response) {
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError = payload?.error;
    throw new ApiError(
      apiError?.message ?? `Request failed with status ${response.status}`,
      response.status,
      apiError?.code,
      apiError?.details,
    );
  }

  return payload;
}

/**
 * Sends a single file as multipart/form-data.
 *
 * Separate from `request` because the body must NOT be JSON-encoded and the
 * Content-Type header must be left unset — the browser has to add it itself so
 * it can include the multipart boundary. Error handling is shared by reusing
 * `readResponse`.
 *
 * @param {string} path
 * @param {{ field: string, file: File, query?: Record<string, unknown>, signal?: AbortSignal }} options
 * @returns {Promise<any>}
 * @throws {ApiError}
 */
export async function upload(path, { field, file, query, signal }) {
  const formData = new FormData();
  formData.append(field, file);

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method: 'POST',
      credentials: 'include',
      body: formData,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the server. Is the API running?', 0, 'NETWORK_ERROR');
  }

  return readResponse(response);
}
