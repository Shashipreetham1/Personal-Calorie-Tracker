import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { getCurrentGoal, listGoals, createGoal } from '../api/goals.js';
import { useAsync } from '../hooks/useAsync.js';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { FormField } from '../components/FormField.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';
import { CheckIcon } from '../components/icons.jsx';
import { formatCalories, formatGrams, formatDate, toISODate } from '../lib/format.js';

/** kcal per gram. Used to show the user what their macros actually add up to. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

/** Mirrors the server's bounds so the same input is accepted in both places. */
const goalSchema = z.object({
  dailyCalories: z.coerce
    .number()
    .int('Use a whole number')
    .min(500, 'At least 500')
    .max(10000, 'At most 10,000'),
  proteinG: z.coerce.number().nonnegative('Cannot be negative').max(2000),
  carbsG: z.coerce.number().nonnegative('Cannot be negative').max(2000),
  fatG: z.coerce.number().nonnegative('Cannot be negative').max(2000),
  weightGoalKg: z.union([z.literal(''), z.coerce.number().positive('Must be more than 0').max(500)]),
  effectiveFrom: z.string().refine((value) => value <= toISODate(), 'Cannot be in the future'),
});

/** Read-only summary of the goal in effect today. */
function CurrentGoalCard({ goal }) {
  return (
    <div className="card goal-current rise">
      <div className="goal-current-head">
        <div>
          <p className="muted">Current goal</p>
          <p className="goal-calories figure">{formatCalories(goal.dailyCalories)} kcal / day</p>
        </div>
        <p className="goal-since">
          <CheckIcon size={13} />
          In effect since {formatDate(goal.effectiveFrom)}
        </p>
      </div>

      <dl className="goal-macros">
        <div>
          <dt>
            <span className="progress-swatch" style={{ '--progress-colour': 'var(--protein)' }} />
            Protein
          </dt>
          <dd className="figure">{formatGrams(goal.proteinG)} g</dd>
        </div>
        <div>
          <dt>
            <span className="progress-swatch" style={{ '--progress-colour': 'var(--carbs)' }} />
            Carbs
          </dt>
          <dd className="figure">{formatGrams(goal.carbsG)} g</dd>
        </div>
        <div>
          <dt>
            <span className="progress-swatch" style={{ '--progress-colour': 'var(--fat)' }} />
            Fat
          </dt>
          <dd className="figure">{formatGrams(goal.fatG)} g</dd>
        </div>
        <div>
          <dt>Weight goal</dt>
          <dd className="figure">
            {goal.weightGoalKg ? `${formatGrams(goal.weightGoalKg)} kg` : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function GoalsPage() {
  const fetchCurrent = useCallback(
    () =>
      getCurrentGoal().catch((error) => {
        // No goal yet is a first-run state, not a failure.
        if (error.status === 404) return null;
        throw error;
      }),
    [],
  );
  const fetchHistory = useCallback(() => listGoals({ limit: 20 }), []);

  const current = useAsync(fetchCurrent);
  const history = useAsync(fetchHistory);

  const [form, setForm] = useState({
    dailyCalories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    weightGoalKg: '',
    effectiveFrom: toISODate(),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  /**
   * What the macro targets actually add up to.
   *
   * Shown live while typing so the mismatch the server would warn about is
   * visible before saving, rather than arriving as a surprise afterwards.
   */
  const derivedCalories = useMemo(() => {
    const protein = Number(form.proteinG) || 0;
    const carbs = Number(form.carbsG) || 0;
    const fat = Number(form.fatG) || 0;

    return protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;
  }, [form.proteinG, form.carbsG, form.fatG]);

  const targetCalories = Number(form.dailyCalories) || 0;
  const mismatch =
    targetCalories > 0 && derivedCalories > 0
      ? Math.round(((derivedCalories - targetCalories) / targetCalories) * 100)
      : 0;

  function updateField(field) {
    return (event) => {
      setForm((c) => ({ ...c, [field]: event.target.value }));
      setErrors((c) => ({ ...c, [field]: undefined }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    setResult(null);

    const parsed = goalSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }

    setSaving(true);
    try {
      const saved = await createGoal({
        ...parsed.data,
        weightGoalKg: parsed.data.weightGoalKg === '' ? null : parsed.data.weightGoalKg,
      });

      // The server may return a warning alongside a perfectly saved goal.
      // That is information, not failure — show it and refresh either way.
      setResult(saved);
      current.reload();
      history.reload();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const goals = history.data?.data ?? [];

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Goals</h1>
      </div>

      {current.loading && !current.data && (
        <div className="card" aria-busy="true" aria-label="Loading your goal">
          <div className="skeleton skeleton-line" style={{ width: '25%' }} />
          <div className="skeleton skeleton-hero" />
        </div>
      )}

      {!current.loading && current.error && (
        <div className="card">
          <ErrorState error={current.error} onRetry={current.reload} />
        </div>
      )}

      {!current.loading && !current.error && !current.data && (
        <div className="card">
          <EmptyState
            title="No goal set yet"
            description="Set your daily targets below. Your progress on the Today screen will start showing against them."
          />
        </div>
      )}

      {!current.loading && !current.error && current.data && <CurrentGoalCard goal={current.data} />}

      <div className="goal-columns">
        <div className="card">
          <h2 className="section-title">Set a new goal</h2>
          <p className="muted section-note">
            Goals are kept as history rather than overwritten, so past days keep the target that
            actually applied to them.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              id="dailyCalories"
              label="Daily calories"
              type="number"
              min="500"
              max="10000"
              value={form.dailyCalories}
              onChange={updateField('dailyCalories')}
              error={errors.dailyCalories}
              placeholder="2000"
            />

            <div className="form-row">
              <FormField
                id="proteinG"
                label="Protein (g)"
                type="number"
                step="any"
                min="0"
                value={form.proteinG}
                onChange={updateField('proteinG')}
                error={errors.proteinG}
                placeholder="150"
              />
              <FormField
                id="carbsG"
                label="Carbs (g)"
                type="number"
                step="any"
                min="0"
                value={form.carbsG}
                onChange={updateField('carbsG')}
                error={errors.carbsG}
                placeholder="200"
              />
              <FormField
                id="fatG"
                label="Fat (g)"
                type="number"
                step="any"
                min="0"
                value={form.fatG}
                onChange={updateField('fatG')}
                error={errors.fatG}
                placeholder="67"
              />
            </div>

            {derivedCalories > 0 && (
              <p className={Math.abs(mismatch) > 15 ? 'macro-sum macro-sum-off' : 'macro-sum'}>
                Your macros add up to <strong>{formatCalories(derivedCalories)} kcal</strong>
                {targetCalories > 0 && (
                  <>
                    {' '}
                    — {mismatch === 0 ? 'exactly your target' : `${Math.abs(mismatch)}% ${mismatch > 0 ? 'above' : 'below'} your target`}
                  </>
                )}
              </p>
            )}

            <div className="form-row">
              <FormField
                id="weightGoalKg"
                label="Weight goal (kg)"
                type="number"
                step="any"
                min="0"
                value={form.weightGoalKg}
                onChange={updateField('weightGoalKg')}
                error={errors.weightGoalKg}
                placeholder="Optional"
              />
              <FormField
                id="effectiveFrom"
                label="In effect from"
                type="date"
                max={toISODate()}
                value={form.effectiveFrom}
                onChange={updateField('effectiveFrom')}
                error={errors.effectiveFrom}
              />
            </div>

            <Alert tone="error">{submitError}</Alert>

            {result && (
              <Alert tone={result.warning ? 'warning' : 'success'}>
                {result.warning ?? `Goal saved, in effect from ${formatDate(result.effectiveFrom)}.`}
              </Alert>
            )}

            <Button type="submit" loading={saving} loadingLabel="Saving…">
              Save goal
            </Button>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Goal history</h2>

          {history.loading && !history.data && (
            <div aria-busy="true" aria-label="Loading goal history">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="skeleton skeleton-row" key={index} />
              ))}
            </div>
          )}
          {!history.loading && history.error && (
            <ErrorState error={history.error} onRetry={history.reload} />
          )}
          {!history.loading && !history.error && goals.length === 0 && (
            <EmptyState title="Nothing yet" description="Goals you set will be listed here." />
          )}

          {!history.loading && !history.error && goals.length > 0 && (
            <ol className="goal-history">
              {goals.map((goal, index) => (
                <li key={goal.id} className="goal-history-item">
                  <div className="goal-history-head">
                    <span className="figure cell-strong">
                      {formatCalories(goal.dailyCalories)} kcal
                    </span>
                    {index === 0 && <span className="badge">Current</span>}
                  </div>
                  <p className="muted goal-history-meta">
                    From {formatDate(goal.effectiveFrom)} · P{formatGrams(goal.proteinG)} C
                    {formatGrams(goal.carbsG)} F{formatGrams(goal.fatG)}
                    {goal.weightGoalKg ? ` · ${formatGrams(goal.weightGoalKg)} kg` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
