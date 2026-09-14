import { formatCalories, formatGrams } from '../lib/format.js';

/**
 * Progress towards one target.
 *
 * The bar is capped at 100% so a large overshoot cannot run off the card, but
 * the number is not — you need to see that you are at 2,800 of 2,000. Going
 * over renders in ochre, never red: the app reports, it does not scold.
 *
 * @param {{ label: string, value: number, target: number | null, unit?: string,
 *   colour?: string, track?: string }} props
 */
export function ProgressBar({ label, value, target, unit = '', colour, track }) {
  const format = unit === 'kcal' ? formatCalories : formatGrams;
  const hasTarget = typeof target === 'number' && target > 0;
  const ratio = hasTarget ? value / target : 0;
  const percent = Math.min(100, Math.round(ratio * 100));
  const over = hasTarget && ratio > 1.05;

  const style = {
    '--progress-colour': over ? 'var(--carbs)' : (colour ?? 'var(--accent)'),
    '--progress-track': track ?? 'var(--surface-sunken)',
  };

  return (
    <div className="progress" style={style}>
      <div className="progress-head">
        <span className="progress-label">
          <span className="progress-swatch" aria-hidden="true" />
          {label}
        </span>
        <span className="progress-value">
          <span className="figure">{format(value)}</span>
          {hasTarget && (
            <span className="muted">
              {' / '}
              {format(target)}
              {unit && ` ${unit}`}
            </span>
          )}
        </span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${format(value)}${hasTarget ? ` of ${format(target)}` : ''}`}
      >
        <div className="progress-fill" style={{ width: `${hasTarget ? percent : 0}%` }} />
      </div>

      {!hasTarget && <p className="progress-note">No target set</p>}
    </div>
  );
}
