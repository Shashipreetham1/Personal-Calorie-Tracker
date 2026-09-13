import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getCalorieTrend,
  getMacroBreakdown,
  getMicroSummary,
  getGoalVsActual,
} from '../api/reports.js';
import { useAsync } from '../hooks/useAsync.js';
import { ChartCard } from '../components/ChartCard.jsx';
import { formatCalories, formatGrams, formatDate, toISODate } from '../lib/format.js';

/**
 * Chart colours, taken from the validated categorical palette in fixed slot
 * order (blue, orange, aqua). Assigned per series identity and never by rank,
 * so filtering or reordering never repaints a series.
 */
const SERIES = {
  primary: '#2a78d6',
  secondary: '#eb6834',
  tertiary: '#1baf7a',
};

const CHROME = {
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
};

/** Preset ranges, the way people actually think about them. */
const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function rangeForDays(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));

  return { from: toISODate(from), to: toISODate(to) };
}

/** Short axis label for a day bucket, e.g. "13 Sep". */
function axisDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Shared tooltip.
 *
 * Names every series it shows, so identity never rests on colour alone, and
 * formats values the same way the rest of the app does.
 */
function ChartTooltip({ active, payload, label, labelFormatter, unit = '' }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((item) => (
        <p className="chart-tooltip-row" key={item.dataKey}>
          <span className="chart-tooltip-swatch" style={{ background: item.color }} aria-hidden="true" />
          <span>{item.name}</span>
          <strong>
            {item.value === null || item.value === undefined
              ? '—'
              : `${formatGrams(item.value)}${unit}`}
          </strong>
        </p>
      ))}
    </div>
  );
}

/** Splits "vitamin_c_mg" into a readable name and its unit. */
function parseMicroKey(key) {
  const parts = key.split('_');
  const unit = ['mg', 'ug', 'g', 'mcg', 'iu'].includes(parts.at(-1)) ? parts.pop() : '';

  return { name: parts.join(' '), unit: unit || 'unit' };
}

