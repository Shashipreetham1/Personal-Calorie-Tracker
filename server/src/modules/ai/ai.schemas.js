import { z } from 'zod';
import { MEAL_TYPES } from '../../config/constants.js';
import { createEntrySchema } from '../entries/entries.schema.js';

/**
 * Schemas for what the model is asked to return.
 *
 * Field names are snake_case here, unlike the rest of the API: this is the
 * model's vocabulary, and matching the phrasing used in the prompt ("food_name",
 * "protein_g") measurably reduces confusion in the reply. The conversion to the
 * application's camelCase draft shape happens in extraction.service.js, which
 * is the boundary where AI data becomes application data.
 *
 * Every constraint here is enforced twice: once as a hint to the model via the
 * derived response schema, and once when the reply is parsed. The second is the
 * one that counts.
 */

/**
 * One micronutrient as the model reports it.
 *
 * Deliberately a list of {name, amount, unit} rather than a free-form object.
 * A map with arbitrary keys is awkward to express in the response schema, and
 * asking for the unit separately is what lets the key be assembled correctly —
 * "iron" + "mg" becomes `iron_mg`, matching the convention the rest of the app
 * and the micro report already use.
 */
const extractedMicroSchema = z.object({
  name: z.string().trim().min(1).max(40).describe('Micronutrient name, e.g. "iron", "vitamin c", "sodium"'),
  amount: z.number().nonnegative().describe('Amount per the stated quantity'),
  unit: z.string().trim().max(10).describe('Unit of the amount, e.g. "mg", "ug", "g"'),
});

/** One food item the model identified. */
const extractedItemSchema = z.object({
  food_name: z.string().trim().min(1).max(200).describe('Name of the food or product'),
  quantity: z.number().positive().max(100_000).describe('Number of units consumed'),
  unit: z.string().trim().max(50).describe('Unit for the quantity, e.g. "serving", "bowl", "g", "piece"'),
  calories: z.number().nonnegative().max(100_000).describe('Energy in kcal for the stated quantity'),
  protein_g: z.number().nonnegative().max(100_000).describe('Protein in grams'),
  carbs_g: z.number().nonnegative().max(100_000).describe('Carbohydrate in grams'),
  fat_g: z.number().nonnegative().max(100_000).describe('Fat in grams'),
  micros: z.array(extractedMicroSchema).max(50).describe('Micronutrients, empty if none are legible'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('How confident you are in THIS item, 0 to 1'),
});

/** The full reply to an image extraction request. */
export const imageExtractionSchema = z.object({
  source_type: z
    .enum(['label', 'plate'])
    .describe('"label" for a packaged nutrition panel, "plate" for prepared food'),
  is_estimate: z
    .boolean()
    .describe('false only when values were read from a printed nutrition panel'),
  confidence: z.number().min(0).max(1).describe('Overall confidence in this extraction, 0 to 1'),
  items: z.array(extractedItemSchema).min(1).max(20).describe('Every food item identified'),
  notes: z
    .string()
    .trim()
    .max(500)
    .describe('Short caveat for the user, e.g. what was unreadable or assumed. Empty string if none.'),
});

/** Optional `?type=` hint on the extraction endpoint. */
export const extractImageQuerySchema = z.object({
  // Omitted means "you decide" — the model reports which path it took in
  // `source_type`, so the UI still knows whether to warn about estimates.
  type: z.enum(['label', 'plate']).optional(),
});

/** @typedef {z.infer<typeof imageExtractionSchema>} ImageExtraction */

/**
 * One row parsed out of a food diary PDF.
 *
 * Unlike a photo, a diary states WHEN each item was eaten, so the date and meal
 * are part of the extraction rather than something the user supplies afterwards.
 */
const importedRowSchema = z.object({
  consumed_at: z
    .string()
    .trim()
    .min(1)
    .describe('When it was eaten, ISO 8601, e.g. 2026-09-04T13:00:00Z. Use the date column.'),
  meal_type: z
    .enum(MEAL_TYPES)
    .describe('Which meal. Infer from the section heading or the time if not stated.'),
  food_name: z.string().trim().min(1).max(200).describe('Name of the food'),
  quantity: z.number().positive().max(100_000).describe('Number of units'),
  unit: z.string().trim().max(50).describe('Unit for the quantity, e.g. "bowl", "g", "piece"'),
  calories: z.number().nonnegative().max(100_000).describe('Energy in kcal'),
  protein_g: z.number().nonnegative().max(100_000).describe('Protein in grams'),
  carbs_g: z.number().nonnegative().max(100_000).describe('Carbohydrate in grams'),
  fat_g: z.number().nonnegative().max(100_000).describe('Fat in grams'),
  micros: z.array(extractedMicroSchema).max(50).describe('Micronutrients if the table lists any'),
});

/** The full reply to a PDF import request. */
export const pdfImportSchema = z.object({
  entries: z.array(importedRowSchema).max(200).describe('Every data row in the document'),
  rows_detected: z
    .number()
    .int()
    .nonnegative()
    .describe('How many data rows you could see in total, including any you could not parse'),
  notes: z
    .string()
    .trim()
    .max(1000)
    .describe('Anything ambiguous: unclear dates, unreadable rows, assumed units. Empty string if none.'),
});

/**
 * Envelope of `POST /api/import/confirm` — deliberately only the envelope.
 *
 * The rows are NOT validated here. Route-level validation is all-or-nothing, so
 * one bad row out of forty would 400 the entire request and the user would lose
 * the thirty-nine good ones after reviewing them. Each row is instead parsed
 * individually in the service, which imports what is valid and reports what is
 * not, with reasons.
 */
export const confirmImportSchema = z.object({
  entries: z
    .array(z.object({}).loose())
    .min(1, 'Send at least one entry to import')
    .max(200, 'Import at most 200 entries at a time'),
});

/**
 * One row of a confirmed import.
 *
 * `source` is omitted and set to 'import' by the server, so a client cannot
 * mislabel where a row came from. Unknown keys (such as the `confidence` the
 * draft carried for the UI) are stripped rather than stored.
 */
export const importRowSchema = createEntrySchema.omit({ source: true });

/** @typedef {z.infer<typeof pdfImportSchema>} PdfImport */

