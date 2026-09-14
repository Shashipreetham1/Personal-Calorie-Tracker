import { useCallback, useMemo, useState } from 'react';
import { listEntries, deleteEntry } from '../api/entries.js';
import { getCurrentGoal } from '../api/goals.js';
import { getCalorieTrend } from '../api/reports.js';
import { useAsync } from '../hooks/useAsync.js';
import { ErrorState } from '../components/States.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { EntryFormModal } from '../components/EntryFormModal.jsx';
import { Alert } from '../components/Alert.jsx';
import { ChevronIcon, PlusIcon, TrashIcon } from '../components/icons.jsx';
import { SourceTag } from '../components/SourceTag.jsx';
import {
  MEALS,
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

/** A dry one-liner per meal, so an empty section reads as new rather than broken. */
const EMPTY_PROMPTS = {
  breakfast: 'Nothing logged this morning.',
  lunch: 'Lunch is still unwritten.',
  dinner: 'Dinner not logged yet.',
  snacks: 'No snacks on the record.',
};

/** One meal's collapsible section. */
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
        <span className={open ? 'meal-chevron' : 'meal-chevron meal-chevron-closed'}>
          <ChevronIcon size={16} />
        </span>
        <span className="meal-name">{meal.label}</span>
        <span className="meal-subtotal">
          {entries.length === 0
            ? '—'
            : `${formatCalories(totals.calories)} cal · ${entries.length} item${entries.length === 1 ? '' : 's'}`}
        </span>
      </button>

      {open && (
        <div className="meal-body">
          {entries.length === 0 && (
            <p className="muted" style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
              {EMPTY_PROMPTS[meal.key]}
            </p>
          )}

          {entries.map((entry) => (
            <div className="entry-row" key={entry.id}>
              <SourceTag source={entry.source} iconOnly />

              <span className="entry-main">
                <span className="entry-name">{entry.foodName}</span>
                <span className="entry-meta">
                  {formatQuantity(entry.quantity, entry.unit)} · {formatTime(entry.consumedAt)}
                </span>
              </span>

              <span className="entry-macros">
                {formatGrams(entry.proteinG)}p · {formatGrams(entry.carbsG)}c ·{' '}
                {formatGrams(entry.fatG)}f
              </span>

              <span className="entry-calories figure">{formatCalories(entry.calories)}</span>

              <button
                type="button"
                className="button button-ghost"
                onClick={() => onDelete(entry)}
                disabled={deletingId === entry.id}
                aria-label={`Delete ${entry.foodName}`}
              >
                <TrashIcon />
              </button>
            </div>
          ))}

          <button type="button" className="entry-add-row" onClick={() => onAdd(meal.key)}>
            <PlusIcon size={14} />
            Add to {meal.label.toLowerCase()}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The last seven days as small bars.
 *
 * Reuses the calorie-trend report — no new endpoint — and fills what would
 * otherwise be dead space below the meals with the one bit of context the
 * Today screen cannot show on its own: whether today is typical.
 */
function LastSevenDays({ state }) {
  const days = state.data?.data ?? [];
  const peak = Math.max(1, ...days.map((day) => day.calories));
  const today = toISODate();

  if (state.loading && !state.data) {
    return (
      <div className="card sparkstrip rise" style={{ '--delay': '240ms' }}>
        <div className="skeleton skeleton-line" style={{ width: '30%' }} />
        <div className="skeleton" style={{ height: 72 }} />
      </div>
    );
  }

  if (state.error || days.length === 0) return null;

  return (
    <div className="card sparkstrip rise" style={{ '--delay': '240ms' }}>
      <div className="sparkstrip-head">
        <h2 className="section-title">Last 7 days</h2>
        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          peak {formatCalories(peak)} cal
        </span>
      </div>

      <div className="sparkstrip-bars">
        {days.map((day) => {
          const isToday = day.day === today;
          const height = Math.max(3, Math.round((day.calories / peak) * 62));
          const label = new Date(`${day.day}T00:00:00Z`).toLocaleDateString([], {
            weekday: 'narrow',
            timeZone: 'UTC',
          });

          return (
            <div className={isToday ? 'spark spark-today' : 'spark'} key={day.day}>
              <div
                className="spark-bar"
                style={{ height }}
                title={`${day.day}: ${formatCalories(day.calories)} cal`}
              />
              <span className="spark-label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A skeleton the shape of the finished page, so nothing jumps when data lands. */
function TodaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading today">
      <div className="card hero">
        <div className="skeleton skeleton-hero" />
        <div className="skeleton skeleton-line" style={{ width: '60%' }} />
      </div>
      <div className="meals" style={{ marginTop: 'var(--space-5)' }}>
        {MEALS.map((meal) => (
          <div className="skeleton skeleton-row" key={meal.key} style={{ height: 52 }} />
        ))}
      </div>
    </div>
  );
}

export default function TodayPage() {
  const today = toISODate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMeal, setModalMeal] = useState('breakfast');
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchToday = useCallback(
    () => listEntries({ from: today, to: today, limit: 100 }),
    [today],
  );

  // A missing goal is an expected first-run state, not an error.
  const fetchGoal = useCallback(
    () =>
      getCurrentGoal().catch((error) => {
        if (error.status === 404) return null;
        throw error;
      }),
    [],
  );

  const weekRange = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: toISODate(from), to: today };
  }, [today]);

  const fetchWeek = useCallback(() => getCalorieTrend(weekRange), [weekRange]);

  const entriesState = useAsync(fetchToday);
  const goalState = useAsync(fetchGoal);
  const weekState = useAsync(fetchWeek);

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
      weekState.reload();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  const loading = (entriesState.loading && !entriesState.data) || (goalState.loading && !goalState.data);

  if (entriesState.error) {
    return (
      <section className="page">
        <div className="page-head">
          <h1 className="page-title">Today</h1>
        </div>
        <div className="card">
          <ErrorState error={entriesState.error} onRetry={entriesState.reload} />
        </div>
      </section>
    );
  }

  const target = goal?.dailyCalories ?? null;
  const remaining = target === null ? null : Math.round(target - totals.calories);
  const percent = target ? Math.min(100, Math.round((totals.calories / target) * 100)) : 0;
  const over = target !== null && totals.calories > target;

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Today</h1>
        <button type="button" className="button button-primary" onClick={() => openModal('breakfast')}>
          <PlusIcon />
          Add entry
        </button>
      </div>

      {loading ? (
        <TodaySkeleton />
      ) : (
        <>
          <div className="card hero rise" style={{ '--delay': '0ms' }}>
            <div className="hero-top">
              <div>
                <span className="hero-remaining-label">Eaten today</span>
                <div className="hero-figure">
                  <span className="figure hero-value">{formatCalories(totals.calories)}</span>
                  {target !== null && (
                    <span className="hero-target">of {formatCalories(target)} kcal</span>
                  )}
                </div>
              </div>

              {/* What is left is the number people actually want. */}
              {remaining !== null && (
                <div className="hero-remaining">
                  <span className="figure hero-remaining-value">
                    {formatCalories(Math.abs(remaining))}
                  </span>
                  <span className="hero-remaining-label">
                    {remaining >= 0 ? 'left' : 'over'}
                  </span>
                </div>
              )}
            </div>

            <div className="hero-bar">
              <div
                className={over ? 'hero-bar-fill hero-bar-over' : 'hero-bar-fill'}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="macro-grid">
              <ProgressBar
                label="Protein"
                value={totals.proteinG}
                target={goal?.proteinG ?? null}
                unit="g"
                colour="var(--protein)"
                track="var(--protein-soft)"
              />
              <ProgressBar
                label="Carbs"
                value={totals.carbsG}
                target={goal?.carbsG ?? null}
                unit="g"
                colour="var(--carbs)"
                track="var(--carbs-soft)"
              />
              <ProgressBar
                label="Fat"
                value={totals.fatG}
                target={goal?.fatG ?? null}
                unit="g"
                colour="var(--fat)"
                track="var(--fat-soft)"
              />
            </div>

            {!goal && (
              <Alert tone="info">
                No goal set yet — targets appear here once you set one on the Goals screen.
              </Alert>
            )}
          </div>

          <Alert tone="warning">{actionError}</Alert>

          <div className="meals">
            {MEALS.map((meal, index) => (
              <div className="rise" style={{ '--delay': `${80 + index * 40}ms` }} key={meal.key}>
                <MealSection
                  meal={meal}
                  entries={byMeal[meal.key]}
                  onAdd={openModal}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              </div>
            ))}
          </div>

          <LastSevenDays state={weekState} />
        </>
      )}

      <EntryFormModal
        open={modalOpen}
        defaultMealType={modalMeal}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          entriesState.reload();
          weekState.reload();
        }}
      />
    </section>
  );
}
