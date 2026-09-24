import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { auditService, deliveryService } from '../services/workflowService';
import { ROLES, CAN_VIEW_AUDIT_LOGS } from '../utils/roles';
import { describeAuditEvent } from '../components/audit/auditActionMap';
import './Dashboard.css';

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  draft:     '#94A3B8',
  pending:   '#F59E0B',
  signed:    '#0F766E',
  rejected:  '#DC2626',
  delivered: '#14B8A6',
};

function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: status badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status, sigStatus }) {
  const { t } = useTranslation('layout');
  const effective =
    status === 'draft' && sigStatus === 'rejected' ? 'rejected' : status;

  const tone =
    effective === 'signed'    ? 'green'  :
    effective === 'delivered' ? 'blue'   :
    effective === 'pending'   ? 'amber'  :
    effective === 'rejected'  ? 'red'    : 'slate';

  const label =
    effective === 'signed'    ? t('dashboard.docBadge.approved')       :
    effective === 'delivered' ? t('dashboard.docBadge.delivered')      :
    effective === 'pending'   ? t('dashboard.docBadge.pendingApproval'):
    effective === 'rejected'  ? t('dashboard.docBadge.rejected')       :
    effective === 'draft'     ? t('dashboard.docBadge.draft')          : effective;

  return (
    <span className={`db-badge db-badge-${tone}`}>
      <span className="db-badge-dot" />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: bar chart (14-day generation trend)
// ─────────────────────────────────────────────────────────────────────────────
function BarChart({ daily }) {
  const { t } = useTranslation('layout');
  const width = 540, height = 160;
  const pad = { top: 8, right: 6, bottom: 24, left: 6 };
  const max = Math.max(1, ...daily.map((d) => d.count));
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const barGap = 5;
  const barW = chartW / daily.length - barGap;

  return (
    <svg
      className="db-bar-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t('dashboard.barChart.ariaLabel')}
    >
      {daily.map((d, i) => {
        const barH = (d.count / max) * chartH;
        const x = pad.left + i * (barW + barGap);
        const y = pad.top + (chartH - barH);
        const label = new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return (
          <g key={d.day}>
            <rect
              x={x} y={y}
              width={Math.max(barW, 2)}
              height={Math.max(barH, d.count > 0 ? 2 : 0)}
              rx="3" fill="var(--accent)" opacity="0.9"
            >
              <title>{t('dashboard.barChart.tooltip', { date: label, count: d.count })}</title>
            </rect>
            {(i % 2 === 0 || daily.length <= 8) && (
              <text
                x={x + barW / 2} y={height - 5}
                textAnchor="middle"
                className="db-chart-axis-label"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: status donut
// ─────────────────────────────────────────────────────────────────────────────
function StatusDonut({ statusBreakdown }) {
  const { t } = useTranslation('layout');

  const STATUS_LABELS = {
    draft:     t('dashboard.statusLabels.draft'),
    pending:   t('dashboard.statusLabels.pending'),
    signed:    t('dashboard.statusLabels.signed'),
    rejected:  t('dashboard.statusLabels.rejected'),
    delivered: t('dashboard.statusLabels.delivered'),
  };

  const total = statusBreakdown.reduce((s, r) => s + Number(r.count), 0) || 1;
  let cumulative = 0;
  const stops = statusBreakdown.map((r) => {
    const start = (cumulative / total) * 360;
    cumulative += Number(r.count);
    const end = (cumulative / total) * 360;
    const color = STATUS_COLORS[r.status] || '#94A3B8';
    return `${color} ${start}deg ${end}deg`;
  });
  const gradient = stops.length
    ? `conic-gradient(${stops.join(', ')})`
    : 'var(--bg-subtle)';

  return (
    <div className="db-donut-wrap">
      <div className="db-donut-ring-wrap" style={{ background: gradient }}>
        <div className="db-donut-hole">
          <span className="db-donut-total">{total}</span>
          <span className="db-donut-total-label">{t('dashboard.statusBreakdown.totalDocs')}</span>
        </div>
      </div>
      <div className="db-donut-legend">
        {statusBreakdown.map((r) => (
          <div className="db-donut-legend-row" key={r.status}>
            <span className="db-donut-dot" style={{ background: STATUS_COLORS[r.status] || '#94A3B8' }} />
            <span className="db-donut-legend-label">{STATUS_LABELS[r.status] || r.status}</span>
            <span className="db-donut-legend-count">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: activity feed row
// ─────────────────────────────────────────────────────────────────────────────
function ActivityItem({ log }) {
  const { stage, tone } = describeAuditEvent(log);
  return (
    <div className="db-activity-item">
      <span className={`db-activity-dot db-activity-dot-${tone}`} />
      <div className="db-activity-body">
        <div className="db-activity-action">{stage}</div>
        <div className="db-activity-meta">
          {log.doc_uuid && <><b>{log.doc_uuid}</b> · </>}
          {log.template_name && <>{log.template_name} · </>}
          {log.actor_name && <>{log.actor_name}</>}
          {log.doc_status && <> · <StatusBadge status={log.doc_status} /></>}
        </div>
      </div>
      <span className="db-activity-time">{fmtRelative(log.timestamp)}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-action icon SVGs
// ─────────────────────────────────────────────────────────────────────────────
function QAIcon({ children }) {
  return <div className="db-action-icon">{children}</div>;
}

function IcoGenerate() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="11" x2="12" y2="17"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
  );
}
function IcoTemplates() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
      <path d="M14 3v4h4"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  );
}
function IcoUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3"/>
      <path d="M3.5 19C3.9 15.9 6.2 14 9 14C11.8 14 14.1 15.9 14.5 19"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      <path d="M21 19c-.5-2.8-2.5-4.5-4.5-5"/>
    </svg>
  );
}
function IcoAudit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5L19 6.3V11C19 15.4 16.1 19.3 12 20.5C7.9 19.3 5 15.4 5 11V6.3L12 3.5Z"/>
      <path d="M9 11.5l2.2 2.2 4.1-4.2"/>
    </svg>
  );
}
function IcoDocTracking() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M9 21V9"/>
    </svg>
  );
}
function IcoApprovals() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5"/>
      <path d="M12 7.5V12L15 14"/>
    </svg>
  );
}
function IcoVerify() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/>
      <path d="M8.5 11l1.7 1.8 3.3-3.6"/>
      <path d="M16.5 16.5L21 21"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div className={`db-kpi-card${accent ? ` db-kpi-${accent}` : ''}`}>
      <div className="db-kpi-header">
        <span className="db-kpi-label">{label}</span>
        {icon && <div className="db-kpi-icon">{icon}</div>}
      </div>
      <div className="db-kpi-value">{value ?? '—'}</div>
      {sub && <span className="db-kpi-sub">{sub}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick action button
// ─────────────────────────────────────────────────────────────────────────────
function QuickAction({ label, icon, onClick }) {
  return (
    <button type="button" className="db-action-btn" onClick={onClick}>
      <QAIcon>{icon}</QAIcon>
      <span className="db-action-label">{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin / System Admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation('layout');

  const [kpis, setKpis] = useState(null);
  const [trends, setTrends] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [ownershipReport, setOwnershipReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, trendsRes, auditRes, ownershipRes] = await Promise.all([
        auditService.getDashboardKpis(),
        auditService.getDashboardTrends(),
        auditService.getAuditTrail({ limit: 10 }),
        deliveryService.getOwnershipReport().catch(() => null),
      ]);
      setKpis(kpisRes.data);
      setTrends(trendsRes.data);
      setAuditLogs(auditRes.data?.slice(0, 10) ?? []);
      setOwnershipReport(ownershipRes?.data ?? null);
    } catch (err) {
      setError(err.message || t('dashboard.failedToLoad'));
      showToast(err.message || t('dashboard.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  const totalDocs = trends
    ? trends.statusBreakdown.reduce((s, r) => s + Number(r.count), 0)
    : null;
  const signed = trends
    ? (trends.statusBreakdown.find((r) => r.status === 'signed')?.count ?? 0)
    : null;
  const delivered = trends
    ? (trends.statusBreakdown.find((r) => r.status === 'delivered')?.count ?? 0)
    : null;
  const pending = trends
    ? (trends.statusBreakdown.find((r) => r.status === 'pending')?.count ?? 0)
    : null;

  if (loading) {
    return (
      <>
        <div className="db-kpi-row">
          {[0,1,2,3,4].map((i) => <div key={i} className="db-skeleton" />)}
        </div>
        <div className="db-section-row">
          <div className="db-skeleton" style={{ height: 220 }} />
          <div className="db-skeleton" style={{ height: 220 }} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="db-error">
        <p className="db-error-title">{t('dashboard.couldntLoad')}</p>
        <p className="db-error-desc">{error}</p>
        <button type="button" className="db-retry-btn" onClick={load}>{t('dashboard.retryBtn')}</button>
      </div>
    );
  }

  return (
    <>
      {/* ── KPI Row ── */}
      <div className="db-kpi-row">
        <KpiCard
          label={t('dashboard.kpi.totalDocuments')}
          value={totalDocs}
          sub={t('dashboard.kpi.allTime')}
          accent="brand"
          icon={<IcoTemplates />}
        />
        <KpiCard
          label={t('dashboard.kpi.generatedToday')}
          value={kpis?.docsGeneratedToday}
          sub={t('dashboard.kpi.liveCount')}
          icon={<IcoGenerate />}
        />
        <KpiCard
          label={t('dashboard.kpi.pendingApprovals')}
          value={pending}
          sub={t('dashboard.kpi.awaitingReview')}
          accent="amber"
          icon={<IcoApprovals />}
        />
        <KpiCard
          label={t('dashboard.kpi.approvedSigned')}
          value={signed}
          sub={t('dashboard.kpi.readyForDelivery')}
          accent="green"
          icon={<IcoVerify />}
        />
        <KpiCard
          label={t('dashboard.kpi.delivered')}
          value={delivered}
          sub={t('dashboard.kpi.sentToRecipients')}
          accent="indigo"
          icon={<IcoDocTracking />}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="db-section-row" style={{ marginBottom: 20 }}>
        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.generationTrend.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.generationTrend.subtitle')}</p>
            </div>
          </div>
          {trends.daily.every((d) => d.count === 0) ? (
            <div className="db-empty">
              <div className="db-empty-icon">📊</div>
              <p className="db-empty-title">{t('dashboard.generationTrend.noActivityTitle')}</p>
              <p className="db-empty-desc">{t('dashboard.generationTrend.noActivityDesc')}</p>
            </div>
          ) : (
            <BarChart daily={trends.daily} />
          )}
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.statusBreakdown.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.statusBreakdown.subtitle')}</p>
            </div>
          </div>
          {trends.statusBreakdown.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty-icon">🗂</div>
              <p className="db-empty-title">{t('dashboard.statusBreakdown.noDocsTitle')}</p>
            </div>
          ) : (
            <StatusDonut statusBreakdown={trends.statusBreakdown} />
          )}
        </div>
      </div>

      {/* ── Recent Activity + Top Templates ── */}
      <div className="db-section-row" style={{ marginBottom: 20 }}>
        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.recentActivity.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.recentActivity.subtitleAll')}</p>
            </div>
            <button type="button" className="db-card-link" onClick={() => navigate('/audit-logs')}>
              {t('dashboard.recentActivity.viewAll')}
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty-icon">📋</div>
              <p className="db-empty-title">{t('dashboard.recentActivity.noActivityTitle')}</p>
              <p className="db-empty-desc">{t('dashboard.recentActivity.noActivityDesc')}</p>
            </div>
          ) : (
            <div className="db-activity-list">
              {auditLogs.map((log) => (
                <ActivityItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.topTemplates.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.topTemplates.subtitle')}</p>
            </div>
            <button type="button" className="db-card-link" onClick={() => navigate('/templates')}>
              {t('dashboard.topTemplates.manage')}
            </button>
          </div>
          {!kpis?.topTemplates?.length ? (
            <div className="db-empty">
              <div className="db-empty-icon">📄</div>
              <p className="db-empty-title">{t('dashboard.topTemplates.noDocsTitle')}</p>
              <p className="db-empty-desc">{t('dashboard.topTemplates.noDocsDesc')}</p>
              <button type="button" className="db-empty-cta" onClick={() => navigate('/templates')}>
                {t('dashboard.topTemplates.manageTemplates')}
              </button>
            </div>
          ) : (
            <ol className="db-template-list">
              {kpis.topTemplates.map((t_item, idx) => {
                const maxUsage = kpis.topTemplates[0]?.usageCount || 1;
                const pct = Math.round((t_item.usageCount / maxUsage) * 100);
                return (
                  <li key={t_item.id} className="db-template-item">
                    <span className="db-template-rank">{idx + 1}</span>
                    <span className="db-template-name" title={t_item.name}>{t_item.name}</span>
                    <div className="db-template-bar-wrap">
                      <div className="db-template-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="db-template-count">{t_item.usageCount}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* ── Avg Approval Time + Delivery Stats ── */}
      {(kpis?.avgApprovalTimeMinutes != null || ownershipReport) && (
        <div className={`db-section-row${ownershipReport ? '' : ' db-section-row-3'}`} style={{ marginBottom: 20 }}>
          {kpis?.avgApprovalTimeMinutes != null && (
            <div className="db-card">
              <div className="db-card-header">
                <div>
                  <h3 className="db-card-title">{t('dashboard.approvalPerf.title')}</h3>
                  <p className="db-card-subtitle">{t('dashboard.approvalPerf.subtitle')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {kpis.avgApprovalTimeMinutes}m
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {t('dashboard.approvalPerf.avgTime')}
                  </div>
                </div>
              </div>
            </div>
          )}
          {ownershipReport && (
            <div className="db-card">
              <div className="db-card-header">
                <div>
                  <h3 className="db-card-title">{t('dashboard.secureDelivery.title')}</h3>
                  <p className="db-card-subtitle">{t('dashboard.secureDelivery.subtitle')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {[
                  { labelKey: 'dashboard.secureDelivery.delivered', value: ownershipReport.totalDelivered, color: 'var(--accent)' },
                  { labelKey: 'dashboard.secureDelivery.confirmed', value: ownershipReport.ownedCount, color: 'var(--success-text)' },
                  { labelKey: 'dashboard.secureDelivery.rate', value: `${ownershipReport.confirmationRate}%`, color: 'var(--brand)' },
                ].map(({ labelKey, value, color }) => (
                  <div key={labelKey}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{t(labelKey)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="db-card" style={{ marginBottom: 0 }}>
        <div className="db-card-header">
          <h3 className="db-card-title">{t('dashboard.quickActions.title')}</h3>
        </div>
        <div className="db-actions-grid">
          <QuickAction label={t('dashboard.quickActions.generateDocument')} icon={<IcoGenerate />}    onClick={() => navigate('/documents')} />
          <QuickAction label={t('dashboard.quickActions.manageTemplates')}  icon={<IcoTemplates />}   onClick={() => navigate('/templates')} />
          <QuickAction label={t('dashboard.quickActions.manageUsers')}      icon={<IcoUsers />}       onClick={() => navigate('/users')} />
          <QuickAction label={t('dashboard.quickActions.auditReports')}     icon={<IcoAudit />}       onClick={() => navigate('/audit-logs')} />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generator dashboard
// ─────────────────────────────────────────────────────────────────────────────
function GeneratorDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation('layout');

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditService.getMyDashboardStats();
      setStats(res.data);
    } catch (err) {
      setError(err.message || t('dashboard.failedToLoad'));
      showToast(err.message || t('dashboard.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <>
        <div className="db-kpi-row db-kpi-row-4">
          {[0,1,2,3].map((i) => <div key={i} className="db-skeleton" />)}
        </div>
        <div className="db-section-row">
          <div className="db-skeleton" style={{ height: 260 }} />
          <div className="db-skeleton" style={{ height: 260 }} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="db-error">
        <p className="db-error-title">{t('dashboard.couldntLoadYours')}</p>
        <p className="db-error-desc">{error}</p>
        <button type="button" className="db-retry-btn" onClick={load}>{t('dashboard.retryBtn')}</button>
      </div>
    );
  }

  return (
    <>
      {/* ── KPI Row ── */}
      <div className="db-kpi-row db-kpi-row-4">
        <KpiCard
          label={t('dashboard.kpi.myDocuments')}
          value={stats.totalDocs}
          sub={t('dashboard.kpi.allTime')}
          accent="brand"
          icon={<IcoTemplates />}
        />
        <KpiCard
          label={t('dashboard.kpi.generatedToday')}
          value={stats.generatedToday}
          sub={t('dashboard.kpi.todaysOutput')}
          icon={<IcoGenerate />}
        />
        <KpiCard
          label={t('dashboard.kpi.pendingApproval')}
          value={stats.pendingApproval}
          sub={t('dashboard.kpi.awaitingSignOff')}
          accent="amber"
          icon={<IcoApprovals />}
        />
        <KpiCard
          label={t('dashboard.kpi.approved')}
          value={stats.approved}
          sub={t('dashboard.kpi.signedOrDelivered')}
          accent="green"
          icon={<IcoVerify />}
        />
      </div>

      {/* ── Recent Docs + Activity ── */}
      <div className="db-section-row" style={{ marginBottom: 20 }}>
        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.recentDocs.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.recentDocs.subtitle')}</p>
            </div>
            <button type="button" className="db-card-link" onClick={() => navigate('/document-tracking')}>
              {t('dashboard.recentDocs.viewAll')}
            </button>
          </div>
          {stats.recentDocs.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty-icon">📄</div>
              <p className="db-empty-title">{t('dashboard.recentDocs.noDocsTitle')}</p>
              <p className="db-empty-desc">{t('dashboard.recentDocs.noDocsDesc')}</p>
              <button type="button" className="db-empty-cta" onClick={() => navigate('/documents')}>
                {t('dashboard.recentDocs.generateCta')}
              </button>
            </div>
          ) : (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>{t('dashboard.recentDocs.colDocId')}</th>
                    <th>{t('dashboard.recentDocs.colTemplate')}</th>
                    <th>{t('dashboard.recentDocs.colStatus')}</th>
                    <th>{t('dashboard.recentDocs.colGenerated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td><span className="db-mono">{doc.doc_uuid}</span></td>
                      <td>{doc.template_name}</td>
                      <td><StatusBadge status={doc.status} sigStatus={doc.signature_status} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fmtDate(doc.generated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.recentActivity.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.recentActivity.subtitleMine')}</p>
            </div>
          </div>
          {stats.recentActivity.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty-icon">📋</div>
              <p className="db-empty-title">{t('dashboard.recentActivity.noActivityTitle')}</p>
              <p className="db-empty-desc">{t('dashboard.recentActivity.noActivityDesc2')}</p>
            </div>
          ) : (
            <div className="db-activity-list">
              {stats.recentActivity.map((log) => (
                <ActivityItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Rejected count callout ── */}
      {stats.rejected > 0 && (
        <div
          style={{
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span style={{ fontWeight: 700, color: 'var(--error-text)' }}>
              {stats.rejected !== 1
                ? t('dashboard.rejected.calloutPlural', { count: stats.rejected })
                : t('dashboard.rejected.callout', { count: stats.rejected })}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--error-text)', marginLeft: 8 }}>
              {t('dashboard.rejected.needAttention')}
            </span>
          </div>
          <button
            type="button"
            className="db-empty-cta"
            style={{ background: 'var(--error-text)' }}
            onClick={() => navigate('/document-tracking')}
          >
            {t('dashboard.rejected.reviewResubmit')}
          </button>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="db-card" style={{ marginBottom: 0 }}>
        <div className="db-card-header">
          <h3 className="db-card-title">{t('dashboard.quickActions.title')}</h3>
        </div>
        <div className="db-actions-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <QuickAction label={t('dashboard.quickActions.generateNew')} icon={<IcoGenerate />}    onClick={() => navigate('/documents')} />
          <QuickAction label={t('dashboard.quickActions.myDocuments')} icon={<IcoDocTracking />} onClick={() => navigate('/document-tracking')} />
          <QuickAction label={t('dashboard.quickActions.verifyDocument')} icon={<IcoVerify />}   onClick={() => navigate('/verify')} />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Approver dashboard
// ─────────────────────────────────────────────────────────────────────────────
function ApproverDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation('layout');

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditService.getMyDashboardStats();
      setStats(res.data);
    } catch (err) {
      setError(err.message || t('dashboard.failedToLoad'));
      showToast(err.message || t('dashboard.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <>
        <div className="db-kpi-row db-kpi-row-4">
          {[0,1,2,3].map((i) => <div key={i} className="db-skeleton" />)}
        </div>
        <div className="db-section-row">
          <div className="db-skeleton" style={{ height: 300 }} />
          <div className="db-skeleton" style={{ height: 300 }} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="db-error">
        <p className="db-error-title">{t('dashboard.couldntLoadYours')}</p>
        <p className="db-error-desc">{error}</p>
        <button type="button" className="db-retry-btn" onClick={load}>{t('dashboard.retryBtn')}</button>
      </div>
    );
  }

  return (
    <>
      {/* ── KPI Row ── */}
      <div className="db-kpi-row db-kpi-row-4">
        <KpiCard
          label={t('dashboard.kpi.pendingToReview')}
          value={stats.pendingToReview}
          sub={t('dashboard.kpi.inYourQueue')}
          accent="amber"
          icon={<IcoApprovals />}
        />
        <KpiCard
          label={t('dashboard.kpi.approved')}
          value={stats.approved}
          sub={t('dashboard.kpi.signedByYou')}
          accent="green"
          icon={<IcoVerify />}
        />
        <KpiCard
          label={t('dashboard.kpi.rejected')}
          value={stats.rejected}
          sub={t('dashboard.kpi.sentBackForCorrection')}
          accent="red"
          icon={<IcoDocTracking />}
        />
        <KpiCard
          label={t('dashboard.kpi.myDocuments')}
          value={stats.totalDocs}
          sub={t('dashboard.kpi.totalGeneratedByMe')}
          accent="brand"
          icon={<IcoTemplates />}
        />
      </div>

      {/* ── Pending queue + Recent Activity ── */}
      <div className="db-section-row" style={{ marginBottom: 20 }}>
        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.awaitingApproval.title')}</h3>
              <p className="db-card-subtitle">
                {stats.pendingToReview > 5
                  ? t('dashboard.awaitingApproval.subtitleOverflow', { count: stats.pendingToReview })
                  : t('dashboard.awaitingApproval.subtitleNormal')}
              </p>
            </div>
            <button type="button" className="db-card-link" onClick={() => navigate('/approvals')}>
              {t('dashboard.awaitingApproval.viewAll')}
            </button>
          </div>
          {stats.pendingQueue.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty-icon">✅</div>
              <p className="db-empty-title">{t('dashboard.awaitingApproval.allCaughtUp')}</p>
              <p className="db-empty-desc">{t('dashboard.awaitingApproval.noPendingDesc')}</p>
            </div>
          ) : (
            <div className="db-queue-list">
              {stats.pendingQueue.map((req) => (
                <div className="db-queue-item" key={req.id}>
                  <div className="db-queue-item-info">
                    <div className="db-queue-item-uuid">{req.doc_uuid}</div>
                    <div className="db-queue-item-template">{req.template_name}</div>
                    <div className="db-queue-item-by">
                      {t('dashboard.awaitingApproval.from')} {req.generator_name} · {fmtRelative(req.created_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="db-queue-review-btn"
                    onClick={() => navigate(`/approvals?open=${req.id}`)}
                  >
                    {t('dashboard.awaitingApproval.review')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="db-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.recentActivity.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.recentActivity.subtitleGenerated')}</p>
            </div>
          </div>
          {stats.recentActivity.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty-icon">📋</div>
              <p className="db-empty-title">{t('dashboard.recentActivity.noActivityTitle')}</p>
              <p className="db-empty-desc">{t('dashboard.recentActivity.noActivityDesc2')}</p>
            </div>
          ) : (
            <div className="db-activity-list">
              {stats.recentActivity.map((log) => (
                <ActivityItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Documents (my generated) ── */}
      {stats.recentDocs.length > 0 && (
        <div className="db-card" style={{ marginBottom: 20 }}>
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">{t('dashboard.myRecentDocs.title')}</h3>
              <p className="db-card-subtitle">{t('dashboard.myRecentDocs.subtitle')}</p>
            </div>
            <button type="button" className="db-card-link" onClick={() => navigate('/document-tracking')}>
              {t('dashboard.myRecentDocs.viewAll')}
            </button>
          </div>
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>{t('dashboard.myRecentDocs.colDocId')}</th>
                  <th>{t('dashboard.myRecentDocs.colTemplate')}</th>
                  <th>{t('dashboard.myRecentDocs.colStatus')}</th>
                  <th>{t('dashboard.myRecentDocs.colGenerated')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td><span className="db-mono">{doc.doc_uuid}</span></td>
                    <td>{doc.template_name}</td>
                    <td><StatusBadge status={doc.status} sigStatus={doc.signature_status} /></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fmtDate(doc.generated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="db-card" style={{ marginBottom: 0 }}>
        <div className="db-card-header">
          <h3 className="db-card-title">{t('dashboard.quickActions.title')}</h3>
        </div>
        <div className="db-actions-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <QuickAction label={t('dashboard.quickActions.pendingApprovals')} icon={<IcoApprovals />}   onClick={() => navigate('/approvals')} />
          <QuickAction label={t('dashboard.quickActions.viewDocuments')}    icon={<IcoDocTracking />} onClick={() => navigate('/document-tracking')} />
          <QuickAction label={t('dashboard.quickActions.verifyDocument')}   icon={<IcoVerify />}      onClick={() => navigate('/verify')} />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DashboardPage — role-based routing
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation('layout');

  if (!user) return null;

  const role = user.role;
  const isAdmin    = role === ROLES.SUPER_ADMIN || role === ROLES.SYSTEM_ADMIN;
  const isApprover = role === ROLES.APPROVER;

  const firstName = user.full_name?.split(' ')[0] || user.email;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dashboard.goodMorning')  :
    hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening');

  const roleLabel =
    role === ROLES.SUPER_ADMIN  ? t('roles.superAdmin')  :
    role === ROLES.SYSTEM_ADMIN ? t('roles.systemAdmin') :
    role === ROLES.GENERATOR    ? t('roles.generator')   :
    role === ROLES.APPROVER     ? t('roles.approver')    : role;

  return (
    <div className="db-page">
      {/* ── Page header ── */}
      <div className="db-header">
        <div className="db-header-left">
          <h1>{greeting}, {firstName}.</h1>
          <p>{t('dashboard.overview')}</p>
        </div>
        <div className="db-header-meta">
          <span className="db-live-dot" aria-hidden="true" />
          {t('dashboard.liveData')} · {roleLabel}
        </div>
      </div>

      {/* ── Role-specific content ── */}
      {isAdmin    && <AdminDashboard user={user} />}
      {isApprover && !isAdmin && <ApproverDashboard />}
      {role === ROLES.GENERATOR && <GeneratorDashboard />}
    </div>
  );
}
