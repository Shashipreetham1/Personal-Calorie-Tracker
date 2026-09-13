import { z } from 'zod';

/**
 * Keywords sent to Gemini in `responseJsonSchema` / `parametersJsonSchema`.
 *
 * Deliberately only the STRUCTURAL ones: what fields exist, their types, which
 * are required, and what they mean. Zod emits valid Draft 2020-12 including
 * `$schema`, `exclusiveMinimum` and `propertyNames`, none of which the API
 * accepts — and in practice it also rejects otherwise-documented bound
 * keywords (`minimum`, `minItems`) in some combinations, with nothing more
 * specific than "Request contains an invalid argument".
 *
 * Dropping bounds costs nothing real. They were only ever hints to the model:
 * the reply is parsed through the same Zod schema afterwards, where the bounds
 * ARE enforced, and the prompt states the important ones in words. Structure is
 * what a response schema is genuinely good at; sanity is our job either way.
 *
 * Converting from Zod rather than hand-writing a second schema is the point —
 * two copies would drift the moment either changed.
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
 * Converts a Zod schema into the JSON Schema Gemini accepts.
 *
 * The single source of truth stays the Zod schema: it constrains the model AND
 * validates the reply. A response schema shapes the output but does not
 * guarantee sanity, so the reply is parsed through Zod regardless.
 *
 * @param {import('zod').ZodType} schema
 * @param {{ io?: 'input' | 'output' }} [options]
 *   `output` (default) for a response schema: every field with a default is
 *   REQUIRED, because we want the model to fill all of them in.
 *   `input` for tool parameters: a field with a default is OPTIONAL, because
 *   the model should not be forced to invent a timestamp or an empty micros
 *   object on every call — the schema supplies those itself.
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
