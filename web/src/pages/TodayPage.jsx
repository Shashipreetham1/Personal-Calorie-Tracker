import { useCallback, useMemo, useState } from 'react';
import { listEntries, deleteEntry } from '../api/entries.js';
import { getCurrentGoal } from '../api/goals.js';
import { useAsync } from '../hooks/useAsync.js';
import { LoadingState, ErrorState } from '../components/States.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { EntryFormModal } from '../components/EntryFormModal.jsx';
import { Alert } from '../components/Alert.jsx';
import {
  MEALS,
  SOURCE_ICONS,
  formatCalories,
  formatGrams,
  formatQuantity,
  formatTime,
  toISODate,
} from '../lib/format.js';

/** Sums the nutrition of a set of entries. */
function totalsOf(entries) {
  return entries.reduce(
    (totals, entry) => ({
      calories: totals.calories + entry.calories,
      proteinG: totals.proteinG + entry.proteinG,
      carbsG: totals.carbsG + entry.carbsG,
      fatG: totals.fatG + entry.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/**
 * One meal's collapsible section.
 *
 * An empty meal still renders, with a faint "+ Add" row rather than nothing:
 * on day one every section is empty, and four blank spaces would read as a
 * broken screen instead of a new one.
 */
function MealSection({ meal, entries, onAdd, onDelete, deletingId }) {
  const [open, setOpen] = useState(true);
  const totals = totalsOf(entries);

  return (
    <section className="meal">
      <button
        type="button"
        className="meal-header"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="meal-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span className="meal-name">{meal.label}</span>
        <span className="meal-subtotal muted">
          {entries.length === 0
            ? 'Nothing yet'
            : `${formatCalories(totals.calories)} cal · ${entries.length} item${entries.length === 1 ? '' : 's'}`}
        </span>
      </button>

      {open && (
        <div className="meal-body">
          {entries.map((entry) => {
            const source = SOURCE_ICONS[entry.source] ?? SOURCE_ICONS.manual;

            return (
              <div className="entry-row" key={entry.id}>
                <span className="entry-source" title={source.label} aria-label={source.label}>
                  {source.icon}
                </span>
                <span className="entry-main">
                  <span className="entry-name">{entry.foodName}</span>
                  <span className="entry-meta muted">
                    {formatQuantity(entry.quantity, entry.unit)} · {formatTime(entry.consumedAt)}
                  </span>
                </span>
                <span className="entry-macros muted">
                  P{formatGrams(entry.proteinG)} C{formatGrams(entry.carbsG)} F{formatGrams(entry.fatG)}
                </span>
                <span className="entry-calories">{formatCalories(entry.calories)}</span>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => onDelete(entry)}
                  disabled={deletingId === entry.id}
                  aria-label={`Delete ${entry.foodName}`}
                >
                  {deletingId === entry.id ? '…' : '✕'}
                </button>
              </div>
            );
          })}

          <button type="button" className="entry-add-row" onClick={() => onAdd(meal.key)}>
            + Add to {meal.label.toLowerCase()}
          </button>
        </div>
      )}
    </section>
  );
}

export default function TodayPage() {
  const today = toISODate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMeal, setModalMeal] = useState('breakfast');
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // `useCallback` keeps the fetcher identity stable so useAsync does not loop.
  const fetchToday = useCallback(
    () => listEntries({ from: today, to: today, limit: 100 }),
    [today],
  );

  // A missing goal is an expected first-run state, not an error: resolve the
  // 404 to null so the screen can show progress without a target rather than
  // an error page.
  const fetchGoal = useCallback(
    () => getCurrentGoal().catch((error) => {
      if (error.status === 404) return null;
      throw error;
    }),
    [],
  );

  const entriesState = useAsync(fetchToday);
  const goalState = useAsync(fetchGoal);

  const entries = entriesState.data?.data ?? [];
  const goal = goalState.data;
  const totals = useMemo(() => totalsOf(entries), [entries]);

  const byMeal = useMemo(
    () =>
      Object.fromEntries(
        MEALS.map((meal) => [meal.key, entries.filter((entry) => entry.mealType === meal.key)]),
      ),
    [entries],
  );

  function openModal(mealType) {
    setModalMeal(mealType);
    setActionError(null);
    setModalOpen(true);
  }

  async function handleDelete(entry) {
    setActionError(null);
    setDeletingId(entry.id);

    try {
      await deleteEntry(entry.id);
      entriesState.reload();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (entriesState.loading || goalState.loading) {
    return (
      <section className="page">
        <h1 className="page-title">Today</h1>
        <div className="card">
          <LoadingState label="Loading today…" />
        </div>
      </section>
    );
  }

  if (entriesState.error) {
    return (
      <section className="page">
        <h1 className="page-title">Today</h1>
        <div className="card">
          <ErrorState error={entriesState.error} onRetry={entriesState.reload} />
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Today</h1>
        <button type="button" className="button button-primary fab" onClick={() => openModal('breakfast')}>
          + Add entry
        </button>
      </div>

      <div className="card summary-card">
        <ProgressBar
          label="Calories"
          value={totals.calories}
          target={goal?.dailyCalories ?? null}
          unit="kcal"
          size="large"
        />

        <div className="macro-grid">
          <ProgressBar label="Protein" value={totals.proteinG} target={goal?.proteinG ?? null} unit="g" />
          <ProgressBar label="Carbs" value={totals.carbsG} target={goal?.carbsG ?? null} unit="g" />
          <ProgressBar label="Fat" value={totals.fatG} target={goal?.fatG ?? null} unit="g" />
        </div>

        {!goal && (
          <Alert tone="info">
            No goal set yet — targets will appear here once you set one on the Goals screen.
          </Alert>
        )}
      </div>

      <Alert tone="error">{actionError}</Alert>

      <div className="meals">
        {MEALS.map((meal) => (
          <MealSection
            key={meal.key}
            meal={meal}
            entries={byMeal[meal.key]}
            onAdd={openModal}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        ))}
      </div>

      <EntryFormModal
        open={modalOpen}
        defaultMealType={modalMeal}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          entriesState.reload();
        }}
      />
    </section>
  );
}
