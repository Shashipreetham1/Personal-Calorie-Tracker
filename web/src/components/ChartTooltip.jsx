import { formatGrams } from '../lib/format.js';

/**
 * The tooltip for every chart in the app — no Recharts default anywhere.
 *
 * Names each series alongside its swatch, so identity never rests on colour
 * alone, and sets the figures in the display serif with tabular numerals so
 * they match the numbers elsewhere on the page.
 *
 * @param {{ active?: boolean, payload?: any[], label?: string,
 *   labelFormatter?: (label: string) => string, unit?: string }} props
 */
export function ChartTooltip({ active, payload, label, labelFormatter, unit = '' }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{labelFormatter ? labelFormatter(label) : label}</p>

      {payload.map((item) => (
        <p className="chart-tooltip-row" key={item.dataKey}>
          <span
            className="chart-tooltip-swatch"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          <span>{item.name}</span>
          <span className="figure">
            {item.value === null || item.value === undefined
              ? '—'
              : `${formatGrams(item.value)}${unit}`}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * A legend that matches the rest of the type system.
 *
 * Recharts' own legend uses its default font and ordering; this takes the
 * series exactly as given so the legend reads in the same order the segments
 * stack.
 *
 * @param {{ series: { label: string, colour: string }[] }} props
 */
export function ChartLegend({ series }) {
  return (
    <ul className="chart-legend">
      {series.map((item) => (
        <li className="chart-legend-item" key={item.label}>
          <span
            className="chart-tooltip-swatch"
            style={{ background: item.colour }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
