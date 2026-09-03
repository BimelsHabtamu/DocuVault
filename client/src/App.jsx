import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import ProtectedRoute        from './components/ProtectedRoute';
import Layout                from './components/Layout';
import AdminLayout           from './components/admin/AdminLayout';
import GeneratorLayout       from './components/generator/GeneratorLayout';
import ApproverLayout        from './components/approver/ApproverLayout';

import AdminDashboardPage        from './pages/AdminDashboardPage';
import SystemAdminDashboardPage  from './pages/SystemAdminDashboardPage';
import GeneratorDashboardPage    from './pages/GeneratorDashboardPage';
import ApproverDashboardPage     from './pages/ApproverDashboardPage';
import LandingPage               from './pages/LandingPage';
import PublicVerifyPage          from './pages/PublicVerifyPage';
import LoginPage                 from './pages/LoginPage';
import SetPasswordPage           from './pages/SetPasswordPage';
import AccessDeniedPage          from './pages/AccessDeniedPage';
import VerifyEmailPage           from './pages/VerifyEmailPage';
import TemplatesPage             from './pages/TemplatesPage';
import TemplateFormPage          from './pages/TemplateFormPage';
import TemplateEditorPage        from './pages/TemplateEditorPage';
import GenerateDocPage           from './pages/GenerateDocPage';
import DocumentsPage             from './pages/DocumentsPage';
import ApprovalsPage             from './pages/ApprovalsPage';
import DocumentReviewPage        from './pages/DocumentReviewPage';
import VerifyPage                from './pages/VerifyPage';
import UsersPage                 from './pages/UsersPage';
import AuditPage                 from './pages/AuditPage';
import ReportsPage               from './pages/ReportsPage';
import DeliveryLogsPage          from './pages/DeliveryLogsPage';
import SettingsPage              from './pages/SettingsPage';
import SystemConfigurationPage   from './pages/SystemConfigurationPage';
import DatabaseConnectionsPage   from './pages/DatabaseConnectionsPage';
import RecipientInboxPage        from './pages/RecipientInboxPage';
import RecipientDocPage          from './pages/RecipientDocPage';
import RecipientAccessPage       from './pages/RecipientAccessPage';
import RecipientQrVerifyPage     from './pages/RecipientQrVerifyPage';
import NotFoundPage              from './pages/NotFoundPage';

const SA  = 'super_admin';
const SYS = 'system_admin';
const GEN = 'generator';
const APP = 'approver';
const REC = 'recipient';

// ─── RoleShell ────────────────────────────────────────────────────────────────
// Picks the correct layout for the authenticated user's role.
// Because this sits inside the single unified ProtectedRoute, user is always
// defined and authenticated by the time this renders.
function RoleShell() {
  const { user } = useAuth();
  const role = user?.role;

  if (role === SA || role === SYS) return <AdminLayout />;
  if (role === GEN)                return <GeneratorLayout />;
  if (role === APP)                return <ApproverLayout />;
  if (role === REC)                return <Layout />;

  // Unknown role — render the outlet directly so the page can still show
  return <Outlet />;
}

// ─── Role-gated page wrapper ──────────────────────────────────────────────────
// Renders AccessDeniedPage when the authenticated user's role is not allowed.
// Used inside the unified shell for routes that only some roles can reach.
const Guard = ({ roles, children }) => {
  const { user, authLoading } = useAuth();
  if (authLoading) return null;
  if (!roles.includes(user?.role)) return <AccessDeniedPage />;
  return children;
};

// ─── Dashboard router ─────────────────────────────────────────────────────────
// /dashboard is shared by all roles — each gets their own page component.
function DashboardRouter() {
  const { user } = useAuth();
  const role = user?.role;

  if (role === SA)  return <AdminDashboardPage />;
  if (role === SYS) return <SystemAdminDashboardPage />;
  if (role === GEN) return <GeneratorDashboardPage />;
  if (role === APP) return <ApproverDashboardPage />;
  // Recipient home is /my-documents, but if they land here show a redirect
  if (role === REC) return <Navigate to="/my-documents" replace />;

  return null;
}

