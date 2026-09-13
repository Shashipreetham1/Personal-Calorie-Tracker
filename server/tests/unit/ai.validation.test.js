import { describe, it, expect } from 'vitest';
import { imageExtractionSchema, pdfImportSchema } from '../../src/modules/ai/ai.schemas.js';
import { toGeminiJsonSchema } from '../../src/modules/ai/jsonSchema.js';
import { createEntrySchema } from '../../src/modules/entries/entries.schema.js';
import { toMicroKey, toMicrosObject, toDraftEntry } from '../../src/modules/ai/drafts.js';

/** A reply that should pass, so the failure cases below stay honest. */
function validExtraction(overrides = {}) {
  return {
    source_type: 'label',
    is_estimate: false,
    confidence: 0.9,
    notes: '',
    items: [
      {
        food_name: 'Granola bar',
        quantity: 1,
        unit: 'serving',
        calories: 150,
        protein_g: 5,
        carbs_g: 22,
        fat_g: 4.5,
        micros: [{ name: 'iron', amount: 2.7, unit: 'mg' }],
        confidence: 0.9,
      },
    ],
    ...overrides,
  };
}

/**
 * A response schema constrains structure, not sanity. The model can return -40
 * calories inside a perfectly shaped object, so every reply is parsed through
 * Zod regardless. These are the payloads that must not get through.
 */
describe('imageExtractionSchema', () => {
  it('accepts a well-formed extraction', () => {
    expect(imageExtractionSchema.safeParse(validExtraction()).success).toBe(true);
  });

  it('rejects negative calories', () => {
    const payload = validExtraction();
    payload.items[0].calories = -40;

    const result = imageExtractionSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('calories');
  });

  it('rejects a zero quantity', () => {
    const payload = validExtraction();
    payload.items[0].quantity = 0;

    expect(imageExtractionSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects an empty item list, which is a failed extraction not a result', () => {
    expect(imageExtractionSchema.safeParse(validExtraction({ items: [] })).success).toBe(false);
  });

  it('rejects a confidence outside 0 to 1', () => {
    expect(imageExtractionSchema.safeParse(validExtraction({ confidence: 1.4 })).success).toBe(false);
    expect(imageExtractionSchema.safeParse(validExtraction({ confidence: -0.2 })).success).toBe(false);
  });

  it('rejects a source_type the application does not know', () => {
    expect(imageExtractionSchema.safeParse(validExtraction({ source_type: 'barcode' })).success).toBe(
      false,
    );
  });

  it('rejects a blank food name', () => {
    const payload = validExtraction();
    payload.items[0].food_name = '   ';

    expect(imageExtractionSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a numeric field returned as prose', () => {
    const payload = validExtraction();
    payload.items[0].calories = 'about 150';

    expect(imageExtractionSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const payload = validExtraction();
    delete payload.items[0].protein_g;

    expect(imageExtractionSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a reply that is not an object at all', () => {
    expect(imageExtractionSchema.safeParse('sorry, I cannot read this image').success).toBe(false);
    expect(imageExtractionSchema.safeParse(null).success).toBe(false);
  });
});

describe('pdfImportSchema', () => {
  it('rejects a row whose meal type is not one of the four', () => {
    const payload = {
      rows_detected: 1,
      notes: '',
      entries: [
        {
          consumed_at: '2026-09-08T13:00:00Z',
          meal_type: 'brunch',
          food_name: 'Rajma chawal',
          quantity: 1,
          unit: 'plate',
          calories: 560,
          protein_g: 20,
          carbs_g: 88,
          fat_g: 11,
          micros: [],
        },
      ],
    };

    expect(pdfImportSchema.safeParse(payload).success).toBe(false);
  });
});

describe('toGeminiJsonSchema', () => {
  it('emits only keywords the API accepts', () => {
    const json = JSON.stringify(toGeminiJsonSchema(imageExtractionSchema));

    for (const unsupported of [
      '$schema',
      'exclusiveMinimum',
      'propertyNames',
      'additionalProperties',
      'pattern',
    ]) {
      expect(json).not.toContain(`"${unsupported}"`);
    }
  });

  it('keeps the structure and descriptions the model needs', () => {
    const schema = toGeminiJsonSchema(imageExtractionSchema);

    expect(schema.type).toBe('object');
    expect(schema.required).toContain('items');
    expect(schema.properties.source_type.enum).toEqual(['label', 'plate']);
    expect(schema.properties.items.items.properties.food_name.description).toBeTruthy();
  });

  it('renders a date as a string, because the model only speaks JSON', () => {
    // A Zod date has no JSON Schema form. Left unhandled this throws, and no
    // chat tool declaration can be built at all.
    const schema = toGeminiJsonSchema(createEntrySchema, { io: 'input' });

    expect(schema.properties.consumedAt.type).toBe('string');
  });

  it('treats defaulted fields as optional for tool parameters', () => {
    const schema = toGeminiJsonSchema(createEntrySchema, { io: 'input' });

    // The model should not be forced to invent a timestamp or an empty micros
    // object on every call — the schema supplies those itself.
    expect(schema.required).toContain('foodName');
    expect(schema.required).not.toContain('consumedAt');
    expect(schema.required).not.toContain('micros');
  });

  it('requires every field for a response schema, where we want them all filled', () => {
    const schema = toGeminiJsonSchema(createEntrySchema);

    expect(schema.required).toContain('consumedAt');
  });
});

describe('micronutrient key building', () => {
  it('joins the name and unit the way the rest of the app stores them', () => {
    expect(toMicroKey({ name: 'Vitamin C', unit: 'mg' })).toBe('vitamin_c_mg');
    expect(toMicroKey({ name: 'iron', unit: 'mg' })).toBe('iron_mg');
  });

  it('does not repeat a unit the model already put in the name', () => {
    expect(toMicroKey({ name: 'sodium_mg', unit: 'mg' })).toBe('sodium_mg');
  });

  it('drops amounts that are not positive', () => {
    const micros = toMicrosObject([
      { name: 'iron', amount: 2.7, unit: 'mg' },
      { name: 'sodium', amount: 0, unit: 'mg' },
      { name: 'calcium', amount: -5, unit: 'mg' },
    ]);

    expect(micros).toEqual({ iron_mg: 2.7 });
  });

  it('adds duplicate keys rather than letting the last one win', () => {
    const micros = toMicrosObject([
      { name: 'sodium', amount: 100, unit: 'mg' },
      { name: 'Sodium', amount: 80, unit: 'mg' },
    ]);

    expect(micros).toEqual({ sodium_mg: 180 });
  });

  it('turns an extracted item into a draft the entries endpoint would accept', () => {
    const draft = toDraftEntry(
      {
        food_name: 'Poha',
        quantity: 1,
        unit: 'bowl',
        calories: 270,
        protein_g: 7,
        carbs_g: 48,
        fat_g: 6,
        micros: [{ name: 'iron', amount: 2.4, unit: 'mg' }],
        confidence: 0.8,
      },
      { source: 'photo' },
    );

    expect(draft).toMatchObject({
      foodName: 'Poha',
      calories: 270,
      micros: { iron_mg: 2.4 },
      source: 'photo',
    });

    // Whatever the draft carries must survive the real entry schema.
    expect(createEntrySchema.safeParse({ ...draft, mealType: 'breakfast' }).success).toBe(true);
  });
});
