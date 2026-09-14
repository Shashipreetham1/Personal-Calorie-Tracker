import { z } from 'zod';

/**
 * Keywords Gemini accepts in `responseJsonSchema` / `parametersJsonSchema`.
 *
 * Structural only. Zod emits valid Draft 2020-12, but the API rejects several
 * of those keywords — including bounds like `minimum` in some combinations —
 * with nothing more useful than "Request contains an invalid argument".
 * Dropping bounds is safe: they were hints to the model, and the reply is
 * parsed through the same Zod schema afterwards, where they are enforced.
 */
const SUPPORTED_KEYWORDS = new Set([
  '$defs',
  '$ref',
  'anyOf',
  'description',
  'enum',
  'items',
  'properties',
  'propertyOrdering',
  'required',
  'title',
  'type',
]);

/**
 * Recursively keeps only the supported keywords.
 *
 * @param {unknown} schema
 * @returns {unknown}
 */
function sanitize(schema) {
  if (Array.isArray(schema)) return schema.map(sanitize);
  if (schema === null || typeof schema !== 'object') return schema;

  const result = {};

  for (const [keyword, value] of Object.entries(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) continue;

    if (keyword === 'properties') {
      result.properties = Object.fromEntries(
        Object.entries(value).map(([name, subSchema]) => [name, sanitize(subSchema)]),
      );
      continue;
    }

    result[keyword] = sanitize(value);
  }

  // A union of "string or null" becomes type: ["string", "null"], which the API
  // does not accept. Nullability is expressed in the prompt instead, and our
  // own Zod parse still allows it.
  if (Array.isArray(result.type)) {
    result.type = result.type.find((entry) => entry !== 'null') ?? 'string';
  }

  return result;
}

/**
 * Converts a Zod schema into the JSON Schema Gemini accepts, keeping one
 * source of truth: the same schema constrains the model and validates its reply.
 *
 * @param {import('zod').ZodType} schema
 * @param {{ io?: 'input' | 'output' }} [options]  `output` (default) makes
 *   defaulted fields required, so the model fills them all in. `input`, for
 *   tool parameters, leaves them optional so the model need not invent a
 *   timestamp on every call.
 * @returns {object}
 */
export function toGeminiJsonSchema(schema, { io = 'output' } = {}) {
  const jsonSchema = z.toJSONSchema(schema, {
    io,
    // Inline every definition: the API's $ref support is limited, and these
    // schemas are small enough that repetition costs nothing.
    reused: 'inline',
    // Do not throw on a type JSON Schema cannot express; `override` below
    // handles the one that matters, and anything else degrades to an
    // unconstrained field rather than breaking the whole declaration.
    unrepresentable: 'any',
    override(context) {
      // A Zod `date` has no JSON Schema equivalent, but the model only ever
      // sends JSON — where a timestamp IS a string. Rendering it as one keeps a
      // single schema as the source of truth: the model is told to send an ISO
      // string, and `z.coerce.date()` turns it back into a Date on the way in.
      if (context.zodSchema?._zod?.def?.type === 'date') {
        context.jsonSchema.type = 'string';
        context.jsonSchema.description =
          context.jsonSchema.description ?? 'ISO 8601 date-time, e.g. 2026-09-13T13:15:00Z';
      }
    },
  });

  return sanitize(jsonSchema);
}
