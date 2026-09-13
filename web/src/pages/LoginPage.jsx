import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth.jsx';
import { FormField } from '../components/FormField.jsx';
import { Button } from '../components/Button.jsx';
import { Alert } from '../components/Alert.jsx';

/**
 * Client-side rules, mirroring the server's.
 *
 * Validating here is about feedback speed, not security — the server validates
 * the same things again and is the only check that counts. Keeping the rules
 * identical means a field that looks fine locally is never rejected remotely.
 */
const signupSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
});

const EMPTY_FORM = { name: '', email: '', password: '' };

export default function LoginPage() {
  const { user, status, login, signup } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState(/** @type {'login' | 'signup'} */ ('login'));
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: go where they were headed, or to Today.
  if (status === 'ready' && user) {
    return <Navigate to={location.state?.from ?? '/today'} replace />;
  }

  const isSignup = mode === 'signup';

  function switchMode(nextMode) {
    setMode(nextMode);
    setFieldErrors({});
    setSubmitError(null);
  }

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      // Clear the error as soon as the user starts fixing the field, rather
      // than making them submit again to find out whether they have.
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const schema = isSignup ? signupSchema : loginSchema;
    const payload = isSignup ? form : { email: form.email, password: form.password };
    const result = schema.safeParse(payload);

    if (!result.success) {
      setFieldErrors(
        Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message])),
      );
      return;
    }

    setSubmitting(true);
    try {
      const credentials = isSignup
        ? { ...result.data, name: result.data.name || undefined }
        : result.data;

      await (isSignup ? signup(credentials) : login(credentials));
      // No navigation needed: `user` becomes set and the redirect above fires.
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Calorie Tracker</h1>
        <p className="muted">
          {isSignup ? 'Create an account to start tracking.' : 'Sign in to your account.'}
        </p>

        <div className="tabs" role="tablist" aria-label="Sign in or create an account">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={!isSignup ? 'tab tab-active' : 'tab'}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={isSignup ? 'tab tab-active' : 'tab'}
            onClick={() => switchMode('signup')}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <FormField
              id="name"
              label="Name"
              type="text"
              autoComplete="name"
              placeholder="Optional"
              value={form.name}
              onChange={updateField('name')}
              error={fieldErrors.name}
            />
          )}

          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={updateField('email')}
            error={fieldErrors.email}
          />

          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            value={form.password}
            onChange={updateField('password')}
            error={fieldErrors.password}
            hint={isSignup ? 'At least 8 characters' : undefined}
          />

          <Alert tone="error">{submitError}</Alert>

          <Button
            type="submit"
            loading={submitting}
            loadingLabel={isSignup ? 'Creating account…' : 'Signing in…'}
          >
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="auth-demo">
          Demo account: <code>demo@example.com</code> / <code>demo1234</code>
        </p>
      </div>
    </main>
  );
}
