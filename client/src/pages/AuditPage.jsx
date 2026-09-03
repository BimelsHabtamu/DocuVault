/**
 * Audit Logs — Admin Console
 * "Who did what, when, and from where?"
 *
 * Real data only. Sources:
 *   GET /api/audit/logs?action&user_id&from_date&to_date  — filtered log rows
 *   GET /api/users                                         — user list for filter dropdown
 *
 * No mock data. No hardcoded records.
 * Schema unchanged.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ACTIONS = ['GENERATE', 'SIGN', 'DELIVER', 'VERIFY', 'PREVIEW', 'DOWNLOAD', 'BULK_GENERATE'];

const ACTION_CFG = {
  GENERATE:       { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  SIGN:           { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500'  },
  DELIVER:        { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  VERIFY:         { bg: 'bg-yellow-100',  text: 'text-yellow-700',  dot: 'bg-yellow-500'  },
  PREVIEW:        { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'    },
  DOWNLOAD:       { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500'    },
  BULK_GENERATE:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
};
const DEFAULT_CFG = { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };

const PAGE_SIZES = [10, 25, 50];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function parseBrowser(ua) {
  if (!ua) return '—';
  if (/Edg\//.test(ua))     return 'Edge';
  if (/Chrome/.test(ua))    return 'Chrome';
  if (/Firefox/.test(ua))   return 'Firefox';
  if (/Safari/.test(ua))    return 'Safari';
  if (/curl/.test(ua))      return 'curl';
  if (/python/.test(ua))    return 'Python';
  return 'Unknown';
}

function parseOs(ua) {
  if (!ua) return '—';
  if (/Windows/.test(ua))  return 'Windows';
  if (/Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua))    return 'Linux';
  if (/Android/.test(ua))  return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  return '—';
}

function safeJson(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return String(v); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small primitives
// ─────────────────────────────────────────────────────────────────────────────
function Pulse({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`animate-pulse bg-gray-200 ${h} ${w} ${rounded}`} />;
}

function ActionBadge({ action }) {
  const cfg = ACTION_CFG[action] || DEFAULT_CFG;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
      text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {action || '—'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail side-panel
// ─────────────────────────────────────────────────────────────────────────────
function DetailPanel({ row, onClose }) {
  if (!row) return null;
  const details = safeJson(row.action_details);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose} aria-hidden />

      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px]
        bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4
          border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Audit Log Detail</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Event #{row.id}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center
              text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Action + timestamp */}
          <div className="flex items-center justify-between gap-3
            bg-gray-50 rounded-xl px-4 py-3">
            <ActionBadge action={row.action} />
            <span className="text-xs text-gray-500">{fmt(row.timestamp)}</span>
          </div>

          {/* Fields grid */}
          {[
            { label: 'User',       value: row.user_name || <span className="italic text-gray-400">Public / unauthenticated</span> },
            { label: 'Document ID',value: row.doc_uuid
              ? <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{row.doc_uuid}</span>
              : '—'
            },
            { label: 'IP Address', value: <span className="font-mono text-sm">{row.ip_address || '—'}</span> },
            { label: 'Browser',    value: parseBrowser(row.user_agent) },
            { label: 'OS',         value: parseOs(row.user_agent) },
            { label: 'Timestamp',  value: fmt(row.timestamp) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {label}
              </p>
              <p className="text-sm text-gray-800">{value}</p>
            </div>
          ))}

          {/* User agent full string */}
          {row.user_agent && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                User Agent
              </p>
              <p className="text-[11px] text-gray-500 break-all leading-relaxed
                bg-gray-50 rounded-lg px-3 py-2 font-mono">
                {row.user_agent}
              </p>
            </div>
          )}

          {/* Action details JSON */}
          {details && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Action Details
              </p>
              <pre className="bg-gray-900 text-emerald-400 text-[11px] rounded-xl
                px-4 py-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}

          {/* Immutability notice */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100
            rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              Audit logs are <strong>immutable</strong> — no edits or deletions are permitted (FR-020).
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination bar
// ─────────────────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, pageSize, totalFiltered, onPage, onPageSize }) {
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, totalFiltered);

  // Build visible page numbers around current
  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }
  const showFirstEllipsis = pages[0] > 2;
  const showLastEllipsis  = pages[pages.length - 1] < totalPages - 1;

  return (
    <div className="px-5 py-3.5 border-t border-gray-100 flex flex-wrap
      items-center justify-between gap-3">

      {/* Left: rows per page + count */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">Rows per page</span>
        <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400">
          {totalFiltered === 0 ? '0' : `${start}–${end}`} of {totalFiltered}
        </span>
      </div>

      {/* Right: page numbers */}
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(1)} disabled={page === 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
            hover:bg-gray-100 disabled:opacity-30 transition-colors" aria-label="First page">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
          </svg>
        </button>
        <button onClick={() => onPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
            hover:bg-gray-100 disabled:opacity-30 transition-colors" aria-label="Previous">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        {pages[0] > 1 && (
          <>
            <button onClick={() => onPage(1)}
              className="w-8 h-8 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
              1
            </button>
            {showFirstEllipsis && <span className="w-8 text-center text-gray-400 text-xs">…</span>}
          </>
        )}
        {pages.map(p => (
          <button key={p} onClick={() => onPage(p)}
            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors
              ${page === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {p}
          </button>
        ))}
        {showLastEllipsis && <span className="w-8 text-center text-gray-400 text-xs">…</span>}
        {pages[pages.length - 1] < totalPages && (
          <button onClick={() => onPage(totalPages)}
            className="w-8 h-8 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            {totalPages}
          </button>
        )}

        <button onClick={() => onPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
            hover:bg-gray-100 disabled:opacity-30 transition-colors" aria-label="Next">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
            hover:bg-gray-100 disabled:opacity-30 transition-colors" aria-label="Last page">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [users,   setUsers]   = useState([]);   // for user filter dropdown

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,     setSearch]     = useState('');
  const [action,     setAction]     = useState('');      // '' = all
  const [userId,     setUserId]     = useState('');      // '' = all
  const [approverId, setApproverId] = useState('');      // '' = all
  const [fromDate,   setFrom]       = useState('');
  const [toDate,     setTo]         = useState('');

  // ── Pagination state ────────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Detail panel ────────────────────────────────────────────────────────────
  const [detail, setDetail] = useState(null);

  // ── Fetch users for the filter dropdown (once) ──────────────────────────────
  useEffect(() => {
    axiosInstance.get('/users')
      .then(r => setUsers(r.data))
      .catch(() => {});
  }, []);

  // ── Fetch logs (re-runs on server-side filter changes) ──────────────────────
  const loadLogs = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (action)      params.append('action',      action);
    if (userId)      params.append('user_id',     userId);
    if (approverId)  params.append('approver_id', approverId);
    if (fromDate)    params.append('from_date',   fromDate);
    if (toDate)      params.append('to_date',     toDate);

    axiosInstance.get(`/audit/logs?${params}`)
      .then(r => { setLogs(r.data); setPage(1); })
      .catch(() => { setError(true); setLogs([]); })
      .finally(() => setLoading(false));
  }, [action, userId, approverId, fromDate, toDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Client-side text search on top of server filters ────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(r =>
      (r.user_name   || '').toLowerCase().includes(q) ||
      (r.doc_uuid    || '').toLowerCase().includes(q) ||
      (r.ip_address  || '').toLowerCase().includes(q) ||
      (r.action      || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated   = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters  = action || userId || approverId || fromDate || toDate || search;

  const clearFilters = () => {
    setSearch('');
    setAction('');
    setUserId('');
    setApproverId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  // Summary counts from loaded logs (not filtered — total scope)
  const summary = useMemo(() => ({
    total:    logs.length,
    generate: logs.filter(r => r.action === 'GENERATE').length,
    sign:     logs.filter(r => r.action === 'SIGN').length,
    deliver:  logs.filter(r => r.action === 'DELIVER').length,
    verify:   logs.filter(r => r.action === 'VERIFY').length,
  }), [logs]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Who did what, when, and from where? — read-only immutable log
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold
          text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg self-start">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          Read Only
        </span>
      </div>

      {/* ── Summary KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Events',  value: summary.total,    color: '#2563eb', bg: '#eff6ff' },
          { label: 'Generations',   value: summary.generate, color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Signatures',    value: summary.sign,     color: '#8b5cf6', bg: '#f5f3ff' },
          { label: 'Deliveries',    value: summary.deliver,  color: '#10b981', bg: '#f0fdf4' },
          { label: 'Verifications', value: summary.verify,   color: '#f59e0b', bg: '#fffbeb' },
        ].map(c => (
          <div key={c.label}
            className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            style={{ borderLeft: `3px solid ${c.color}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{c.label}</p>
            {loading
              ? <div className="animate-pulse h-7 w-12 bg-gray-200 rounded mt-1.5" />
              : <p className="text-2xl font-black mt-1 tabular-nums"
                  style={{ color: c.color }}>{c.value.toLocaleString()}</p>
            }
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        {/* Row 1: search + action tabs */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
              text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search user, document ID, IP address…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm
                bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20
                focus:border-blue-400 transition"
            />
          </div>

          {/* Action pills */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => { setAction(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${action === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              All
            </button>
            {ACTIONS.map(a => (
              <button key={a}
                onClick={() => { setAction(a); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${action === a ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: user filter + date range + clear */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* User filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider
              whitespace-nowrap">
              User
            </label>
            <select value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                focus:border-blue-400 min-w-[160px]">
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          {/* Approver filter — FR-039 */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider
              whitespace-nowrap">
              Approver
            </label>
            <select value={approverId} onChange={e => { setApproverId(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                focus:border-blue-400 min-w-[160px]">
              <option value="">All Approvers</option>
              {users
                .filter(u => u.role === 'approver' || u.role === 'super_admin' || u.role === 'system_admin')
                .map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))
              }
            </select>
          </div>

          {/* From date */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              From
            </label>
            <input type="date" value={fromDate}
              onChange={e => { setFrom(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
          </div>

          {/* To date */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              To
            </label>
            <input type="date" value={toDate}
              onChange={e => { setTo(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
          </div>

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters}
              className="text-xs text-red-500 hover:text-red-700 font-semibold
                px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              Clear
            </button>
          )}

          {/* Record count */}
          <span className="ml-auto text-xs text-gray-400">
            {loading ? '…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50
          border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>
            Failed to load audit logs.{' '}
            <button onClick={loadLogs} className="underline font-semibold">Retry</button>
          </span>
        </div>
      )}

      {/* ── Table card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['#', 'User', 'Action', 'Document ID', 'IP Address', 'Browser', 'Timestamp', ''].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500
                      uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">

              {/* Loading skeleton */}
              {loading && Array.from({ length: pageSize }, (_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3.5"><Pulse h="h-3" w="w-6" /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Pulse h="h-6" w="w-6" rounded="rounded-full" />
                      <Pulse h="h-3" w="w-24" />
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><Pulse h="h-5" w="w-20" rounded="rounded-full" /></td>
                  <td className="px-4 py-3.5"><Pulse h="h-3" w="w-28" /></td>
                  <td className="px-4 py-3.5"><Pulse h="h-3" w="w-24" /></td>
                  <td className="px-4 py-3.5"><Pulse h="h-3" w="w-16" /></td>
                  <td className="px-4 py-3.5"><Pulse h="h-3" w="w-32" /></td>
                  <td className="px-4 py-3.5" />
                </tr>
              ))}

              {/* Error / empty */}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <svg className="w-10 h-10 text-gray-300 mx-auto mb-2"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                    </svg>
                    <p className="text-sm font-medium text-gray-400">
                      {hasFilters ? 'No logs match the current filters' : 'No audit logs yet'}
                    </p>
                    {hasFilters && (
                      <button onClick={clearFilters}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800
                          font-semibold underline underline-offset-2">
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {/* Rows */}
              {!loading && paginated.map((row, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                return (
                  <tr key={row.id}
                    className="hover:bg-gray-50 transition-colors group cursor-pointer"
                    onClick={() => setDetail(row)}>

                    {/* # */}
                    <td className="px-4 py-3.5 text-xs text-gray-400 font-mono tabular-nums">
                      {rowNum}
                    </td>

                    {/* User */}
                    <td className="px-4 py-3.5">
                      {row.user_name
                        ? <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center
                              justify-center flex-shrink-0">
                              <span className="text-[9px] font-black text-blue-700">
                                {row.user_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[13px] font-medium text-gray-800 whitespace-nowrap">
                              {row.user_name}
                            </span>
                          </div>
                        : <span className="text-xs text-gray-400 italic">Public</span>
                      }
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5">
                      <ActionBadge action={row.action} />
                    </td>

                    {/* Document ID */}
                    <td className="px-4 py-3.5">
                      {row.doc_uuid
                        ? <span className="font-mono text-[11px] text-blue-600
                            bg-blue-50 px-2 py-0.5 rounded">
                            {row.doc_uuid}
                          </span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>

                    {/* IP */}
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-500">
                      {row.ip_address || '—'}
                    </td>

                    {/* Browser */}
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {parseBrowser(row.user_agent)}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                      {fmtShort(row.timestamp)}
                    </td>

                    {/* View button */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={e => { e.stopPropagation(); setDetail(row); }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg
                          flex items-center justify-center
                          text-gray-400 hover:bg-blue-50 hover:text-blue-600
                          transition-all"
                        aria-label="View details"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor"
                          viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalFiltered={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        )}
      </div>

      {/* ── Detail side panel ── */}
      <DetailPanel row={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
