import { GoogleGenAI, ApiError } from '@google/genai';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { toGeminiJsonSchema } from './jsonSchema.js';

/**
 * The only place the application talks to Gemini.
 *
 * Everything above this file deals in plain objects and AppErrors; nothing else
 * imports the SDK. Swapping providers, or stubbing the model in a test, means
 * replacing this one module.
 */

/** How long to wait for the model before giving up. */
const REQUEST_TIMEOUT_MS = 45_000;

/** Lazily constructed so the app boots fine with no API key configured. */
let client = null;

/**
 * @returns {GoogleGenAI}
 * @throws {AppError} 503 when no API key is configured.
 */
function getClient() {
  if (!config.ai.apiKey) {
    throw AppError.aiUnavailable(
      'AI features are not configured. Set GEMINI_API_KEY to enable photo extraction, chat and PDF import.',
    );
  }

  client ??= new GoogleGenAI({ apiKey: config.ai.apiKey });
  return client;
}

/** True when the server can make AI calls at all — used to fail fast with a clear message. */
export function isAiConfigured() {
  return Boolean(config.ai.apiKey);
}

/**
 * Translates SDK and network failures into AppErrors with useful messages.
 *
 * A generic 500 here would be the worst outcome: "something went wrong" gives
 * the user nothing to act on, when the real answer is usually "wait a minute
 * and retry" or "the image was too complex". Each case is distinguished.
 *
 * @param {unknown} error
 * @returns {AppError}
 */
function toAppError(error) {
  // AbortSignal.timeout() rejects with a DOMException named TimeoutError; some
  // runtimes surface the same condition as AbortError.
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return AppError.gatewayTimeout(
      'The AI service took too long to respond. Try again, or enter the details manually.',
    );
  }

  if (error instanceof ApiError) {
    if (error.status === 429) {
      return AppError.tooManyRequests(
        'The AI service is rate limited right now. Wait a moment and try again.',
      );
    }
    if (error.status === 401 || error.status === 403) {
      return AppError.aiUnavailable('The configured AI API key was rejected.');
    }
    if (error.status === 400) {
      return AppError.badGateway('The AI service rejected the request.');
    }
    if (error.status >= 500) {
      return AppError.serviceUnavailable('The AI service is temporarily unavailable.');
    }
  }

  // Network-level failures (DNS, refused connection) reach here as TypeError.
  if (error?.name === 'TypeError' || error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
    return AppError.serviceUnavailable('Could not reach the AI service.');
  }

  return AppError.badGateway('The AI request failed unexpectedly.');
}

/**
 * Asks the model for JSON matching a Zod schema, and returns it parsed.
 *
 * Two layers of safety, deliberately both:
 *   1. the schema is sent as `responseJsonSchema`, which constrains the shape;
 *   2. the reply is parsed through the same Zod schema anyway.
 * A response schema guarantees structure, not sanity — the model can still
 * return -40 calories or an empty item list inside a perfectly valid shape.
 *
 * @param {object} options
 * @param {Array} options.contents  Gemini content parts (text, inlineData, …).
 * @param {string} options.systemInstruction
 * @param {import('zod').ZodType} options.schema  Validates the reply.
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ data: unknown, raw: unknown }>} `data` is Zod-parsed; `raw` is
 *   the model's reply as received, for the audit log.
 * @throws {AppError} Never a bare Error: timeout, quota, and unparseable reply
 *   are all distinguished.
 */
export async function generateJson({ contents, systemInstruction, schema, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const ai = getClient();
  const startedAt = Date.now();

  let response;
  try {
    response = await ai.models.generateContent({
      model: config.ai.model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: toGeminiJsonSchema(schema),
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    });
  } catch (error) {
    logger.error('Gemini request failed', {
      model: config.ai.model,
      durationMs: Date.now() - startedAt,
      name: error?.name,
      status: error?.status,
      message: error?.message,
    });
    throw toAppError(error);
  }

  logger.info('Gemini request completed', {
    model: config.ai.model,
    durationMs: Date.now() - startedAt,
  });

  const text = response.text;
  if (!text) {
    // Usually a safety block or a truncated response: there is no JSON to parse.
    throw AppError.badGateway(
      'The AI service returned no usable content for this input. Try a clearer photo.',
    );
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw AppError.badGateway('The AI service returned malformed JSON.');
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    logger.warn('Gemini response failed schema validation', {
      issues: result.error.issues.slice(0, 5),
    });
    throw AppError.badGateway('The AI service returned data that did not make sense.', {
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
      raw: parsedJson,
    });
  }

  return { data: result.data, raw: parsedJson };
}

/**
 * Raw text generation with tool calling, used by the chat loop.
 *
 * Exposed separately from `generateJson` because the chat turn is a
 * conversation, not a single structured answer: it needs the full candidate
 * back so function calls can be read off it.
 *
 * @param {object} options
 * @param {Array} options.contents
 * @param {string} options.systemInstruction
 * @param {Array} [options.tools]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<import('@google/genai').GenerateContentResponse>}
 */
export async function generateWithTools({ contents, systemInstruction, tools, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const ai = getClient();

  try {
    return await ai.models.generateContent({
      model: config.ai.model,
      contents,
      config: {
        systemInstruction,
        tools,
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    });
  } catch (error) {
    logger.error('Gemini tool-calling request failed', {
      name: error?.name,
      status: error?.status,
      message: error?.message,
    });
    throw toAppError(error);
  }
}
