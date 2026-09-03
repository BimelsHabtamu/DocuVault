import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import axiosInstance from '../../api/axiosInstance';
import i18n from '../../i18n';

// ── Page title map ────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  '/dashboard':    'Dashboard',
  '/documents':    'Documents',
  '/generate':     'Generate Document',
  '/templates':    'Templates',
  '/approvals':    'My Approvals',
  '/delivery-logs':'Delivery Logs',
  '/verify-doc':   'Verify Document',
  '/settings':     'My Profile',
};

function getTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find(k => pathname.startsWith(k) && k !== '/');
  return match ? PAGE_TITLES[match] : 'DocuVault';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(d) {
  if (!d) return '';
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

// ── Notification bell (real API) ──────────────────────────────────────────────
function NotificationBell() {
  const navigate          = useNavigate();
  const [open, setOpen]   = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoad] = useState(false);
  const [badge, setBadge]  = useState(0);
  const ref               = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const fetchBadge = useCallback(() => {
    axiosInstance.get('/notifications/unread-count')
      .then(r => setBadge(Number(r.data.count) || 0))
      .catch(() => {});
  }, []);

  const fetchItems = useCallback(() => {
    setLoad(true);
    axiosInstance.get('/notifications')
      .then(r => { setItems(r.data); setBadge(r.data.filter(n => n.unread).length); })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, []);

  useEffect(() => {
    fetchBadge();
    const t = setInterval(fetchBadge, 30000);
    return () => clearInterval(t);
  }, [fetchBadge]);

  const toggle = () => { setOpen(o => !o); if (!open) fetchItems(); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center
          text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors
          ${open ? 'bg-gray-100 text-gray-900' : ''}`}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {badge > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full
            flex items-center justify-center text-[9px] font-bold text-white px-0.5
            border-2 border-white bg-red-500">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl
          shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {loading && (
              <svg className="animate-spin w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {!loading && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No new notifications</p>
              </div>
            )}
            {items.map(n => (
              <button key={n.id}
                onClick={() => { setOpen(false); navigate(n.link || '/dashboard'); }}
                className={`flex items-start gap-3 w-full px-4 py-3 text-left
                  hover:bg-gray-50 transition-colors
                  ${n.unread ? 'bg-blue-50/30' : ''}`}>
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-blue-500"
                  style={{ opacity: n.unread ? 1 : 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 line-clamp-2">{n.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.time)}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); navigate('/dashboard'); }}
              className="text-xs font-semibold w-full text-center text-blue-600
                hover:text-blue-800 transition-colors">
              View all activity →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar() {
  const [value,   setValue]   = useState('');
  const [focused, setFocused] = useState(false);
  const navigate              = useNavigate();

  const handleSubmit = e => {
    e.preventDefault();
    if (value.trim()) {
      navigate(`/documents?search=${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}
      className={`relative transition-all duration-200 ${focused ? 'w-56 sm:w-72' : 'w-36 sm:w-52'}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5
        text-gray-400 pointer-events-none"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search documents…"
        aria-label="Search documents"
        className="w-full h-9 pl-8 pr-3 text-sm rounded-lg border bg-gray-50
          text-gray-900 placeholder-gray-400
          focus:outline-none focus:bg-white transition-all"
        style={{
          borderColor: focused ? '#3b82f6' : '#e5e7eb',
          boxShadow:   focused ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
        }}
      />
    </form>
  );
}
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="w-9 h-9 rounded-lg flex items-center justify-center
        text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
      {isDark
        ? <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 110 10A5 5 0 0112 7z"/>
          </svg>
        : <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
          </svg>
      }
    </button>
  );
}

// ── Language toggle ───────────────────────────────────────────────────────────
function LangToggle() {
  const isAm = i18n.language?.startsWith('am');
  return (
    <button
      onClick={() => i18n.changeLanguage(isAm ? 'en' : 'am')}
      className="h-9 px-2.5 rounded-lg text-xs font-semibold
        text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
      {isAm ? 'EN' : 'አማ'}
    </button>
  );
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [open, setOpen]  = useState(false);
  const ref              = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const initial = user?.full_name?.charAt(0)?.toUpperCase() || 'G';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg
          transition-colors hover:bg-gray-100
          ${open ? 'bg-gray-100' : ''}`}>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
          text-white text-xs font-bold flex-shrink-0"
          style={{ border: '2px solid #e5e7eb' }}>
          {initial}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[13px] font-semibold text-gray-900 leading-tight">
            {user?.full_name}
          </p>
          <p className="text-[11px] text-gray-500 capitalize leading-tight">
            {user?.role?.replace(/_/g, ' ')}
          </p>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl
          shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[13px] font-semibold text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1.5 text-[10px] font-semibold
              px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm
              text-gray-600 hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            My Profile
          </button>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm
                text-red-500 hover:bg-red-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// ── Navbar ────────────────────────────────────────────────────────────────────
export default function GeneratorNavbar({ onMenuClick }) {
  const { pathname } = useLocation();
  const pageTitle    = getTitle(pathname);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center
      justify-between px-4 sm:px-6 flex-shrink-0 z-10"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>

      {/* ── Left: hamburger · page title · search ── */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center
            text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Page title */}
        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap hidden sm:block">
          {pageTitle}
        </p>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-gray-200" />

        {/* Search */}
        <SearchBar />
      </div>

      {/* ── Right: lang · theme · bell · divider · profile ── */}
      <div className="flex items-center gap-1">
        <LangToggle />
        <ThemeToggle />
        <NotificationBell />
        <div className="w-px h-6 bg-gray-200 mx-1.5" />
        <ProfileMenu />
      </div>
    </header>
  );
}