// ─── Approver-only dashboard at /approver ─────────────────────────────────────
function ApproverHomeRouter() {
  const { user } = useAuth();
  if (user?.role !== APP) return <AccessDeniedPage />;
  return <ApproverDashboardPage />;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Public routes ───────────────────────────────────────────── */}
          <Route path="/"                  element={<LandingPage />} />
          <Route path="/verify"            element={<PublicVerifyPage />} />
          <Route path="/verify/:doc_uuid"  element={<PublicVerifyPage />} />
          <Route path="/login"             element={<LoginPage />} />
          <Route path="/set-password"      element={<SetPasswordPage />} />
          <Route path="/verify-email"      element={<VerifyEmailPage />} />
          <Route path="/access-denied"     element={<AccessDeniedPage />} />
          {/* Recipient no-login document access flow */}
          <Route path="/doc/:token"        element={<RecipientAccessPage />} />
          <Route path="/doc/:token/verify" element={<RecipientQrVerifyPage />} />

          {/* ── Authenticated shell ─────────────────────────────────────── */}
          {/*
            ONE pathless layout route wraps all authenticated pages.
            ProtectedRoute checks isAuthenticated only — no role filtering here.
            RoleShell then picks the correct layout (navbar + sidebar) for the
            user's role. Every route is declared exactly once, so there are no
            competing shells and no redirect loops.
          */}

          {/* ── Document review — full-page, no sidebar, approver only ── */}
          {/* Must be OUTSIDE RoleShell so it gets its own clean full-page layout */}
          <Route
            element={<ProtectedRoute><Guard roles={[APP, SA, SYS]}><Outlet /></Guard></ProtectedRoute>}
          >
            <Route path="/review/:token" element={<DocumentReviewPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <RoleShell />
              </ProtectedRoute>
            }
          >
            {/* ── Dashboard — each role gets their own component ── */}
            <Route path="/dashboard" element={<DashboardRouter />} />

            {/* ── Approver primary entry point ── */}
            <Route path="/approver"  element={<ApproverHomeRouter />} />

            {/* ── Documents ── */}
            <Route path="/documents" element={<DocumentsPage />} />

            {/* ── Generate ── */}
            <Route path="/generate"  element={<GenerateDocPage />} />

            {/* ── Verify ── */}
            <Route path="/verify-doc" element={<VerifyPage />} />

            {/* ── Approvals (admin + approver + generator) ── */}
            <Route path="/approvals"  element={<ApprovalsPage />} />

            {/* ── Templates (admin only) ── */}
            <Route path="/templates"           element={<Guard roles={[SA, SYS]}><TemplatesPage /></Guard>} />
            <Route path="/templates/new"       element={<Guard roles={[SA, SYS]}><TemplateEditorPage /></Guard>} />
            <Route path="/templates/:id/edit"  element={<Guard roles={[SA, SYS]}><TemplateEditorPage /></Guard>} />
            {/* Legacy editor kept accessible at /templates/:id/edit-legacy */}
            <Route path="/templates/:id/edit-legacy" element={<Guard roles={[SA, SYS]}><TemplateFormPage /></Guard>} />

            {/* ── Users (admin only) ── */}
            <Route path="/users"  element={<Guard roles={[SA, SYS]}><UsersPage /></Guard>} />

            {/* ── Delivery logs (admin only) ── */}
            <Route path="/delivery-logs"  element={<Guard roles={[SA, SYS]}><DeliveryLogsPage /></Guard>} />

            {/* ── Audit (admin only) ── */}
            <Route path="/audit"  element={<Guard roles={[SA, SYS]}><AuditPage /></Guard>} />

            {/* ── Reports (admin only) ── */}
            <Route path="/reports"  element={<Guard roles={[SA, SYS]}><ReportsPage /></Guard>} />

            {/* ── Recipient inbox ── */}
            <Route path="/my-documents"            element={<Guard roles={[REC]}><RecipientInboxPage /></Guard>} />
            <Route path="/my-documents/:doc_uuid"  element={<Guard roles={[REC]}><RecipientDocPage /></Guard>} />

            {/* ── Settings ── */}
            <Route path="/settings"              element={<SettingsPage />} />
            <Route path="/settings/password"     element={<Navigate to="/settings" replace />} />
            <Route path="/settings/system"       element={<Guard roles={[SA]}><SystemConfigurationPage /></Guard>} />
            <Route path="/settings/connections"  element={<Guard roles={[SA]}><DatabaseConnectionsPage /></Guard>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
