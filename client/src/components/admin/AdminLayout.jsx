import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminNavbar  from './AdminNavbar';

// Map route → page title shown in the navbar breadcrumb
const PAGE_TITLES = {
  '/dashboard':          'Dashboard',
  '/documents':          'Documents',
  '/templates':          'Templates',
  '/users':              'Users',
  '/approvals':          'Approvals',
  '/delivery-logs':      'Deliveries',
  '/reports':            'Reports',
  '/audit':              'Audit Logs',
  '/verify-doc':         'Verify Document',
  '/settings':           'My Profile',
  '/settings/system':    'System Settings',
  '/settings/connections': 'Database Connections',
  '/generate':           'Generate Document',
};

function getTitle(pathname) {
  // Exact match first, then prefix match
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find(k => k !== '/' && pathname.startsWith(k));
  return match ? PAGE_TITLES[match] : '';
}

export default function AdminLayout() {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { pathname } = useLocation();
  const pageTitle    = getTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`
        fixed inset-y-0 left-0 z-40
        lg:static lg:z-auto lg:flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <AdminSidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminNavbar
          onMenuClick={() => setMobileOpen(true)}
          pageTitle={pageTitle}
        />

        {/* Content area */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-gray-50">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-5 sm:py-7">
            <Outlet />
          </div>
        </main>

        {/* Footer bar */}
        <footer
          className="flex-shrink-0 px-6 py-2.5 flex items-center justify-between
            bg-white border-t border-gray-200"
        >
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            DocuVault Admin Console
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            © {new Date().getFullYear()} DocuVault
          </p>
        </footer>
      </div>
    </div>
  );
}
