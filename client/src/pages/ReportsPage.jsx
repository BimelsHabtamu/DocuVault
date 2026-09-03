/**
 * Reports Page — Admin Console
 * "What is happening in the system?"
 *
 * Real data only. API: GET /api/audit/reports
 * Filters: date range, status, category
 * Sections: KPI cards, Activity line chart, Category bar chart, Top Templates bar chart
 * Export: triggers GET /api/audit/export/csv with the same filters
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';

// ─────────────────────────────────────────────────────────────────────────────
// Design constants (matches the white admin console palette)
// ─────────────────────────────────────────────────────────────────────────────
const BLUE    = '#2563eb';
const VIOLET  = '#8b5cf6';
const EMERALD = '#10b981';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const GRAY    = '#6b7280';

const STATUS_COLORS = {
  draft:          '#9ca3af',
  pending:        '#f59e0b',
  signed:         '#3b82f6',
  delivered:      '#10b981',
  hand_delivered: '#8b5cf6',
  rejected:       '#ef4444',
};
const STATUS_LABELS = {
  draft: 'Draft', pending: 'Pending', signed: 'Signed',
  delivered: 'Delivered', hand_delivered: 'Hand Delivered', rejected: 'Rejected',
};

const CAT_COLORS = [BLUE, VIOLET, EMERALD, AMBER, RED, GRAY,
  '#0ea5e9', '#f97316', '#14b8a6', '#a855f7'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US',
    { month: 'short', day: 'numeric', year: 'numeric' });
}
function dayLabel(iso) {
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton pulse
// ─────────────────────────────────────────────────────────────────────────────
function Pulse({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`animate-pulse bg-gray-200 ${h} ${w} ${rounded}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Card({ children, className = '', noPad = false }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {noPad ? children : <div className="p-5 sm:p-6">{children}</div>}
    </div>
  );
}
function CardHeader({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-gray-100 flex-wrap gap-2">
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
function EmptyChart({ message = 'No data for this period' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
      <p className="text-sm font-medium text-gray-400">{message}</p>
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
        <Pulse h="h-3" w="w-24" />
        <Pulse h="h-8" w="w-16" />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group"
      style={{
        borderLeft: `3px solid ${accentColor}`,
        borderTop: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
      }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="text-[2.2rem] font-black text-gray-900 leading-none mt-1.5 tabular-nums">
            {Number(value ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
          group-hover:scale-105 transition-transform" style={{ backgroundColor: accentBg }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: accentColor }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart 1 — Activity line chart (generated / signed / delivered per day)
// ─────────────────────────────────────────────────────────────────────────────
const LINE_SERIES = [
  { key: 'generated', label: 'Generated', color: BLUE    },
  { key: 'signed',    label: 'Signed',    color: VIOLET  },
  { key: 'delivered', label: 'Delivered', color: EMERALD },
];

function ActivityLineChart({ data, loading }) {
  const [hovered, setHovered] = useState(null);

  if (loading) {
    return (
      <Card noPad>
        <CardHeader title="Document Activity" sub="Generated · Signed · Delivered" />
        <div className="px-6 py-8 space-y-3">{[1,2,3].map(i => <Pulse key={i} h="h-4" />)}</div>
      </Card>
    );
  }

  const hasData = data?.some(d => d.generated > 0 || d.signed > 0 || d.delivered > 0);
  if (!data?.length || !hasData) {
    return (
      <Card noPad>
        <CardHeader title="Document Activity" sub="Generated · Signed · Delivered" />
        <EmptyChart />
      </Card>
    );
  }

  const W = 600, H = 200, PL = 42, PR = 20, PT = 16, PB = 36;
  const PW = W - PL - PR, PH = H - PT - PB;
  const n  = data.length;

  const allV = data.flatMap(d => [d.generated, d.signed, d.delivered]);
  const max  = Math.max(...allV, 1);
  const yMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const Y_TICKS = 4;

  const xAt = i => n < 2 ? PL + PW / 2 : PL + (i / (n - 1)) * PW;
  const yAt = v => PT + PH - (v / yMax) * PH;

  const polyPts = key => data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ');
  const areaD   = key => {
    const pts = data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`);
    return `M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${xAt(n-1).toFixed(1)},${(PT+PH).toFixed(1)} L ${PL},${(PT+PH).toFixed(1)} Z`;
  };

  return (
    <Card noPad>
      <CardHeader
        title="Document Activity"
        sub={`${fmtDate(data[0]?.date)} → ${fmtDate(data[n-1]?.date)}`}
        action={
          <div className="flex items-center gap-4 flex-wrap">
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
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet"
          style={{ userSelect: 'none' }} onMouseLeave={() => setHovered(null)}
          role="img" aria-label="Document activity chart">

          {/* Y grid + labels */}
          {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
            const frac = i / Y_TICKS;
            const y = PT + PH - frac * PH;
            return (
              <g key={i}>
                <line x1={PL} y1={y} x2={W - PR} y2={y}
                  stroke={i === 0 ? '#e5e7eb' : '#f3f4f6'}
                  strokeWidth={i === 0 ? 1 : 0.8} strokeDasharray={i === 0 ? 'none' : '4 3'}/>
                <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af" fontWeight="500">
                  {Math.round(yMax * frac)}
                </text>
              </g>
            );
          })}

          {/* Area fills */}
          {LINE_SERIES.map(s => <path key={`a-${s.key}`} d={areaD(s.key)} fill={s.color} opacity={0.05}/>)}

          {/* Lines */}
          {LINE_SERIES.map(s => (
            <polyline key={`l-${s.key}`} points={polyPts(s.key)}
              fill="none" stroke={s.color} strokeWidth={2.2}
              strokeLinejoin="round" strokeLinecap="round"/>
          ))}

          {/* Hover zones */}
          {data.map((d, i) => (
            <rect key={`hz-${i}`}
              x={xAt(i) - (n > 1 ? PW / (n - 1) / 2 : PW / 2)} y={PT}
              width={n > 1 ? PW / (n - 1) : PW} height={PH}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHovered(i)}
            />
          ))}

          {/* Hover tooltip */}
          {hovered !== null && (() => {
            const d  = data[hovered];
            const tx = xAt(hovered);
            const BOX_W = 140, BOX_H = 80;
            const flipped = tx > W * 0.6;
            const bx = flipped ? tx - BOX_W - 12 : tx + 12;

            return (
              <g pointerEvents="none">
                <line x1={tx} y1={PT} x2={tx} y2={PT+PH}
                  stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3"/>
                {LINE_SERIES.map(s => (
                  <circle key={s.key} cx={tx} cy={yAt(d[s.key])}
                    r={4} fill="white" stroke={s.color} strokeWidth={2.2}/>
                ))}
                <rect x={bx} y={PT} width={BOX_W} height={BOX_H}
                  rx={7} fill="white" stroke="#e5e7eb" strokeWidth={1}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.09))' }}/>
                <text x={bx+10} y={PT+16} fontSize={9.5} fontWeight="700" fill="#374151">
                  {dayLabel(d.date)}
                </text>
                <line x1={bx+10} y1={PT+22} x2={bx+BOX_W-10} y2={PT+22} stroke="#f3f4f6" strokeWidth={1}/>
                {LINE_SERIES.map((s, si) => (
                  <g key={s.key}>
                    <circle cx={bx+14} cy={PT+33+si*16} r={3.5} fill={s.color}/>
                    <text x={bx+24} y={PT+37+si*16} fontSize={9.5} fill="#6b7280">{s.label}:</text>
                    <text x={bx+BOX_W-10} y={PT+37+si*16}
                      fontSize={9.5} fontWeight="700" fill="#111827" textAnchor="end">
                      {d[s.key]}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          {/* X axis labels — date */}
          {data.map((d, i) => {
            // Only render every Nth label when there are many points to avoid crowding
            const step = data.length > 14 ? Math.ceil(data.length / 7) : 1;
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text key={`xl-${i}`} x={xAt(i)} y={PT+PH+18}
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
// Chart 2 — Documents by Category (horizontal bar)
// ─────────────────────────────────────────────────────────────────────────────
function CategoryChart({ data, loading }) {
  if (loading) {
    return (
      <Card noPad>
        <CardHeader title="Documents by Category" />
        <div className="px-6 py-6 space-y-5">
          {[80, 55, 35, 20].map((w, i) => (
            <div key={i} className="space-y-1.5">
              <Pulse h="h-3" w="w-1/2" />
              <div className="flex gap-3">
                <div className="h-7 bg-gray-100 animate-pulse rounded-md flex-1" style={{ maxWidth: `${w}%` }}/>
                <Pulse h="h-3" w="w-8" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card noPad>
        <CardHeader title="Documents by Category" />
        <EmptyChart />
      </Card>
    );
  }

  const max     = Math.max(...data.map(r => r.count), 1);
  const BAR_H   = 26;
  const ROW_H   = 14 + BAR_H;   // label line + bar
  const GAP     = 24;
  const PAD_T   = 4, PAD_B = 8, PAD_R = 52;
  const CHART_W = 500;
  const BAR_AREA = CHART_W - PAD_R;
  const CHART_H  = data.length * (ROW_H + GAP) - GAP + PAD_T + PAD_B;

  const bw = count => Math.max(4, Math.round((count / max) * BAR_AREA));

  return (
    <Card noPad>
      <CardHeader
        title="Documents by Category"
        sub={`${data.reduce((s, r) => s + r.count, 0).toLocaleString()} total`}
      />
      <div className="px-5 sm:px-6 pt-4 pb-5">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full overflow-visible"
          preserveAspectRatio="xMinYMid meet" role="img" aria-label="Documents by category chart">
          {data.map((row, i) => {
            const w      = bw(row.count);
            const rowTop = PAD_T + i * (ROW_H + GAP);
            const labelY = rowTop + 11;
            const barY   = rowTop + 14;
            const color  = CAT_COLORS[i % CAT_COLORS.length];
            const inside = w > 50;
            const name   = row.category?.length > 42 ? row.category.slice(0, 40) + '…' : row.category;
            return (
              <g key={row.category ?? i}>
                <text x={0} y={labelY} fontSize={10.5} fontWeight="600" fill="#374151">{name}</text>
                <rect x={0} y={barY} width={BAR_AREA} height={BAR_H} rx={5} fill="#f3f4f6"/>
                <rect x={0} y={barY} width={w} height={BAR_H} rx={5} fill={color}/>
                {inside
                  ? <text x={w-8} y={barY+BAR_H/2+4} fontSize={11} fontWeight="800" fill="white" textAnchor="end">
                      {row.count.toLocaleString()}
                    </text>
                  : <text x={w+8} y={barY+BAR_H/2+4} fontSize={11} fontWeight="700" fill={color} textAnchor="start">
                      {row.count.toLocaleString()}
                    </text>
                }
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart 3 — Top 5 Templates (horizontal bar)
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATE_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

function TopTemplatesChart({ data, loading }) {
  if (loading) {
    return (
      <Card noPad>
        <CardHeader title="Top 5 Templates" sub="By usage in selected period" />
        <div className="px-6 py-6 space-y-5">
          {[80, 60, 45, 28, 15].map((w, i) => (
            <div key={i} className="space-y-1.5">
              <Pulse h="h-3" w="w-2/3" />
              <div className="flex gap-3">
                <div className="h-7 bg-gray-100 animate-pulse rounded-md flex-1" style={{ maxWidth: `${w}%` }}/>
                <Pulse h="h-3" w="w-8" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card noPad>
        <CardHeader title="Top 5 Templates" sub="By usage in selected period" />
        <EmptyChart message="No template usage in this period" />
      </Card>
    );
  }

  const list    = data.slice(0, 5);
  const max     = Math.max(...list.map(t => t.usage_count), 1);
  const BAR_H   = 26, ROW_H = 14 + BAR_H, GAP = 24;
  const PAD_T   = 4, PAD_B = 8, PAD_R = 52, CHART_W = 500;
  const BAR_AREA = CHART_W - PAD_R;
  const CHART_H  = list.length * (ROW_H + GAP) - GAP + PAD_T + PAD_B;
  const bw = v => Math.max(4, Math.round((v / max) * BAR_AREA));

  return (
    <Card noPad>
      <CardHeader
        title="Top 5 Templates"
        sub="By usage in selected period"
      />
      <div className="px-5 sm:px-6 pt-4 pb-5">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full overflow-visible"
          preserveAspectRatio="xMinYMid meet" role="img" aria-label="Top 5 templates chart">
          {list.map((t, i) => {
            const w      = bw(t.usage_count);
            const rowTop = PAD_T + i * (ROW_H + GAP);
            const labelY = rowTop + 11;
            const barY   = rowTop + 14;
            const color  = TEMPLATE_COLORS[i];
            const inside = w > 50;
            const name   = t.name?.length > 42 ? t.name.slice(0, 40) + '…' : t.name;
            return (
              <g key={t.name ?? i}>
                <text x={0} y={labelY} fontSize={10.5} fontWeight="600" fill="#374151">{name}</text>
                <rect x={0} y={barY} width={BAR_AREA} height={BAR_H} rx={5} fill="#f3f4f6"/>
                <rect x={0} y={barY} width={w} height={BAR_H} rx={5} fill={color}/>
                {t.category && w > 90 && (
                  <text x={10} y={barY+BAR_H/2+4} fontSize={8.5}
                    fill="rgba(255,255,255,0.8)" fontWeight="500">
                    {t.category}
                  </text>
                )}
                {inside
                  ? <text x={w-8} y={barY+BAR_H/2+4} fontSize={11} fontWeight="800"
                      fill="white" textAnchor="end">
                      {t.usage_count.toLocaleString()}
                    </text>
                  : <text x={w+8} y={barY+BAR_H/2+4} fontSize={11} fontWeight="700"
                      fill={color} textAnchor="start">
                      {t.usage_count.toLocaleString()}
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
                  style={{ backgroundColor: TEMPLATE_COLORS[i] }}/>
                <span className="text-[11px] text-gray-600 truncate">{t.name}</span>
                {t.category && (
                  <span className="text-[10px] text-gray-400 truncate hidden sm:inline">
                    · {t.category}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-gray-900 tabular-nums flex-shrink-0">
                {t.usage_count.toLocaleString()}
                <span className="text-gray-400 font-normal ml-1">
                  {t.usage_count === 1 ? 'doc' : 'docs'}
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
// Status breakdown mini-chart (horizontal progress bars)
// ─────────────────────────────────────────────────────────────────────────────
function StatusBreakdown({ data, total, loading }) {
  if (loading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-gray-900 mb-4">Status Breakdown</p>
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between"><Pulse h="h-2.5" w="w-20"/><Pulse h="h-2.5" w="w-8"/></div>
              <Pulse h="h-2"/>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data?.length || total === 0) {
    return (
      <Card>
        <p className="text-sm font-semibold text-gray-900 mb-2">Status Breakdown</p>
        <EmptyChart message="No documents" />
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-semibold text-gray-900 mb-1">Status Breakdown</p>
      <p className="text-[11px] text-gray-400 mb-4">{total.toLocaleString()} total documents</p>
      <div className="space-y-3.5">
        {data.map(row => {
          const color = STATUS_COLORS[row.status] || GRAY;
          const label = STATUS_LABELS[row.status] || row.status;
          const pct   = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.status}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}/>
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{pct}%</span>
                  <span className="text-xs font-bold text-gray-900 tabular-nums w-8 text-right">
                    {row.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: color }}/>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports Page root
// ─────────────────────────────────────────────────────────────────────────────
const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'draft',          label: 'Draft' },
  { value: 'pending',        label: 'Pending' },
  { value: 'signed',         label: 'Signed' },
  { value: 'delivered',      label: 'Delivered' },
  { value: 'hand_delivered', label: 'Hand Delivered' },
  { value: 'rejected',       label: 'Rejected' },
];

// Default: last 30 days
function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toLocaleDateString('en-CA');
}
function defaultTo() {
  return new Date().toLocaleDateString('en-CA');
}

export default function ReportsPage() {
  const [fromDate,   setFromDate]   = useState(defaultFrom());
  const [toDate,     setToDate]     = useState(defaultTo());
  const [status,     setStatus]     = useState('');
  const [category,   setCategory]   = useState('');

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [exporting,  setExporting]  = useState(false);

  // All categories from the data for the filter dropdown
  const allCategories = data?.category_breakdown?.map(r => r.category).filter(Boolean) ?? [];

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate)   params.append('to_date',   toDate);
    if (status)   params.append('status',    status);
    if (category) params.append('category',  category);

    axiosInstance.get(`/audit/reports?${params}`)
      .then(res => setData(res.data))
      .catch(() => { setError(true); setData(null); })
      .finally(() => setLoading(false));
  }, [fromDate, toDate, status, category]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // CSV export — reuses the existing /api/audit/export/csv endpoint with same filters
  const handleExport = () => {
    setExporting(true);
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate)   params.append('to_date',   toDate);
    if (status)   params.append('status',    status);
    if (category) params.append('category',  category);

    const token = localStorage.getItem('token');
    fetch(`/api/audit/export/csv?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error('Export failed');
        return r.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `docuvault-report-${fromDate || 'all'}-to-${toDate || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert('Export failed — no data matches the current filters.'))
      .finally(() => setExporting(false));
  };

  const kpis = data?.kpis ?? {};
  const hasAnyData = kpis.total > 0;

  return (
    <div className="space-y-5 pb-8">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">What is happening in the system?</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || loading || !hasAnyData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            bg-emerald-600 hover:bg-emerald-700 text-white transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed self-start"
        >
          {exporting
            ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
          }
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* ── Filters ── */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">

          {/* Date from */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              From
            </label>
            <input type="date" value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
          </div>

          {/* Date to */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              To
            </label>
            <input type="date" value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Status
            </label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                min-w-[140px]">
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Category — populated from real data */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                min-w-[160px]">
              <option value="">All Categories</option>
              {allCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Clear */}
          {(status || category || fromDate !== defaultFrom() || toDate !== defaultTo()) && (
            <button
              onClick={() => {
                setFromDate(defaultFrom());
                setToDate(defaultTo());
                setStatus('');
                setCategory('');
              }}
              className="px-3 py-2 text-xs font-semibold text-red-500 hover:text-red-700
                hover:bg-red-50 rounded-lg transition-colors">
              Clear filters
            </button>
          )}

          {/* Date range summary */}
          {fromDate && toDate && (
            <span className="text-xs text-gray-400 ml-auto self-center">
              {fmtDate(fromDate)} — {fmtDate(toDate)}
            </span>
          )}
        </div>
      </Card>

      {/* ── API error banner ── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50
          border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>
            Failed to load report data.{' '}
            <button onClick={fetchReport} className="underline font-semibold">Retry</button>
          </span>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard loading={loading} label="Total Documents" value={kpis.total}
          accentColor={BLUE}    accentBg="#eff6ff"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
        <KpiCard loading={loading} label="Signed" value={kpis.signed}
          accentColor={VIOLET}  accentBg="#f5f3ff"
          icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
        <KpiCard loading={loading} label="Delivered" value={kpis.delivered}
          accentColor={EMERALD} accentBg="#f0fdf4"
          icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
        <KpiCard loading={loading} label="Pending" value={kpis.pending}
          accentColor={AMBER}   accentBg="#fffbeb"
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard loading={loading} label="Rejected" value={kpis.rejected}
          accentColor={RED}     accentBg="#fef2f2"
          icon="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      {/* ── Activity line chart (full width) ── */}
      <ActivityLineChart data={data?.activity_series ?? null} loading={loading} />

      {/* ── Category chart + Status breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <CategoryChart data={data?.category_breakdown ?? null} loading={loading} />
        </div>
        <div className="lg:col-span-1">
          <StatusBreakdown
            data={data?.status_breakdown ?? null}
            total={kpis.total ?? 0}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Top 5 Templates (full width) ── */}
      <TopTemplatesChart data={data?.top_templates ?? null} loading={loading} />
    </div>
  );
}
