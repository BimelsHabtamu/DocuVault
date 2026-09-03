import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  super_admin:  '/dashboard',
  system_admin: '/dashboard',
  generator:    '/dashboard',
  approver:     '/approver',
  recipient:    '/my-documents',
};

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = (user && ROLE_HOME[user.role]) || '/dashboard';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-gray-100 mb-4 leading-none">403</div>
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm mb-6">
          You don't have permission to access this page.
          {user?.role && (
            <span className="block mt-1 capitalize text-gray-400">
              Your role: <span className="font-semibold text-gray-600">{user.role.replace(/_/g, ' ')}</span>
            </span>
          )}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-100 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate(home)}
            className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
          >
            My Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
