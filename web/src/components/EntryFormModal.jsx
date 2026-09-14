import { useState } from 'react';
import { z } from 'zod';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Alert } from './Alert.jsx';
import { FormField } from './FormField.jsx';
import { FileDropzone } from './FileDropzone.jsx';
import { CameraIcon } from './icons.jsx';
import { createEntry } from '../api/entries.js';
import { extractFromImage } from '../api/extract.js';
import { MEALS, datetimeLocal } from '../lib/format.js';

/**
 * Add Entry — one component, two paths.
 *
 * Typing and snapping are the same flow: both end up as a list of editable
 * items that the user checks and saves. A photo simply fills that list in
 * advance instead of leaving one blank row. That is why there is no separate
 * "review extraction" screen — the review IS the form, so every extracted value
 * is editable in place and nothing is saved until the user presses Save.
 *
 * Meal and time are shared by all items: a photo of a plate is one meal.
 */

/** Mirrors the server's rules so a field that looks fine here is not rejected there. */
const itemSchema = z.object({
  foodName: z.string().trim().min(1, 'Required').max(200),
  quantity: z.coerce.number().positive('Must be more than 0'),
  unit: z.string().trim().max(50).optional(),
  calories: z.coerce.number().nonnegative('Cannot be negative'),
  proteinG: z.coerce.number().nonnegative('Cannot be negative'),
  carbsG: z.coerce.number().nonnegative('Cannot be negative'),
  fatG: z.coerce.number().nonnegative('Cannot be negative'),
});

/** A blank row, for the typing path. */
function blankItem() {
  return {
    key: crypto.randomUUID(),
    foodName: '',
    quantity: '1',
    unit: '',
    calories: '',
    proteinG: '0',
    carbsG: '0',
    fatG: '0',
    micros: {},
    source: 'manual',
    confidence: null,
  };
}

/**
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void,
 *   defaultMealType?: string }} props
 */
