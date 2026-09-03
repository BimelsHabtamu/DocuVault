/**
 * System Admin Dashboard
 * Identical layout and data fetching as Super Admin.
 * No System Settings or Database Connections anywhere in this page.
 *
 * API endpoints:
 *   GET /api/audit/dashboard        — KPIs, status_breakdown, top_templates, avg_approval_minutes
 *   GET /api/audit/activity-chart   — 7-day [{date, generated, signed, delivered}]
 *   GET /api/audit/search           — recent documents (newest first)
 *   GET /api/notifications          — notification feed
 */
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';
import {
  WelcomeHeader,
  AdminKpiRow,
  AvgApprovalTime,
  ActivityChart,
  DocumentStatusChart,
  TopTemplates,
  RecentDocuments,
  RecentNotifications,
} from '../components/admin/adminDashboardComponents';

export default function SystemAdminDashboardPage() {
  const { user } = useAuth();

  const [kpiData,    setKpiData]    = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError,   setKpiError]   = useState(false);

  const [chartData,    setChartData]    = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError,   setChartError]   = useState(false);

  const [recentDocs,  setRecentDocs]  = useState(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError,   setDocsError]   = useState(false);

  const [notifications,  setNotifications]  = useState(null);
  const [notifsLoading,  setNotifsLoading]  = useState(true);
  const [notifsError,    setNotifsError]    = useState(false);

  const loadKpis = useCallback(() => {
    setKpiLoading(true); setKpiError(false);
    axiosInstance.get('/audit/dashboard')
      .then(res => setKpiData(res.data))
      .catch(() => { setKpiError(true); setKpiData(null); })
      .finally(() => setKpiLoading(false));
  }, []);

  const loadChart = useCallback(() => {
    setChartLoading(true); setChartError(false);
    axiosInstance.get('/audit/activity-chart')
      .then(res => setChartData(res.data))
      .catch(() => { setChartError(true); setChartData(null); })
      .finally(() => setChartLoading(false));
  }, []);

  const loadRecentDocs = useCallback(() => {
    setDocsLoading(true); setDocsError(false);
    axiosInstance.get('/audit/search')
      .then(res => setRecentDocs(res.data.slice(0, 10)))
      .catch(() => { setDocsError(true); setRecentDocs(null); })
      .finally(() => setDocsLoading(false));
  }, []);

  const loadNotifications = useCallback(() => {
    setNotifsLoading(true); setNotifsError(false);
    axiosInstance.get('/notifications')
      .then(res => setNotifications(res.data))
      .catch(() => { setNotifsError(true); setNotifications(null); })
      .finally(() => setNotifsLoading(false));
  }, []);

  useEffect(() => {
    loadKpis();
    loadChart();
    loadRecentDocs();
    loadNotifications();
  }, [loadKpis, loadChart, loadRecentDocs, loadNotifications]);

  const d = kpiData ?? {};

  return (
    <div className="space-y-5 pb-6">

      {/* Welcome */}
      <WelcomeHeader user={user} />

      {/* KPI error banner */}
      {kpiError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50
          border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>
            Could not load dashboard data.{' '}
            <button onClick={loadKpis} className="underline font-semibold">Retry</button>
          </span>
        </div>
      )}

      {/* KPI cards */}
      <AdminKpiRow d={d} loading={kpiLoading} />

      {/* Activity chart — full width */}
      <ActivityChart
        data={chartData}
        loading={chartLoading}
        error={chartError}
        onRetry={loadChart}
      />

      {/* Avg Approval Time + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <AvgApprovalTime
            minutes={d.avg_approval_minutes ?? null}
            loading={kpiLoading}
          />
        </div>
        <div className="lg:col-span-2">
          <DocumentStatusChart
            breakdown={d.status_breakdown ?? null}
            totalDocs={d.total_docs ?? null}
            loading={kpiLoading}
            error={kpiError}
            onRetry={loadKpis}
          />
        </div>
      </div>

      {/* Top Templates + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopTemplates
          templates={d.top_templates ?? null}
          loading={kpiLoading}
          error={kpiError}
          onRetry={loadKpis}
        />
        <RecentNotifications
          notifications={notifications}
          loading={notifsLoading}
          error={notifsError}
          onRetry={loadNotifications}
        />
      </div>

      {/* Recent Documents */}
      <RecentDocuments
        docs={recentDocs}
        loading={docsLoading}
        error={docsError}
        onRetry={loadRecentDocs}
      />
    </div>
  );
}
