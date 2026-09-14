/**
 * Chart theme.
 *
 * Every colour is a `var(--token)` reference rather than a literal. SVG
 * presentation attributes resolve custom properties, so the charts re-theme
 * themselves in dark mode with no JavaScript and no second palette.
 *
 * The macro hues are fixed: protein is forest, carbs ochre, fat plum, on every
 * chart and every bar in the app. Nothing here is a Recharts default.
 */

export const CHART = {
  accent: 'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  protein: 'var(--protein)',
  carbs: 'var(--carbs)',
  fat: 'var(--fat)',
  neutral: 'var(--neutral)',
  line: 'var(--line)',
  ink: 'var(--ink)',
  inkMuted: 'var(--ink-muted)',
  surface: 'var(--surface)',
};

/** Axis ticks: body font, small, muted — recessive by design. */
export const axisTick = {
  fill: 'var(--ink-muted)',
  fontSize: 12,
  fontFamily: 'var(--font-body)',
};

/** Shared props for a horizontal-only 1px grid. */
export const gridProps = {
  stroke: 'var(--line)',
  strokeWidth: 1,
  vertical: false,
};

/** Shared props for both axes. */
export const axisProps = {
  tick: axisTick,
  stroke: 'var(--line)',
  tickLine: false,
  axisLine: { stroke: 'var(--line)' },
};

/** A barely-there hover band behind the focused column. */
export const barCursor = { fill: 'var(--surface-sunken)', opacity: 0.7 };

/** The three macros, in the order they stack and appear in every legend. */
export const MACRO_SERIES = [
  { key: 'proteinG', label: 'Protein', colour: CHART.protein },
  { key: 'carbsG', label: 'Carbs', colour: CHART.carbs },
  { key: 'fatG', label: 'Fat', colour: CHART.fat },
];
