import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ROLES } from '../../utils/roles';
const logo = '/logo.png';
import {
  IconDashboard,
  IconTemplates,
  IconMyDocuments,
  IconDocumentTracking,
  IconApprovals,
  IconUsers,
  IconSettings,
  IconDatabase,
  IconExternalData,
  IconAudit,
  IconVerify,
  IconMyReceivedDocs,
} from './SidebarIcons';

// ── Bottom-section inline icons ───────────────────────────────────────────────
function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function IconPerson() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconHelp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconChevron({ open }) {
  return (
    <svg
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
      width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // My Settings submenu expand/collapse state
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!user) return null;

  const role          = user.role;
  const isSuperAdmin  = role === ROLES.SUPER_ADMIN;
  const isSystemAdmin = role === ROLES.SYSTEM_ADMIN;
  const isAdmin       = isSuperAdmin || isSystemAdmin;
  const isGenerator   = role === ROLES.GENERATOR;
  const isApprover    = role === ROLES.APPROVER;
  const isRecipient   = role === ROLES.RECIPIENT;

  // On narrow screens the sidebar acts as an overlay drawer — picking a link closes it.
  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) onClose?.();
  };

  const handleLogout = async () => {
    onClose?.();
    await logout();
    navigate('/login', { replace: true });
  };

  const navTo = (path) => {
    handleNavClick();
    navigate(path);
  };

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* ── Brand ── */}
      <div className="sidebar-brand">
        <span className="sidebar-brand-text">
          <img src={logo} alt="" className="sidebar-brand-logo" />
          DocuVault
        </span>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onClose}
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      {/* ── Role-specific navigation (scrollable) ── */}
      <nav className="sidebar-nav sidebar-nav-scroll" onClick={handleNavClick}>

        {/* ── ADMIN (super_admin + system_admin) ── */}
        {isAdmin && (
          <>
            <NavLink to="/dashboard" className="sidebar-link">
              <IconDashboard /> <span>Dashboard</span>
            </NavLink>
            <NavLink to="/templates" className="sidebar-link">
              <IconTemplates /> <span>Templates</span>
            </NavLink>
            <NavLink to="/documents" className="sidebar-link">
              <IconMyDocuments /> <span>My Documents</span>
            </NavLink>
            <NavLink to="/document-tracking" className="sidebar-link">
              <IconDocumentTracking /> <span>Document Tracking</span>
            </NavLink>
            <NavLink to="/approvals" className="sidebar-link">
              <IconApprovals /> <span>Pending Approvals</span>
            </NavLink>
            <NavLink to="/verify" className="sidebar-link">
              <IconVerify /> <span>Verify Document</span>
            </NavLink>
            <NavLink to="/audit-logs" className="sidebar-link">
              <IconAudit /> <span>Audit &amp; Reports</span>
            </NavLink>
          </>
        )}

        {/* Super Admin only: Administration section */}
        {isSuperAdmin && (
          <>
            <div className="sidebar-section-label">Administration</div>
            <NavLink to="/users" className="sidebar-link">
              <IconUsers /> <span>User Management</span>
            </NavLink>
            <NavLink to="/settings" end className="sidebar-link">
              <IconSettings /> <span>System Settings</span>
            </NavLink>
            <NavLink to="/settings/database" className="sidebar-link">
              <IconDatabase /> <span>Database Connections</span>
            </NavLink>
            <NavLink to="/settings/external-databases" className="sidebar-link">
              <IconExternalData /> <span>External Data Sources</span>
            </NavLink>
          </>
        )}

        {/* ── GENERATOR ── */}
        {isGenerator && (
          <>
            <NavLink to="/dashboard" className="sidebar-link">
              <IconDashboard /> <span>Dashboard</span>
            </NavLink>
            <NavLink to="/documents" className="sidebar-link">
              <IconMyDocuments /> <span>My Documents</span>
            </NavLink>
            <NavLink to="/document-tracking" className="sidebar-link">
              <IconDocumentTracking /> <span>Document Tracking</span>
            </NavLink>
            <NavLink to="/verify" className="sidebar-link">
              <IconVerify /> <span>Verify Document</span>
            </NavLink>
          </>
        )}

        {/* ── APPROVER ── */}
        {isApprover && (
          <>
            <NavLink to="/dashboard" className="sidebar-link">
              <IconDashboard /> <span>Dashboard</span>
            </NavLink>
            <NavLink to="/documents" className="sidebar-link">
              <IconMyDocuments /> <span>My Documents</span>
            </NavLink>
            <NavLink to="/document-tracking" className="sidebar-link">
              <IconDocumentTracking /> <span>Document Tracking</span>
            </NavLink>
            <NavLink to="/approvals" className="sidebar-link">
              <IconApprovals /> <span>Pending Approvals</span>
            </NavLink>
            <NavLink to="/verify" className="sidebar-link">
              <IconVerify /> <span>Verify Document</span>
            </NavLink>
          </>
        )}

        {/* ── RECIPIENT ── */}
        {isRecipient && (
          <>
            <NavLink to="/my-documents" className="sidebar-link">
              <IconMyReceivedDocs /> <span>My Documents</span>
            </NavLink>
            <NavLink to="/verify" className="sidebar-link">
              <IconVerify /> <span>Verify Document</span>
            </NavLink>
          </>
        )}

      </nav>

      {/* ── Shared bottom section — all 5 roles ── */}
      <div className="sidebar-bottom">

        {/* Divider */}
        <div className="sidebar-bottom-divider" />

        {/* My Settings — expandable */}
        <button
          type="button"
          className={`sidebar-bottom-item${['/notifications', '/profile'].includes(location.pathname) ? ' sidebar-bottom-item-active' : ''}`}
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen}
        >
          <span className="sidebar-bottom-item-icon"><IconGear /></span>
          <span className="sidebar-bottom-item-label">My Settings</span>
          <IconChevron open={settingsOpen} />
        </button>

        {settingsOpen && (
          <div className="sidebar-submenu">
            <button type="button"
              className={`sidebar-submenu-item${location.pathname === '/notifications' ? ' sidebar-submenu-item-active' : ''}`}
              onClick={() => navTo('/notifications')}>
              <span className="sidebar-submenu-tree">├</span>
              <span className="sidebar-submenu-icon"><IconBell /></span>
              <span>Notifications</span>
            </button>
            <button type="button"
              className={`sidebar-submenu-item${location.pathname === '/profile' ? ' sidebar-submenu-item-active' : ''}`}
              onClick={() => navTo('/profile')}>
              <span className="sidebar-submenu-tree">└</span>
              <span className="sidebar-submenu-icon"><IconPerson /></span>
              <span>Profile</span>
            </button>
          </div>
        )}

        {/* FAQ & Help Center */}
        <button type="button"
          className={`sidebar-bottom-item${location.pathname === '/faq' ? ' sidebar-bottom-item-active' : ''}`}
          onClick={() => navTo('/faq')}>
          <span className="sidebar-bottom-item-icon"><IconHelp /></span>
          <span className="sidebar-bottom-item-label">FAQ &amp; Help Center</span>
        </button>

        {/* Theme toggle — action button, no active state */}
        <button type="button" className="sidebar-bottom-item"
          onClick={toggleTheme}
          title={dark ? 'Switch to Light mode' : 'Switch to Dark mode'}>
          <span className="sidebar-bottom-item-icon">
            {dark ? <IconSun /> : <IconMoon />}
          </span>
          <span className="sidebar-bottom-item-label">
            {dark ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>

        {/* Logout — action button, no active state */}
        <button type="button" className="sidebar-bottom-item sidebar-bottom-item-danger"
          onClick={handleLogout}>
          <span className="sidebar-bottom-item-icon"><IconLogout /></span>
          <span className="sidebar-bottom-item-label">Logout</span>
        </button>

      </div>
    </aside>
  );
}
