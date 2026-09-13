import { useCallback, useState } from 'react';
import { listEntries } from '../api/entries.js';
import { useAsync } from '../hooks/useAsync.js';
import { LoadingState, EmptyState, ErrorState } from '../components/States.jsx';
import {
  MEALS,
  SOURCE_ICONS,
  formatCalories,
  formatGrams,
  formatQuantity,
  formatDate,
  formatTime,
  toISODate,
} from '../lib/format.js';

const PAGE_SIZE = 20;

/** Default range: the last 30 days, which is enough to be interesting without being slow. */
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  return { from: toISODate(from), to: toISODate(to) };
}

export default function HistoryPage() {
  const [filters, setFilters] = useState(() => ({ ...defaultRange(), mealType: '' }));
  const [page, setPage] = useState(1);

  const fetchEntries = useCallback(
    () =>
      listEntries({
        from: filters.from,
        to: filters.to,
        mealType: filters.mealType || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [filters.from, filters.to, filters.mealType, page],
  );

  const { data, error, loading, reload } = useAsync(fetchEntries);

  /** Changing a filter must reset to page 1 — page 4 of the old result is meaningless. */
  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  const entries = data?.data ?? [];
  const pagination = data?.pagination;
  const rangeInvalid = filters.from && filters.to && filters.from > filters.to;

  return (
    <section className="page">
      <h1 className="page-title">History</h1>

      <div className="card filters">
        <div className="field filter-field">
          <label className="field-label" htmlFor="from">
            From
          </label>
          <input
            id="from"
            className="input"
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </div>

        <div className="field filter-field">
          <label className="field-label" htmlFor="to">
            To
          </label>
          <input
            id="to"
            className="input"
            type="date"
            value={filters.to}
            min={filters.from}
            max={toISODate()}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </div>

        <div className="field filter-field">
          <label className="field-label" htmlFor="mealType">
            Meal
          </label>
          <select
            id="mealType"
            className="input"
            value={filters.mealType}
            onChange={(event) => updateFilter('mealType', event.target.value)}
          >
            <option value="">All meals</option>
            {MEALS.map((meal) => (
              <option key={meal.key} value={meal.key}>
                {meal.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field filter-field filter-reset">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setFilters({ ...defaultRange(), mealType: '' });
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {rangeInvalid && (
        <div className="card">
          <EmptyState
            title="That range runs backwards"
            description="The start date is after the end date."
          />
        </div>
      )}

      {!rangeInvalid && (
        <div className="card">
          {loading && <LoadingState label="Loading entries…" />}

          {!loading && error && <ErrorState error={error} onRetry={reload} />}

          {!loading && !error && entries.length === 0 && (
            <EmptyState
              title="No entries in this range"
              description={
                filters.mealType
                  ? 'Try a wider date range, or clear the meal filter.'
                  : 'Try a wider date range, or log something on the Today screen.'
              }
            />
          )}

          {!loading && !error && entries.length > 0 && (
            <>
              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">
                    Food entries from {filters.from} to {filters.to}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Meal</th>
                      <th scope="col">Food</th>
                      <th scope="col">Quantity</th>
                      <th scope="col" className="numeric">
                        Calories
                      </th>
                      <th scope="col" className="numeric">
                        P / C / F
                      </th>
                      <th scope="col">
                        <span className="visually-hidden">Source</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const source = SOURCE_ICONS[entry.source] ?? SOURCE_ICONS.manual;

                      return (
                        <tr key={entry.id}>
                          <td>
                            <span className="cell-strong">{formatDate(entry.consumedAt)}</span>
                            <span className="muted cell-sub">{formatTime(entry.consumedAt)}</span>
                          </td>
                          <td className="capitalise">{entry.mealType}</td>
                          <td>{entry.foodName}</td>
                          <td className="muted">{formatQuantity(entry.quantity, entry.unit)}</td>
                          <td className="numeric cell-strong">{formatCalories(entry.calories)}</td>
                          <td className="numeric muted">
                            {formatGrams(entry.proteinG)} / {formatGrams(entry.carbsG)} /{' '}
                            {formatGrams(entry.fatG)}
                          </td>
                          <td className="source-cell" title={source.label} aria-label={source.label}>
                            {source.icon}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <span className="muted">
                  {pagination.total} entr{pagination.total === 1 ? 'y' : 'ies'} · page{' '}
                  {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.limit))}
                </span>

                <div className="pager-buttons">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!pagination.hasNext}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
