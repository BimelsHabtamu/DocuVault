/**
 * FaqAccordion — role-aware, reusable FAQ list.
 *
 * - In the workspace ("My Settings → FAQ") it filters items by the signed-in
 *   user's role, so every role only sees the questions relevant to them.
 * - On the public landing page (`roleAware={false}`) every item is shown, so
 *   any visitor — logged in or not — can read the full help content.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utils/roles';

const ALL_ROLES = Object.values(ROLES);

/** Which questions apply to which roles (roleAware mode). */
/**
 * Role Guide items — follow a role's normal everyday workflow, so each role only
 * sees the workflow questions that drive their work (never another role's flow).
 */
export const ROLE_GUIDE_ITEMS = [
  { key: 'generateDoc',    roles: [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.GENERATOR] },
  { key: 'requestEsign',   roles: [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.GENERATOR] },
  { key: 'otpApproval',    roles: [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.APPROVER] },
  { key: 'approveReject',  roles: [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.APPROVER] },
  { key: 'secureDelivery', roles: [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.GENERATOR, ROLES.RECIPIENT] },
];

/**
 * General Help items — shared by every role (profile, security, theme, support).
 */
export const GENERAL_ITEMS = [
  { key: 'verifyDoc',     roles: ALL_ROLES },
  { key: 'qrCode',        roles: ALL_ROLES },
  { key: 'profilePassword', roles: ALL_ROLES },
  { key: 'themeSwitch',   roles: ALL_ROLES },
  { key: 'support',       roles: ALL_ROLES },
];

export const FAQ_ITEMS = [...ROLE_GUIDE_ITEMS, ...GENERAL_ITEMS];

export function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? ' faq-item-open' : ''}`}>
      <button
        type="button"
        className="faq-question"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <svg
          className="faq-chevron"
          width="16" height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
}

/**
 * Renders a slice of the FAQ accordion.
 *
 * @param {{
 *   roleAware?: boolean,   // true = filter by the signed-in user's role (default)
 *   group?: 'role'|'general'|'all', // which items to show
 *   query?: string,        // narrows to questions whose translated text matches
 * }} props
 */
export default function FaqAccordion({
  roleAware = true,
  group = 'all',
  query = '',
}) {
  const { t } = useTranslation('layout');
  const { user } = useAuth();

  const role = user?.role;
  const source =
    group === 'role'
      ? ROLE_GUIDE_ITEMS
      : group === 'general'
      ? GENERAL_ITEMS
      : FAQ_ITEMS;

  const q = query.trim().toLowerCase();
  const visible = source.filter((item) => {
    const allowed = !roleAware || !role || item.roles.includes(role);
    if (!allowed) return false;
    if (!q) return true;
    const text = `${t(`faq.items.${item.key}.q`)} ${t(`faq.items.${item.key}.a`)}`.toLowerCase();
    return text.includes(q);
  });

  return (
    <div className="faq-list">
      {visible.map(({ key }) => (
        <FaqItem
          key={key}
          q={t(`faq.items.${key}.q`)}
          a={t(`faq.items.${key}.a`)}
        />
      ))}
    </div>
  );
}