/**
 * FaqPage — /faq
 * Role-aware help page. Each FAQ item is an accordion panel and only the
 * questions relevant to the signed-in user's role are shown.
 */
import { useTranslation } from 'react-i18next';
import FaqAccordion from '../components/common/FaqAccordion';

export default function FaqPage() {
  const { t } = useTranslation('layout');

  return (
    <div className="faq-page">
      <h1 className="faq-page-title">{t('faq.title')}</h1>
      <p className="faq-page-subtitle">{t('faq.subtitle')}</p>
      <FaqAccordion />
    </div>
  );
}