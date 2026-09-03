import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { navGroups, recipientNavGroups } from '../config/navConfig.js';
import { useTranslation } from 'react-i18next';

// ── Icon library ──────────────────────────────────────────────────────────────
const ICONS = {
  home: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
    </svg>
  ),
  users: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>
  ),
  lock: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
    </svg>
  ),
  template: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
    </svg>
  ),
  database: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3M4 7v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3M4 17c0 1.657 3.582 3 8 3s8-1.343 8-3v-5"/>
    </svg>
  ),
  map: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
    </svg>
  ),
  'plus-doc': (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  ),
  doc: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  ),
  pen: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
    </svg>
  ),
  'check-circle': (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  ),
  history: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  ),
  mail: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  ),
  shield: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
    </svg>
  ),
  clipboard: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
    </svg>
  ),
  chart: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>
  ),
  cog: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  ),
  server: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
    </svg>
  ),
  bell: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    </svg>
  ),
  logout: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
    </svg>
  ),
};

// ── Single nav item ───────────────────────────────────────────────────────────
function NavItem({ item, collapsed, onClose }) {
  const { t } = useTranslation();

  return (
    <NavLink
      to={item.to}
      end
      onClick={onClose}
      title={collapsed ? t(`nav.${item.translationKey}`) : undefined}
      className={({ isActive }) =>
        `flex items-center rounded-xl text-[13px] font-medium transition-all duration-150 group
         outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
         ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2'}
         ${isActive
           ? 'bg-blue-600 text-white'
           : 'text-white/80 hover:bg-white/10 hover:text-white'
         }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`flex-shrink-0 transition-colors
            ${isActive
              ? 'text-white'
              : 'text-white/60 group-hover:text-white'
            }`}>
            {ICONS[item.icon]}
          </span>

          {!collapsed && (
            <span className="truncate leading-tight flex-1">
              {t(`nav.${item.translationKey}`)}
            </span>
          )}

          {!collapsed && isActive && (
            <span className="ml-auto w-1 h-4 rounded-full bg-white/60 flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Sidebar root ──────────────────────────────────────────────────────────────
export default function Sidebar({ collapsed, setCollapsed, onClose }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    const isRecipient = user?.role === 'recipient';
    logout();
    navigate(isRecipient ? '/' : '/login');
  };

  const sourceGroups = user?.role === 'recipient' ? recipientNavGroups : navGroups;

  const visibleGroups = sourceGroups
    .map(g => ({
      ...g,
      items: g.items.filter(i => i.roles.includes(user?.role)),
    }))
    .filter(g => g.items.length > 0);

  return (
    <aside
      className={`
        ${collapsed ? 'w-[68px]' : 'w-[240px]'}
        flex-shrink-0 h-screen
        bg-black border-r border-white/10
        flex flex-col
        transition-[width] duration-300 ease-in-out relative
        shadow-sm
      `}
    >
      {/* ── Logo ── */}
      <div className={`flex items-center h-16 border-b border-white/10 flex-shrink-0
        ${collapsed ? 'justify-center' : 'px-4 gap-3'}`}>
        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-white/10
          flex items-center justify-center bg-white/5">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
        </div>

        {!collapsed && (
          <div className="overflow-hidden leading-tight">
            <p className="text-white font-bold text-[13px] tracking-tight">
              DocuVault
            </p>
            <p className="text-[10px] text-white/50 font-medium">
              Document Management
            </p>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[30px] w-6 h-6 rounded-full
          bg-black border border-white/20
          flex items-center justify-center
          text-blue-300/70 hover:text-blue-200
          hover:border-blue-400/50
          transition-colors z-20 shadow-md"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      {/* ── Navigation groups ── */}
      <nav className="flex-1 flex flex-col py-3 px-2 min-h-0 overflow-y-auto sidebar-scroll">
        <div className="space-y-0.5 flex-1">
          {visibleGroups.map((group, gi) => (
            <div key={group.group} className={gi > 0 ? 'pt-3' : ''}>
              {/* Group label */}
              {!collapsed ? (
                <p className="text-[9px] font-bold text-white/40 uppercase
                  tracking-[0.14em] px-3 pb-1.5 pt-0.5">
                  {t(`nav.${group.translationKey}`)}
                </p>
              ) : (
                gi > 0 && (
                  <div className="py-1.5 flex justify-center">
                    <div className="w-5 h-px bg-white/10" />
                  </div>
                )
              )}

              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem
                    key={`${item.to}-${item.translationKey}`}
                    item={item}
                    collapsed={collapsed}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Footer: My Settings + Sign Out ── */}
      <div className="border-t border-white/10 px-2 py-3 flex-shrink-0 space-y-0.5">

        {/* My Settings */}
        <NavLink
          to="/settings"
          end
          onClick={onClose}
          title={collapsed ? t('nav.mySettings') : undefined}
          className={({ isActive }) =>
            `flex items-center rounded-xl text-[13px] font-medium transition-colors w-full
             ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2'}
             ${isActive
               ? 'bg-blue-600 text-white'
               : 'text-white/80 hover:bg-white/10 hover:text-white'
             }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`}>
                {ICONS.cog}
              </span>
              {!collapsed && <span className="truncate">{t('nav.mySettings')}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto w-1 h-4 rounded-full bg-white/60 flex-shrink-0" />
              )}
            </>
          )}
        </NavLink>

        {/* Sign Out */}
        <button
          onClick={handleLogout}
          title={collapsed ? t('actions.signOut') : undefined}
          className={`flex items-center rounded-xl text-[13px] font-medium
            text-white/60
            hover:bg-red-600/30 hover:text-red-400
            transition-colors w-full
            ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2'}`}
        >
          {ICONS.logout}
          {!collapsed && <span>{t('actions.signOut')}</span>}
        </button>
      </div>
    </aside>
  );
}
