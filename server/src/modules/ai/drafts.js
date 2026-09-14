/**
 * The boundary where AI output becomes application data.
 *
 * Photo extraction and PDF import both return items in the model's vocabulary
 * (snake_case, micros as a list); everything downstream speaks the
 * application's shape. Translating here once keeps the two from drifting.
 *
 * Nothing here touches the database — drafts are proposals until confirmed.
 */

/**
 * Builds a micros key from the model's name and unit.
 *
 * "Vitamin C" + "mg" becomes `vitamin_c_mg`, matching the convention used by
 * seeded data, the entries schema, and the micro report — which sums by exact
 * key, so an inconsistent one silently creates a second bucket.
 *
 * @param {{ name: string, unit?: string }} micro
 * @returns {string}
 */
export function toMicroKey({ name, unit }) {
  const slug = (text) =>
    String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const base = slug(name);
  const suffix = slug(unit);

  if (!base) return '';
  // Avoid "sodium_mg_mg" when the model already includes the unit in the name.
  if (!suffix || base.endsWith(`_${suffix}`)) return base;

  return `${base}_${suffix}`;
}

/**
 * Converts the model's micro list into the object shape food_entries stores.
 *
 * Zero and negative amounts are dropped: `micros` values must be positive, and
 * a micronutrient the food does not contain is simply absent rather than zero.
 *
 * @param {{ name: string, amount: number, unit?: string }[]} [micros]
 * @returns {Record<string, number>}
 */
export function toMicrosObject(micros = []) {
  const result = {};

  for (const micro of micros) {
    const key = toMicroKey(micro);
    if (!key || !(micro.amount > 0)) continue;

    // Same key twice (e.g. "salt" and "sodium" both slugged to sodium_mg):
    // add them rather than letting the last one win.
    result[key] = (result[key] ?? 0) + micro.amount;
  }

  return result;
}

/**
 * Turns one extracted item into a draft entry in the application's shape.
 *
 * The result is deliberately close to postable: the client fills in whatever is
 * null (a photo cannot reveal the meal type) and posts it unchanged.
 *
 * @param {object} item  An item as the model returned it.
 * @param {{ source: 'photo' | 'import' }} options
 * @returns {object}
 */
export function toDraftEntry(item, { source }) {
  return {
    // Present for PDF rows (the diary has a date column), absent for photos.
    ...(item.consumed_at ? { consumedAt: item.consumed_at } : {}),
    ...(item.meal_type ? { mealType: item.meal_type } : {}),
    foodName: item.food_name,
    quantity: item.quantity,
    unit: item.unit || null,
    calories: item.calories,
    proteinG: item.protein_g,
    carbsG: item.carbs_g,
    fatG: item.fat_g,
    micros: toMicrosObject(item.micros),
    source,
    confidence: item.confidence,
  };
}
