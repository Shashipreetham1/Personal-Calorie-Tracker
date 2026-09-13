/**
 * A labelled input with inline validation feedback.
 *
 * The error is tied to the input with `aria-describedby` and `aria-invalid`, so
 * a screen reader announces why a field was rejected rather than leaving the
 * message as decoration next to it.
 *
 * @param {{ id: string, label: string, error?: string, hint?: string } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export function FormField({ id, label, error, hint, ...inputProps }) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={error ? 'input input-invalid' : 'input'}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && !error && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
