import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { approverNavGroups } from '../../config/navConfig.js';
import { useTranslation } from 'react-i18next';

// ── Icon set ──────────────────────────────────────────────────────────────────
const I = ({ d }) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"
    className="w-[18px] h-[18px] flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

const ICONS = {
  home:       <I d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  clock:      <I d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  check:      <I d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  'x-circle': <I d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  doc:        <I d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  'plus-doc': <I d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  approval:   <I d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  shield:     <I d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  user:       <I d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  logout:     <I d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};

// ── Nav item — handles both plain paths and paths with query strings ───────────
// The active check uses pathname + search so ?status=pending and ?status=approved
// highlight different items even though they share the same /approvals path.
function NavItem({ item, onClose }) {
  const { t }   = useTranslation();
  const { pathname, search } = useLocation();
  const icon    = ICONS[item.icon] ?? ICONS.doc;

  // Build the full href so NavLink can compare correctly
  const [itemPath, itemQuery] = item.to.split('?');
  const itemSearch = itemQuery ? `?${itemQuery}` : '';

  // An item is active when its path matches AND (if it has a query) the search matches
  const isActive = itemSearch
    ? pathname === itemPath && search === itemSearch
    : pathname === itemPath && !search;

  return (
    <NavLink
      to={item.to}
      end
      onClick={onClose}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
        transition-all duration-150 outline-none
        focus-visible:ring-2 focus-visible:ring-blue-500/30
        ${isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      <span className={`transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
        {icon}
      </span>
      <span className="truncate flex-1">{t(`nav.${item.translationKey}`)}</span>
      {isActive && (
        <span className="ml-auto w-1 h-4 rounded-full bg-blue-500 flex-shrink-0" />
      )}
    </NavLink>
  );
}

// ── Nav group ─────────────────────────────────────────────────────────────────
function NavGroup({ group, onClose }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-400
        uppercase tracking-[0.14em]">
        {t(`nav.${group.translationKey}`)}
      </p>
      <div className="space-y-0.5">
        {group.items.map(item => (
          <NavItem key={`${item.to}-${item.translationKey}`} item={item} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function ApproverSidebar({ onClose = () => {} }) {
  const { logout } = useAuth();
  const navigate         = useNavigate();
  const { t }            = useTranslation();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="w-[240px] h-screen bg-white border-r border-gray-200
      flex flex-col flex-shrink-0 overflow-hidden">

      {/* ── Brand ── */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center
        gap-3 h-16 flex-shrink-0">
        <img
          src="/logo.png"
          alt="DocuVault"
          className="h-8 w-auto flex-shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-gray-900 leading-tight">DocuVault</p>
          <p className="text-[10px] text-gray-400 leading-tight">Document Approver</p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 min-h-0">
        {approverNavGroups.map(group => (
          <NavGroup key={group.group} group={group} onClose={onClose} />
        ))}
      </nav>

      {/* ── Footer: Logout ── */}
      <div className="border-t border-gray-100 px-3 py-3 space-y-0.5 flex-shrink-0">

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-lg
            text-[13px] font-medium text-gray-500
            hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <span className="text-gray-400 group-hover:text-red-500 transition-colors">
            {ICONS.logout}
          </span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
