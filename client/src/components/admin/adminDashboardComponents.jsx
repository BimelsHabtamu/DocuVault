/**
 * Shared dashboard widgets — Super Admin & System Admin.
 * NO mock/fake data. Every value comes from the real API or shows "No data".
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Design tokens ─────────────────────────────────────────────────────────────
export const ACCENT  = 'var(--admin-accent)';
export const ACCENT2 = 'var(--admin-accent-light)';
export const PALE    = 'var(--admin-accent-pale)';

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function timeAgo(d) {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtMinutes(m) {
  if (m === null || m === undefined) return null;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

// Pull a count from status_breakdown array by status name(s).
// Returns null  → breakdown was not provided (API hasn't responded yet or failed)
// Returns 0     → breakdown was provided but none matched (legitimate zero)
export function countByStatus(breakdown, ...statuses) {
  // null/undefined breakdown = data not yet available → show "No data"
  if (breakdown === null || breakdown === undefined) return null;
  // empty array or populated array → sum matching rows (may be 0)
  return statuses.reduce((sum, s) => {
    const row = breakdown.find(r => r.status === s);
    return sum + (row ? Number(row.count) : 0);
  }, 0);
}

// ── Status configs ────────────────────────────────────────────────────────────
export const STATUS_CFG = {
  draft:          { label: 'Draft',          cls: 'bg-gray-100 text-gray-600'        },
  pending:        { label: 'Pending',        cls: 'bg-yellow-100 text-yellow-700'    },
  signed:         { label: 'Signed',         cls: 'bg-blue-100 text-blue-700'        },
  delivered:      { label: 'Delivered',      cls: 'bg-emerald-100 text-emerald-700'  },
  hand_delivered: { label: 'Hand Delivered', cls: 'bg-purple-100 text-purple-700'    },
  rejected:       { label: 'Rejected',       cls: 'bg-red-100 text-red-600'          },
};

// ── Skeleton pulse ────────────────────────────────────────────────────────────
export function Pulse({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`animate-pulse bg-gray-200 ${h} ${w} ${rounded}`} />;
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
export function Card({ children, className = '', noPad = false }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {noPad ? children : <div className="p-5 sm:p-6">{children}</div>}
    </div>
  );
}

export function CardHeader({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── No-data state ─────────────────────────────────────────────────────────────
function NoData({ message = 'No data available' }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-1.5">
      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p className="text-sm text-gray-400 font-medium">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WELCOME HEADER
// ─────────────────────────────────────────────────────────────────────────────
export function WelcomeHeader({ user }) {
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const initial  = user?.full_name?.charAt(0)?.toUpperCase() || 'A';
  const today    = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center
      justify-between gap-4 bg-white border border-gray-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center
          text-base font-black text-white flex-shrink-0"
          style={{ backgroundColor: ACCENT }}>
          {initial}
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{today}</p>
          <h1 className="text-gray-900 text-xl font-bold leading-tight mt-0.5">
            {greeting}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5 capitalize">
            {user?.role?.replace(/_/g, ' ')} · DocuVault Admin Console
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            System Status
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-sm font-bold text-emerald-600">Online</p>
          </div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Today</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. KPI CARD
// ─────────────────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, icon, accentColor, accentBg, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-3">
        <Pulse h="h-3" w="w-24" />
        <Pulse h="h-8" w="w-16" />
        <Pulse h="h-2.5" w="w-20" />
      </div>
    );
  }

  // null / undefined  →  data genuinely unavailable (API failed or not returned)
  // 0 or any number   →  show the real value, even when zero
  const hasData = value !== null && value !== undefined;
  const display = hasData ? Number(value) : null;

  return (
    <div className="bg-white rounded-xl p-5 border-l-[3px] shadow-sm
      hover:shadow-md transition-all duration-200 group"
      style={{
        borderColor:  accentColor,
        borderTop:    '1px solid #e5e7eb',
        borderRight:  '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
      }}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {label}
          </p>

          {!hasData
            ? <p className="text-sm text-gray-400 mt-2 font-medium">No data available</p>
            : <>
                <p className="text-[2rem] font-black text-gray-900 leading-none mt-1.5 tabular-nums">
                  {display.toLocaleString()}
                </p>
                {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
              </>
          }
        </div>

        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
          group-hover:scale-105 transition-transform"
          style={{ backgroundColor: accentBg }}>
          <svg className="w-5 h-5" style={{ color: accentColor }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AVERAGE APPROVAL TIME
// ─────────────────────────────────────────────────────────────────────────────
export function AvgApprovalTime({ minutes, loading }) {
  const pct   = minutes !== null && minutes !== undefined
    ? Math.min(100, Math.round(minutes / 240 * 100))
    : 0;
  const color = minutes === null || minutes === undefined
    ? '#9ca3af'
    : minutes < 60 ? '#10b981' : minutes < 120 ? '#2563eb' : '#ef4444';
  const label = fmtMinutes(minutes);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Avg. Approval Time
          </p>
          {loading
            ? <Pulse h="h-8" w="w-24 mt-1.5" />
            : label
              ? <p className="text-[2rem] font-black leading-none mt-1.5 tabular-nums"
                  style={{ color }}>
                  {label}
                </p>
              : <p className="text-sm text-gray-400 mt-2 font-medium">No data available</p>
          }
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: PALE }}>
          <svg className="w-5 h-5" style={{ color: ACCENT }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        {!loading && label && (
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, backgroundColor: color }} />
        )}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-400">Fast (0–1h)</span>
        <span className="text-[10px] text-gray-400">Slow (4h+)</span>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOCUMENT STATUS BREAKDOWN
//    Data source: status_breakdown from /api/audit/dashboard
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_BAR = {
  draft:          { color: '#9ca3af', label: 'Draft'          },
  pending:        { color: '#f59e0b', label: 'Pending'        },
  signed:         { color: '#3b82f6', label: 'Signed'         },
  delivered:      { color: '#10b981', label: 'Delivered'      },
  hand_delivered: { color: '#8b5cf6', label: 'Hand Delivered' },
  rejected:       { color: '#ef4444', label: 'Rejected'       },
};

export function DocumentStatusChart({ breakdown, totalDocs, loading, error, onRetry }) {
  const total   = breakdown?.reduce((s, r) => s + Number(r.count), 0) ?? 0;
  const hasData = total > 0;

  return (
    <Card noPad>
      <CardHeader
        title="Document Status Breakdown"
        sub={hasData ? `${total.toLocaleString()} total documents` : undefined}
      />
      <div className="p-5 sm:p-6">
        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Pulse h="h-2.5" w="w-20" />
                  <Pulse h="h-2.5" w="w-8" />
                </div>
                <Pulse h="h-2" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Failed to load status data</p>
            {onRetry && (
              <button onClick={onRetry}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold
                  underline underline-offset-2 transition-colors">
                Retry
              </button>
            )}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && !hasData && (
          <NoData message="No documents in the system yet" />
        )}

        {/* Chart */}
        {!loading && !error && hasData && (
          <div className="space-y-4">
            {Object.entries(STATUS_BAR).map(([status, cfg]) => {
              const row   = breakdown?.find(r => r.status === status);
              const count = row ? Number(row.count) : 0;
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
              if (count === 0) return null;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cfg.color }} />
                      <span className="text-xs font-medium text-gray-600">{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{pct}%</span>
                      <span className="text-xs font-bold text-gray-900 w-8 text-right tabular-nums">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. ACTIVITY CHART  — pure SVG line chart, no library dependency
//     Data source: GET /api/audit/activity-chart
//     Shape: [{ date:"YYYY-MM-DD", generated:n, signed:n, delivered:n }] × 7
// ─────────────────────────────────────────────────────────────────────────────

const CHART_SERIES = [
  { key: 'generated', label: 'Generated', color: '#2563eb' },
  { key: 'signed',    label: 'Signed',    color: '#8b5cf6' },
  { key: 'delivered', label: 'Delivered', color: '#10b981' },
];

function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function ActivityChart({ data, loading, error, onRetry }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card noPad>
        <CardHeader title="7-Day Document Activity" sub="Generated · Signed · Delivered" />
        <div className="px-6 py-8 space-y-3">
          {[1, 2, 3].map(i => <Pulse key={i} h="h-4" />)}
        </div>
      </Card>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card noPad>
        <CardHeader title="7-Day Document Activity" sub="Generated · Signed · Delivered" />
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">Failed to load chart data</p>
          {onRetry && (
            <button onClick={onRetry}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold
                underline underline-offset-2 transition-colors">
              Retry
            </button>
          )}
        </div>
      </Card>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  const hasAnyData = data?.some(d => d.generated > 0 || d.signed > 0 || d.delivered > 0);
  if (!data?.length || !hasAnyData) {
    return (
      <Card noPad>
        <CardHeader title="7-Day Document Activity" sub="Generated · Signed · Delivered" />
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <p className="text-sm font-medium text-gray-500">No activity in the last 7 days</p>
          <p className="text-xs text-gray-400">Data will appear as documents are generated, signed, and delivered</p>
        </div>
      </Card>
    );
  }

  // ── Chart geometry ────────────────────────────────────────────────────────
  const W      = 600;
  const H      = 200;
  const PAD_L  = 42;   // wide enough for 3-digit Y labels
  const PAD_R  = 20;
  const PAD_T  = 16;
  const PAD_B  = 36;   // room for weekday + MM-DD labels
  const PLOT_W = W - PAD_L - PAD_R;
  const PLOT_H = H - PAD_T - PAD_B;

  const allValues = data.flatMap(d => [d.generated, d.signed, d.delivered]);
  const maxVal    = Math.max(...allValues, 1);
  const yMax      = maxVal <= 5 ? 5 : Math.ceil(maxVal / 5) * 5;
  const Y_TICKS   = 4;
  const n         = data.length;

  // Guard: need at least 2 points for a line chart
  const xAt = (i) => n < 2
    ? PAD_L + PLOT_W / 2
    : PAD_L + (i / (n - 1)) * PLOT_W;
  const yAt = (v) => PAD_T + PLOT_H - (v / yMax) * PLOT_H;

  const polylinePoints = (key) =>
    data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ');

  const areaPath = (key) => {
    const pts = data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`);
    return `M ${pts[0]} L ${pts.slice(1).join(' L ')} `
         + `L ${xAt(n - 1).toFixed(1)},${(PAD_T + PLOT_H).toFixed(1)} `
         + `L ${PAD_L},${(PAD_T + PLOT_H).toFixed(1)} Z`;
  };

  return (
    <Card noPad>
      <CardHeader
        title="7-Day Document Activity"
        sub={`${data[0]?.date} → ${data[n - 1]?.date}`}
        action={
          <div className="flex items-center gap-4 flex-wrap">
            {CHART_SERIES.map(s => (
              <div key={s.key} className="flex items-center gap-1.5">
                <svg className="w-5 h-2.5 flex-shrink-0">
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
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ userSelect: 'none' }}
          onMouseLeave={() => setHoveredIdx(null)}
          role="img"
          aria-label="7-day document activity line chart"
        >
          {/* Y-axis grid + labels */}
          {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
            const frac = i / Y_TICKS;
            const val  = Math.round(yMax * frac);
            const y    = PAD_T + PLOT_H - frac * PLOT_H;
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke={i === 0 ? '#e5e7eb' : '#f3f4f6'}
                  strokeWidth={i === 0 ? 1 : 0.8}
                  strokeDasharray={i === 0 ? 'none' : '4 3'}
                />
                <text x={PAD_L - 8} y={y + 4}
                  textAnchor="end" fontSize={9} fill="#9ca3af" fontWeight="500">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area fills */}
          {CHART_SERIES.map(s => (
            <path key={`area-${s.key}`} d={areaPath(s.key)}
              fill={s.color} opacity={0.05} />
          ))}

          {/* Lines */}
          {CHART_SERIES.map(s => (
            <polyline key={`line-${s.key}`} points={polylinePoints(s.key)}
              fill="none" stroke={s.color} strokeWidth={2.2}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Hover zones — invisible wide rects per column */}
          {data.map((d, i) => (
            <rect
              key={`hover-${i}`}
              x={xAt(i) - (n > 1 ? PLOT_W / (n - 1) / 2 : PLOT_W / 2)}
              y={PAD_T}
              width={n > 1 ? PLOT_W / (n - 1) : PLOT_W}
              height={PLOT_H}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHoveredIdx(i)}
            />
          ))}

          {/* Vertical rule + dots on hover */}
          {hoveredIdx !== null && (() => {
            const d  = data[hoveredIdx];
            const tx = xAt(hoveredIdx);
            // Tooltip: flip left if in right 40% of chart
            const BOX_W = 138, BOX_H = 78;
            const flipped = tx > W * 0.6;
            const bx = flipped ? tx - BOX_W - 12 : tx + 12;
            const by = PAD_T;

            return (
              <g pointerEvents="none">
                {/* Vertical rule */}
                <line x1={tx} y1={PAD_T} x2={tx} y2={PAD_T + PLOT_H}
                  stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3"/>

                {/* Dots on each series */}
                {CHART_SERIES.map(s => (
                  <circle key={s.key}
                    cx={tx} cy={yAt(d[s.key])}
                    r={4} fill="white"
                    stroke={s.color} strokeWidth={2.2}/>
                ))}

                {/* Tooltip box */}
                <rect x={bx} y={by} width={BOX_W} height={BOX_H}
                  rx={7} fill="white" stroke="#e5e7eb" strokeWidth={1}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.09))' }}/>

                {/* Tooltip header */}
                <text x={bx + 10} y={by + 16} fontSize={9.5} fontWeight="700" fill="#374151">
                  {dayLabel(d.date)}
                </text>
                <text x={bx + BOX_W - 10} y={by + 16} fontSize={9} fill="#9ca3af"
                  textAnchor="end">
                  {d.date.slice(5)}
                </text>

                {/* Divider */}
                <line x1={bx + 10} y1={by + 22} x2={bx + BOX_W - 10} y2={by + 22}
                  stroke="#f3f4f6" strokeWidth={1}/>

                {/* Series rows */}
                {CHART_SERIES.map((s, si) => (
                  <g key={s.key}>
                    <circle cx={bx + 14} cy={by + 33 + si * 16} r={3.5} fill={s.color}/>
                    <text x={bx + 24} y={by + 37 + si * 16} fontSize={9.5} fill="#6b7280">
                      {s.label}:
                    </text>
                    <text x={bx + BOX_W - 10} y={by + 37 + si * 16}
                      fontSize={9.5} fontWeight="700" fill="#111827" textAnchor="end">
                      {d[s.key]}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          {/* X-axis weekday labels */}
          {data.map((d, i) => (
            <text key={`wd-${i}`} x={xAt(i)} y={PAD_T + PLOT_H + 16}
              textAnchor="middle" fontSize={10} fill="#6b7280" fontWeight="600">
              {dayLabel(d.date)}
            </text>
          ))}

          {/* X-axis MM-DD labels */}
          {data.map((d, i) => (
            <text key={`dt-${i}`} x={xAt(i)} y={PAD_T + PLOT_H + 28}
              textAnchor="middle" fontSize={8} fill="#9ca3af">
              {d.date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TOP 5 TEMPLATE USAGE — horizontal bar chart
//    Data source: top_templates from GET /api/audit/dashboard
//    Shape: [{ name, category, usage_count }] — already sorted DESC by backend
// ─────────────────────────────────────────────────────────────────────────────

// Five distinct blue-family bar colors so bars are visually distinguishable
const BAR_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export function TopTemplates({ templates, loading, error, onRetry }) {
  const navigate = useNavigate();

  // Normalise field name — backend sends usage_count; fallback to count
  const list = (templates ?? [])
    .slice(0, 5)
    .map(t => ({ ...t, count: Number(t.usage_count ?? t.count ?? 0) }));

  const maxCount = list.length ? Math.max(...list.map(t => t.count), 1) : 1;

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card noPad>
        <CardHeader title="Top 5 Templates" sub="By documents generated" />
        <div className="px-6 py-5 space-y-5">
          {[80, 65, 50, 38, 25].map((w, i) => (
            <div key={i} className="space-y-1.5">
              <Pulse h="h-3" w="w-2/3" />
              <div className="flex items-center gap-3">
                <div className={`h-7 bg-gray-100 animate-pulse rounded-md`}
                  style={{ width: `${w}%` }} />
                <Pulse h="h-3" w="w-6" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (!loading && error) {
    return (
      <Card noPad>
        <CardHeader title="Top 5 Templates" sub="By documents generated"
          action={
            <button onClick={() => navigate('/templates')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              View all →
            </button>
          }
        />
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">Failed to load template data</p>
          {onRetry && (
            <button onClick={onRetry}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold
                underline underline-offset-2 transition-colors">
              Retry
            </button>
          )}
        </div>
      </Card>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!list.length) {
    return (
      <Card noPad>
        <CardHeader title="Top 5 Templates" sub="By documents generated"
          action={
            <button onClick={() => navigate('/templates')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              View all →
            </button>
          }
        />
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
          </svg>
          <p className="text-sm font-medium text-gray-500">No template data available</p>
          <p className="text-xs text-gray-400">Documents must be generated to see template usage</p>
        </div>
      </Card>
    );
  }

  // Chart geometry — name label sits INSIDE the row above the bar,
  // so we allocate extra height per row: label height (14) + bar (BAR_H) + gap (BAR_GAP)
  const BAR_H    = 26;
  const BAR_GAP  = 28;   // gap includes space for the name label above each bar
  const PAD_T    = 4;
  const PAD_B    = 8;
  const PAD_R    = 52;
  const CHART_W  = 500;
  const ROW_H    = 14 + BAR_H;  // label line height + bar height
  const CHART_H  = list.length * (ROW_H + BAR_GAP) - BAR_GAP + PAD_T + PAD_B;
  const BAR_AREA = CHART_W - PAD_R;

  const barWidth = (v) => Math.max(4, Math.round((v / maxCount) * BAR_AREA));

  return (
    <Card noPad>
      <CardHeader
        title="Top 5 Templates"
        sub="By documents generated · real database data"
        action={
          <button onClick={() => navigate('/templates')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            View all →
          </button>
        }
      />

      <div className="px-5 sm:px-6 pt-4 pb-5">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full overflow-visible"
          preserveAspectRatio="xMinYMid meet"
          aria-label="Top 5 templates horizontal bar chart"
          role="img"
        >
          {list.map((t, i) => {
            const bw     = barWidth(t.count);
            const rowTop = PAD_T + i * (ROW_H + BAR_GAP);
            const labelY = rowTop + 11;       // baseline of the name label
            const barY   = rowTop + 14;       // top of the bar
            const color  = BAR_COLORS[i];
            const label  = t.name.length > 40 ? t.name.slice(0, 38) + '…' : t.name;
            const countInside = bw > 50;

            return (
              <g key={t.name ?? i}>
                {/* Template name label — above bar, never clips */}
                <text x={0} y={labelY}
                  fontSize={10.5} fontWeight="600" fill="#374151">
                  {label}
                </text>

                {/* Background track */}
                <rect x={0} y={barY} width={BAR_AREA} height={BAR_H}
                  rx={5} fill="#f3f4f6"/>

                {/* Filled bar */}
                <rect x={0} y={barY} width={bw} height={BAR_H}
                  rx={5} fill={color}/>

                {/* Category text inside bar (if wide enough) */}
                {t.category && bw > 90 && (
                  <text x={10} y={barY + BAR_H / 2 + 4}
                    fontSize={8.5} fill="rgba(255,255,255,0.8)" fontWeight="500">
                    {t.category}
                  </text>
                )}

                {/* Count label — inside or outside bar */}
                {countInside
                  ? <text x={bw - 8} y={barY + BAR_H / 2 + 4}
                      fontSize={11} fontWeight="800" fill="white" textAnchor="end">
                      {t.count.toLocaleString()}
                    </text>
                  : <text x={bw + 8} y={barY + BAR_H / 2 + 4}
                      fontSize={11} fontWeight="700" fill={color} textAnchor="start">
                      {t.count.toLocaleString()}
                    </text>
                }
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
          {list.map((t, i) => (
            <div key={t.name ?? i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: BAR_COLORS[i] }}/>
                <span className="text-[11px] text-gray-600 truncate">{t.name}</span>
              </div>
              <span className="text-[11px] font-bold text-gray-900 tabular-nums flex-shrink-0">
                {t.count.toLocaleString()}
                <span className="text-gray-400 font-normal ml-1">
                  {t.count === 1 ? 'doc' : 'docs'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECENT DOCUMENTS TABLE
//    Data source: GET /api/audit/search (no filters → all docs, newest first)
//    API fields:  doc_uuid | template_name | generated_by_name | status | generated_at
// ─────────────────────────────────────────────────────────────────────────────
export function RecentDocuments({ docs, loading, error, onRetry }) {
  const navigate = useNavigate();
  const list = docs ?? [];

  const COLUMNS = ['Document ID', 'Template', 'Generated By', 'Status', 'Created Date'];

  // ── Shared body content (keeps desktop table and mobile cards in sync) ───
  function SkeletonRows() {
    return Array.from({ length: 6 }, (_, i) => (
      <tr key={i}>
        <td className="px-5 py-3.5"><Pulse h="h-3" w="w-28" /></td>
        <td className="px-5 py-3.5"><Pulse h="h-3" w="w-32" /></td>
        <td className="px-5 py-3.5"><Pulse h="h-3" w="w-24" /></td>
        <td className="px-5 py-3.5"><Pulse h="h-3" w="w-16" /></td>
        <td className="px-5 py-3.5"><Pulse h="h-3" w="w-20" /></td>
      </tr>
    ));
  }

  function ErrorRow() {
    return (
      <tr>
        <td colSpan={5}>
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium">Failed to load documents</p>
            {onRetry && (
              <button onClick={onRetry}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold
                  underline underline-offset-2 transition-colors">
                Retry
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function EmptyRow() {
    return (
      <tr>
        <td colSpan={5}>
          <div className="flex flex-col items-center justify-center py-10 gap-1.5">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p className="text-sm text-gray-400 font-medium">No documents in the database yet</p>
            <p className="text-xs text-gray-300">Generated documents will appear here</p>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <Card noPad>
      <CardHeader
        title="Recent Documents"
        sub={!loading && !error && list.length > 0
          ? `Showing ${list.length} most recent`
          : 'Latest generated documents'}
        action={
          <button
            onClick={() => navigate('/documents')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800
              flex items-center gap-1 transition-colors">
            View All
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        }
      />

      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {COLUMNS.map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold
                  uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading   ? <SkeletonRows />
             : error   ? <ErrorRow />
             : !list.length ? <EmptyRow />
             : list.map(doc => {
                 const cfg = STATUS_CFG[doc.status]
                   ?? { label: doc.status ?? '—', cls: 'bg-gray-100 text-gray-600' };
                 return (
                   <tr
                     key={doc.doc_uuid ?? doc.id}
                     onClick={() => navigate('/documents')}
                     className="hover:bg-gray-50 transition-colors cursor-pointer group"
                   >
                     {/* Document ID */}
                     <td className="px-5 py-3.5 whitespace-nowrap">
                       <span className="font-mono text-[11px] font-semibold text-blue-600
                         group-hover:underline underline-offset-2">
                         {doc.doc_uuid ?? '—'}
                       </span>
                     </td>

                     {/* Template */}
                     <td className="px-5 py-3.5 max-w-[180px]">
                       <span className="text-[13px] text-gray-900 font-medium truncate block">
                         {doc.template_name ?? '—'}
                       </span>
                     </td>

                     {/* Generated By */}
                     <td className="px-5 py-3.5">
                       <div className="flex items-center gap-2">
                         <div
                           className="w-6 h-6 rounded-full flex items-center justify-center
                             flex-shrink-0 text-[9px] font-black text-white"
                           style={{ backgroundColor: ACCENT }}>
                           {(doc.generated_by_name ?? '?').charAt(0).toUpperCase()}
                         </div>
                         <span className="text-[13px] text-gray-600 truncate max-w-[130px]">
                           {doc.generated_by_name ?? '—'}
                         </span>
                       </div>
                     </td>

                     {/* Status */}
                     <td className="px-5 py-3.5 whitespace-nowrap">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
                         text-[10px] font-semibold ${cfg.cls}`}>
                         {cfg.label}
                       </span>
                     </td>

                     {/* Created Date */}
                     <td className="px-5 py-3.5 whitespace-nowrap">
                       <span className="text-[12px] text-gray-500">
                         {fmtDate(doc.generated_at)}
                       </span>
                     </td>
                   </tr>
                 );
               })
            }
          </tbody>
        </table>
      </div>

      {/* ── Mobile card list ── */}
      <div className="md:hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="px-5 py-4 space-y-2">
                <div className="flex justify-between">
                  <Pulse h="h-3" w="w-28" />
                  <Pulse h="h-5" w="w-16" rounded="rounded-full" />
                </div>
                <Pulse h="h-3" w="w-40" />
                <div className="flex justify-between">
                  <Pulse h="h-2.5" w="w-24" />
                  <Pulse h="h-2.5" w="w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
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
        ) : !list.length ? (
          <div className="flex flex-col items-center justify-center py-10 gap-1.5">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p className="text-sm text-gray-400 font-medium">No documents yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map(doc => {
              const cfg = STATUS_CFG[doc.status]
                ?? { label: doc.status ?? '—', cls: 'bg-gray-100 text-gray-600' };
              return (
                <div
                  key={doc.doc_uuid ?? doc.id}
                  onClick={() => navigate('/documents')}
                  className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-[11px] font-bold text-blue-600">
                      {doc.doc_uuid ?? '—'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full
                      text-[10px] font-semibold flex-shrink-0 ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-gray-900 truncate">
                    {doc.template_name ?? '—'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-gray-500 truncate">
                      {doc.generated_by_name ?? '—'}
                    </span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                      {fmtDate(doc.generated_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. RECENT NOTIFICATIONS
//    Data source: /api/notifications
// ─────────────────────────────────────────────────────────────────────────────
const NOTIF_CFG = {
  approval:  { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',                                                            color: '#f59e0b', bg: '#fffbeb' },
  delivery:  { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',   color: '#10b981', bg: '#f0fdf4' },
  user:      { icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: '#3b82f6', bg: '#eff6ff' },
  rejection: { icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',                                    color: '#ef4444', bg: '#fef2f2' },
  activity:  { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: '#6b7280', bg: '#f9fafb' },
  verify:    { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: '#2563eb', bg: '#eff6ff' },
};

export function RecentNotifications({ notifications, loading, error, onRetry }) {
  const list        = notifications ?? [];
  const unreadCount = list.filter(n => n.unread).length;

  return (
    <Card noPad>
      <CardHeader
        title="Notifications"
        action={
          unreadCount > 0 && !loading && !error && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {unreadCount} new
            </span>
          )
        }
      />
      <div className="divide-y divide-gray-50">
        {/* Loading */}
        {loading && [1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-start gap-3 px-5 py-3.5">
            <Pulse h="h-8" w="w-8" rounded="rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Pulse h="h-2.5" w="w-4/5" />
              <Pulse h="h-2" w="w-20" />
            </div>
          </div>
        ))}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Failed to load notifications</p>
            {onRetry && (
              <button onClick={onRetry}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold
                  underline underline-offset-2 transition-colors">
                Retry
              </button>
            )}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && !list.length && (
          <NoData message="No notifications" />
        )}

        {/* List */}
        {!loading && !error && list.map(n => {
          const cfg = NOTIF_CFG[n.type] || NOTIF_CFG.activity;
          return (
            <div key={n.id}
              className={`flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors
                ${n.unread ? 'bg-blue-50/30' : ''}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: cfg.bg }}>
                <svg className="w-4 h-4" style={{ color: cfg.color }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={cfg.icon}/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-gray-800 leading-snug line-clamp-2">{n.text}</p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.time)}</p>
              </div>
              {n.unread && (
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 bg-blue-500" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI ROW — shared by both admin dashboards
// Derives E-Signed and Delivered from status_breakdown (real data only)
// ─────────────────────────────────────────────────────────────────────────────
export function AdminKpiRow({ d, loading }) {
  // E-Signed  = all docs with status 'signed'   (from status_breakdown)
  // Delivered = docs with status 'delivered' OR 'hand_delivered'
  // countByStatus returns null when breakdown is null/undefined (API not yet returned),
  // and returns 0 when breakdown is [] or has no matching rows — both are valid.
  const eSigned   = countByStatus(d.status_breakdown ?? null, 'signed');
  const delivered = countByStatus(d.status_breakdown ?? null, 'delivered', 'hand_delivered');

  // docs_today and pending_approvals come directly from the API as numbers.
  // Coerce to Number so string "0" renders correctly; keep null if API returned null.
  const docsToday     = d.docs_today        !== null && d.docs_today        !== undefined ? Number(d.docs_today)        : null;
  const pendingApprovals = d.pending_approvals !== null && d.pending_approvals !== undefined ? Number(d.pending_approvals) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

      {/* Documents Generated Today — source: docs_today from /api/audit/dashboard */}
      <KpiCard loading={loading}
        label="Documents Generated Today"
        value={docsToday}
        accentColor="#2563eb" accentBg="#eff6ff"
        icon="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />

      {/* Pending Approvals — source: pending_approvals from /api/audit/dashboard */}
      <KpiCard loading={loading}
        label="Pending Approvals"
        value={pendingApprovals}
        accentColor="#f59e0b" accentBg="#fffbeb"
        icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />

      {/* E-Signed Documents — source: status_breakdown[status='signed'] */}
      <KpiCard loading={loading}
        label="E-Signed Documents"
        value={eSigned}
        accentColor="#3b82f6" accentBg="#eff6ff"
        icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />

      {/* Delivered Documents — source: status_breakdown[status='delivered'|'hand_delivered'] */}
      <KpiCard loading={loading}
        label="Delivered Documents"
        value={delivered}
        accentColor="#10b981" accentBg="#f0fdf4"
        icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />

    </div>
  );
}
