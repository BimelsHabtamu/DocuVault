import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

/**
 * Wrap any route element with this to require login, and optionally
 * a specific set of roles.
 *
 * <ProtectedRoute allowedRoles={CAN_MANAGE_TEMPLATES}>
 *   <TemplateManagementPage />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { t } = useTranslation(['translation', 'layout']);
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="route-loading">{t('common.loading')}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
