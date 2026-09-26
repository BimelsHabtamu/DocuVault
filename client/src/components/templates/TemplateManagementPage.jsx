import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOfflineGuard } from '../../hooks/useOfflineGuard';
import { useToast } from '../../hooks/useToast';
import TemplateList from './TemplateList';

export default function TemplateManagementPage() {
  const { t } = useTranslation(['translation', 'templates']);
  const { isOffline } = useOfflineGuard();
  const { showToast } = useToast();

  return (
    <div className="template-management-page">
      <div className="page-header">
        <h1>{t('templates:management.title')}</h1>
        <Link
          to={isOffline ? '#' : '/templates/create'}
          className="btn-primary"
          onClick={(e) => {
            if (isOffline) {
              e.preventDefault();
              showToast('You are offline. Please reconnect to perform this action.', 'error');
            }
          }}
          aria-disabled={isOffline}
          title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}
        >
          {t('templates:management.createTemplate')}
        </Link>
      </div>
      <TemplateList />
    </div>
  );
}
