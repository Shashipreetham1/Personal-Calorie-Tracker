/**
 * System instructions for image extraction.
 *
 * Two genuinely different jobs behind one endpoint. Reading a nutrition panel
 * is transcription — the numbers are printed, and inventing any of them is a
 * bug. Looking at a plate of food is estimation — nothing is printed, and
 * pretending otherwise would be worse. The prompts say so explicitly, and the
 * `is_estimate` / `confidence` fields let the UI warn on one and stay quiet on
 * the other.
 */

const SHARED_RULES = `
Return every number for the stated quantity, not per 100g, unless the quantity
IS 100g. Use kcal for calories and grams for macronutrients. If a value is not
available, use 0 rather than guessing wildly, and say so in "notes".
Never invent micronutrients that are not visible or not typical of the food.
`;

/** Reading a packaged product's nutrition panel. */
export const LABEL_PROMPT = `
You are reading a packaged food product's nutrition label.

Transcribe the printed values. Do NOT estimate: every number you return must be
legible on the label. Report values PER SERVING, using the serving size printed
on the label as the unit (for example quantity 1, unit "serving (30g)"). If the
label shows only per-100g values, report those and set the unit to "100 g".

Set is_estimate to false and source_type to "label". Set confidence based on how
legible the panel is, not on how sure you are that the food is healthy. If part
of the panel is cut off or blurred, return what you can read and name the
missing parts in "notes".
${SHARED_RULES}`.trim();

/** Estimating a prepared meal from a photo. */
export const PLATE_PROMPT = `
You are looking at a photograph of prepared food.

Identify each distinct food item and estimate its portion size from visual cues
(plate size, utensils, common serving sizes). These ARE estimates: set
is_estimate to true and source_type to "plate", and set a realistic confidence
per item — a clearly visible single apple deserves high confidence, a mixed
curry of uncertain composition deserves low.

Prefer everyday units a person would recognise ("bowl", "piece", "plate",
"cup") over grams unless the amount is genuinely obvious. Do not list garnishes
or condiments that contribute negligible calories. Use "notes" to state the main
assumption you made about portion size.
${SHARED_RULES}`.trim();

/** No hint given: let the model decide which of the two jobs it is doing. */
export const AUTO_PROMPT = `
You are given a food photograph. First decide what it shows.

If it shows a packaged product's printed nutrition panel, treat it as a LABEL:
transcribe the printed per-serving values, set source_type to "label" and
is_estimate to false. Do not estimate anything.

If it shows prepared food, a meal, or ingredients, treat it as a PLATE:
identify each item, estimate portions from visual cues, set source_type to
"plate" and is_estimate to true, with a realistic confidence per item.

If the image contains no food at all, still return the required shape with a
single item named after what you see, calories 0, confidence 0, and an
explanation in "notes".
${SHARED_RULES}`.trim();

/**
 * Picks the instruction for an optional `type` hint.
 *
 * @param {'label' | 'plate' | undefined} type
 * @returns {string}
 */
export function promptForType(type) {
  if (type === 'label') return LABEL_PROMPT;
  if (type === 'plate') return PLATE_PROMPT;
  return AUTO_PROMPT;
}

/**
 * Reading a food diary exported as a PDF.
 *
 * The document is sent to the model as a document — no text extraction step
 * first. A text extractor flattens a table into a stream of words and loses the
 * column alignment that says which number is calories and which is protein.
 */
export const PDF_IMPORT_PROMPT = `
You are reading a food diary or nutrition history exported as a PDF, usually a
table with one row per food item.

Extract EVERY data row. Do not summarise, skip duplicates, or merge rows that
look similar — two identical breakfasts on different days are two rows.

Rules:
- Read dates from the document's own date column or section headings, and output
  them as ISO 8601. Where only a date is given, pick a time that matches the
  meal: breakfast 08:00, lunch 13:00, dinner 20:00, snacks 17:00.
- If a date is ambiguous (03/04/2026 could be March or April), choose the
  interpretation consistent with the surrounding rows and say so in "notes".
- Infer meal_type from a section heading or the time. If genuinely unmarked,
  use the time of day.
- Ignore header rows, page numbers, and total or subtotal rows — a "Daily total"
  line is not a food item.
- If a row's calories are missing but macros are present, leave calories 0 rather
  than computing them, and mention it in "notes".
- Set rows_detected to the number of data rows you could see in total, including
  any you could not parse. If it is higher than the number you returned, explain
  the difference in "notes".
`.trim();
