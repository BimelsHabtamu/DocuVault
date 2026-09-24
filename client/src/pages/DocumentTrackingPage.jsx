import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { documentService } from '../services/templateService';
import { deliveryService, signatureService, auditService } from '../services/workflowService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import ApproverSelectModal from '../components/common/ApproverSelectModal';
import SecureDeliveryModal from '../components/common/SecureDeliveryModal';
import { ROLES } from '../utils/roles';
import './DocumentTracking.css';

const API_BASE = import.meta.env?.VITE_API_URL || '/api';
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN];

// Status group order for display (pending work first)
const STATUS_GROUP_ORDER = ['pending', 'draft', 'rejected', 'signed', 'delivered'];

function effectiveStatus(doc) {
  if (doc.status === 'draft' && doc.signature_status === 'rejected') return 'rejected';
  return doc.status;
}

function withinDateFilter(doc, dateFilter) {
  if (!dateFilter) return true;
  const generated = new Date(doc.generated_at).getTime();
  const now = Date.now();
  const days = dateFilter === 'today' ? 1 : dateFilter === '7d' ? 7 : 30;
  const cutoff = dateFilter === 'today'
    ? new Date().setHours(0, 0, 0, 0)
    : now - days * 24 * 60 * 60 * 1000;
  return generated >= cutoff;
}

/** Small status pill */
function DocBadge({ status }) {
  const { t } = useTranslation('layout');

  const BADGE_MAP = {
    draft:     { tone: 'slate',  label: t('docTracking.card.badgeDraft') },
    pending:   { tone: 'amber',  label: t('docTracking.card.badgePendingApproval') },
    signed:    { tone: 'green',  label: t('docTracking.card.badgeApproved') },
    delivered: { tone: 'blue',   label: t('docTracking.card.badgeDelivered') },
    rejected:  { tone: 'red',    label: t('docTracking.card.badgeRejected') },
  };

  const entry = BADGE_MAP[status] || { tone: 'slate', label: status };
  return (
    <span className={`doc-badge doc-badge-${entry.tone}`}>
      <span className="doc-badge-dot" />
      {entry.label}
    </span>
  );
}

/**
 * One document's card, with the status-appropriate actions.
 */
