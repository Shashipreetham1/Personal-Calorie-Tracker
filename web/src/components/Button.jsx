/**
 * The app's button.
 *
 * While `loading` it shows its own pending label and disables itself, so a slow
 * request cannot be submitted twice by an impatient click.
 *
 * @param {{ variant?: 'primary' | 'secondary' | 'ghost', loading?: boolean,
 *   loadingLabel?: string, children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel = 'Working…',
  disabled,
  children,
  ...buttonProps
}) {
  return (
    <button
      className={`button button-${variant}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
