/**
 * Generator Dashboard
 *
 * Real data only. Sources:
 *   GET /api/audit/dashboard         → docs_today, total_docs, status_breakdown (own)
 *   GET /api/documents               → recent docs table (generator's own, newest first)
 *   GET /api/audit/my-activity-chart → 7-day scoped activity chart
 *
 * KPIs derived from status_breakdown:
 *   - Documents Generated  → total_docs (all-time, own)
 *   - Draft Documents      → status_breakdown[status='draft']
 *   - Pending Approvals    → status_breakdown[status='pending']
 *   - Delivered Documents  → status_breakdown[status='delivered'] + [status='hand_delivered']
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const BLUE    = '#2563eb';
const VIOLET  = '#8b5cf6';
const EMERALD = '#10b981';
const AMBER   = '#f59e0b';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function dayLabel(iso) {
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function countByStatus(breakdown, ...statuses) {
  if (breakdown === null || breakdown === undefined) return null;
  return statuses.reduce((sum, s) => {
    const row = breakdown.find(r => r.status === s);
    return sum + (row ? Number(row.count) : 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:          { label: 'Draft',          cls: 'bg-gray-100 text-gray-600'        },
  pending:        { label: 'Pending',        cls: 'bg-yellow-100 text-yellow-700'    },
  signed:         { label: 'Signed',         cls: 'bg-blue-100 text-blue-700'        },
  delivered:      { label: 'Delivered',      cls: 'bg-emerald-100 text-emerald-700'  },
  hand_delivered: { label: 'Hand Delivered', cls: 'bg-purple-100 text-purple-700'    },
  rejected:       { label: 'Rejected',       cls: 'bg-red-100 text-red-600'          },
  archived:       { label: 'Archived',       cls: 'bg-gray-100 text-gray-500'        },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
      text-[10px] font-semibold whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function Pulse({ h = 'h-4', w = 'w-full' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${h} ${w}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Card({ children, noPad = false, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm
      overflow-hidden ${className}`}>
      {noPad ? children : <div className="p-5 sm:p-6">{children}</div>}
    </div>
  );
}

function CardHeader({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between px-5 sm:px-6 py-4
      border-b border-gray-100">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ icon, message, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-1">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon}/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">{message}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error banner
// ─────────────────────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50
      border border-red-200 text-red-700 text-sm">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-auto underline font-semibold text-xs">
          Retry
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, accentColor, accentBg, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-3">
        <Pulse h="h-3" w="w-28" />
        <Pulse h="h-8" w="w-16" />
      </div>
    );
  }

  const hasData = value !== null && value !== undefined;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md
      transition-shadow group"
      style={{
        borderLeft: `3px solid ${accentColor}`,
        borderTop: '1px solid #e5e7eb',
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
      }}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </p>
          {!hasData
            ? <p className="text-sm text-gray-400 mt-2 font-medium">No data</p>
            : <p className="text-[2.2rem] font-black text-gray-900 leading-none
                mt-1.5 tabular-nums">
                {Number(value).toLocaleString()}
              </p>
          }
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center
          flex-shrink-0 group-hover:scale-105 transition-transform"
          style={{ backgroundColor: accentBg }}>
          <svg className="w-5 h-5" style={{ color: accentColor }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon}/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity line chart — pure SVG, scoped to this generator
// ─────────────────────────────────────────────────────────────────────────────
const LINE_SERIES = [
  { key: 'generated', label: 'Generated', color: BLUE    },
  { key: 'signed',    label: 'Signed',    color: VIOLET  },
  { key: 'delivered', label: 'Delivered', color: EMERALD },
];

function ActivityChart({ data, loading, error, onRetry }) {
  const [hovered, setHovered] = useState(null);

  if (loading) {
    return (
      <Card noPad>
        <CardHeader title="My Document Activity" sub="Last 7 days" />
        <div className="px-6 py-8 space-y-3">
          {[1, 2, 3].map(i => <Pulse key={i} h="h-4" />)}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card noPad>
        <CardHeader title="My Document Activity" sub="Last 7 days" />
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">Failed to load chart</p>
          {onRetry && (
            <button onClick={onRetry}
              className="text-xs text-blue-600 underline underline-offset-2 font-semibold">
              Retry
            </button>
          )}
        </div>
      </Card>
    );
  }

  const hasAnyData = data?.some(d => d.generated > 0 || d.signed > 0 || d.delivered > 0);

  if (!data?.length || !hasAnyData) {
    return (
      <Card noPad>
        <CardHeader title="My Document Activity" sub="Last 7 days" />
        <EmptyState
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          message="No document activity in the last 7 days"
          hint="Activity will appear as you generate, sign, and deliver documents"
        />
      </Card>
    );
  }

  // Chart geometry
  const W = 600, H = 190, PL = 38, PR = 20, PT = 16, PB = 34;
  const PW = W - PL - PR, PH = H - PT - PB;
  const n  = data.length;

  const allV = data.flatMap(d => [d.generated, d.signed, d.delivered]);
  const max  = Math.max(...allV, 1);
  const yMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;

  const xAt = i => n < 2 ? PL + PW / 2 : PL + (i / (n - 1)) * PW;
  const yAt = v => PT + PH - (v / yMax) * PH;

  const pts = key => data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ');
  const area = key => {
    const p = data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`);
    return `M ${p[0]} L ${p.slice(1).join(' L ')} L ${xAt(n-1).toFixed(1)},${(PT+PH).toFixed(1)} L ${PL},${(PT+PH).toFixed(1)} Z`;
  };

  return (
    <Card noPad>
      <CardHeader
        title="My Document Activity"
        sub={`${dayLabel(data[0]?.date)} → ${dayLabel(data[n-1]?.date)}`}
        action={
          <div className="flex items-center gap-3 flex-wrap">
            {LINE_SERIES.map(s => (
              <div key={s.key} className="flex items-center gap-1.5">
                <svg className="w-5 h-2 flex-shrink-0">
                  <line x1="0" y1="4" x2="14" y2="4" stroke={s.color} strokeWidth="2"/>
                  <circle cx="7" cy="4" r="2.5" fill="white" stroke={s.color} strokeWidth="2"/>
                </svg>
                <span className="text-[10px] text-gray-500 font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        }
      />
      <div className="px-4 sm:px-5 py-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full"
          preserveAspectRatio="xMidYMid meet" style={{ userSelect: 'none' }}
          onMouseLeave={() => setHovered(null)}
          role="img" aria-label="7-day document activity chart">

          {/* Y grid */}
          {Array.from({ length: 5 }, (_, i) => {
            const frac = i / 4;
            const y = PT + PH - frac * PH;
            return (
              <g key={i}>
                <line x1={PL} y1={y} x2={W - PR} y2={y}
                  stroke={i === 0 ? '#e5e7eb' : '#f3f4f6'}
                  strokeWidth={i === 0 ? 1 : 0.8}
                  strokeDasharray={i === 0 ? 'none' : '4 3'}/>
                <text x={PL - 7} y={y + 4} textAnchor="end"
                  fontSize={9} fill="#9ca3af" fontWeight="500">
                  {Math.round(yMax * frac)}
                </text>
              </g>
            );
          })}

          {/* Area fills */}
          {LINE_SERIES.map(s => (
            <path key={`a-${s.key}`} d={area(s.key)} fill={s.color} opacity={0.05}/>
          ))}

          {/* Lines */}
          {LINE_SERIES.map(s => (
            <polyline key={`l-${s.key}`} points={pts(s.key)}
              fill="none" stroke={s.color} strokeWidth={2.2}
              strokeLinejoin="round" strokeLinecap="round"/>
          ))}

          {/* Hover zones */}
          {data.map((d, i) => (
            <rect key={`hz-${i}`}
              x={xAt(i) - (n > 1 ? PW / (n - 1) / 2 : PW / 2)} y={PT}
              width={n > 1 ? PW / (n - 1) : PW} height={PH}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHovered(i)}/>
          ))}

          {/* Tooltip */}
          {hovered !== null && (() => {
            const d   = data[hovered];
            const tx  = xAt(hovered);
            const BW  = 142, BH = 80;
            const flip = tx > W * 0.6;
            const bx  = flip ? tx - BW - 12 : tx + 12;

            return (
              <g pointerEvents="none">
                <line x1={tx} y1={PT} x2={tx} y2={PT + PH}
                  stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3"/>
                {LINE_SERIES.map(s => (
                  <circle key={s.key} cx={tx} cy={yAt(d[s.key])}
                    r={4} fill="white" stroke={s.color} strokeWidth={2.2}/>
                ))}
                <rect x={bx} y={PT} width={BW} height={BH} rx={7}
                  fill="white" stroke="#e5e7eb" strokeWidth={1}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}/>
                <text x={bx + 10} y={PT + 16} fontSize={9.5} fontWeight="700" fill="#374151">
                  {dayLabel(d.date)}
                </text>
                <line x1={bx + 10} y1={PT + 22} x2={bx + BW - 10} y2={PT + 22}
                  stroke="#f3f4f6" strokeWidth={1}/>
                {LINE_SERIES.map((s, si) => (
                  <g key={s.key}>
                    <circle cx={bx + 14} cy={PT + 33 + si * 16} r={3.5} fill={s.color}/>
                    <text x={bx + 24} y={PT + 37 + si * 16} fontSize={9.5} fill="#6b7280">
                      {s.label}:
                    </text>
                    <text x={bx + BW - 10} y={PT + 37 + si * 16}
                      fontSize={9.5} fontWeight="700" fill="#111827" textAnchor="end">
                      {d[s.key]}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          {/* X labels */}
          {data.map((d, i) => {
            const step = data.length > 7 ? Math.ceil(data.length / 7) : 1;
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text key={`xl-${i}`} x={xAt(i)} y={PT + PH + 18}
                textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight="500">
                {dayLabel(d.date)}
              </text>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Documents table
// ─────────────────────────────────────────────────────────────────────────────
function RecentDocuments({ docs, loading, error, onRetry }) {
  const navigate = useNavigate();
  const list = docs ?? [];
  const COLS = ['Document ID', 'Template', 'Record ID', 'Status', 'Created Date', 'Actions'];

  return (
    <Card noPad>
      <CardHeader
        title="My Recent Documents"
        sub={!loading && !error && list.length > 0
          ? `Showing ${list.length} most recent`
          : 'Your latest generated documents'}
        action={
          <button onClick={() => navigate('/documents')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800
              flex items-center gap-1 transition-colors">
            View All
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        }
      />

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {COLS.map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold
                  uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                <td className="px-5 py-3.5"><Pulse h="h-3" w="w-28" /></td>
                <td className="px-5 py-3.5"><Pulse h="h-3" w="w-32" /></td>
                <td className="px-5 py-3.5"><Pulse h="h-3" w="w-20" /></td>
                <td className="px-5 py-3.5"><Pulse h="h-5" w="w-16" /></td>
                <td className="px-5 py-3.5"><Pulse h="h-3" w="w-24" /></td>
                <td className="px-5 py-3.5"><Pulse h="h-7" w="w-20" /></td>
              </tr>
            ))}

            {!loading && error && (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">Failed to load documents</p>
                    {onRetry && (
                      <button onClick={onRetry}
                        className="text-xs text-blue-600 underline font-semibold">
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && list.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    message="No documents yet"
                    hint="Documents you generate will appear here"
                    action={
                      <button onClick={() => navigate('/generate')}
                        className="mt-1 text-xs font-semibold text-blue-600
                          hover:text-blue-800 underline underline-offset-2">
                        Generate your first document →
                      </button>
                    }
                  />
                </td>
              </tr>
            )}

            {!loading && !error && list.map(doc => (
              <tr key={doc.id ?? doc.doc_uuid}
                className="hover:bg-gray-50 transition-colors group">
                {/* Document ID */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className="font-mono text-[11px] font-semibold text-blue-600">
                    {doc.doc_uuid ?? '—'}
                  </span>
                </td>

                {/* Template */}
                <td className="px-5 py-3.5 max-w-[180px]">
                  <span className="text-[13px] text-gray-900 font-medium truncate block">
                    {doc.template_name ?? '—'}
                  </span>
                </td>

                {/* Record ID */}
                <td className="px-5 py-3.5">
                  <span className="text-[12px] text-gray-500 font-mono">
                    {doc.record_identifier || '—'}
                  </span>
                </td>

                {/* Status */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <StatusBadge status={doc.status} />
                </td>

                {/* Created Date */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className="text-[12px] text-gray-500">
                    {fmtDate(doc.generated_at)}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                    transition-opacity">
                    {/* Download */}
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      title="Download PDF"
                      className="w-7 h-7 rounded-lg flex items-center justify-center
                        text-gray-400 hover:bg-emerald-50 hover:text-emerald-600
                        transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                    </a>
                    {/* Verify */}
                    <button
                      title="Verify Document"
                      onClick={() => navigate(`/verify-doc?doc_uuid=${doc.doc_uuid}`)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center
                        text-gray-400 hover:bg-blue-50 hover:text-blue-600
                        transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading && (
          <div className="divide-y divide-gray-50">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-5 py-4 space-y-2">
                <div className="flex justify-between">
                  <Pulse h="h-3" w="w-28" />
                  <Pulse h="h-5" w="w-16" />
                </div>
                <Pulse h="h-3" w="w-40" />
                <Pulse h="h-2.5" w="w-24" />
              </div>
            ))}
          </div>
        )}
        {!loading && !error && list.length === 0 && (
          <EmptyState
            icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            message="No documents yet"
          />
        )}
        {!loading && !error && list.map(doc => (
          <div key={doc.id ?? doc.doc_uuid}
            className="px-5 py-4 border-b border-gray-50 last:border-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-mono text-[11px] font-bold text-blue-600">
                {doc.doc_uuid ?? '—'}
              </span>
              <StatusBadge status={doc.status} />
            </div>
            <p className="text-[13px] font-medium text-gray-900 truncate">
              {doc.template_name ?? '—'}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-400 font-mono">
                {doc.record_identifier || '—'}
              </span>
              <span className="text-[11px] text-gray-400">
                {fmtDate(doc.generated_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick action button
// ─────────────────────────────────────────────────────────────────────────────
function QuickAction({ label, desc, icon, color, bg, to }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200
        shadow-sm hover:shadow-md hover:border-gray-300 transition-all text-left w-full group"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center
        flex-shrink-0 group-hover:scale-105 transition-transform"
        style={{ backgroundColor: bg }}>
        <svg className="w-5 h-5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon}/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500
        group-hover:translate-x-0.5 transition-all flex-shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome header
// ─────────────────────────────────────────────────────────────────────────────
function WelcomeHeader({ user }) {
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today    = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const initial  = user?.full_name?.charAt(0)?.toUpperCase() || 'G';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm
      px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center
          text-base font-black text-white flex-shrink-0"
          style={{ backgroundColor: BLUE }}>
          {initial}
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">{today}</p>
          <h1 className="text-gray-900 text-xl font-bold leading-tight mt-0.5">
            {greeting}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-gray-400 text-xs mt-0.5 capitalize">
            Document Generator
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-600">Active</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────
export default function GeneratorDashboardPage() {
  const { user } = useAuth();

  // ── KPI / status data ────────────────────────────────────────────────────
  const [kpiData,    setKpiData]    = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError,   setKpiError]   = useState(false);

  // ── Activity chart ────────────────────────────────────────────────────────
  const [chartData,    setChartData]    = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError,   setChartError]   = useState(false);

  // ── Recent documents ──────────────────────────────────────────────────────
  const [docs,       setDocs]       = useState(null);
  const [docsLoading,setDocsLoading]= useState(true);
  const [docsError,  setDocsError]  = useState(false);

  // ── Fetch functions ───────────────────────────────────────────────────────
  const loadKpis = useCallback(() => {
    setKpiLoading(true); setKpiError(false);
    axiosInstance.get('/audit/dashboard')
      .then(r => setKpiData(r.data))
      .catch(() => { setKpiError(true); setKpiData(null); })
      .finally(() => setKpiLoading(false));
  }, []);

  const loadChart = useCallback(() => {
    setChartLoading(true); setChartError(false);
    axiosInstance.get('/audit/my-activity-chart')
      .then(r => setChartData(r.data))
      .catch(() => { setChartError(true); setChartData(null); })
      .finally(() => setChartLoading(false));
  }, []);

  const loadDocs = useCallback(() => {
    setDocsLoading(true); setDocsError(false);
    // GET /api/documents already scoped to the generator's own docs
    axiosInstance.get('/documents')
      .then(r => setDocs(r.data.slice(0, 10)))
      .catch(() => { setDocsError(true); setDocs(null); })
      .finally(() => setDocsLoading(false));
  }, []);

  useEffect(() => {
    loadKpis();
    loadChart();
    loadDocs();
  }, [loadKpis, loadChart, loadDocs]);

  // ── Derive KPI values from status_breakdown ───────────────────────────────
  const d         = kpiData ?? {};
  const breakdown = d.status_breakdown ?? null;

  // total_docs is returned directly by the API for generators
  const totalDocs  = d.total_docs !== null && d.total_docs !== undefined
    ? Number(d.total_docs) : null;

  // draft, pending, delivered derived from status_breakdown (own docs only)
  const draftCount    = countByStatus(breakdown, 'draft');
  const pendingCount  = countByStatus(breakdown, 'pending');
  const deliveredCount = countByStatus(breakdown, 'delivered', 'hand_delivered');

  return (
    <div className="space-y-5 pb-8">

      {/* Welcome */}
      <WelcomeHeader user={user} />

      {/* KPI error */}
      {kpiError && (
        <ErrorBanner
          message="Could not load dashboard data from the server."
          onRetry={loadKpis}
        />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard loading={kpiLoading}
          label="Documents Generated"
          value={totalDocs}
          accentColor={BLUE} accentBg="#eff6ff"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
        <KpiCard loading={kpiLoading}
          label="Draft Documents"
          value={draftCount}
          accentColor="#9ca3af" accentBg="#f9fafb"
          icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
        <KpiCard loading={kpiLoading}
          label="Pending Approvals"
          value={pendingCount}
          accentColor={AMBER} accentBg="#fffbeb"
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard loading={kpiLoading}
          label="Delivered Documents"
          value={deliveredCount}
          accentColor={EMERALD} accentBg="#f0fdf4"
          icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-sm font-bold text-gray-900 mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            label="Generate Document"
            desc="Create a new PDF from a template"
            icon="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            color={BLUE} bg="#eff6ff" to="/generate"
          />
          <QuickAction
            label="View Documents"
            desc="Browse and manage your documents"
            icon="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            color={VIOLET} bg="#f5f3ff" to="/documents"
          />
          <QuickAction
            label="Request Approval"
            desc="Send a draft document for e-signature"
            icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            color={EMERALD} bg="#f0fdf4" to="/documents"
          />
        </div>
      </div>

      {/* Activity chart */}
      <ActivityChart
        data={chartData}
        loading={chartLoading}
        error={chartError}
        onRetry={loadChart}
      />

      {/* Recent documents table */}
      <RecentDocuments
        docs={docs}
        loading={docsLoading}
        error={docsError}
        onRetry={loadDocs}
      />
    </div>
  );
}