function DocumentCard({ doc, highlighted, isAdmin, onNeedsApprover, onSecureDeliver, onChanged, onEditResubmit, ownershipRejectionBanner }) {
  const { showToast } = useToast();
  const { t } = useTranslation('layout');
  const cardRef = useRef(null);
  const menuRef = useRef(null);
  const [viewingDoc, setViewingDoc]           = useState(false);
  const [downloading, setDownloading]         = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [menuOpen, setMenuOpen]               = useState(false);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDeleted           = Boolean(doc.deleted_at);
  const wasRejected         = doc.status === 'draft' && doc.signature_status === 'rejected';
  const isSignedOrDelivered = doc.status === 'signed' || doc.status === 'delivered';
  const canMarkHandDelivered = !isDeleted && isSignedOrDelivered;
  const canDelete           = !isDeleted && (doc.status !== 'pending' || isAdmin);
  const hasSecondaryActions = canDelete;

  const handleView = async () => {
    setViewingDoc(true);
    try {
      const url = await documentService.viewUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast(err.message || t('docTracking.openFailed'), 'error');
    } finally {
      setViewingDoc(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await documentService.download(doc.id);
    } catch (err) {
      showToast(err.message || t('docTracking.openFailed'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleMarkDelivered = async () => {
    setMarkingDelivered(true);
    try {
      const res = await deliveryService.markHandDelivered(doc.id);
      showToast(res.message || 'Marked as hand-delivered.', 'success');
      setMenuOpen(false);
      onChanged();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
    } finally {
      setMarkingDelivered(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await documentService.remove(doc.id);
      showToast(res.message || t('docTracking.deleteModal.deleted'), 'success');
      onChanged();
    } catch (err) {
      showToast(err.message || t('docTracking.deleteModal.failed'), 'error');
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`doc-card${highlighted ? ' doc-card-highlighted' : ''}${isDeleted ? ' doc-card-deleted' : ''}`}
    >
      <div className="doc-card-top">
        <div className="doc-card-id-block">
          <span className="doc-card-template">{doc.template_name}</span>
          <span className="doc-card-id">{doc.doc_uuid}</span>
          <div className="doc-card-meta">
            <span><b>{t('docTracking.card.record')}</b> {doc.record_identifier}</span>
            <span><b>{t('docTracking.card.generated')}</b> {new Date(doc.generated_at).toLocaleString()}</span>
          </div>
        </div>
        <div>
          {isDeleted
            ? <span className="doc-badge doc-badge-red"><span className="doc-badge-dot" />Deleted</span>
            : <DocBadge status={doc.status} />}
          {doc.status === 'pending' && doc.approver_name && !isDeleted && (
            <div className="doc-card-subline doc-card-subline-amber">
              {t('docTracking.card.approver')} {doc.approver_name}
            </div>
          )}
          {doc.status === 'signed' && doc.approver_name && !isDeleted && (
            <div className="doc-card-subline doc-card-subline-green">
              {/* "Approved by <name>" — reuse approver label */}
              {t('docTracking.card.approver')} {doc.approver_name}
            </div>
          )}
          {doc.status === 'delivered' && doc.delivered_to && !isDeleted && (
            <div className="doc-card-subline doc-card-subline-blue">
              {t('docTracking.card.deliveredTo', { email: doc.delivered_to })}
              {doc.delivered_at && <> · {new Date(doc.delivered_at).toLocaleString()}</>}
            </div>
          )}
          {wasRejected && !isDeleted && (
            <div className="doc-card-subline doc-card-subline-red">
              {doc.rejection_reason
                ? t('docTracking.card.reason') + ' ' + doc.rejection_reason
                : t('docTracking.card.badgeRejected')}
            </div>
          )}
          {ownershipRejectionBanner && !wasRejected && !isDeleted && (
            <div style={{
              marginTop: 4, padding: '4px 10px', borderRadius: 6,
              background: 'var(--error-bg)', border: '1px solid var(--error-border)',
              fontSize: '0.8rem', color: 'var(--error-text)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
              {t('docTracking.card.recipientRejected')}: <i>{ownershipRejectionBanner.reason}</i>
            </div>
          )}
        </div>
      </div>

      {isDeleted ? (
        <div className="doc-card-deleted-note">
          This document was deleted — its file is no longer available to view, download, or deliver. It can still be checked for authenticity on the <b>Verify Document</b> page using its Doc ID (<span className="doc-card-id">{doc.doc_uuid}</span>).
        </div>
      ) : (
        <>
          <div className="doc-card-actions">
            <button type="button" onClick={handleView} disabled={viewingDoc} className="doc-btn doc-btn-secondary">
              {viewingDoc ? t('docTracking.card.opening') : t('docTracking.card.viewPdf')}
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading} className="doc-btn doc-btn-secondary">
              {downloading ? t('common.download', { ns: 'translation' }) + '…' : t('common.download', { ns: 'translation' })}
            </button>
            {doc.status === 'draft' && !wasRejected && (
              <button type="button" onClick={onNeedsApprover} className="doc-btn doc-btn-primary">
                {t('docTracking.card.assignApprover')}
              </button>
            )}
            {wasRejected && (
              <button type="button" onClick={() => onEditResubmit(null)} className="doc-btn doc-btn-primary">
                {t('docTracking.card.editResubmit')}
              </button>
            )}
            {isSignedOrDelivered && (
              <button type="button" onClick={onSecureDeliver} className="doc-btn doc-btn-primary">
                {t('docTracking.card.deliver')}
              </button>
            )}
            {canMarkHandDelivered && (
              <button
                type="button"
                onClick={handleMarkDelivered}
                disabled={markingDelivered}
                className="doc-btn doc-btn-secondary"
              >
                {markingDelivered ? '…' : 'Hand Delivered'}
              </button>
            )}
            {canDelete && (doc.status === 'pending' || doc.status === 'draft') && (
              <button type="button" onClick={() => setConfirmingDelete(true)} className="doc-btn doc-btn-danger">
                {t('docTracking.card.delete')}
              </button>
            )}
            {ownershipRejectionBanner && isSignedOrDelivered && (
              <button
                type="button"
                onClick={() => onEditResubmit(ownershipRejectionBanner)}
                className="doc-btn doc-btn-primary"
                style={{ background: 'var(--error-text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {t('docTracking.card.editResubmit')}
              </button>
            )}
            {hasSecondaryActions && doc.status !== 'pending' && doc.status !== 'draft' && (
              <div className="doc-card-menu" ref={menuRef}>
                <button
                  type="button"
                  className="doc-btn doc-btn-secondary doc-card-menu-trigger"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                >
                  ⋮
                </button>
                {menuOpen && (
                  <div className="doc-card-menu-dropdown">
                    <button
                      type="button"
                      className="doc-card-menu-item doc-card-menu-item-danger"
                      onClick={() => { setMenuOpen(false); setConfirmingDelete(true); }}
                    >
                      {t('docTracking.card.delete')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {confirmingDelete && (
            <div className="doc-confirm-banner doc-confirm-banner-danger" style={{ marginTop: 10 }}>
              <p>
                {doc.status === 'pending'
                  ? t('docTracking.deleteModal.message', { docUuid: doc.doc_uuid })
                  : t('docTracking.deleteModal.message', { docUuid: doc.doc_uuid })}
              </p>
              <div className="doc-confirm-banner-actions">
                <button type="button" onClick={handleDelete} disabled={deleting} className="doc-btn doc-btn-danger doc-btn-sm">
                  {deleting ? t('docTracking.deleteModal.deleting') : t('docTracking.deleteModal.confirm')}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className="doc-btn doc-btn-secondary doc-btn-sm">
                  {t('docTracking.deleteModal.cancel')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DocumentTrackingPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation('layout');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const highlightDocId = searchParams.get('doc');
  const pendingAction  = searchParams.get('action');

  const [myDocs, setMyDocs]           = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [search, setSearch]           = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const [dateFilter, setDateFilter]         = useState('');
  const [collapsedTemplates, setCollapsedTemplates] = useState(() => new Set());

  const [approverModalDoc, setApproverModalDoc]           = useState(null);
  const [secureDeliveryModalDoc, setSecureDeliveryModalDoc] = useState(null);
  const [ownershipRejectionBanner, setOwnershipRejectionBanner] = useState(null);
  const [workflowPanelDoc, setWorkflowPanelDoc] = useState(null); // eslint-disable-line no-unused-vars

  // Build filter options from t() — defined inside component so they react to language changes
  const STATUS_FILTER_OPTIONS = [
    { value: '',          label: t('docTracking.toolbar.allStatuses') },
    { value: 'pending',   label: t('docTracking.toolbar.statusPending') },
    { value: 'signed',    label: t('docTracking.toolbar.statusApproved') },
    { value: 'delivered', label: t('docTracking.toolbar.statusDelivered') },
    { value: 'draft',     label: t('docTracking.toolbar.statusDraft') },
    { value: 'rejected',  label: t('docTracking.toolbar.statusRejected') },
  ];

  const DATE_FILTER_OPTIONS = [
    { value: '',      label: t('docTracking.toolbar.allTime') },
    { value: 'today', label: t('docTracking.toolbar.today') },
    { value: '7d',    label: t('docTracking.toolbar.last7Days') },
    { value: '30d',   label: t('docTracking.toolbar.last30Days') },
  ];

  const BADGE_LABELS = {
    draft:     t('docTracking.card.badgeDraft'),
    pending:   t('docTracking.card.badgePendingApproval'),
    signed:    t('docTracking.card.badgeApproved'),
    delivered: t('docTracking.card.badgeDelivered'),
    rejected:  t('docTracking.card.badgeRejected'),
  };

  const loadMyDocs = useCallback(() => {
    if (!user) return;
    setLoadingDocs(true);
    auditService.searchDocuments({ generated_by: user.id })
      .then((res) => setMyDocs(res.data || []))
      .catch((err) => showToast(err.message || t('docTracking.loadFailed'), 'error'))
      .finally(() => setLoadingDocs(false));
  }, [user, showToast, t]);

  useEffect(() => { loadMyDocs(); }, [loadMyDocs]);

  const isAdminUser = ADMIN_ROLES.includes(user?.role);

  useEffect(() => {
    if (loadingDocs || !highlightDocId || myDocs.some((d) => String(d.id) === String(highlightDocId))) return;
    if (isAdminUser) {
      auditService.searchDocuments({ id: highlightDocId })
        .then((res) => {
          const match = (res.data || [])[0];
          if (match) {
            setMyDocs((prev) => (prev.some((d) => d.id === match.id) ? prev : [match, ...prev]));
          } else {
            showToast("That document doesn't exist or was deleted.", 'error');
            setSearchParams({}, { replace: true });
          }
        })
        .catch(() => {
          showToast("That document doesn't exist or was deleted.", 'error');
          setSearchParams({}, { replace: true });
        });
      return;
    }
    showToast("That document isn't in your list (wrong account, or it doesn't exist).", 'error');
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDocs, highlightDocId, myDocs, isAdminUser]);

  const handleAssignApprover = async (approverId) => {
    try {
      const res = await signatureService.initiate(approverModalDoc.id, approverId);
      showToast(res.message || t('docTracking.approverAssigned'), 'success');
      setApproverModalDoc(null);
      loadMyDocs();
    } catch (err) {
      showToast(err.message || t('docTracking.approverFailed'), 'error');
    }
  };

  const handleSecureDeliverySent = (message) => {
    showToast(message || 'Secure delivery sent.', 'success');
    loadMyDocs();
  };

  const handleEditResubmit = (doc, ownershipBanner = null) => {
    navigate('/documents', {
      state: {
        resubmitDoc: {
          id: doc.id,
          doc_uuid: doc.doc_uuid,
          template_id: doc.template_id,
          template_name: doc.template_name,
          record_identifier: doc.record_identifier,
          approver_id: doc.approver_id || null,
          approver_name: doc.approver_name || null,
          rejection_reason: ownershipBanner?.reason || doc.rejection_reason || null,
        },
      },
    });
  };

  useEffect(() => {
    if (!pendingAction || !highlightDocId) return;
    if (pendingAction !== 'edit_resubmit' && pendingAction !== 'view_rejection' && pendingAction !== 'view_workflow') return;
    if (loadingDocs) return;
    const target = myDocs.find((d) => String(d.id) === String(highlightDocId));
    if (!target) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('action');
      return next;
    }, { replace: true });

    if (pendingAction === 'view_workflow') {
      navigate(`/workflow-result?doc=${encodeURIComponent(highlightDocId)}`);
      return;
    }

    deliveryService.listDeliveries(target.id)
      .then((res) => {
        const rows = res.data || [];
        const latest = rows.find((r) => r.ownership_status === 'REJECTED');
        if (latest) {
          const banner = {
            docId: String(target.id),
            reason: latest.rejection_reason || '(no reason given)',
            recipientName: latest.recipient_name || latest.recipient_email || 'the recipient',
          };
          setOwnershipRejectionBanner(banner);
          if (pendingAction === 'edit_resubmit') {
            const wasRejected = target.status === 'draft' && target.signature_status === 'rejected';
            const wasDeliveredRejected = target.status === 'delivered';
            if (wasRejected || wasDeliveredRejected) {
              handleEditResubmit(target, banner);
            }
          }
        } else if (pendingAction === 'edit_resubmit') {
          const wasRejected = target.status === 'draft' && target.signature_status === 'rejected';
          if (wasRejected) handleEditResubmit(target, null);
        }
      })
      .catch(() => {
        if (pendingAction === 'edit_resubmit') {
          const wasRejected = target.status === 'draft' && target.signature_status === 'rejected';
          if (wasRejected) handleEditResubmit(target, null);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction, loadingDocs, highlightDocId, myDocs]);

  const activeDocs = useMemo(() => myDocs.filter((doc) => !doc.deleted_at), [myDocs]);

  const templateNames = useMemo(
    () => Array.from(new Set(activeDocs.map((d) => d.template_name || 'Untitled Template'))).sort((a, b) => a.localeCompare(b)),
    [activeDocs]
  );

  const totals = useMemo(() => {
    const acc = { total: activeDocs.length, pending: 0, approved: 0, delivered: 0 };
    for (const doc of activeDocs) {
      const status = effectiveStatus(doc);
      if (status === 'pending') acc.pending += 1;
      else if (status === 'signed') acc.approved += 1;
      else if (status === 'delivered') acc.delivered += 1;
    }
    return acc;
  }, [activeDocs]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeDocs.filter((doc) => {
      if (templateFilter && (doc.template_name || 'Untitled Template') !== templateFilter) return false;
      if (statusFilter && effectiveStatus(doc) !== statusFilter) return false;
      if (!withinDateFilter(doc, dateFilter)) return false;
      if (q) {
        const haystack = `${doc.doc_uuid} ${doc.record_identifier} ${doc.template_name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [activeDocs, search, templateFilter, statusFilter, dateFilter]);

  const templateGroups = useMemo(() => {
    const byTemplate = new Map();
    for (const doc of filteredDocs) {
      const key = doc.template_name || 'Untitled Template';
      if (!byTemplate.has(key)) byTemplate.set(key, []);
      byTemplate.get(key).push(doc);
    }
    return Array.from(byTemplate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([templateName, docs]) => {
        const byStatus = new Map();
        for (const doc of docs) {
          const key = effectiveStatus(doc);
          if (!byStatus.has(key)) byStatus.set(key, []);
          byStatus.get(key).push(doc);
        }
        const statusGroups = STATUS_GROUP_ORDER
          .filter((status) => byStatus.has(status))
          .map((status) => ({ status, docs: byStatus.get(status) }));
        for (const [status, docs] of byStatus) {
          if (!STATUS_GROUP_ORDER.includes(status)) statusGroups.push({ status, docs });
        }
        return { templateName, count: docs.length, statusGroups };
      });
  }, [filteredDocs]);

  const visibleDocCount  = filteredDocs.length;
  const hasActiveFilters = Boolean(search.trim() || templateFilter || statusFilter || dateFilter);

  const toggleTemplateCollapsed = (templateName) => {
    setCollapsedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateName)) next.delete(templateName); else next.add(templateName);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setTemplateFilter('');
    setStatusFilter('');
    setDateFilter('');
  };

  return (
    <div className="doc-track">
      <div className="doc-track-header">
        <h1>{t('docTracking.title')}</h1>
      </div>
      <p className="doc-track-subtitle">{t('docTracking.subtitle')}</p>

      {!loadingDocs && activeDocs.length > 0 && (
        <div className="doc-track-stats">
          <div className="doc-track-stat">
            <span className="doc-track-stat-value">{totals.total}</span>
            <span className="doc-track-stat-label">{t('docTracking.stats.total')}</span>
          </div>
          <div className="doc-track-stat doc-track-stat-amber">
            <span className="doc-track-stat-value">{totals.pending}</span>
            <span className="doc-track-stat-label">{t('docTracking.stats.pending')}</span>
          </div>
          <div className="doc-track-stat doc-track-stat-green">
            <span className="doc-track-stat-value">{totals.approved}</span>
            <span className="doc-track-stat-label">{t('docTracking.stats.approved')}</span>
          </div>
          <div className="doc-track-stat doc-track-stat-blue">
            <span className="doc-track-stat-value">{totals.delivered}</span>
            <span className="doc-track-stat-label">{t('docTracking.stats.delivered')}</span>
          </div>
        </div>
      )}

      {!loadingDocs && activeDocs.length > 0 && (
        <div className="doc-track-toolbar">
          <div className="doc-track-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('docTracking.toolbar.searchPlaceholder')}
            />
          </div>
          <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}>
            <option value="">{t('docTracking.toolbar.allTemplates')}</option>
            {templateNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            {DATE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasActiveFilters && (
            <button type="button" className="doc-btn doc-btn-secondary" onClick={clearFilters}>
              {t('docTracking.toolbar.clearFilters')}
            </button>
          )}
        </div>
      )}

      {loadingDocs ? (
        <p className="doc-track-loading">{t('docTracking.loading')}</p>
      ) : activeDocs.length === 0 ? (
        <div className="doc-track-empty">{t('docTracking.empty.noDocs')}</div>
      ) : visibleDocCount === 0 ? (
        <div className="doc-track-empty">
          {t('docTracking.empty.noMatch')}{' '}
          <button type="button" className="doc-track-link-btn" onClick={clearFilters}>
            {t('docTracking.empty.clearFilters')}
          </button>
        </div>
      ) : (
        <div className="doc-track-groups">
          {templateGroups.map((group) => {
            const collapsed = collapsedTemplates.has(group.templateName);
            return (
              <section className="doc-track-template-group" key={group.templateName}>
                <button
                  type="button"
                  className="doc-track-template-header"
                  onClick={() => toggleTemplateCollapsed(group.templateName)}
                  aria-expanded={!collapsed}
                >
                  <span className={`doc-track-caret${collapsed ? ' doc-track-caret-collapsed' : ''}`}>▼</span>
                  <h2>{group.templateName}</h2>
                  <span className="doc-track-count">
                    {group.count} {group.count === 1 ? 'document' : 'documents'}
                  </span>
                </button>
                {!collapsed && group.statusGroups.map(({ status, docs }) => {
                  const label = BADGE_LABELS[status] || status;
                  const toneMap = { draft: 'slate', pending: 'amber', signed: 'green', delivered: 'blue', rejected: 'red' };
                  const tone = toneMap[status] || 'slate';
                  return (
                    <div className="doc-track-status-group" key={status}>
                      <div className={`doc-track-status-header doc-track-status-header-${tone}`}>
                        <span className="doc-badge-dot" />
                        {label}
                        <span className="doc-track-status-count">{docs.length}</span>
                      </div>
                      <div className="doc-track-grid">
                        {docs.map((doc) => (
                          <DocumentCard
                            key={doc.id}
                            doc={doc}
                            highlighted={String(doc.id) === String(highlightDocId)}
                            isAdmin={isAdminUser}
                            onNeedsApprover={() => setApproverModalDoc({ id: doc.id, doc_uuid: doc.doc_uuid })}
                            onSecureDeliver={() => setSecureDeliveryModalDoc(doc)}
                            onChanged={loadMyDocs}
                            onEditResubmit={(banner) => handleEditResubmit(doc, banner || null)}
                            ownershipRejectionBanner={
                              ownershipRejectionBanner && ownershipRejectionBanner.docId === String(doc.id)
                                ? ownershipRejectionBanner
                                : null
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {approverModalDoc && (
        <ApproverSelectModal
          title={t('docTracking.card.assignApprover')}
          description={`Document ${approverModalDoc.doc_uuid} needs an approver. Choose who should review, OTP-confirm, and e-sign it.`}
          submitLabel={t('approvals.approveModal.confirmSign')}
          onSubmit={handleAssignApprover}
          onSkip={() => setApproverModalDoc(null)}
        />
      )}
      {secureDeliveryModalDoc && (
        <SecureDeliveryModal
          doc={secureDeliveryModalDoc}
          onClose={() => setSecureDeliveryModalDoc(null)}
          onSent={handleSecureDeliverySent}
        />
      )}
    </div>
  );
}
