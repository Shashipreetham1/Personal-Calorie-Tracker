import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import {
  BrandMark,
  ChatIcon,
  GoalsIcon,
  HistoryIcon,
  ImportIcon,
  ReportsIcon,
  TodayIcon,
} from './icons.jsx';

/**
 * Every route in the app, in the order they are used.
 *
 * One list drives both the desktop nav and the mobile tab bar, so a screen can
 * never be reachable from one and not the other.
 */
const NAV_ITEMS = [
  { to: '/today', label: 'Today', Icon: TodayIcon },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/reports', label: 'Reports', Icon: ReportsIcon },
  { to: '/goals', label: 'Goals', Icon: GoalsIcon },
  { to: '/chat', label: 'Chat', Icon: ChatIcon },
  { to: '/import', label: 'Import', Icon: ImportIcon },
];

/** First letter of the display name, for the avatar. */
function initialOf(user) {
  return (user?.name?.trim() || user?.email || '?').charAt(0).toUpperCase();
}

/**
 * The account control.
 *
 * A long address — a test account, say — is truncated to the avatar and a short
 * label rather than being allowed to push the header apart; the full address
 * lives in the menu.
 */
function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="avatar" aria-hidden="true">
          {initialOf(user)}
        </span>
        <span className="account-name">{user?.name || user?.email}</span>
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <span className="account-menu-email">{user?.email}</span>
          <button type="button" className="button button-ghost" role="menuitem" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** The shell every signed-in screen renders inside. */
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // The header rule appears only once the page has moved, so the bar sits flush
  // with the paper at rest.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app">
      <header className={scrolled ? 'app-header app-header-scrolled' : 'app-header'}>
        <div className="app-header-inner">
          <NavLink to="/today" className="brand">
            <BrandMark />
            <span className="brand-word">Calorie Tracker</span>
          </NavLink>

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

          <AccountMenu user={user} onSignOut={handleSignOut} />
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      {/* Below 768px the nav becomes a bottom tab bar: this is a logging app,
          and logging happens on a phone. */}
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'tab-link tab-link-active' : 'tab-link')}
            >
              <item.Icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
