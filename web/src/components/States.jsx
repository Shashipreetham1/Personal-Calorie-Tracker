import { Button } from './Button.jsx';

/**
 * The three states every async view needs.
 *
 * Kept together because they are a set: a view that renders one of these must
 * be able to render all three, and having them in one file makes a missing case
 * obvious while writing a screen.
 */

/** @param {{ label?: string }} props */
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p className="muted">{label}</p>
    </div>
  );
}

/**
 * Empty states explain what the screen is for and offer the action that fills
 * it — a blank panel reads as broken rather than new.
 *
 * @param {{ title: string, description?: string, action?: React.ReactNode }} props
 */
export function EmptyState({ title, description, action }) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  );
}

/**
 * @param {{ error: Error | { message: string } | null, onRetry?: () => void }} props
 */
export function ErrorState({ error, onRetry }) {
  return (
    <div className="state">
      <p className="state-title">Something went wrong</p>
      <p className="error">{error?.message ?? 'Unknown error'}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
