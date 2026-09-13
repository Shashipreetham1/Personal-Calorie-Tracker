/**
 * An inline message. `role="alert"` for errors so it is announced immediately;
 * anything else is announced politely when the user reaches it.
 *
 * @param {{ tone?: 'error' | 'warning' | 'info' | 'success', children: React.ReactNode }} props
 */
export function Alert({ tone = 'info', children }) {
  if (!children) return null;

  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
