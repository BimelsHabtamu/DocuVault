/**
 * FaqPage — /faq
 * Role-aware, personalized help page.
 *
 * The page adapts itself to the signed-in user's current role:
 *   - a role badge and the personalized intro (faq.personalized) greet them,
 *   - the "Role Guide — {current role}" section shows only the workflow-driven
 *     questions for that role (never another role's flow),
 *   - the "General Help" section shows the shared questions every role needs.
 *
 * Search filters both sections live by matching the question/answer text.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { ROLES, ROLE_LABELS } from '../utils/roles';
import FaqAccordion from '../components/common/FaqAccordion';

const ROLE_BADGE_KEYS = {
  [ROLES.SUPER_ADMIN]: 'superAdmin',
  [ROLES.SYSTEM_ADMIN]: 'systemAdmin',
  [ROLES.GENERATOR]: 'generator',
  [ROLES.APPROVER]: 'approver',
  [ROLES.RECIPIENT]: 'recipient',
};

export default function FaqPage() {
  const { t } = useTranslation('layout');
  const { user } = useAuth();
  const [query, setQuery] = useState('');

  const role = user?.role;
  const roleKey = ROLE_BADGE_KEYS[role];
  const roleLabel = roleKey ? t(`roles.${roleKey}`) : '';

  return (
    <div className="faq-page">
      <h1 className="faq-page-title">{t('faq.title')}</h1>

      <span className="faq-role-badge">
        {t('faq.roleBadgeLabel')}:{' '}
        <strong data-role-badge aria-live="polite">{roleLabel}</strong>
      </span>

      <p className="faq-page-personalized">
        {t('faq.personalized', { role: roleLabel })}
      </p>

      <label className="faq-search" htmlFor="faq-search-input">
        <span className="faq-search-label">{t('faq.searchLabel')}</span>
        <input
          id="faq-search-input"
          type="search"
          className="faq-search-input"
          placeholder={t('faq.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls="faq-role-group general-faq-group"
        />
      </label>

      <section className="faq-group faq-role-group" id="faq-role-group">
        <h2 className="faq-group-title">
          {t('faq.roleGuideTitle', { role: roleLabel })}
        </h2>
        <FaqAccordion group="role" query={query} />
      </section>

      <section className="faq-group" id="general-faq-group">
        <h2 className="faq-group-title">{t('faq.generalHelpTitle')}</h2>
        <p className="faq-group-intro">{t('faq.generalHelpIntro')}</p>
        <FaqAccordion group="general" query={query} />
      </section>

      <section className="faq-contact">
        <h2 className="faq-contact-title">{t('faq.contactTitle')}</h2>
        <p className="faq-contact-text">{t('faq.contactText')}</p>
        <a
          className="faq-contact-btn"
          href={`mailto:${t('faq.contactEmail')}`}
        >
          {t('faq.contactButton')}
        </a>
      </section>
    </div>
  );
}
