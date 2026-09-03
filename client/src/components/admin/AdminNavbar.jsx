import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext.jsx';
import axiosInstance from '../../api/axiosInstance';
import i18n from '../../i18n';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function useOutsideClick(ref, fn) {
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) fn(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn]);
}

// ── Search ────────────────────────────────────────────────────────────────────
function AdminSearch() {
  const [v, setV]         = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div className={`relative transition-all duration-200 ${focused ? 'w-64 sm:w-80' : 'w-40 sm:w-60'}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        value={v}
        onChange={e => setV(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search documents, users…"
        className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border
          bg-gray-50 text-[var(--color-text-primary)]
          placeholder-gray-400
          focus:outline-none focus:bg-white transition-all"
        style={{
          borderColor: focused ? 'var(--admin-accent)' : 'var(--color-border)',
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
        }}
      />
      {v && (
        <button
          onClick={() => setV('')}
          aria-label="Clear"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
            hover:text-gray-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Notification type config ──────────────────────────────────────────────────
// Maps every `type` value the backend can return to an icon, color, and label.
const NOTIF_TYPES = {
  // Source 1 — persistent notifications table
  download:    { color: '#10b981', bg: '#f0fdf4', label: 'Downloaded',    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  approval:    { color: '#f59e0b', bg: '#fffbeb', label: 'Approval',      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  rejection:   { color: '#ef4444', bg: '#fef2f2', label: 'Rejected',      icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
  delivery:    { color: '#3b82f6', bg: '#eff6ff', label: 'Delivered',      icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  signed:      { color: '#8b5cf6', bg: '#f5f3ff', label: 'Signed',        icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  verified:    { color: '#06b6d4', bg: '#ecfeff', label: 'Verified',      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  // Source 2 — live pending signature requests (type is always 'approval')
  // Source 3 — audit log activity
  activity:    { color: '#6b7280', bg: '#f9fafb', label: 'Activity',      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
};
// Default fallback for any unknown type
const NOTIF_DEFAULT = { color: '#6b7280', bg: '#f9fafb', label: 'Event', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };

// Resolve the numeric DB id from strings like "notif-5", "sign-3", "audit-12"
// Only persistent "notif-*" ids can be marked read in the DB
function parsePersistentId(id) {
  if (typeof id === 'string' && id.startsWith('notif-')) {
    return id.replace('notif-', '');
  }
  return null; // sign-* and audit-* are not rows in the notifications table
}

// ── Notification bell ─────────────────────────────────────────────────────────
function AdminNotifications() {
  const navigate = useNavigate();

  const [open,    setOpen]    = useState(false);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);
  // Unread badge count — fetched independently so it's always visible
  const [badge,   setBadge]   = useState(0);

  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  // ── Fetch unread count (badge) — lightweight, runs on mount + interval ──
  const fetchBadge = useCallback(() => {
    axiosInstance.get('/notifications/unread-count')
      .then(r => setBadge(Number(r.data.count) || 0))
      .catch(() => {}); // badge failure is non-critical
  }, []);

  // ── Fetch full notification list — runs when dropdown opens ────────────
  const fetchNotifs = useCallback(() => {
    setLoading(true);
    setError(false);
    axiosInstance.get('/notifications')
      .then(r => {
        setItems(r.data);
        // Sync badge from the live count in the fetched list
        setBadge(r.data.filter(n => n.unread).length);
      })
      .catch(() => {
        setError(true);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Poll badge every 30 s; fetch list on mount too (so badge reflects total unread)
  useEffect(() => {
    fetchBadge();
    const t = setInterval(fetchBadge, 30000);
    return () => clearInterval(t);
  }, [fetchBadge]);

  // ── Mark a single persistent notification as read ───────────────────────
  const markOneRead = useCallback((rawId) => {
    const persistentId = parsePersistentId(rawId);
    if (!persistentId) return; // audit/sign rows not in notifications table
    axiosInstance.post(`/notifications/read/${persistentId}`)
      .then(() => {
        setItems(prev => prev.map(n =>
          n.id === rawId ? { ...n, unread: false } : n
        ));
        setBadge(prev => Math.max(0, prev - 1));
      })
      .catch(() => {}); // silent — UI already navigated
  }, []);

  // ── Mark all persistent notifications as read ────────────────────────────
  const markAllRead = useCallback(() => {
    axiosInstance.post('/notifications/read-all')
      .then(() => {
        setItems(prev => prev.map(n => ({ ...n, unread: false })));
        setBadge(0);
      })
      .catch(() => {});
  }, []);

  const handleToggle = () => {
    const opening = !open;
    setOpen(opening);
    if (opening) fetchNotifs();
  };

  const handleItemClick = (n) => {
    if (n.unread) markOneRead(n.id);
    setOpen(false);
    navigate(n.link || '/dashboard');
  };

  const unreadCount = items.filter(n => n.unread).length;

  return (
    <div className="relative" ref={ref}>

      {/* ── Bell button ── */}
      <button
        onClick={handleToggle}
        aria-label={badge > 0 ? `${badge} unread notifications` : 'Notifications'}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center
          transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-100
          ${open ? 'bg-gray-100 text-gray-900' : ''}`}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {badge > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] rounded-full
            flex items-center justify-center text-[9px] font-bold text-white px-0.5
            border-2 border-white bg-blue-600">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] rounded-xl shadow-xl z-50
          bg-white border border-gray-200 overflow-hidden"
          style={{ maxHeight: '480px', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              {loading && (
                <svg className="animate-spin w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && !loading && (
                <>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    {unreadCount} new
                  </span>
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-gray-400 hover:text-gray-700 font-medium
                      transition-colors underline underline-offset-2">
                    Mark all read
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">

            {/* Loading skeleton */}
            {loading && (
              <div className="divide-y divide-gray-50">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 bg-gray-100 rounded animate-pulse w-4/5" />
                      <div className="h-2 bg-gray-100 rounded animate-pulse w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">Failed to load notifications</p>
                <button onClick={fetchNotifs}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold
                    underline underline-offset-2 transition-colors">
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-700">No new notifications</p>
                <p className="text-xs text-gray-400 text-center px-6">
                  Events like document generation, approvals, and deliveries will appear here.
                </p>
              </div>
            )}

            {/* Real notification list */}
            {!loading && !error && items.length > 0 && (
              <div className="divide-y divide-gray-50">
                {items.map(n => {
                  const cfg = NOTIF_TYPES[n.type] ?? NOTIF_DEFAULT;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      className={`flex items-start gap-3 w-full px-4 py-3.5 text-left
                        hover:bg-gray-50 transition-colors group
                        ${n.unread ? 'bg-blue-50/30' : ''}`}
                    >
                      {/* Type icon */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center
                        flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: cfg.bg }}>
                        <svg className="w-4 h-4" style={{ color: cfg.color }}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round"
                            strokeWidth={1.8} d={cfg.icon}/>
                        </svg>
                      </div>

                      {/* Text + time */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed line-clamp-2
                          ${n.unread ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {n.text}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {timeAgo(n.time)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {n.unread && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5 flex-shrink-0 bg-white">
            <button
              onClick={() => { setOpen(false); navigate('/audit'); }}
              className="text-xs font-semibold w-full text-center text-blue-600
                hover:text-blue-800 transition-colors">
              View full audit log →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Theme + language toggles ──────────────────────────────────────────────────
function AppearanceControls() {
  const { theme, toggleTheme } = useTheme();
  const isAm  = i18n.language?.startsWith('am');
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => i18n.changeLanguage(isAm ? 'en' : 'am')}
        className="h-9 px-2.5 rounded-lg text-xs font-semibold
          text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        {isAm ? 'EN' : 'አማ'}
      </button>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="w-9 h-9 rounded-lg flex items-center justify-center
          text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        {isDark
          ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 110 10A5 5 0 0112 7z"/>
            </svg>
          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
        }
      </button>
    </div>
  );
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function AdminUserMenu() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [open, setOpen]  = useState(false);
  const ref              = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const doLogout = () => { logout(); navigate('/login'); };
  const initial  = user?.full_name?.charAt(0)?.toUpperCase() || 'A';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg
          transition-colors hover:bg-gray-100
          ${open ? 'bg-gray-100' : ''}`}
      >
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center
            text-xs font-bold text-white flex-shrink-0"
          style={{
            backgroundColor: 'var(--admin-accent)',
            border: '2px solid #e5e7eb',
          }}>
          {initial}
        </div>

        {/* Name + role */}
        <div className="text-left hidden sm:block">
          <p className="text-[13px] font-semibold text-gray-900 leading-tight">
            {user?.full_name || '—'}
          </p>
          <p className="text-[11px] text-gray-500 capitalize leading-tight">
            {user?.role?.replace(/_/g, ' ')}
          </p>
        </div>

        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg z-50
          overflow-hidden animate-in bg-white border border-gray-200">

          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[13px] font-semibold text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5
              rounded-full capitalize bg-blue-50 text-blue-700">
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>

          {/* My Profile */}
          <button
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm
              text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4 flex-shrink-0 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            My Profile
          </button>

          {/* Sign out */}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={doLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm
                text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Navbar root ───────────────────────────────────────────────────────────────
export default function AdminNavbar({ onMenuClick, pageTitle }) {
  return (
    <header
      className="h-16 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10 bg-white"
      style={{
        borderBottom: '1px solid var(--admin-navbar-border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center
            text-gray-500 hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Page title */}
        {pageTitle && (
          <div className="hidden sm:flex items-center gap-3">
            <p className="text-sm font-semibold text-gray-900">{pageTitle}</p>
            <div className="w-px h-4 bg-gray-200" />
          </div>
        )}

        <AdminSearch />
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <AppearanceControls />
        <AdminNotifications />
        <div className="w-px h-6 bg-gray-200 mx-1.5" />
        <AdminUserMenu />
      </div>
    </header>
  );
}
