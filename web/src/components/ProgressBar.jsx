import { formatCalories, formatGrams } from '../lib/format.js';

/**
 * Progress towards one target.
 *
 * The bar is capped at 100% so a large overshoot cannot run off the card, but
 * the number is not — the user needs to see that they are at 2,800 of 2,000,
 * and a bar pinned at full with the real figure beside it says that clearly.
 *
 * @param {{ label: string, value: number, target: number | null, unit?: string,
 *   size?: 'large' | 'small' }} props
 */
export function ProgressBar({ label, value, target, unit = '', size = 'small' }) {
  const format = unit === 'kcal' ? formatCalories : formatGrams;
  const hasTarget = typeof target === 'number' && target > 0;
  const ratio = hasTarget ? value / target : 0;
  const percent = Math.min(100, Math.round(ratio * 100));
  const over = hasTarget && ratio > 1.05;

  return (
    <div className={size === 'large' ? 'progress progress-large' : 'progress'}>
      <div className="progress-head">
        <span className="progress-label">{label}</span>
        <span className="progress-value">
          <strong>{format(value)}</strong>
          {hasTarget ? <span className="muted"> / {format(target)}{unit && ` ${unit}`}</span> : unit && <span className="muted"> {unit}</span>}
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
        <div
          className={over ? 'progress-fill progress-fill-over' : 'progress-fill'}
          style={{ width: `${hasTarget ? percent : 0}%` }}
        />
      </div>

      {!hasTarget && <p className="progress-note muted">No target set</p>}
    </div>
  );
}
