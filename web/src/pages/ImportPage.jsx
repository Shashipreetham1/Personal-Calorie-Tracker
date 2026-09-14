import { useState } from 'react';
import { importPdf, confirmImport } from '../api/imports.js';
import { FileDropzone } from '../components/FileDropzone.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { MEALS, datetimeLocal, formatCalories, formatGrams } from '../lib/format.js';

/**
 * Import a food diary from a PDF.
 *
 * Three steps, and the middle one is the point: parse, **review**, confirm.
 * The parse saves nothing — the rows land in an editable table, and only the
 * ones the user keeps are sent back to be written. A model reading a table of
 * forty rows will get some of them wrong, and the fix should be editing a cell
 * rather than discovering a bad number in your history weeks later.
 */

/** Turns a draft from the API into an editable row. */
function toRow(draft) {
  return {
    key: crypto.randomUUID(),
    include: true,
    consumedAt: datetimeLocal.from(new Date(draft.consumedAt)),
    mealType: draft.mealType ?? 'lunch',
    foodName: draft.foodName,
    quantity: String(draft.quantity),
    unit: draft.unit ?? '',
    calories: String(draft.calories),
    proteinG: String(draft.proteinG),
    carbsG: String(draft.carbsG),
    fatG: String(draft.fatG),
    micros: draft.micros ?? {},
  };
}

/** Turns an edited row back into the shape the confirm endpoint expects. */
function toEntry(row) {
  return {
    consumedAt: datetimeLocal.toISO(row.consumedAt),
    mealType: row.mealType,
    foodName: row.foodName,
    quantity: Number(row.quantity),
    unit: row.unit || undefined,
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    micros: row.micros,
  };
}

