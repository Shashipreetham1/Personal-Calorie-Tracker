import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
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
import { ChartTooltip, ChartLegend } from '../components/ChartTooltip.jsx';
import { CHART, MACRO_SERIES, axisProps, gridProps, barCursor } from '../lib/chartTheme.js';
import { formatCalories, formatGrams, formatDate, toISODate } from '../lib/format.js';

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

/** Splits "vitamin_c_mg" into a readable name and its unit. */
function parseMicroKey(key) {
  const parts = key.split('_');
  const unit = ['mg', 'ug', 'g', 'mcg', 'iu'].includes(parts.at(-1)) ? parts.pop() : '';

  return { name: parts.join(' '), unit: unit || 'unit' };
}

/**
 * Marks a day with nothing logged.
 *
 * The line already runs to zero, but a bare corner on the axis reads as missing
 * data. A small hollow dot says "this day is a real zero" — which is the whole
 * point of the gap-filled series behind it.
 */
function ZeroDayDot({ cx, cy, payload }) {
  if (!payload || payload.entryCount !== 0) return null;

  return <circle cx={cx} cy={cy} r={3} fill="var(--surface)" stroke={CHART.neutral} strokeWidth={1.5} />;
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
    () =>
      PRESETS.find((preset) => {
        const candidate = rangeForDays(preset.days);
        return candidate.from === range.from && candidate.to === range.to;
      }),
    [range],
  );

  /**
   * Micronutrients grouped by unit.
   *
   * Sodium in milligrams and vitamin D in micrograms cannot share an axis —
   * 15,000 beside 18 renders every other bar as a hairline. One chart per unit
   * keeps each on a scale where its values can be read.
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

  /** The most recent target in range, for the dashed reference line. */
  const currentTarget = useMemo(() => {
    const withGoal = (goalVsActual.data?.data ?? []).filter((day) => day.goalCalories !== null);
    return withGoal.at(-1)?.goalCalories ?? null;
  }, [goalVsActual.data]);

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Reports</h1>
      </div>

      {/* One filter row above every chart, never per-card controls. */}
      <div className="card filters rise">
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
          delay={40}
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
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" tickFormatter={axisDate} minTickGap={28} {...axisProps} />
                <YAxis width={52} {...axisProps} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={formatDate} unit=" kcal" />}
                  cursor={{ stroke: CHART.line }}
                />
                <Line
                  // Straight segments, not a spline: a smoothed curve invents
                  // values between days and overshoots either side of a gap.
                  type="linear"
                  dataKey="calories"
                  name="Calories"
                  stroke={CHART.accent}
                  strokeWidth={2}
                  dot={<ZeroDayDot />}
                  activeDot={{ r: 4, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Macronutrients"
          description="Protein, carbohydrate and fat, stacked so the bar height is the day's total."
          state={macros}
          delay={80}
          isEmpty={(data) => data.data.every((bucket) => bucket.entryCount === 0)}
          controls={
            <div className="segmented">
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
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="bucket" tickFormatter={axisDate} minTickGap={28} {...axisProps} />
                  <YAxis width={52} {...axisProps} />
                  <Tooltip
                    content={<ChartTooltip labelFormatter={formatDate} unit=" g" />}
                    cursor={barCursor}
                  />
                  {MACRO_SERIES.map((series, index) => (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      stackId="macros"
                      fill={series.colour}
                      // A hairline of the surface colour between segments,
                      // rather than an outline around each one.
                      stroke="var(--surface)"
                      strokeWidth={1}
                      radius={index === MACRO_SERIES.length - 1 ? [3, 3, 0, 0] : 0}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <ChartLegend series={MACRO_SERIES} />
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Goal vs actual"
          description="What you ate each day against the target that applied on that day."
          state={goalVsActual}
          delay={120}
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
            <>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={data.data} margin={{ top: 14, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="day" tickFormatter={axisDate} minTickGap={28} {...axisProps} />
                  <YAxis width={52} {...axisProps} />
                  <Tooltip
                    content={<ChartTooltip labelFormatter={formatDate} unit=" kcal" />}
                    cursor={barCursor}
                  />

                  <Bar dataKey="actualCalories" name="Eaten" radius={[3, 3, 0, 0]} strokeWidth={1}>
                    {data.data.map((day) => {
                      // Over target is ochre, never red — the app does not
                      // scold. See the README on tone.
                      const over = day.goalCalories !== null && day.actualCalories > day.goalCalories;

                      return (
                        <Cell
                          key={day.day}
                          fill={over ? CHART.carbs : CHART.accentSoft}
                          stroke={over ? CHART.carbs : CHART.accent}
                        />
                      );
                    })}
                  </Bar>

                  {currentTarget !== null && (
                    <ReferenceLine
                      y={currentTarget}
                      stroke={CHART.inkMuted}
                      strokeDasharray="4 4"
                      label={{
                        value: `target ${formatCalories(currentTarget)}`,
                        position: 'right',
                        fill: 'var(--ink-muted)',
                        fontSize: 11,
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                  )}

                  {/* The per-day target, which steps when the goal changes. */}
                  <Line
                    type="stepAfter"
                    dataKey="goalCalories"
                    name="Target"
                    stroke={CHART.inkMuted}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <ChartLegend
                series={[
                  { label: 'Eaten', colour: CHART.accent },
                  { label: 'Over target', colour: CHART.carbs },
                  { label: 'Target', colour: CHART.inkMuted },
                ]}
              />
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Micronutrients"
          description="Totals for the range. Grouped by unit — milligrams and micrograms cannot share a scale."
          state={micros}
          delay={160}
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
                  <h3 className="micro-facet-title">in {group.unit}</h3>
                  <ResponsiveContainer width="100%" height={Math.max(120, group.rows.length * 32)}>
                    <BarChart
                      data={group.rows}
                      layout="vertical"
                      margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={104}
                        {...axisProps}
                        axisLine={false}
                      />
                      <Tooltip content={<ChartTooltip unit={` ${group.unit}`} />} cursor={barCursor} />
                      <Bar dataKey="total" name="Total" fill={CHART.accent} radius={[0, 3, 3, 0]} barSize={12}>
                        {/* Within one unit these still span three orders of
                            magnitude, so the smallest bars are a hairline. The
                            value is written beside each one. */}
                        <LabelList
                          dataKey="total"
                          position="right"
                          formatter={(value) => formatGrams(value)}
                          className="figure"
                          style={{ fill: 'var(--ink)', fontSize: 12 }}
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
