import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Unauthorized() {
  const { t } = useTranslation(['translation', 'auth']);
  return (
    <div className="unauthorized-page">
      <h1>{t('unauthorized.title')}</h1>
      <p>{t('unauthorized.message')}</p>
      <Link to="/templates">{t('unauthorized.goBack')}</Link>
    </div>
  );
}