export default function ImportPage() {
  const [rows, setRows] = useState([]);
  const [parse, setParse] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const included = rows.filter((row) => row.include);

  function updateRow(key, field, value) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
    // A row the user has just corrected should not keep its old rejection.
    setResult((current) => (current ? { ...current, rejectedRows: [] } : current));
  }

  async function handleFile(file) {
    setParsing(true);
    setParseError(null);
    setResult(null);

    try {
      const parsed = await importPdf(file);

      setParse(parsed);
      setRows(parsed.drafts.map(toRow));
    } catch (error) {
      setParseError(error.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setParseError(null);

    try {
      // Only the rows still ticked are sent. The row's position in THIS array
      // is what the server's rejection indexes refer to.
      const sent = included;
      const outcome = await confirmImport(sent.map(toEntry));

      setResult({ ...outcome, sentKeys: sent.map((row) => row.key) });

      // Drop what landed and keep what did not, so a second attempt cannot
      // import the same row twice.
      const rejectedKeys = new Set(outcome.rejectedRows.map((bad) => sent[bad.index]?.key));
      setRows((current) => current.filter((row) => !row.include || rejectedKeys.has(row.key)));
    } catch (error) {
      setParseError(error.message);
    } finally {
      setImporting(false);
    }
  }

  function startOver() {
    setRows([]);
    setParse(null);
    setResult(null);
    setParseError(null);
  }

  /** The rejection for a row, if the last import refused it. */
  function rejectionFor(row) {
    if (!result?.sentKeys) return null;

    return result.rejectedRows.find((bad) => result.sentKeys[bad.index] === row.key) ?? null;
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Import</h1>
        {rows.length > 0 && (
          <button type="button" className="button button-secondary" onClick={startOver}>
            Start over
          </button>
        )}
      </div>

      {rows.length === 0 && (
        <div className="card">
          <p className="muted section-note">
            Upload a food diary exported as a PDF. The rows are read out of the document and shown
            here for you to check — nothing is saved until you confirm. A tabular diary with a
            date, meal, food and calories per row works best.
          </p>

          <FileDropzone
            accept={['application/pdf']}
            prompt="Drop a food diary PDF"
            hint="PDF, up to 5MB"
            buttonLabel="Choose a PDF"
            busyLabel="Reading the document…"
            typeError="Choose a PDF file."
            onSelect={handleFile}
            busy={parsing}
          />

          <Alert tone="error">{parseError}</Alert>

          {result && (
            <Alert tone="success">
              Imported {result.imported} {result.imported === 1 ? 'entry' : 'entries'}. They are on
              your History screen now.
            </Alert>
          )}

        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="card import-summary rise">
            <p>
              Found <strong>{parse?.rowsDetected ?? rows.length}</strong> rows in the document.
              {' '}
              <strong>{included.length}</strong> selected to import.
            </p>
            {parse?.notes && (
              <Alert tone="info">
                <strong>Note from the reader:</strong> {parse.notes}
              </Alert>
            )}
            {result && result.rejected > 0 && (
              <Alert tone="warning">
                Imported {result.imported}, but {result.rejected}{' '}
                {result.rejected === 1 ? 'row was' : 'rows were'} rejected and left below. Fix the
                highlighted fields and import again.
              </Alert>
            )}
            {result && result.rejected === 0 && result.imported > 0 && (
              <Alert tone="success">Imported {result.imported} entries.</Alert>
            )}
            <Alert tone="error">{parseError}</Alert>
          </div>

          <div className="card rise" style={{ '--delay': '80ms' }}>
            <div className="table-scroll">
              <table className="table import-table">
                <caption className="visually-hidden">Rows read from the PDF, editable</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Include</span>
                    </th>
                    <th scope="col">When</th>
                    <th scope="col">Meal</th>
                    <th scope="col">Food</th>
                    <th scope="col">Qty</th>
                    <th scope="col" className="numeric">Calories</th>
                    <th scope="col" className="numeric">P / C / F</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const rejection = rejectionFor(row);
                    const badFields = new Set(rejection?.errors.map((error) => error.field) ?? []);

                    return (
                      <tr key={row.key} className={rejection ? 'row-rejected' : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.include}
                            aria-label={`Import ${row.foodName}`}
                            onChange={(event) => updateRow(row.key, 'include', event.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            type="datetime-local"
                            className={badFields.has('consumedAt') ? 'input input-invalid' : 'input'}
                            value={row.consumedAt}
                            aria-label="When"
                            onChange={(event) => updateRow(row.key, 'consumedAt', event.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className={badFields.has('mealType') ? 'input input-invalid' : 'input'}
                            value={row.mealType}
                            aria-label="Meal"
                            onChange={(event) => updateRow(row.key, 'mealType', event.target.value)}
                          >
                            {MEALS.map((meal) => (
                              <option key={meal.key} value={meal.key}>
                                {meal.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className={badFields.has('foodName') ? 'input input-invalid' : 'input'}
                            value={row.foodName}
                            aria-label="Food"
                            onChange={(event) => updateRow(row.key, 'foodName', event.target.value)}
                          />
                        </td>
                        <td className="muted import-qty">
                          {formatGrams(row.quantity)} {row.unit}
                        </td>
                        <td className="numeric">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className={
                              badFields.has('calories') ? 'input input-invalid numeric' : 'input numeric'
                            }
                            value={row.calories}
                            aria-label="Calories"
                            onChange={(event) => updateRow(row.key, 'calories', event.target.value)}
                          />
                        </td>
                        <td className="numeric muted">
                          {formatGrams(row.proteinG)} / {formatGrams(row.carbsG)} /{' '}
                          {formatGrams(row.fatG)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {result?.rejectedRows?.length > 0 && (
              <ul className="rejection-list">
                {result.rejectedRows.map((bad) => (
                  <li key={bad.index}>
                    <strong>{bad.foodName || `Row ${bad.index + 1}`}:</strong>{' '}
                    {bad.errors.map((error) => `${error.field} — ${error.message}`).join('; ')}
                  </li>
                ))}
              </ul>
            )}

            <div className="import-actions">
              <span className="import-total">
                <span className="figure">
                  {formatCalories(
                    included.reduce((sum, row) => sum + (Number(row.calories) || 0), 0),
                  )}
                </span>{' '}
                kcal
                <span className="import-total-label">
                  {' '}
                  across {included.length} {included.length === 1 ? 'entry' : 'entries'}
                </span>
              </span>
              <Button
                onClick={handleImport}
                loading={importing}
                loadingLabel="Importing…"
                disabled={included.length === 0}
              >
                Import {included.length} {included.length === 1 ? 'entry' : 'entries'}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
