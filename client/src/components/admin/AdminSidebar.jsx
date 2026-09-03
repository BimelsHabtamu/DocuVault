import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Icon helper ───────────────────────────────────────────────────────────────
const Icon = ({ d, d2 }) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"
    className="w-[18px] h-[18px] flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    {d2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d2} />}
  </svg>
);

const ICONS = {
  dashboard:  <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  documents:  <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  templates:  <Icon d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />,
  users:      <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  approvals:  <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  deliveries: <Icon d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  reports:    <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  audit:      <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  verify:     <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  profile:    <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  settings:   <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  database:   <Icon d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3M4 7v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3M4 17c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" />,
  logout:     <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }) {
  if (collapsed) {
    return (
      <div className="my-2 h-px mx-3"
        style={{ backgroundColor: 'var(--admin-sidebar-border)' }} />
    );
  }
  return (
    <p className="mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest select-none"
      style={{ color: 'var(--admin-sidebar-muted)' }}>
      {label}
    </p>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ to, icon, label, collapsed, onClose, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center rounded-lg text-[13px] font-medium w-full',
          'transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-blue-500/40',
          collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-3 px-3 py-2',
          isActive
            ? 'text-blue-700 font-semibold'
            : 'hover:bg-gray-50',
        ].join(' ')
      }
      style={({ isActive }) => ({
        backgroundColor: isActive ? 'var(--admin-sidebar-active-bg)' : undefined,
        color: isActive ? 'var(--admin-accent)' : 'var(--admin-sidebar-text)',
        borderLeft: isActive && !collapsed ? '2px solid var(--admin-accent)' : '2px solid transparent',
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? 'var(--admin-accent)' : 'var(--admin-sidebar-muted)' }}
            className="transition-colors">
            {icon}
          </span>

          {!collapsed && (
            <span className="flex-1 truncate leading-tight">{label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function AdminSidebar({ collapsed, setCollapsed, onClose }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const isSuperAdmin     = user?.role === 'super_admin';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside
      className={[
        collapsed ? 'w-[64px]' : 'w-[240px]',
        'flex-shrink-0 h-screen flex flex-col',
        'transition-[width] duration-300 ease-in-out relative',
      ].join(' ')}
      style={{
        backgroundColor: 'var(--admin-sidebar-bg)',
        borderRight: '1px solid var(--admin-sidebar-border)',
        boxShadow: '1px 0 0 0 var(--admin-sidebar-border)',
      }}
    >
      {/* ── Logo / Brand ─────────────────────────────────────────────────── */}
      <div
        className={`flex items-center h-16 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5 gap-3'}`}
        style={{ borderBottom: '1px solid var(--admin-sidebar-border)' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            backgroundColor: 'var(--admin-accent-pale)',
            border: '1px solid var(--admin-sidebar-border)',
          }}>
          <img src="/logo.png" alt="DocuVault" className="w-6 h-6 object-contain" />
        </div>

        {!collapsed && (
          <div className="overflow-hidden min-w-0">
            <p className="font-bold text-[14px] tracking-tight leading-tight truncate"
              style={{ color: 'var(--admin-sidebar-text)' }}>
              DocuVault
            </p>
            <p className="text-[10px] font-medium leading-tight truncate"
              style={{ color: 'var(--admin-sidebar-muted)' }}>
              Admin Console
            </p>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ──────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[30px] w-6 h-6 rounded-full z-20
          flex items-center justify-center shadow-sm
          hover:shadow-md transition-shadow"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--admin-sidebar-border)',
          color: 'var(--admin-sidebar-muted)',
        }}
      >
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto sidebar-scroll min-h-0 space-y-0.5">

        <SectionLabel label="Main" collapsed={collapsed} />
        <NavItem to="/dashboard" icon={ICONS.dashboard} label="Dashboard"
          collapsed={collapsed} onClose={onClose} end />

        <SectionLabel label="Management" collapsed={collapsed} />
        <NavItem to="/documents"     icon={ICONS.documents}  label="Documents"  collapsed={collapsed} onClose={onClose} />
        <NavItem to="/templates"     icon={ICONS.templates}  label="Templates"  collapsed={collapsed} onClose={onClose} />
        <NavItem to="/users"         icon={ICONS.users}      label="Users"      collapsed={collapsed} onClose={onClose} />
        <NavItem to="/approvals"     icon={ICONS.approvals}  label="Approvals"  collapsed={collapsed} onClose={onClose} />
        <NavItem to="/delivery-logs" icon={ICONS.deliveries} label="Deliveries" collapsed={collapsed} onClose={onClose} />

        <SectionLabel label="Analytics" collapsed={collapsed} />
        <NavItem to="/reports" icon={ICONS.reports} label="Reports"    collapsed={collapsed} onClose={onClose} />
        <NavItem to="/audit"   icon={ICONS.audit}   label="Audit Logs" collapsed={collapsed} onClose={onClose} />

        <SectionLabel label="Verification" collapsed={collapsed} />
        <NavItem to="/verify-doc" icon={ICONS.verify} label="Verify Document" collapsed={collapsed} onClose={onClose} />

        {/* Super Admin only */}
        {isSuperAdmin && (
          <>
            <SectionLabel label="System" collapsed={collapsed} />
            <NavItem to="/settings/system"      icon={ICONS.settings} label="System Settings"      collapsed={collapsed} onClose={onClose} />
            <NavItem to="/settings/connections" icon={ICONS.database} label="Database Connections"  collapsed={collapsed} onClose={onClose} />
          </>
        )}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-2 py-3 space-y-0.5"
        style={{ borderTop: '1px solid var(--admin-sidebar-border)' }}
      >
        {/* My Profile */}
        <NavItem to="/settings" icon={ICONS.profile} label="My Profile"
          collapsed={collapsed} onClose={onClose} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={[
            'group flex items-center rounded-lg text-[13px] font-medium w-full',
            'transition-colors hover:bg-red-50',
            collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-3 px-3 py-2',
          ].join(' ')}
          style={{ color: '#6b7280' }}
        >
          <span className="group-hover:text-red-500 transition-colors text-gray-400">
            {ICONS.logout}
          </span>
          {!collapsed && (
            <span className="group-hover:text-red-500 transition-colors">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}
