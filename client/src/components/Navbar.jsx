import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext.jsx';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

// ── Search bar ────────────────────────────────────────────
function SearchBar() {
  const { t } = useTranslation();
  const [value,  setValue]  = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div className={`relative transition-all duration-200 ${focused ? 'w-52 sm:w-80' : 'w-40 sm:w-64'}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
        text-[var(--color-text-secondary)] pointer-events-none"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('nav.search', 'Search documents, templates...')}
        className="w-full pl-9 pr-8 py-2
          bg-[var(--color-surface-raised)] border border-[var(--color-border)]
          rounded-xl text-sm text-[var(--color-text-primary)]
          placeholder-[var(--color-text-secondary)]
          focus:outline-none focus:ring-2 focus:ring-indigo-500/20
          focus:border-indigo-400 focus:bg-[var(--color-surface)]
          transition-all"
      />
      {value && (
        <button onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2
            text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Notification bell ─────────────────────────────────────
function NotificationBell() {
  const { t } = useTranslation();
  const navigate              = useNavigate();
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const unreadCount = items.filter(n => n.unread).length;

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    axiosInstance.get('/notifications')
      .then(res => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const TYPE_ICON = {
    approval: (
      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
    ),
    activity: (
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
      </div>
    ),
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors
          ${open
            ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]'
          }`}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4
            bg-red-500 text-white text-[9px] font-bold rounded-full
            flex items-center justify-center border-2 border-[var(--color-surface)] px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80
          bg-[var(--color-surface)] border border-[var(--color-border)]
          rounded-2xl shadow-xl z-50 overflow-hidden animate-in">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            border-b border-[var(--color-border)]">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {t('notifications.title')}
            </p>
            <div className="flex items-center gap-2">
              {loading && (
                <svg className="animate-spin w-3.5 h-3.5 text-[var(--color-text-secondary)]"
                  fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">
                  {unreadCount} {t('notifications.new')}
                </span>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)]">
            {items.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-8 h-8 text-[var(--color-text-secondary)] mb-2 opacity-40"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <p className="text-xs text-[var(--color-text-secondary)]">{t('notifications.none')}</p>
              </div>
            )}
            {items.map(n => (
              <button key={n.id}
                onClick={() => { setOpen(false); navigate(n.link || '/dashboard'); }}
                className={`flex items-start gap-3 w-full px-4 py-3 text-left
                  hover:bg-[var(--color-surface-raised)] transition-colors
                  ${n.unread ? 'bg-indigo-50/30' : ''}`}
              >
                {TYPE_ICON[n.type] || TYPE_ICON.activity}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--color-text-primary)] leading-relaxed line-clamp-2">
                    {n.text}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    {timeAgo(n.time)}
                  </p>
                </div>
                {n.unread && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3b5bdb] flex-shrink-0 mt-1"/>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--color-border)] px-4 py-2.5">
            <button onClick={() => { setOpen(false); navigate('/audit'); }}
              className="text-xs text-[#3b5bdb] hover:text-[#2f4ac4] font-medium w-full text-center transition-colors">
              {t('notifications.audit')} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Appearance controls (theme + language) ────────────────
function AppearanceControls() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isAm = i18n.language.startsWith('am');
  const toggleLanguage = () => i18n.changeLanguage(isAm ? 'en' : 'am');
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center gap-1">
      {/* Language */}
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={t('actions.language')}
        className="h-9 px-2.5 rounded-xl text-xs font-semibold
          text-[var(--color-text-secondary)]
          hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]
          transition-colors"
      >
        {isAm ? 'EN' : 'አማ'}
      </button>

      {/* Theme */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={t('actions.toggleTheme')}
        className="w-9 h-9 rounded-xl flex items-center justify-center
          text-[var(--color-text-secondary)]
          hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]
          transition-colors"
      >
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

// ── User menu ─────────────────────────────────────────────
function UserMenu() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const { t }            = useTranslation();
  const [open, setOpen]  = useState(false);
  const ref              = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const handleLogout = () => { logout(); navigate('/login'); };
  const initial      = user?.full_name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl transition-colors
          ${open
            ? 'bg-[var(--color-surface-raised)]'
            : 'hover:bg-[var(--color-surface-raised)]'
          }`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500
          flex items-center justify-center ring-2 ring-[var(--color-border)] flex-shrink-0">
          <span className="text-xs font-bold text-white">{initial}</span>
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-tight">
            {user?.full_name || '—'}
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)] capitalize leading-tight">
            {user?.role?.replace(/_/g, ' ')}
          </p>
        </div>
        <svg className={`w-3.5 h-3.5 text-[var(--color-text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56
          bg-[var(--color-surface)] border border-[var(--color-border)]
          rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden animate-in">

          {/* User info */}
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {user?.full_name}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">{user?.email}</p>
            <span className="inline-block mt-1.5 text-[10px] font-semibold
              bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Menu items */}
          {[
            {
              label: t('nav.mySettings', 'My Settings'),
              icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
              onClick: () => navigate('/settings'),
            },
          ].map(item => (
            <button key={item.label}
              onClick={() => { setOpen(false); item.onClick(); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm
                text-[var(--color-text-secondary)]
                hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]
                transition-colors">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon}/>
              </svg>
              {item.label}
            </button>
          ))}

          {/* Sign out */}
          <div className="border-t border-[var(--color-border)] mt-1 pt-1">
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm
                text-red-500 hover:bg-red-50 transition-colors">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              {t('actions.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Navbar root ───────────────────────────────────────────
export default function Navbar({ onMenuClick }) {
  return (
    <header className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)]
      flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10 shadow-sm">

      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center
            text-[var(--color-text-secondary)]
            hover:bg-[var(--color-surface-raised)] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <SearchBar />
      </div>

      <div className="flex items-center gap-1.5">
        <AppearanceControls />
        <NotificationBell />
        <div className="w-px h-6 bg-[var(--color-border)] mx-1.5"/>
        <UserMenu />
      </div>
    </header>
  );
}