export default function ReportsPage() {
  const [range, setRange] = useState(() => rangeForDays(30));
  const [granularity, setGranularity] = useState('day');

  const trend = useAsync(useCallback(() => getCalorieTrend(range), [range]));
  const macros = useAsync(
    useCallback(() => getMacroBreakdown({ ...range, granularity }), [range, granularity]),
  );
  const micros = useAsync(useCallback(() => getMicroSummary(range), [range]));
  const goalVsActual = useAsync(useCallback(() => getGoalVsActual(range), [range]));

  const activePreset = useMemo(
    () => PRESETS.find((preset) => {
      const candidate = rangeForDays(preset.days);
      return candidate.from === range.from && candidate.to === range.to;
    }),
    [range],
  );

  /**
   * Micronutrients grouped by unit.
   *
   * Sodium in milligrams and vitamin D in micrograms cannot share an axis —
   * 15,000 next to 18 renders every other bar as a hairline, and the comparison
   * would be meaningless anyway. One small chart per unit keeps each on a scale
   * where its values can actually be read.
   */
  const microGroups = useMemo(() => {
    const groups = new Map();

    for (const row of micros.data?.data ?? []) {
      const { name, unit } = parseMicroKey(row.key);
      if (!groups.has(unit)) groups.set(unit, []);
      groups.get(unit).push({ name, total: row.total, entryCount: row.entryCount });
    }

    return [...groups.entries()]
      .map(([unit, rows]) => ({ unit, rows: rows.sort((a, b) => b.total - a.total).slice(0, 8) }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [micros.data]);

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Reports</h1>
      </div>

      {/* One filter row above every chart, never per-card controls. */}
      <div className="card filters">
        <div className="field filter-field">
          <label className="field-label" htmlFor="report-from">
            From
          </label>
          <input
            id="report-from"
            className="input"
            type="date"
            value={range.from}
            max={range.to}
            onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
          />
        </div>

        <div className="field filter-field">
          <label className="field-label" htmlFor="report-to">
            To
          </label>
          <input
            id="report-to"
            className="input"
            type="date"
            value={range.to}
            min={range.from}
            max={toISODate()}
            onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
          />
        </div>

        <div className="field filter-field filter-reset">
          <span className="field-label">Quick ranges</span>
          <div className="segmented">
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                className={activePreset?.days === preset.days ? 'segment segment-active' : 'segment'}
                aria-pressed={activePreset?.days === preset.days}
                onClick={() => setRange(rangeForDays(preset.days))}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-stack">
        <ChartCard
          title="Calorie intake"
          description="Daily totals. Days with nothing logged show as zero rather than being skipped."
          state={trend}
          isEmpty={(data) => data.data.every((day) => day.calories === 0)}
          table={(data) => (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="numeric">Calories</th>
                    <th scope="col" className="numeric">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((day) => (
                    <tr key={day.day}>
                      <td>{formatDate(day.day)}</td>
                      <td className="numeric">{formatCalories(day.calories)}</td>
                      <td className="numeric muted">{day.entryCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        >
          {(data) => (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={CHROME.grid} vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={axisDate}
                  tick={{ fill: CHROME.muted, fontSize: 12 }}
                  stroke={CHROME.axis}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: CHROME.muted, fontSize: 12 }}
                  stroke={CHROME.axis}
                  width={48}
                />
                <Tooltip
                  content={<ChartTooltip labelFormatter={formatDate} unit=" kcal" />}
                  cursor={{ stroke: CHROME.axis }}
                />
                <Line
                  // Straight segments, not a spline: a smoothed curve invents
                  // values between days and overshoots below zero on either
                  // side of a gap day, implying intake that never happened.
                  type="linear"
                  dataKey="calories"
                  name="Calories"
                  stroke={SERIES.primary}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Macronutrients"
          description="Protein, carbohydrate and fat, stacked so the bar height is the day's total."
          state={macros}
          isEmpty={(data) => data.data.every((bucket) => bucket.entryCount === 0)}
          controls={
            <div className="segmented segmented-small">
              {['day', 'week'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={granularity === option ? 'segment segment-active' : 'segment'}
                  aria-pressed={granularity === option}
                  onClick={() => setGranularity(option)}
                >
                  By {option}
                </button>
              ))}
            </div>
          }
          table={(data) => (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{granularity === 'week' ? 'Week of' : 'Day'}</th>
                    <th scope="col" className="numeric">Protein (g)</th>
                    <th scope="col" className="numeric">Carbs (g)</th>
                    <th scope="col" className="numeric">Fat (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((bucket) => (
                    <tr key={bucket.bucket}>
                      <td>{formatDate(bucket.bucket)}</td>
                      <td className="numeric">{formatGrams(bucket.proteinG)}</td>
                      <td className="numeric">{formatGrams(bucket.carbsG)}</td>
                      <td className="numeric">{formatGrams(bucket.fatG)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        >
          {(data) => (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={CHROME.grid} vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={axisDate}
                  tick={{ fill: CHROME.muted, fontSize: 12 }}
                  stroke={CHROME.axis}
                  minTickGap={24}
                />
                <YAxis tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis} width={48} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={formatDate} unit=" g" />}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Legend
                  iconType="square"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  // Stated explicitly so the legend reads in the same order the
                  // segments stack; Recharts orders it by render pass otherwise.
                  payload={[
                    { value: 'Protein', type: 'square', color: SERIES.primary },
                    { value: 'Carbs', type: 'square', color: SERIES.secondary },
                    { value: 'Fat', type: 'square', color: SERIES.tertiary },
                  ]}
                />
                {/* A 2px surface-coloured gap between stacked segments, rather
                    than an outline around each one. */}
                <Bar dataKey="proteinG" name="Protein" stackId="macros" fill={SERIES.primary} stroke="#fff" strokeWidth={1} />
                <Bar dataKey="carbsG" name="Carbs" stackId="macros" fill={SERIES.secondary} stroke="#fff" strokeWidth={1} />
                <Bar dataKey="fatG" name="Fat" stackId="macros" fill={SERIES.tertiary} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Goal vs actual"
          description="What you ate each day against the target that applied on that day."
          state={goalVsActual}
          isEmpty={(data) => data.data.every((day) => day.entryCount === 0)}
          table={(data) => (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="numeric">Goal</th>
                    <th scope="col" className="numeric">Actual</th>
                    <th scope="col" className="numeric">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((day) => (
                    <tr key={day.day}>
                      <td>{formatDate(day.day)}</td>
                      <td className="numeric muted">
                        {day.goalCalories === null ? '—' : formatCalories(day.goalCalories)}
                      </td>
                      <td className="numeric">{formatCalories(day.actualCalories)}</td>
                      <td className="numeric">
                        {day.goalCalories === null
                          ? '—'
                          : formatCalories(day.actualCalories - day.goalCalories)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        >
          {(data) => (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={CHROME.grid} vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={axisDate}
                  tick={{ fill: CHROME.muted, fontSize: 12 }}
                  stroke={CHROME.axis}
                  minTickGap={24}
                />
                <YAxis tick={{ fill: CHROME.muted, fontSize: 12 }} stroke={CHROME.axis} width={48} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={formatDate} unit=" kcal" />}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {/* Both series are kcal, so they share one axis honestly. */}
                <Bar dataKey="actualCalories" name="Eaten" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
                <Line
                  type="stepAfter"
                  dataKey="goalCalories"
                  name="Target"
                  stroke={SERIES.secondary}
                  strokeWidth={2}
                  dot={false}
                  // A day before the first goal has no target; leave a gap
                  // rather than drawing a line down to zero.
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Micronutrients"
          description="Totals for the range. Grouped by unit — milligrams and micrograms cannot share a scale."
          state={micros}
          isEmpty={(data) => data.data.length === 0}
          emptyTitle="No micronutrients recorded"
          emptyDescription="Entries logged from a nutrition label usually carry them."
          table={(data) => (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Micronutrient</th>
                    <th scope="col" className="numeric">Total</th>
                    <th scope="col" className="numeric">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => {
                    const { name, unit } = parseMicroKey(row.key);
                    return (
                      <tr key={row.key}>
                        <td className="capitalise">{name}</td>
                        <td className="numeric">
                          {formatGrams(row.total)} {unit}
                        </td>
                        <td className="numeric muted">{row.entryCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        >
          {() => (
            <div className="micro-facets">
              {microGroups.map((group) => (
                <div className="micro-facet" key={group.unit}>
                  <h3 className="micro-facet-title muted">in {group.unit}</h3>
                  <ResponsiveContainer width="100%" height={Math.max(120, group.rows.length * 34)}>
                    <BarChart
                      data={group.rows}
                      layout="vertical"
                      margin={{ top: 4, right: 56, bottom: 4, left: 0 }}
                    >
                      <CartesianGrid stroke={CHROME.grid} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: CHROME.muted, fontSize: 12 }}
                        stroke={CHROME.axis}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: CHROME.muted, fontSize: 12 }}
                        stroke={CHROME.axis}
                        width={110}
                      />
                      <Tooltip
                        content={<ChartTooltip unit={` ${group.unit}`} />}
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      />
                      <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]} barSize={14}>
                        {/* One hue for one series: the nutrient name on the
                            axis carries identity, so shading bars by size
                            would encode magnitude twice. */}
                        {group.rows.map((row) => (
                          <Cell key={row.name} fill={SERIES.primary} />
                        ))}
                        {/* Even inside one unit these span three orders of
                            magnitude — sodium in the thousands beside vitamin E
                            in tens — so the smallest bars are a hairline. The
                            value is written beside each one rather than left to
                            a hover the reader may never try. */}
                        <LabelList
                          dataKey="total"
                          position="right"
                          formatter={(value) => formatGrams(value)}
                          style={{ fill: CHROME.muted, fontSize: 11 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
