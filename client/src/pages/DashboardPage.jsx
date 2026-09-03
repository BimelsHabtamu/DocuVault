import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axiosInstance from '../api/axiosInstance';
import { SkeletonCard } from '../components/ui/Skeleton';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// KPI card — left-border accent style
function KpiCard({ label, value, sub, icon, iconBg, border, loading }) {
  if (loading) return <SkeletonCard />;
  return (
    <div className={`bg-[var(--color-surface)] rounded-2xl border-l-4 ${border}
      shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            {label}
          </p>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-1 leading-none">{value ?? 0}</p>
          {sub && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Section heading
function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">{children}</h2>
  );
}

// Quick-action button card
function QuickAction({ label, desc, icon, iconBg, to }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-3.5 p-4 bg-[var(--color-surface)] rounded-xl
        border border-[var(--color-border)] shadow-sm
        hover:shadow-md hover:border-indigo-200 transition-all text-left w-full group"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
        group-hover:scale-105 transition-transform ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
        <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-[var(--color-border)] group-hover:text-[#3b5bdb]
        group-hover:translate-x-0.5 transition-all flex-shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  );
}

// Empty state
function EmptyState({ message, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
      {hint && <p className="text-xs text-[var(--color-text-secondary)] mt-1 opacity-60">{hint}</p>}
    </div>
  );
}

// Status badge
const STATUS_BADGE = {
  draft:          'bg-gray-100 text-gray-600',
  pending:        'bg-yellow-100 text-yellow-700',
  signed:         'bg-blue-100 text-blue-700',
  delivered:      'bg-emerald-100 text-emerald-700',
  hand_delivered: 'bg-purple-100 text-purple-700',
  rejected:       'bg-red-100 text-red-600',
};

const STATUS_BAR = {
  draft:          'bg-gray-400',
  pending:        'bg-yellow-400',
  signed:         'bg-blue-500',
  delivered:      'bg-emerald-500',
  hand_delivered: 'bg-purple-500',
  rejected:       'bg-red-400',
};

const ACTION_COLORS = {
  GENERATE: { bg: 'bg-blue-100',   text: 'text-blue-700' },
  SIGN:     { bg: 'bg-purple-100', text: 'text-purple-700' },
  DELIVER:  { bg: 'bg-emerald-100',text: 'text-emerald-700' },
  VERIFY:   { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  PREVIEW:  { bg: 'bg-gray-100',   text: 'text-gray-600' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Activity timeline (shared between admin roles)
// ─────────────────────────────────────────────────────────────────────────────
function ActivityTimeline({ events, loading }) {
  const navigate = useNavigate();
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">Recent Activity</p>
        <button
          onClick={() => navigate('/audit')}
          className="text-xs text-[#3b5bdb] hover:text-[#2f4ac4] font-semibold flex items-center gap-1">
          Full log
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
      {loading ? (
        <div className="px-6 py-4 space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-8 h-8 bg-[var(--color-border)] rounded-lg flex-shrink-0"/>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[var(--color-border)] rounded w-3/4"/>
                <div className="h-2.5 bg-[var(--color-border)] rounded w-1/2"/>
              </div>
            </div>
          ))}
        </div>
      ) : !events?.length ? (
        <EmptyState message="No activity yet" hint="Events appear when documents are generated, signed, or verified"/>
      ) : (
        <div className="px-6 py-2 divide-y divide-[var(--color-border)]">
          {events.map((ev, i) => {
            const ac = ACTION_COLORS[ev.action] || ACTION_COLORS.PREVIEW;
            return (
              <div key={i} className="flex items-center gap-3.5 py-3.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ac.bg}`}>
                  <span className={`text-[9px] font-black ${ac.text}`}>{ev.action?.slice(0, 3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                    {ev.user_name || 'Public'}
                    {ev.doc_uuid && (
                      <span className="text-[var(--color-text-secondary)] font-normal">
                        {' '}on <span className="font-mono">{ev.doc_uuid}</span>
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    {ev.ip_address || '—'}
                  </p>
                </div>
                <span className="text-[10px] text-[var(--color-text-secondary)] flex-shrink-0
                  bg-[var(--color-surface-raised)] px-2 py-0.5 rounded-md">
                  {timeAgo(ev.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document status breakdown (shared widget)
// ─────────────────────────────────────────────────────────────────────────────
function DocStatusWidget({ breakdown, loading }) {
  const total = breakdown?.reduce((s, r) => s + Number(r.count), 0) || 0;
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5">
      <p className="text-sm font-bold text-[var(--color-text-primary)]">Documents by Status</p>
      <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 mb-4">{total} total</p>
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="animate-pulse h-5 bg-[var(--color-border)] rounded"/>)}
        </div>
      ) : total === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">No documents yet</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(STATUS_BAR).map(([status, barClass]) => {
            const row   = breakdown?.find(r => r.status === status);
            const count = row ? Number(row.count) : 0;
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${barClass}`}/>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)] capitalize">
                      {status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-secondary)]">{pct}%</span>
                    <span className="text-xs font-bold text-[var(--color-text-primary)] w-4 text-right">{count}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-[var(--color-surface-raised)] rounded-full overflow-hidden">
                  <div className={`h-full ${barClass} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top templates widget
// ─────────────────────────────────────────────────────────────────────────────
function TopTemplatesWidget({ templates, loading }) {
  const navigate = useNavigate();
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">Top Templates</p>
        <button onClick={() => navigate('/templates')}
          className="text-xs text-[#3b5bdb] hover:text-[#2f4ac4] font-semibold">
          View all →
        </button>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">
          {[1,2,3].map(i => <div key={i} className="animate-pulse h-8 bg-[var(--color-border)] rounded"/>)}
        </div>
      ) : !templates?.length ? (
        <EmptyState message="No templates yet"/>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {templates.slice(0, 5).map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-[11px] font-bold text-[var(--color-text-secondary)] w-4 text-center">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{t.name}</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                  {t.count} document{t.count !== 1 ? 's' : ''} generated
                </p>
              </div>
              <span className="text-xs font-bold text-[#3b5bdb] bg-indigo-50 px-2 py-0.5 rounded-full">
                {t.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page header
// ─────────────────────────────────────────────────────────────────────────────
function DashboardHeader({ user }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
        Welcome back,{' '}
        <span className="font-semibold text-[var(--color-text-primary)]">{user?.full_name}</span>
        <span className="mx-2 text-[var(--color-border)]">·</span>
        <span className="capitalize">{user?.role?.replace(/_/g, ' ')}</span>
        <span className="mx-2 text-[var(--color-border)]">·</span>
        {new Date().toLocaleDateString('en-US', {
          weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
        })}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function SuperAdminDashboard({ user, data, loading }) {
  return (
    <div className="space-y-6">
      <DashboardHeader user={user} />

      {/* KPIs: Generated Today, Pending Approvals, Delivered, Active Templates, Users, Failed Deliveries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard loading={loading} label="Generated Today"    value={data?.docs_today}          border="border-blue-500"    iconBg="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
        />
        <KpiCard loading={loading} label="Pending Approvals"  value={data?.pending_approvals}    border="border-yellow-500"  iconBg="bg-yellow-50"
          icon={<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard loading={loading} label="Delivered"          value={data?.total_delivered}       border="border-emerald-500" iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
        />
        <KpiCard loading={loading} label="Active Templates"   value={data?.active_templates}      border="border-indigo-500"  iconBg="bg-indigo-50"
          icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>}
        />
        <KpiCard loading={loading} label="Total Users"        value={data?.active_users}          border="border-purple-500"  iconBg="bg-purple-50"
          icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
        />
        <KpiCard loading={loading} label="Failed Deliveries"  value={data?.failed_deliveries}     border="border-red-500"     iconBg="bg-red-50"
          icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <QuickAction label="Generate Document" desc="Create a new PDF from a template" to="/generate" iconBg="bg-blue-100"
            icon={<svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          />
          <QuickAction label="Manage Templates" desc="Create, edit or archive templates" to="/templates" iconBg="bg-indigo-100"
            icon={<svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>}
          />
          <QuickAction label="Manage Users" desc="Add, edit or deactivate accounts" to="/users" iconBg="bg-purple-100"
            icon={<svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
          />
          <QuickAction label="Pending Approvals" desc="Review documents awaiting signature" to="/approvals" iconBg="bg-yellow-100"
            icon={<svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <QuickAction label="Audit Logs" desc="Full forensic event trail" to="/audit" iconBg="bg-gray-100"
            icon={<svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>}
          />
          <QuickAction label="System Settings" desc="Configure system preferences" to="/settings/system" iconBg="bg-slate-100"
            icon={<svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
          />
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <ActivityTimeline events={data?.recent_activity} loading={loading}/>
        </div>
        <div className="space-y-5">
          <DocStatusWidget breakdown={data?.status_breakdown} loading={loading}/>
          <TopTemplatesWidget templates={data?.top_templates} loading={loading}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM ADMIN Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function SystemAdminDashboard({ user, data, loading }) {
  return (
    <div className="space-y-6">
      <DashboardHeader user={user} />

      {/* Same KPIs as Super Admin minus system-level ones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard loading={loading} label="Generated Today"   value={data?.docs_today}         border="border-blue-500"    iconBg="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
        />
        <KpiCard loading={loading} label="Pending Approvals" value={data?.pending_approvals}   border="border-yellow-500"  iconBg="bg-yellow-50"
          icon={<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard loading={loading} label="Delivered"         value={data?.total_delivered}      border="border-emerald-500" iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
        />
        <KpiCard loading={loading} label="Active Templates"  value={data?.active_templates}     border="border-indigo-500"  iconBg="bg-indigo-50"
          icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>}
        />
        <KpiCard loading={loading} label="Total Users"       value={data?.active_users}         border="border-purple-500"  iconBg="bg-purple-50"
          icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
        />
        <KpiCard loading={loading} label="Failed Deliveries" value={data?.failed_deliveries}    border="border-red-500"     iconBg="bg-red-50"
          icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      </div>

      {/* Quick Actions (no System Settings) */}
      <div>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <QuickAction label="Generate Document" desc="Create a new PDF from a template" to="/generate" iconBg="bg-blue-100"
            icon={<svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          />
          <QuickAction label="Manage Templates" desc="Create, edit or archive templates" to="/templates" iconBg="bg-indigo-100"
            icon={<svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>}
          />
          <QuickAction label="Manage Users" desc="Add, edit or deactivate accounts" to="/users" iconBg="bg-purple-100"
            icon={<svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
          />
          <QuickAction label="Pending Approvals" desc="Review documents awaiting signature" to="/approvals" iconBg="bg-yellow-100"
            icon={<svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <QuickAction label="Audit Logs" desc="Full forensic event trail" to="/audit" iconBg="bg-gray-100"
            icon={<svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>}
          />
          <QuickAction label="Verify Document" desc="Check document authenticity via QR" to="/verify-doc" iconBg="bg-emerald-100"
            icon={<svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <ActivityTimeline events={data?.recent_activity} loading={loading}/>
        </div>
        <div className="space-y-5">
          <DocStatusWidget breakdown={data?.status_breakdown} loading={loading}/>
          <TopTemplatesWidget templates={data?.top_templates} loading={loading}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT GENERATOR Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function GeneratorDashboard({ user, data, loading }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <DashboardHeader user={user} />

      {/* KPIs: My Generated Docs, Pending Signatures, Delivered, Drafts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard loading={loading} label="My Documents"        value={data?.total_docs}          border="border-blue-500"    iconBg="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
        />
        <KpiCard loading={loading} label="Pending Signatures"  value={data?.pending_approvals}   border="border-yellow-500"  iconBg="bg-yellow-50"
          icon={<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>}
        />
        <KpiCard loading={loading} label="Delivered"           value={data?.total_delivered}      border="border-emerald-500" iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
        />
        <KpiCard loading={loading} label="Drafts"              value={data?.drafts}               border="border-gray-400"    iconBg="bg-gray-100"
          icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>}
        />
      </div>

      {/* Quick Action: Generate Document */}
      <div>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <QuickAction label="Generate Document" desc="Create a new PDF from a template" to="/generate" iconBg="bg-blue-100"
            icon={<svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          />
          <QuickAction label="My Documents" desc="View all documents you've generated" to="/documents" iconBg="bg-indigo-100"
            icon={<svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>}
          />
          <QuickAction label="Signature Requests" desc="Track pending signature requests" to="/signature-requests" iconBg="bg-yellow-100"
            icon={<svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>}
          />
          <QuickAction label="Verify Document" desc="Check document authenticity" to="/verify-doc" iconBg="bg-emerald-100"
            icon={<svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
          />
        </div>
      </div>

      {/* Recent Documents */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--color-text-primary)]">Recent Documents</p>
          <button onClick={() => navigate('/documents')}
            className="text-xs text-[#3b5bdb] hover:text-[#2f4ac4] font-semibold flex items-center gap-1">
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
        ) : !data?.recent_activity?.length ? (
          <EmptyState message="No documents yet" hint="Generate your first document to get started"/>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {data.recent_activity.slice(0, 6).map((ev, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {ev.doc_uuid || 'Document'}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    {ev.action} · {timeAgo(ev.timestamp)}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                  ${ACTION_COLORS[ev.action]?.bg || 'bg-gray-100'}
                  ${ACTION_COLORS[ev.action]?.text || 'text-gray-600'}`}>
                  {ev.action}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVER Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function ApproverDashboard({ user, data, loading }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <DashboardHeader user={user} />

      {/* KPIs: Pending, Approved this week, Rejected this week, Avg Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard loading={loading} label="Pending Approvals"     value={data?.pending_approvals}      border="border-yellow-500"  iconBg="bg-yellow-50"
          icon={<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard loading={loading} label="Approved This Week"    value={data?.approved_this_week}     border="border-emerald-500" iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard loading={loading} label="Rejected This Week"    value={data?.rejected_this_week}     border="border-red-500"     iconBg="bg-red-50"
          icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard loading={loading} label="Avg. Approval Time"    value={data?.avg_approval_time ? `${data.avg_approval_time}h` : '—'} border="border-indigo-500" iconBg="bg-indigo-50"
          sub="average hours"
          icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <QuickAction label="Pending Approvals" desc="Review documents awaiting your signature" to="/approvals" iconBg="bg-yellow-100"
            icon={<svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <QuickAction label="Approval History" desc="View all previously reviewed documents" to="/approval-history" iconBg="bg-indigo-100"
            icon={<svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <QuickAction label="Verify Document" desc="Check document authenticity via QR" to="/verify-doc" iconBg="bg-emerald-100"
            icon={<svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
          />
        </div>
      </div>

      {/* Documents waiting for signature — main focus */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">Waiting for Your Signature</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Documents pending your review and OTP approval
            </p>
          </div>
          <button onClick={() => navigate('/approvals')}
            className="text-xs text-[#3b5bdb] hover:text-[#2f4ac4] font-semibold flex items-center gap-1">
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
                <div className="w-16 h-6 bg-[var(--color-border)] rounded-full"/>
              </div>
            ))}
          </div>
        ) : !data?.pending_docs?.length ? (
          <EmptyState
            message="No pending approvals"
            hint="Documents sent for your signature will appear here"
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {data.pending_docs.map((doc, i) => (
              <button
                key={i}
                onClick={() => navigate(`/approvals/${doc.id || doc.doc_uuid}`)}
                className="w-full flex items-center gap-4 px-6 py-4
                  hover:bg-[var(--color-surface-raised)] transition-colors text-left group"
              >
                <div className="w-9 h-9 bg-yellow-50 rounded-xl flex items-center
                  justify-center flex-shrink-0 group-hover:bg-yellow-100 transition-colors">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {doc.template_name || doc.doc_uuid}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    Requested by {doc.requester || 'Unknown'} · {fmtDate(doc.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
                    Pending
                  </span>
                  <svg className="w-4 h-4 text-[var(--color-border)] group-hover:text-[#3b5bdb] transition-colors"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECIPIENT Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function RecipientDashboard({ user }) {
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get('/recipient/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader user={user}/>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard loading={loading} label="Total Delivered"  value={stats?.total_delivered}      border="border-indigo-500"  iconBg="bg-indigo-50"
          icon={<svg className="w-5 h-5 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
        />
        <KpiCard loading={loading} label="Downloaded"       value={stats?.total_downloaded}     border="border-emerald-500" iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>}
        />
        <KpiCard loading={loading} label="This Week"        value={stats?.delivered_this_week}  border="border-amber-500"   iconBg="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        />
      </div>

      <div>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction label="My Documents" desc="View all documents delivered to you" to="/my-documents" iconBg="bg-indigo-100"
            icon={<svg className="w-4 h-4 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          />
          <QuickAction label="Verify Document" desc="Check a document's authenticity" to="/verify-doc" iconBg="bg-emerald-100"
            icon={<svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
          />
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
          <EmptyState
            message="No documents yet"
            hint="Documents will appear here when delivered to you"
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {stats.recent_documents.map((doc, i) => (
              <button
                key={i}
                onClick={() => navigate(`/my-documents/${doc.doc_uuid}`)}
                className="w-full flex items-center gap-4 px-6 py-4
                  hover:bg-[var(--color-surface-raised)] transition-colors text-left group"
              >
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center
                  justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <svg className="w-4 h-4 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    doc.downloaded_at ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
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

// ─────────────────────────────────────────────────────────────────────────────
// Root — routes to the correct role dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const role     = user?.role;

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Recipient uses its own endpoint; all other roles share /audit/dashboard
  const needsSharedData = role !== 'recipient';

  useEffect(() => {
    if (!needsSharedData) { setLoading(false); return; }
    axiosInstance.get('/audit/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Could not load dashboard data'))
      .finally(() => setLoading(false));
  }, [role]);

  if (role === 'recipient')    return <RecipientDashboard user={user}/>;
  if (role === 'super_admin')  return <SuperAdminDashboard  user={user} data={data} loading={loading}/>;
  if (role === 'system_admin') return <SystemAdminDashboard user={user} data={data} loading={loading}/>;
  if (role === 'generator')    return <GeneratorDashboard   user={user} data={data} loading={loading}/>;
  if (role === 'approver')     return <ApproverDashboard    user={user} data={data} loading={loading}/>;

  // Fallback
  return (
    <div className="flex items-center justify-center h-full py-20">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Unknown role: <code className="font-mono">{role}</code>
      </p>
    </div>
  );
}
