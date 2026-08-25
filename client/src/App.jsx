import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import ProtectedRoute   from './components/ProtectedRoute';
import Layout           from './components/Layout';

import LandingPage        from './pages/LandingPage';
import PublicVerifyPage   from './pages/PublicVerifyPage';
import LoginPage          from './pages/LoginPage';
import DashboardPage      from './pages/DashboardPage';
import TemplatesPage      from './pages/TemplatesPage';
import TemplateFormPage   from './pages/TemplateFormPage';
import GenerateDocPage    from './pages/GenerateDocPage';
import DocumentsPage      from './pages/DocumentsPage';
import ApprovalsPage      from './pages/ApprovalsPage';
import VerifyPage         from './pages/VerifyPage';
import UsersPage          from './pages/UsersPage';
import AuditPage          from './pages/AuditPage';
import DeliveryLogsPage   from './pages/DeliveryLogsPage';
import SettingsPage       from './pages/SettingsPage';
import SystemConfigurationPage from './pages/SystemConfigurationPage';
import NotFoundPage       from './pages/NotFoundPage';

const SA  = 'super_admin';
const SYS = 'system_admin';
const GEN = 'generator';
const APP = 'approver';
const REC = 'recipient';

const Guard = ({ roles, children }) => (
  <ProtectedRoute allowedRoles={roles}>{children}</ProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Public (no auth) ──────────────────────────── */}
          <Route path="/"       element={<LandingPage />} />
          <Route path="/verify" element={<PublicVerifyPage />} />
          {/* QR codes embed /verify/:doc_uuid — resolves directly */}
          <Route path="/verify/:doc_uuid" element={<PublicVerifyPage />} />
          <Route path="/login"  element={<LoginPage />} />

          {/* ── Protected app shell ───────────────────────── */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>

            {/* Default landing for authenticated users */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Admins only */}
            <Route path="/templates"          element={<Guard roles={[SA,SYS]}><TemplatesPage /></Guard>} />
            <Route path="/templates/new"      element={<Guard roles={[SA,SYS]}><TemplateFormPage /></Guard>} />
            <Route path="/templates/:id/edit" element={<Guard roles={[SA,SYS]}><TemplateFormPage /></Guard>} />
            <Route path="/users"              element={<Guard roles={[SA,SYS]}><UsersPage /></Guard>} />
            <Route path="/audit"              element={<Guard roles={[SA,SYS]}><AuditPage /></Guard>} />
            <Route path="/delivery-logs"      element={<Guard roles={[SA,SYS]}><DeliveryLogsPage /></Guard>} />

            {/* Generate — admins + generator + approver */}
            <Route path="/generate"  element={<Guard roles={[SA,SYS,GEN,APP]}><GenerateDocPage /></Guard>} />

            {/* Documents — all roles */}
            <Route path="/documents" element={<Guard roles={[SA,SYS,GEN,APP,REC]}><DocumentsPage /></Guard>} />

            {/* Approvals — admins + approver */}
            <Route path="/approvals" element={<Guard roles={[SA,SYS,APP]}><ApprovalsPage /></Guard>} />

            {/* In-app verify (sidebar nav link /verify-doc) — all roles */}
            <Route path="/verify-doc" element={<Guard roles={[SA,SYS,GEN,APP,REC]}><VerifyPage /></Guard>} />

            {/* Settings */}
            <Route path="/settings"          element={<Guard roles={[SA,SYS,GEN,APP,REC]}><SettingsPage /></Guard>} />
            <Route path="/settings/password" element={<Navigate to="/settings" replace />} />
            <Route path="/settings/system"   element={<Guard roles={[SA]}><SystemConfigurationPage /></Guard>} />

          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
