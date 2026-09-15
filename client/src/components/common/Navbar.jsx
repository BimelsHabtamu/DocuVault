import NotificationsBell from './NotificationsBell';
import SidebarUserMenu from './SidebarUserMenu';

export default function Navbar({ onToggleSidebar }) {
  return (
    <header className="navbar">
      {/* Hamburger — toggles sidebar at ALL screen sizes */}
      <button
        type="button"
        className="hamburger-btn"
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="3" y1="6"  x2="21" y2="6"  />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="navbar-spacer" />

      <div className="navbar-user">
        <NotificationsBell />
        <SidebarUserMenu />
      </div>
    </header>
  );
}
