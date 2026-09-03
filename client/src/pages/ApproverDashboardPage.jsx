import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { SkeletonTableRow } from '../components/ui/Skeleton';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(d) {
  return d
    ? new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';
}

const STATUS_META = {
  pending:  { bg: 'bg-yellow-100',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  label: 'Pending'  },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
  rejected: { bg: 'bg-red-100',     text: 'text-red-600',     dot: 'bg-red-400',     label: 'Rejected' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold
      px-2.5 py-1 rounded-full ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, border, color, icon, loading }) {
  return (
    <div className={`bg-[var(--color-surface)] rounded-2xl border-l-4 ${border}
      shadow-sm p-5 flex items-start justify-between gap-3`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)]
          uppercase tracking-wide mb-1">
          {label}
        </p>
        {loading
          ? <div className="h-8 w-16 rounded-lg bg-[var(--color-border)] animate-pulse" />
          : <p className={`text-3xl font-bold ${color}`}>{value ?? '—'}</p>
        }
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center
        flex-shrink-0 ${border.replace('border-', 'bg-').replace('-500', '-100')
          .replace('-600', '-100')}`}>
        {icon}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconClock = (
  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
);
const IconCheck = (
  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
);
const IconX = (
  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
);
const IconList = (
  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function ApproverDashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [requests,     setRequests]     = useState([]);
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError,   setTableError]   = useState(null);

  // ── Load KPI stats from audit/dashboard ──────────────────────────────────
  const loadStats = useCallback(() => {
    setStatsLoading(true);
    axiosInstance.get('/audit/dashboard')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // ── Load pending requests for the "Approval Requests" table ──────────────
  const loadRequests = useCallback(() => {
    setTableLoading(true);
    setTableError(null);
    axiosInstance.get('/esign/pending', { params: { status: 'all' } })
      .then(r => setRequests(r.data))
      .catch(e => {
        setRequests([]);
        setTableError(e.response?.data?.message || 'Failed to load approval requests.');
      })
      .finally(() => setTableLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
    loadRequests();
  }, [loadStats, loadRequests]);

  // Derive counts from the requests array (source of truth)
  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;
  const total    = requests.length;

  // Show most recent 8 rows in dashboard table (newest first)
  const recentRequests = [...requests]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {greeting()}, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Here's your approval overview for today.
          </p>
        </div>
        <button
          onClick={() => navigate('/approvals')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-[#3b5bdb] text-white text-sm font-semibold
            hover:bg-[#2f4ac4] transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4"/>
          </svg>
          View All Approvals
        </button>
      </div>

      {/* ── KPI Stats ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Pending Approvals"
          value={statsLoading ? null : pending}
          border="border-yellow-500"
          color="text-yellow-600"
          icon={IconClock}
          loading={statsLoading}
        />
        <StatCard
          label="Approved"
          value={statsLoading ? null : approved}
          border="border-emerald-500"
          color="text-emerald-600"
          icon={IconCheck}
          loading={statsLoading}
        />
        <StatCard
          label="Rejected"
          value={statsLoading ? null : rejected}
          border="border-red-500"
          color="text-red-500"
          icon={IconX}
          loading={statsLoading}
        />
        <StatCard
          label="Total Reviewed"
          value={statsLoading ? null : total}
          border="border-violet-500"
          color="text-violet-600"
          icon={IconList}
          loading={statsLoading}
        />
      </div>

      {/* ── Avg approval time pill (from audit dashboard) ── */}
      {stats?.avgApprovalMinutes != null && (
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-[var(--color-surface)]
            border border-[var(--color-border)] rounded-full px-4 py-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Avg. approval time:&nbsp;
              <span className="text-violet-600">
                {stats.avgApprovalMinutes < 60
                  ? `${Math.round(stats.avgApprovalMinutes)} min`
                  : `${(stats.avgApprovalMinutes / 60).toFixed(1)} hrs`}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ── Approval Requests table ── */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
        shadow-sm overflow-hidden">

        {/* Table header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)]
          flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
              Approval Requests
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Recent document requests assigned to you
            </p>
          </div>
          {pending > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold
              px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {pending} pending
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                {['Document ID', 'Template', 'Generated By', 'Record ID',
                  'Requested', 'Status', 'Actions'].map(h => (
                  <th key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold
                      text-[var(--color-text-secondary)] uppercase tracking-wider
                      whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">

              {/* Loading skeletons */}
              {tableLoading && [1, 2, 3, 4].map(i => (
                <SkeletonTableRow key={i} cols={7} />
              ))}

              {/* Error state */}
              {!tableLoading && tableError && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <svg className="w-10 h-10 text-red-300 mx-auto mb-3"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0
                           001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      Failed to load requests
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                      {tableError}
                    </p>
                    <button onClick={loadRequests}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold
                        px-4 py-2 rounded-lg bg-[#3b5bdb] text-white
                        hover:bg-[#2f4ac4] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11
                             11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                      Retry
                    </button>
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!tableLoading && !tableError && recentRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center
                      justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      No approval requests yet
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      Requests assigned to you will appear here.
                    </p>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!tableLoading && !tableError && recentRequests.map(r => (
                <tr key={r.id}
                  className="hover:bg-[var(--color-surface-raised)] transition-colors group">

                  {/* Document ID */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-[var(--color-surface-raised)]
                      text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg">
                      {r.doc_uuid}
                    </span>
                    {r.template_category && (
                      <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5
                        rounded-full bg-blue-50 text-blue-600">
                        {r.template_category}
                      </span>
                    )}
                  </td>

                  {/* Template */}
                  <td className="px-5 py-4 text-sm font-medium
                    text-[var(--color-text-primary)] whitespace-nowrap">
                    {r.template_name}
                  </td>

                  {/* Generated By */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br
                        from-indigo-400 to-blue-500 flex items-center
                        justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">
                          {(r.generator_name || 'U').charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {r.generator_name}
                      </span>
                    </div>
                  </td>

                  {/* Record ID */}
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)]
                    font-mono">
                    {r.record_identifier || '—'}
                  </td>

                  {/* Requested date */}
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)]
                    whitespace-nowrap">
                    {fmt(r.created_at)}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 opacity-0
                      group-hover:opacity-100 transition-opacity">
                      {r.status === 'pending' ? (
                        <button
                          onClick={() => navigate(`/approvals?tab=pending&highlight=${r.id}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold
                            text-white bg-[#3b5bdb] hover:bg-[#2f4ac4] transition-colors
                            whitespace-nowrap">
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/approvals?tab=${r.status}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold
                            text-[#3b5bdb] bg-indigo-50 hover:bg-indigo-100
                            transition-colors whitespace-nowrap">
                          View
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border)]
          flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Showing {recentRequests.length} of {total} total requests
          </p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-emerald-600 font-medium">● Live from database</p>
            {total > 8 && (
              <button
                onClick={() => navigate('/approvals')}
                className="text-xs font-semibold text-[#3b5bdb] hover:underline">
                View all →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            title: 'Review Pending',
            desc:  `${pending} document${pending !== 1 ? 's' : ''} awaiting your approval`,
            icon:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4',
            color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200',
            to:    '/approvals',
          },
          {
            title: 'Generate Document',
            desc:  'Create a new PDF from an existing template',
            icon:  'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
            color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200',
            to:    '/generate',
          },
          {
            title: 'Verify Document',
            desc:  'Check SHA-256 integrity of any document',
            icon:  'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
            color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200',
            to:    '/verify-doc',
          },
        ].map(card => (
          <button
            key={card.title}
            onClick={() => navigate(card.to)}
            className={`text-left p-5 rounded-2xl border ${card.border} ${card.bg}
              hover:shadow-md transition-all group`}
          >
            <div className={`w-9 h-9 rounded-xl bg-white border ${card.border}
              flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <svg className={`w-4.5 h-4.5 ${card.color}`} fill="none"
                stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d={card.icon}/>
              </svg>
            </div>
            <p className={`text-sm font-bold ${card.color}`}>{card.title}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
              {card.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
