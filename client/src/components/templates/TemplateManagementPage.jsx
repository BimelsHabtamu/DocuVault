import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TemplateList from './TemplateList';

export default function TemplateManagementPage() {
  const { t } = useTranslation(['translation', 'templates']);
  return (
    <div className="template-management-page">
      <div className="page-header">
        <h1>{t('templates:management.title')}</h1>
        <Link to="/templates/create" className="btn-primary">{t('templates:management.createTemplate')}</Link>
      </div>
      <TemplateList />
    </div>
  );
}
