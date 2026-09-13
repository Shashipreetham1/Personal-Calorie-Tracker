import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { LoadingState } from './States.jsx';

/**
 * Gates the signed-in area of the app.
 *
 * While the session is still being checked it renders a loading state rather
 * than redirecting: bouncing a signed-in user to the login screen for the
 * fraction of a second before `/me` answers is a visible, confusing flash.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function ProtectedRoute({ children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="app-boot">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (!user) {
    // Remember where they were going so the login screen can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
