import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signatureService } from '../services/workflowService';
import { documentService } from '../services/templateService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useOfflineGuard } from '../hooks/useOfflineGuard';
import { ROLES } from '../utils/roles';
import RejectRecipientsPicker from '../components/common/RejectRecipientsPicker';
import '../pages/DocumentTracking.css';

function withinDateFilter(req, dateFilter) {
  if (!dateFilter) return true;
  const created = new Date(req.created_at).getTime();
  const now = Date.now();
  const days = dateFilter === 'today' ? 1 : dateFilter === '7d' ? 7 : 30;
  const cutoff = dateFilter === 'today'
    ? new Date().setHours(0, 0, 0, 0)
    : now - days * 24 * 60 * 60 * 1000;
  return created >= cutoff;
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { guardedAction, isOffline } = useOfflineGuard();
  const { t } = useTranslation('layout');
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open');

  const DATE_FILTER_OPTIONS = [
    { value: '',     label: t('approvals.dateFilter.allTime') },
    { value: 'today', label: t('approvals.dateFilter.today') },
    { value: '7d',   label: t('approvals.dateFilter.last7Days') },
    { value: '30d',  label: t('approvals.dateFilter.last30Days') },
  ];

  const [pending, setPending]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeRequest, setActiveRequest] = useState(null);
  const [otpCode, setOtpCode]           = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [mode, setMode]                 = useState(null); // 'approve' | 'reject'
  const [submitting, setSubmitting]     = useState(false);
  const [viewingPdf, setViewingPdf]     = useState(false);
  const [sendingOtp, setSendingOtp]     = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const [search, setSearch]                 = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [dateFilter, setDateFilter]         = useState('');

  const [recipients, setRecipients]                   = useState([]);
  const [recipientsLoading, setRecipientsLoading]     = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);

  const isAdmin = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.SYSTEM_ADMIN;

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await signatureService.listPending();
      setPending(res.data);
    } catch (err) {
      showToast(err.message || t('approvals.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPending(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deepLinkReq = openId ? pending.find((r) => String(r.id) === String(openId)) : null;
  const dismissDeepLink = () => setSearchParams({}, { replace: true });

  useEffect(() => {
    if (!loading && openId && !deepLinkReq) {
      showToast(t('approvals.deepLink.staleWarning'), 'error');
      dismissDeepLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, openId, deepLinkReq]);

  const templateNames = useMemo(
    () => [...new Set(pending.map((r) => r.template_name))].sort(),
    [pending]
  );

  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pending.filter((r) => {
      if (templateFilter && r.template_name !== templateFilter) return false;
      if (!withinDateFilter(r, dateFilter)) return false;
      if (!term) return true;
      return (
        r.doc_uuid?.toLowerCase().includes(term) ||
        r.template_name?.toLowerCase().includes(term) ||
        r.generator_name?.toLowerCase().includes(term) ||
        r.record_identifier?.toLowerCase().includes(term)
      );
    });
  }, [pending, search, templateFilter, dateFilter]);

  const hasActiveFilters = !!(search || templateFilter || dateFilter);
  const clearFilters = () => { setSearch(''); setTemplateFilter(''); setDateFilter(''); };

  const openApprove = (req) => {
    setActiveRequest(req);
    setMode('approve');
    setOtpCode('');
  };

  const openReject = (req) => {
    setActiveRequest(req);
    setMode('reject');
    setRejectReason('');
    setRecipients([]);
    setSelectedRecipientIds([]);
    setRecipientsLoading(true);
    signatureService.getRejectRecipients(req.id)
      .then((res) => {
        const data = res.data || [];
        setRecipients(data);
        setSelectedRecipientIds(data.map((c) => c.id));
      })
      .catch((err) => showToast(err.message || t('approvals.recipientsFailed'), 'error'))
      .finally(() => setRecipientsLoading(false));
  };

  const closePanel = () => { setActiveRequest(null); setMode(null); };

  const handleSendOtp = async (signatureRequestId) => {
    await guardedAction(
      async () => {
        setSendingOtp(true);
        try {
          const res = await signatureService.resendOtp(signatureRequestId);
          showToast(res.message || t('approvals.approveModal.otpSent'), 'success');
        } finally {
          setSendingOtp(false);
        }
      },
      {
        offlineMessage: 'You are offline. OTP cannot be sent without a server connection.',
        onError: (err) => {
          if (!err.isOfflineError) {
            showToast(err.message || t('approvals.approveModal.otpFailed'), 'error');
          }
          setSendingOtp(false);
        },
      }
    );
  };

  const handleViewPdf = async (req) => {
    setViewingPdf(true);
    try {
      const url = await signatureService.viewPdfUrl(req.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast(err.message || t('approvals.approveModal.failed'), 'error');
    } finally {
      setViewingPdf(false);
    }
  };

  const submitApprove = async () => {
    if (!otpCode.trim()) {
      showToast(t('approvals.approveModal.otpRequired'), 'error');
      return;
    }
    await guardedAction(
      async () => {
        setSubmitting(true);
        try {
          const res = await signatureService.approve(activeRequest.id, otpCode.trim());
          showToast(res.message || t('approvals.approveModal.approved'), 'success');
          closePanel();
          dismissDeepLink();
          loadPending();
        } finally {
          setSubmitting(false);
        }
      },
      {
        offlineMessage: 'You are offline. Approval requires a live server connection.',
        onBlocked: () => { /* keep modal open, don't clear OTP */ },
        onError: (err) => {
          if (!err.isOfflineError) showToast(err.message || t('approvals.approveModal.failed'), 'error');
          setSubmitting(false);
        },
      }
    );
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      showToast(t('approvals.rejectModal.reasonRequired'), 'error');
      return;
    }
    if (selectedRecipientIds.length === 0) {
      showToast(t('approvals.rejectModal.recipientRequired'), 'error');
      return;
    }
    await guardedAction(
      async () => {
        setSubmitting(true);
        try {
          const res = await signatureService.reject(activeRequest.id, rejectReason.trim(), selectedRecipientIds);
          showToast(res.message || t('approvals.rejectModal.rejected'), 'success');
          closePanel();
          dismissDeepLink();
          loadPending();
        } finally {
          setSubmitting(false);
        }
      },
      {
        offlineMessage: 'You are offline. Rejection requires a live server connection.',
        onBlocked: () => { /* keep modal open, don't clear reason */ },
        onError: (err) => {
          if (!err.isOfflineError) showToast(err.message || t('approvals.rejectModal.failed'), 'error');
          setSubmitting(false);
        },
      }
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await guardedAction(
      async () => {
        setDeleting(true);
        try {
          const res = await documentService.remove(deleteTarget.doc_id);
          showToast(res.message || t('approvals.deleteModal.deleted'), 'success');
          setDeleteTarget(null);
          loadPending();
        } finally {
          setDeleting(false);
        }
      },
      {
        offlineMessage: 'You are offline. Records cannot be deleted without a server connection.',
        onError: (err) => {
          if (!err.isOfflineError) showToast(err.message || t('approvals.deleteModal.failed'), 'error');
          setDeleting(false);
        },
      }
    );
  };

  if (loading) {
    return (
      <div className="doc-track">
        <p className="doc-track-loading">{t('approvals.loading')}</p>
      </div>
    );
  }

  return (
    <div className="doc-track">
      <div className="doc-track-header">
        <h1>{t('approvals.title')}</h1>
      </div>
      <p className="doc-track-subtitle">{t('approvals.subtitle')}</p>

      {pending.length > 0 && (
        <div className="doc-track-stats">
          <div className="doc-track-stat doc-track-stat-amber">
            <span className="doc-track-stat-value">{pending.length}</span>
            <span className="doc-track-stat-label">{t('approvals.stats.awaitingYou')}</span>
          </div>
          <div className="doc-track-stat">
            <span className="doc-track-stat-value">{templateNames.length}</span>
            <span className="doc-track-stat-label">{t('approvals.stats.templates')}</span>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="doc-track-toolbar">
          <div className="doc-track-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('approvals.toolbar.searchPlaceholder')}
            />
          </div>
          <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}>
            <option value="">{t('approvals.toolbar.allTemplates')}</option>
            {templateNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            {DATE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasActiveFilters && (
            <button type="button" className="doc-btn doc-btn-secondary" onClick={clearFilters}>
              {t('approvals.toolbar.clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Deep-linked card */}
      {deepLinkReq && (
        <div className="doc-card doc-card-highlighted" style={{ marginBottom: 20 }}>
          <div className="doc-card-top">
            <div className="doc-card-id-block">
              <span className="doc-card-template">{t('approvals.card.actionRequired')}</span>
              <span className="doc-card-id">{deepLinkReq.doc_uuid}</span>
              <div className="doc-card-meta">
                <span><b>{t('approvals.card.templateLabel')}</b> {deepLinkReq.template_name}</span>
                <span><b>{t('approvals.card.generatedByLabel')}</b> {deepLinkReq.generator_name}</span>
              </div>
            </div>
            <span className="doc-badge doc-badge-amber">
              <span className="doc-badge-dot" />{t('approvals.card.pendingBadge')}
            </span>
          </div>
          <div className="doc-card-actions">
            <button type="button" onClick={() => handleViewPdf(deepLinkReq)} disabled={viewingPdf} className="doc-btn doc-btn-secondary">
              {viewingPdf ? t('approvals.card.opening') : t('approvals.card.viewPdf')}
            </button>
            <button type="button" onClick={() => openApprove(deepLinkReq)} className="doc-btn doc-btn-primary"
              disabled={isOffline}
              title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}>
              {t('approvals.card.approve')}
            </button>
            <button type="button" onClick={() => openReject(deepLinkReq)} className="doc-btn doc-btn-danger"
              disabled={isOffline}
              title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}>
              {t('approvals.card.reject')}
            </button>
            {isAdmin && (
              <button type="button" onClick={() => setDeleteTarget(deepLinkReq)} className="doc-btn doc-btn-danger" style={{ marginLeft: 'auto' }}
                disabled={isOffline}
                title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}>
                {t('approvals.card.delete')}
              </button>
            )}
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="doc-track-empty">{t('approvals.empty.noPending')}</div>
      ) : visibleRequests.length === 0 ? (
        <div className="doc-track-empty">
          {t('approvals.empty.noMatch')}{' '}
          <button type="button" className="doc-track-link-btn" onClick={clearFilters}>
            {t('approvals.empty.clearFilters')}
          </button>
        </div>
      ) : (
        <div className="doc-track-grid">
          {visibleRequests.map((req) => (
            <div className="doc-card" key={req.id}>
              <div className="doc-card-top">
                <div className="doc-card-id-block">
                  <span className="doc-card-template">{req.template_name}</span>
                  <span className="doc-card-id">{req.doc_uuid}</span>
                  <div className="doc-card-meta">
                    <span><b>{t('approvals.card.recordLabel')}</b> {req.record_identifier}</span>
                    <span><b>{t('approvals.card.requestedLabel')}</b> {new Date(req.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <span className="doc-badge doc-badge-amber">
                    <span className="doc-badge-dot" />{t('approvals.card.pendingBadge')}
                  </span>
                  <div className="doc-card-subline doc-card-subline-amber">
                    {t('approvals.card.from')} {req.generator_name}
                  </div>
                </div>
              </div>

              <div className="doc-card-actions">
                <button type="button" onClick={() => handleViewPdf(req)} disabled={viewingPdf} className="doc-btn doc-btn-secondary">
                  {viewingPdf ? t('approvals.card.opening') : t('approvals.card.viewPdf')}
                </button>
                <button type="button" onClick={() => openApprove(req)} className="doc-btn doc-btn-primary"
                  disabled={isOffline}
                  title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}>
                  {t('approvals.card.approve')}
                </button>
                <button type="button" onClick={() => openReject(req)} className="doc-btn doc-btn-danger"
                  disabled={isOffline}
                  title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}>
                  {t('approvals.card.reject')}
                </button>
                {isAdmin && (
                  <button type="button" onClick={() => setDeleteTarget(req)} className="doc-btn doc-btn-danger" style={{ marginLeft: 'auto' }}
                    disabled={isOffline}
                    title={isOffline ? 'You are offline. Please reconnect to perform this action.' : undefined}>
                    {t('approvals.card.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve / Reject modal */}
      {activeRequest && (
        <div className="modal-overlay" onClick={closePanel}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {mode === 'approve' ? t('approvals.approveModal.title') : t('approvals.rejectModal.title')}
              </h2>
              <button type="button" onClick={closePanel} className="modal-close-btn" title={t('common.close', { ns: 'translation' })}>×</button>
            </div>
            <div className="modal-body">
              <p>
                {mode === 'approve' ? t('approvals.approveModal.document') : t('approvals.rejectModal.document')}{' '}
                <b>{activeRequest.doc_uuid}</b>
              </p>

              {mode === 'approve' && (
                <div className="form-field">
                  <button
                    type="button"
                    onClick={() => handleViewPdf(activeRequest)}
                    disabled={viewingPdf}
                    className="btn-secondary"
                    style={{ marginBottom: 12 }}
                  >
                    {viewingPdf ? t('approvals.card.opening') : t('approvals.approveModal.viewPdfBtn')}
                  </button>
                  <label htmlFor="otp-input">{t('approvals.approveModal.otpLabel')}</label>
                  <div className="verify-input-row">
                    <input
                      id="otp-input"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                      placeholder={sendingOtp ? t('approvals.approveModal.otpPlaceholderSending') : t('approvals.approveModal.otpPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendOtp(activeRequest.id)}
                      disabled={sendingOtp || isOffline}
                      className="btn-secondary"
                      title={isOffline ? 'You are offline. OTP requires a server connection.' : undefined}
                    >
                      {sendingOtp ? t('approvals.approveModal.sending') : t('approvals.approveModal.resendOtp')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={submitApprove}
                    disabled={submitting || sendingOtp || isOffline}
                    className="btn-primary"
                    style={{ marginTop: 10 }}
                    title={isOffline ? 'You are offline. Approval requires a server connection.' : undefined}
                  >
                    {submitting ? t('approvals.approveModal.verifying') : t('approvals.approveModal.confirmSign')}
                  </button>
                </div>
              )}

              {mode === 'reject' && (
                <div className="form-field">
                  <label htmlFor="reject-reason">{t('approvals.rejectModal.reasonLabel')}</label>
                  <textarea
                    id="reject-reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <RejectRecipientsPicker
                    candidates={recipients}
                    loading={recipientsLoading}
                    selectedIds={selectedRecipientIds}
                    onChange={setSelectedRecipientIds}
                  />
                  <button
                    type="button"
                    onClick={submitReject}
                    disabled={submitting || recipientsLoading || isOffline}
                    className="btn-danger"
                    style={{ marginTop: 10 }}
                    title={isOffline ? 'You are offline. Rejection requires a server connection.' : undefined}
                  >
                    {submitting ? t('approvals.rejectModal.submitting') : t('approvals.rejectModal.confirmReject')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>{t('approvals.deleteModal.title')}</h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="modal-close-btn"
                title={t('common.close', { ns: 'translation' })}
                disabled={deleting}
              >×</button>
            </div>
            <div className="modal-body">
              <p>
                {t('approvals.deleteModal.message', { docUuid: deleteTarget.doc_uuid })}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                {t('approvals.deleteModal.detail')}
              </p>
              <div className="template-form-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting || isOffline}
                  className="btn-danger"
                  title={isOffline ? 'You are offline. Records cannot be deleted without a connection.' : undefined}
                >
                  {deleting ? t('approvals.deleteModal.deleting') : t('approvals.deleteModal.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="btn-secondary"
                >
                  {t('approvals.deleteModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
