import { useState } from 'react';
import { LoadingState, EmptyState, ErrorState } from './States.jsx';

/**
 * The frame every chart sits in: title, state handling, and a table view.
 *
 * The table is not decoration. Reading a value must never depend on hovering —
 * a tooltip is unavailable to keyboard and touch users and invisible in print —
 * and one of the series colours sits below 3:1 contrast on this surface, which
 * obliges a non-colour way to read the data. One toggle covers both.
 *
 * @param {{ title: string, description?: string, state: { data: any, error: Error|null, loading: boolean, reload: () => void },
 *   isEmpty?: (data: any) => boolean, emptyTitle?: string, emptyDescription?: string,
 *   controls?: React.ReactNode, table?: (data: any) => React.ReactNode,
 *   children: (data: any) => React.ReactNode }} props
 */
export function ChartCard({
  title,
  description,
  state,
  isEmpty,
  emptyTitle = 'Nothing to show yet',
  emptyDescription = 'Log some meals, or widen the date range.',
  controls,
  table,
  children,
}) {
  const [showTable, setShowTable] = useState(false);

  const { data, error, loading, reload } = state;
  // Keep the previous chart on screen while a new range loads. Replacing it
  // with a spinner makes every filter change flash the layout apart.
  const showSpinner = loading && !data;
  const empty = data && isEmpty?.(data);

  return (
    <section className="card chart-card">
      <header className="chart-head">
        <div>
          <h2 className="section-title">{title}</h2>
          {description && <p className="muted section-note">{description}</p>}
        </div>

        <div className="chart-actions">
          {controls}
          {table && data && !empty && (
            <button
              type="button"
              className="button button-ghost"
              aria-pressed={showTable}
              onClick={() => setShowTable((current) => !current)}
            >
              {showTable ? 'Show chart' : 'Show data'}
            </button>
          )}
        </div>
      </header>

      {showSpinner && <LoadingState label="Loading…" />}
      {!showSpinner && error && <ErrorState error={error} onRetry={reload} />}
      {!showSpinner && !error && empty && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}

      {!showSpinner && !error && data && !empty && (
        <div className={loading ? 'chart-body chart-body-stale' : 'chart-body'}>
          {showTable && table ? table(data) : children(data)}
        </div>
      )}
    </section>
  );
}
