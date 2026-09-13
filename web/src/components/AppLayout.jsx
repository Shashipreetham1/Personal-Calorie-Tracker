import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

/** The screens in the primary navigation, in the order they are used. */
const NAV_ITEMS = [
  { to: '/today', label: 'Today' },
  { to: '/history', label: 'History' },
  { to: '/reports', label: 'Reports' },
  { to: '/goals', label: 'Goals' },
  { to: '/chat', label: 'Chat' },
  { to: '/import', label: 'Import' },
];

/**
 * The shell every signed-in screen renders inside: navigation, the account
 * menu, and the outlet the routed page fills.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-brand">Calorie Tracker</span>

          <nav className="app-nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="app-account">
            <span className="muted app-account-name">{user?.name || user?.email}</span>
            <button type="button" className="button button-ghost" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
