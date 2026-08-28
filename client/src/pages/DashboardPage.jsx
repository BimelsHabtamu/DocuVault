import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axiosInstance from '../api/axiosInstance';
import { SkeletonCard } from '../components/ui/Skeleton';

// ── Recipient Dashboard ───────────────────────────────────────────────────────
function RecipientDashboard({ user }) {
  const navigate = useNavigate();
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    axiosInstance.get('/recipient/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          Welcome back, <span className="font-semibold text-[var(--color-text-primary)]">{user?.full_name}</span>
          <span className="mx-2 text-[var(--color-border)]">·</span>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading
          ? [1,2,3].map(i => <SkeletonCard key={i}/>)
          : [
              { label: 'Total Delivered',  value: stats?.total_delivered ?? 0,     border: 'border-indigo-500', iconBg: 'bg-indigo-50',  color: 'text-[#3b5bdb]' },
              { label: 'Downloaded',       value: stats?.total_downloaded ?? 0,    border: 'border-emerald-500', iconBg: 'bg-emerald-50', color: 'text-emerald-600' },
              { label: 'This Week',        value: stats?.delivered_this_week ?? 0, border: 'border-amber-500',   iconBg: 'bg-amber-50',   color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label}
                className={`bg-[var(--color-surface)] rounded-2xl border-l-4 ${s.border}
                  shadow-sm p-5 hover:shadow-md transition-shadow`}>
                <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {s.label}
                </p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))
        }
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              label: 'My Documents',
              desc: 'View all documents delivered to you',
              to: '/my-documents',
              bg: 'bg-indigo-100',
              iconColor: 'text-[#3b5bdb]',
              path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
            },
            {
              label: 'Verify Document',
              desc: 'Check a document\'s authenticity',
              to: '/verify-doc',
              bg: 'bg-emerald-100',
              iconColor: 'text-emerald-600',
              path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
            },
          ].map(action => (
            <button key={action.to} onClick={() => navigate(action.to)}
              className="flex items-center gap-3.5 p-4 bg-[var(--color-surface)] rounded-xl
                border border-[var(--color-border)] shadow-sm
                hover:shadow-md hover:border-indigo-200 transition-all text-left w-full group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                flex-shrink-0 group-hover:scale-105 transition-transform ${action.bg}`}>
                <svg className={`w-4.5 h-4.5 ${action.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={action.path}/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{action.label}</p>
                <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">{action.desc}</p>
              </div>
              <svg className="w-4 h-4 text-[var(--color-border)] group-hover:text-[#3b5bdb]
                group-hover:translate-x-0.5 transition-all flex-shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Recent documents */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--color-text-primary)]">Recent Documents</p>
          <button onClick={() => navigate('/my-documents')}
            className="text-xs text-[#3b5bdb] font-semibold hover:text-[#2f4ac4] flex items-center gap-1">
            View all
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
        {loading ? (
          <div className="px-6 py-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-9 h-9 bg-[var(--color-border)] rounded-xl flex-shrink-0"/>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[var(--color-border)] rounded w-3/4"/>
                  <div className="h-2.5 bg-[var(--color-border)] rounded w-1/2"/>
                </div>
              </div>
            ))}
          </div>
        ) : !stats?.recent_documents?.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No documents yet</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 opacity-60">
              Documents will appear here when delivered to you
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {stats.recent_documents.map((doc, i) => (
              <button key={i}
                onClick={() => navigate(`/my-documents/${doc.doc_uuid}`)}
                className="w-full flex items-center gap-4 px-6 py-4
                  hover:bg-[var(--color-bg)] transition-colors text-left group">
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center
                  justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <svg className="w-4.5 h-4.5 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {doc.template_name}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 font-mono">
                    {doc.doc_uuid}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    doc.downloaded_at
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {doc.downloaded_at ? 'Downloaded' : 'Delivered'}
                  </span>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                    {fmtDate(doc.delivered_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
const ACTION_COLORS = {
  GENERATE: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SIGN:     { bg: 'bg-purple-100', text: 'text-purple-700' },
  DELIVER:  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  VERIFY:   { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  PREVIEW:  { bg: 'bg-gray-100', text: 'text-gray-600' },
};

const STATUS_COLORS = {
  draft:          { bar: 'bg-gray-400' },
  pending:        { bar: 'bg-yellow-400' },
  signed:         { bar: 'bg-blue-500' },
  delivered:      { bar: 'bg-emerald-500' },
  hand_delivered: { bar: 'bg-purple-500' },
  rejected:       { bar: 'bg-red-400' },
};

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function KpiCard({ label, value, sub, icon, iconBg, border }) {
  if (value === null || value === undefined) return null;
  return (
    <div className={`bg-white rounded-2xl border-l-4 ${border} shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 leading-none">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, desc, icon, bg, to }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav(to)}
      className="flex items-center gap-3.5 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left w-full group"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${bg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-400 truncate mt-0.5">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const role    = user?.role;
  const isAdmin = role === 'super_admin' || role === 'system_admin';

  // Always call hooks before any conditional renders (Rules of Hooks)
  useEffect(() => {
    // Skip dashboard data fetch for recipients — they use /recipient/stats instead
    if (role === 'recipient') { setLoading(false); return; }
    axiosInstance
      .get('/audit/dashboard')
      .then((r) => setData(r.data))
      .catch(() => toast.error('Could not load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  const statusTotal = data?.status_breakdown?.reduce((s, r) => s + Number(r.count), 0) || 0;
  const delivTotal  = data?.delivery_stats?.reduce((s, r) => s + Number(r.count), 0) || 0;

  // Recipient gets their own focused dashboard (after all hooks)
  if (role === 'recipient') {
    return <RecipientDashboard user={user} />;
  }

  // Quick Actions based on role
  const quickActions = [
    {
      label: 'Generate Document',
      desc: 'Create a new PDF from a template',
      to: '/generate',
      bg: 'bg-blue-100',
      roles: ['super_admin', 'system_admin', 'generator', 'approver'],
      icon: (
        <svg className="w-4.5 h-4.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Manage Templates',
      desc: 'Create, edit or archive templates',
      to: '/templates',
      bg: 'bg-indigo-100',
      roles: ['super_admin', 'system_admin'],
      icon: (
        <svg className="w-4.5 h-4.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
    {
      label: 'Pending Approvals',
      desc: 'Review and sign documents',
      to: '/approvals',
      bg: 'bg-yellow-100',
      roles: ['super_admin', 'system_admin', 'approver'],
      icon: (
        <svg className="w-4.5 h-4.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Verify Document',
      desc: 'Check document authenticity via QR',
      to: '/verify',
      bg: 'bg-emerald-100',
      roles: ['super_admin', 'system_admin', 'generator', 'approver', 'recipient'],
      icon: (
        <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      label: 'Manage Users',
      desc: 'Add, edit or deactivate accounts',
      to: '/users',
      bg: 'bg-purple-100',
      roles: ['super_admin', 'system_admin'],
      icon: (
        <svg className="w-4.5 h-4.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'View Audit Logs',
      desc: 'Full forensic event trail',
      to: '/audit',
      bg: 'bg-gray-100',
      roles: ['super_admin', 'system_admin'],
      icon: (
        <svg className="w-4.5 h-4.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ].filter((action) => action.roles.includes(role));

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5 break-words">
            Welcome back, <span className="font-semibold text-gray-700">{user?.full_name}</span>
            <span className="mx-2 text-gray-200">·</span>
            <span className="capitalize">{role?.replace('_', ' ')}</span>
            <span className="mx-2 text-gray-200">·</span>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              label="Docs Generated Today"
              value={data?.docs_today ?? 0}
              border="border-blue-500"
              iconBg="bg-blue-50"
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />

            {(isAdmin || role === 'approver') && (
              <KpiCard
                label="Pending Approvals"
                value={data?.pending_approvals ?? 0}
                border="border-yellow-500"
                iconBg="bg-yellow-50"
                icon={
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            )}

            {(isAdmin || role === 'generator') && (
              <KpiCard
                label="Total Documents"
                value={data?.total_docs ?? 0}
                border="border-indigo-500"
                iconBg="bg-indigo-50"
                icon={
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                }
              />
            )}

            {isAdmin && (
              <KpiCard
                label="Active Users"
                value={data?.active_users ?? 0}
                border="border-emerald-500"
                iconBg="bg-emerald-50"
                icon={
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
              />
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <QuickAction key={action.to} {...action} />
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Activity Timeline */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Activity Timeline</p>
            <a href="/audit" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              Full log
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {loading ? (
            <div className="px-6 py-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-50 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.recent_activity?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-gray-400">No activity yet</p>
              <p className="text-xs text-gray-300 mt-1">Events appear when you generate, sign, or verify documents</p>
            </div>
          ) : (
            <div className="px-6 py-2 divide-y divide-gray-50">
              {data.recent_activity.map((ev, i) => {
                const ac = ACTION_COLORS[ev.action] || ACTION_COLORS.PREVIEW;
                return (
                  <div key={i} className="flex items-center gap-3.5 py-3.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ac.bg}`}>
                      <span className={`text-[9px] font-black ${ac.text}`}>{ev.action.slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {ev.user_name || 'Public'}
                        {ev.doc_uuid && (
                          <span className="text-gray-400 font-normal">
                            {' '}
                            on <span className="font-mono">{ev.doc_uuid}</span>
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{ev.ip_address || '—'}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 bg-gray-50 px-2 py-0.5 rounded-md">
                      {timeAgo(ev.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Document Status */}
          {(isAdmin || role === 'generator') && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-900">Document Status</p>
              <p className="text-[11px] text-gray-400 mt-0.5 mb-4">Breakdown · {statusTotal} total</p>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse h-5 bg-gray-100 rounded" />
                  ))}
                </div>
              ) : statusTotal === 0 ? (
                <p className="text-xs text-gray-300 text-center py-4">No documents generated yet</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(STATUS_COLORS).map(([s, meta]) => {
                    const row = data?.status_breakdown?.find((r) => r.status === s);
                    const count = row ? Number(row.count) : 0;
                    const pct = statusTotal > 0 ? Math.round((count / statusTotal) * 100) : 0;
                    return (
                      <div key={s}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${meta.bar}`} />
                            <span className="text-xs font-medium text-gray-600 capitalize">{s}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">{pct}%</span>
                            <span className="text-xs font-bold text-gray-700 w-4 text-right">{count}</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${meta.bar} rounded-full transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Delivery Stats */}
          {(isAdmin || role === 'generator') && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-900">Delivery Status</p>
              <p className="text-[11px] text-gray-400 mt-0.5 mb-4">From delivery_logs · {delivTotal} sent</p>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse h-5 bg-gray-100 rounded" />
                  ))}
                </div>
              ) : delivTotal === 0 ? (
                <p className="text-xs text-gray-300 text-center py-4">No deliveries yet</p>
              ) : (
                <div className="space-y-2.5">
                  {data?.delivery_stats?.map((d) => {
                    const colors = {
                      sent: 'bg-blue-500',
                      opened: 'bg-emerald-500',
                      queued: 'bg-yellow-400',
                      failed: 'bg-red-400',
                    };
                    return (
                      <div key={d.email_status} className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[d.email_status] || 'bg-gray-300'}`} />
                        <span className="text-xs font-medium text-gray-600 capitalize flex-1">{d.email_status}</span>
                        <span className="text-xs font-bold text-gray-700">{d.count}</span>
                        <span className="text-[10px] text-gray-400 w-8 text-right">
                          {Math.round((d.count / delivTotal) * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}