export function EntryFormModal({ open, onClose, onSaved, defaultMealType = 'breakfast' }) {
  const [mealType, setMealType] = useState(defaultMealType);
  const [consumedAt, setConsumedAt] = useState(() => datetimeLocal.from(new Date()));
  const [items, setItems] = useState(() => [blankItem()]);
  const [extraction, setExtraction] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setItems([blankItem()]);
    setExtraction(null);
    setErrors({});
    setFormError(null);
    setConsumedAt(datetimeLocal.from(new Date()));
  }

  function handleClose() {
    reset();
    onClose();
  }

  function updateItem(key, field, value) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
    setErrors((current) => ({ ...current, [`${key}.${field}`]: undefined }));
  }

  async function handlePhoto(file) {
    setExtracting(true);
    setFormError(null);

    try {
      const result = await extractFromImage(file);

      setExtraction(result);
      setItems(
        result.drafts.map((draft) => ({
          key: crypto.randomUUID(),
          foodName: draft.foodName,
          quantity: String(draft.quantity),
          unit: draft.unit ?? '',
          calories: String(draft.calories),
          proteinG: String(draft.proteinG),
          carbsG: String(draft.carbsG),
          fatG: String(draft.fatG),
          micros: draft.micros ?? {},
          source: 'photo',
          confidence: draft.confidence,
        })),
      );
    } catch (error) {
      // Extraction failing must not cost the user their typing — the form stays
      // exactly as it was and they can carry on by hand.
      setFormError(error.message);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = {};
    const payloads = [];

    items.forEach((item) => {
      const result = itemSchema.safeParse(item);

      if (!result.success) {
        result.error.issues.forEach((issue) => {
          nextErrors[`${item.key}.${issue.path[0]}`] = issue.message;
        });
        return;
      }

      payloads.push({
        ...result.data,
        unit: result.data.unit || undefined,
        micros: item.micros,
        mealType,
        consumedAt: datetimeLocal.toISO(consumedAt),
        source: item.source,
      });
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      // Sequential rather than parallel: if the third of five fails, the first
      // two are already saved and the message can say exactly which one broke.
      for (const payload of payloads) {
        await createEntry(payload);
      }
      reset();
      onSaved();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const multiple = items.length > 1;

  return (
    <Modal
      open={open}
      title="Add entry"
      onClose={handleClose}
      wide={multiple}
      footer={
        <div className="modal-actions">
          <Button variant="secondary" onClick={handleClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="entry-form"
            loading={saving}
            loadingLabel="Saving…"
          >
            {multiple ? `Save ${items.length} entries` : 'Save entry'}
          </Button>
        </div>
      }
    >
      <form id="entry-form" onSubmit={handleSubmit} noValidate>
        <FileDropzone
          Icon={CameraIcon}
          accept={['image/jpeg', 'image/png', 'image/webp']}
          prompt="Drop a photo of a nutrition label or a plate of food"
          hint="JPEG, PNG or WebP, up to 5MB"
          buttonLabel="Choose a photo"
          busyLabel="Reading the photo…"
          typeError="Choose a JPEG, PNG or WebP image."
          onSelect={handlePhoto}
          busy={extracting}
          disabled={saving}
        />

        {extraction && (
          <Alert tone={extraction.isEstimate ? 'warning' : 'info'}>
            {extraction.isEstimate
              ? `Estimated from the photo (${Math.round(extraction.confidence * 100)}% confident) — please check every value before saving.`
              : 'Read from the nutrition label — please verify before saving.'}
            {extraction.notes ? ` ${extraction.notes}` : ''}
          </Alert>
        )}

        <div className="field">
          <span className="field-label">Meal</span>
          <div className="segmented" role="group" aria-label="Meal">
            {MEALS.map((meal) => (
              <button
                key={meal.key}
                type="button"
                className={mealType === meal.key ? 'segment segment-active' : 'segment'}
                aria-pressed={mealType === meal.key}
                onClick={() => setMealType(meal.key)}
              >
                {meal.label}
              </button>
            ))}
          </div>
        </div>

        <FormField
          id="consumedAt"
          label="When"
          type="datetime-local"
          value={consumedAt}
          max={datetimeLocal.from(new Date())}
          onChange={(event) => setConsumedAt(event.target.value)}
        />

        {items.map((item, index) => (
          <fieldset className="item-fieldset" key={item.key}>
            <legend className="item-legend">
              {multiple ? `Item ${index + 1}` : 'Item'}
              {item.confidence !== null && item.confidence !== undefined && (
                <span className="muted"> · {Math.round(item.confidence * 100)}% confident</span>
              )}
              {multiple && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                >
                  Remove
                </button>
              )}
            </legend>

            <FormField
              id={`${item.key}-foodName`}
              label="Food"
              value={item.foodName}
              onChange={(event) => updateItem(item.key, 'foodName', event.target.value)}
              error={errors[`${item.key}.foodName`]}
              placeholder="e.g. Dal tadka with rice"
            />

            <div className="form-row">
              <FormField
                id={`${item.key}-quantity`}
                label="Quantity"
                type="number"
                step="any"
                min="0"
                value={item.quantity}
                onChange={(event) => updateItem(item.key, 'quantity', event.target.value)}
                error={errors[`${item.key}.quantity`]}
              />
              <FormField
                id={`${item.key}-unit`}
                label="Unit"
                value={item.unit}
                onChange={(event) => updateItem(item.key, 'unit', event.target.value)}
                placeholder="bowl, g, piece"
              />
              <FormField
                id={`${item.key}-calories`}
                label="Calories"
                type="number"
                step="any"
                min="0"
                value={item.calories}
                onChange={(event) => updateItem(item.key, 'calories', event.target.value)}
                error={errors[`${item.key}.calories`]}
              />
            </div>

            <div className="form-row">
              <FormField
                id={`${item.key}-proteinG`}
                label="Protein (g)"
                type="number"
                step="any"
                min="0"
                value={item.proteinG}
                onChange={(event) => updateItem(item.key, 'proteinG', event.target.value)}
                error={errors[`${item.key}.proteinG`]}
              />
              <FormField
                id={`${item.key}-carbsG`}
                label="Carbs (g)"
                type="number"
                step="any"
                min="0"
                value={item.carbsG}
                onChange={(event) => updateItem(item.key, 'carbsG', event.target.value)}
                error={errors[`${item.key}.carbsG`]}
              />
              <FormField
                id={`${item.key}-fatG`}
                label="Fat (g)"
                type="number"
                step="any"
                min="0"
                value={item.fatG}
                onChange={(event) => updateItem(item.key, 'fatG', event.target.value)}
                error={errors[`${item.key}.fatG`]}
              />
            </div>

            {Object.keys(item.micros ?? {}).length > 0 && (
              <p className="muted micros-line">
                Micros: {Object.entries(item.micros).map(([key, value]) => `${key.replace(/_/g, ' ')} ${value}`).join(', ')}
              </p>
            )}
          </fieldset>
        ))}

        <button
          type="button"
          className="button button-secondary add-item-button"
          onClick={() => setItems((current) => [...current, blankItem()])}
        >
          + Add another item
        </button>

        <Alert tone="error">{formError}</Alert>
      </form>
    </Modal>
  );
}
