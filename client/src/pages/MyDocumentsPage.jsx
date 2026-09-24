import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { templateService, documentService } from '../services/templateService';
import { signatureService, deliveryService } from '../services/workflowService';
import { useToast } from '../hooks/useToast';
import TemplateViewer from '../components/templates/TemplateViewer';
import ApproverSelectModal from '../components/common/ApproverSelectModal';
import BulkGenerationPanel from './BulkGenerationPanel';

/** Small document-style icon */
function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h6M9 8.5h2" />
    </svg>
  );
}

/**
 * "Edit & Resubmit" panel — reached from Document Tracking or the public
 * RejectionReviewPage. Handles both approver-rejected and recipient-rejected documents.
 */
function ResubmitPanel({ resubmitDoc, onDone, onCancel }) {
  const { showToast } = useToast();
  const { t } = useTranslation('layout');
  const [recordId, setRecordId]       = useState(resubmitDoc.record_identifier || '');
  const [note, setNote]               = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [phase, setPhase]             = useState('form'); // 'form' | 'redelivering' | 'done'
  const [deliveryResult, setDeliveryResult] = useState(null);

  const handlePreview = async () => {
    if (!recordId.trim()) {
      showToast(t('myDocuments.resubmit.enterRecordId'), 'error');
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await documentService.preview({ template_id: resubmitDoc.template_id, record_id: recordId.trim() });
      setPreviewData(res.data);
    } catch (err) {
      showToast(err.message || t('myDocuments.previewFailed'), 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async () => {
    if (!recordId.trim()) {
      showToast(t('myDocuments.resubmit.enterRecordId'), 'error');
      return;
    }
    if (!note.trim()) {
      showToast(t('myDocuments.resubmit.enterNote'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await documentService.resubmit(resubmitDoc.id, {
        record_identifier: recordId.trim(),
        note: note.trim(),
      });
      showToast(res.message || 'Corrected document generated.', 'success');

      setPhase('redelivering');
      let delivery = null;
      try {
        const newDocId = res.data?.id || res.data?.docId || resubmitDoc.id;
        const delivRes = await deliveryService.resubmitDelivery(newDocId);
        delivery = delivRes.data;
      } catch (delivErr) {
        console.warn('[ResubmitPanel] resubmit-delivery failed (non-fatal):', delivErr.message);
      }
      setDeliveryResult(delivery);
      setPhase('done');
    } catch (err) {
      showToast(err.message || t('myDocuments.resubmit.failed'), 'error');
      setPhase('form');
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'done') {
    return (
      <div className="my-documents-page">
        <h1>Resubmitted Successfully</h1>
        <div className="send-doc-verify send-doc-verify-ok" style={{ flexDirection: 'column', gap: 10, maxWidth: 560, marginTop: 16 }}>
          <div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Corrected document regenerated
          </div>
          {deliveryResult ? (
            <>
              <div>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                Sent directly to <b>{deliveryResult.recipientEmail}</b>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                The recipient will receive a new secure link and must complete OTP verification again before downloading. No approver step was needed.
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Delivery could not be sent automatically — use the <b>Send</b> button in Document Tracking to send it to the recipient.
            </div>
          )}
        </div>
        <div className="template-form-actions" style={{ marginTop: 20 }}>
          <button type="button" onClick={onDone} className="btn-primary">
            Go to Document Tracking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-documents-page">
      <h1>{t('myDocuments.resubmit.title')}</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: -8 }}>
        Fixing <b>{resubmitDoc.doc_uuid}</b> ({resubmitDoc.template_name}) — the corrected document
        will be sent <b>directly to the recipient</b> once you submit. No approver step required.
      </p>

      {resubmitDoc.rejection_reason && (
        <p className="approver-required-banner" style={{ display: 'block' }}>
          <b>Rejection reason:</b> {resubmitDoc.rejection_reason}
        </p>
      )}

      <div className="template-form" style={{ maxWidth: 560 }}>
        <div className="form-field">
          <label>Template</label>
          <p style={{ margin: '4px 0', fontWeight: 600 }}>{resubmitDoc.template_name}</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            The current version of the template is used automatically. If the template itself was the problem, fix it in Templates first, then resubmit here.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="resubmit-record-id">{t('myDocuments.resubmit.recordIdLabel')}</label>
          <input
            id="resubmit-record-id"
            value={recordId}
            onChange={(e) => { setRecordId(e.target.value); setPreviewData(null); }}
            placeholder="e.g. EMP001"
            autoFocus
            disabled={submitting}
          />
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Pre-filled with the original entry — change it if the wrong record was the problem.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="resubmit-note">{t('myDocuments.resubmit.noteLabel')}</label>
          <textarea
            id="resubmit-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={t('myDocuments.resubmit.notePlaceholder')}
            disabled={submitting}
          />
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          Submitting regenerates the document and sends a new secure link + OTP directly to the recipient.
        </p>

        <div className="template-form-actions">
          <button type="button" onClick={handlePreview} disabled={loadingPreview || submitting} className="btn-secondary">
            {loadingPreview ? t('myDocuments.resubmit.previewing') : t('myDocuments.resubmit.previewBtn')}
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || !recordId.trim()} className="btn-primary">
            {phase === 'redelivering'
              ? 'Sending to recipient…'
              : submitting
                ? t('myDocuments.resubmit.submitting')
                : t('myDocuments.resubmit.submitBtn')}
          </button>
          <button type="button" onClick={onCancel} disabled={submitting} className="btn-secondary">
            {t('myDocuments.resubmit.cancelBtn')}
          </button>
        </div>
      </div>

      {previewData && (
        <div style={{ marginTop: 24 }}>
          <h2>Preview</h2>
          <TemplateViewer data={previewData} />
        </div>
      )}
    </div>
  );
}

/**
 * Generation-only page: pick a template, then pick Single / Multiple / Bulk mode.
 * Also serves as the Edit & Resubmit landing page when arriving with rejected doc state.
 */
export default function MyDocumentsPage() {
  const { showToast } = useToast();
  const { t } = useTranslation(['translation', 'layout']);
  const location = useLocation();
  const navigate  = useNavigate();
  const [resubmitDoc, setResubmitDoc] = useState(location.state?.resubmitDoc || null);

  // Build generation modes from t() so they update on language switch
  const MODES = [
    { id: 'single',   title: t('modes.singleTitle'),   desc: t('modes.singleDesc') },
    { id: 'multiple', title: t('modes.multipleTitle'),  desc: t('modes.multipleDesc') },
    { id: 'bulk',     title: t('modes.bulkTitle'),      desc: t('modes.bulkDesc') },
  ];

  const [templates, setTemplates]           = useState([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [mode, setMode]                     = useState('single');
  const [recordId, setRecordId]             = useState('');
  const [previewData, setPreviewData]       = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating]         = useState(false);
  const [approverModalDoc, setApproverModalDoc] = useState(null);

  useEffect(() => {
    templateService.getAll({ status: 'active' })
      .then((res) => setTemplates(res.data))
      .catch((err) => showToast(err.message || t('myDocuments.generateFailed', { ns: 'layout' }), 'error'))
      .finally(() => setTemplatesLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTemplateChange = (id) => {
    setSelectedTemplateId(id);
    setMode('single');
    setRecordId('');
    setPreviewData(null);
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setRecordId('');
    setPreviewData(null);
  };

  const handlePreview = async () => {
    const id = recordId.trim();
    if (!selectedTemplateId || !id) {
      showToast(t('myDocuments.enterRecordId', { ns: 'layout' }), 'error');
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await documentService.preview({ template_id: selectedTemplateId, record_id: id });
      setPreviewData(res.data);
    } catch (err) {
      showToast(err.message || t('myDocuments.previewFailed', { ns: 'layout' }), 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleGenerate = async () => {
    const id = recordId.trim();
    if (!selectedTemplateId || !id) return;
    setGenerating(true);
    try {
      const res = await documentService.generate({ template_id: selectedTemplateId, record_id: id });
      showToast(res.message || t('myDocuments.generatedSuccess', { ns: 'layout' }), 'success');
      setApproverModalDoc({ id: res.data.id, doc_uuid: res.data.docUuid });
    } catch (err) {
      showToast(err.message || t('myDocuments.generateFailed', { ns: 'layout' }), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleAssignApprover = async (approverId) => {
    try {
      const res = await signatureService.initiate(approverModalDoc.id, approverId);
      showToast(res.message || 'Signature request sent — track it from Document Tracking.', 'success');
      setApproverModalDoc(null);
      navigate(`/document-tracking?highlight=${approverModalDoc.id}`);
    } catch (err) {
      showToast(err.message || t('docTracking.approverFailed', { ns: 'layout' }), 'error');
    }
  };

  if (resubmitDoc) {
    const clearResubmit = () => {
      setResubmitDoc(null);
      navigate(location.pathname, { replace: true, state: {} });
    };
    return (
      <ResubmitPanel
        resubmitDoc={resubmitDoc}
        onDone={() => navigate('/document-tracking', { replace: true })}
        onCancel={clearResubmit}
      />
    );
  }

  return (
    <div className="my-documents-page">
      <h1>{t('myDocuments.generateTitle', { ns: 'layout' })}</h1>

      {templatesLoaded && templates.length === 0 && (
        <p className="approver-required-banner" style={{ display: 'block' }}>
          No <strong>Active</strong> templates yet — single and bulk/CSV generation only work
          against a template whose status is Active. Ask an admin to create or activate one in Templates.
        </p>
      )}

      {templates.length > 0 && (
        <div className="template-card-grid doc-template-picker" role="tablist" aria-label={t('myDocuments.selectTemplate', { ns: 'layout' })}>
          {templates.map((tmpl) => {
            const selected = String(selectedTemplateId) === String(tmpl.id);
            return (
              <button
                type="button"
                key={tmpl.id}
                role="tab"
                aria-selected={selected}
                className={`template-card doc-template-card${selected ? ' doc-template-card-selected' : ''}`}
                onClick={() => handleTemplateChange(tmpl.id)}
              >
                <div className="template-card-top">
                  <div className="template-card-icon"><DocumentIcon /></div>
                  <div className="template-card-title-wrap">
                    <h3 className="template-card-name" title={tmpl.name}>{tmpl.name}</h3>
                    <span className="template-card-category">{tmpl.category}</span>
                  </div>
                  {selected && <span className="gen-mode-card-check">✓</span>}
                </div>
                <div className="template-card-meta">
                  <span className="template-card-meta-item"><strong>Version</strong> v{tmpl.version}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedTemplateId && (
        <>
          <div className="gen-mode-grid" role="tablist" aria-label={t('myDocuments.generateTitle', { ns: 'layout' })}>
            {MODES.map((m) => {
              const selected = mode === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  role="tab"
                  aria-selected={selected}
                  className={`gen-mode-card${selected ? ' gen-mode-selected' : ''}`}
                  onClick={() => handleModeChange(m.id)}
                >
                  <div className="gen-mode-card-top">
                    <h3 className="gen-mode-card-title">{m.title}</h3>
                    {selected && <span className="gen-mode-card-check">✓</span>}
                  </div>
                  <p className="gen-mode-card-desc">{m.desc}</p>
                </button>
              );
            })}
          </div>

          {mode === 'single' && (
            <div className="template-form" style={{ maxWidth: 560 }}>
              <div className="form-field">
                <label htmlFor="doc-record-id">{t('myDocuments.recordIdLabel', { ns: 'layout' })}</label>
                <input
                  id="doc-record-id"
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  placeholder={t('myDocuments.recordIdPlaceholder', { ns: 'layout' })}
                  autoFocus
                />
              </div>

              <div className="template-form-actions">
                <button type="button" onClick={handlePreview} disabled={loadingPreview} className="btn-secondary">
                  {loadingPreview ? t('myDocuments.previewing', { ns: 'layout' }) : t('myDocuments.previewBtn', { ns: 'layout' })}
                </button>
                <button type="button" onClick={handleGenerate} disabled={generating || !recordId} className="btn-primary">
                  {generating ? t('myDocuments.generating', { ns: 'layout' }) : t('myDocuments.generateBtn', { ns: 'layout' })}
                </button>
              </div>
            </div>
          )}

          {previewData && mode === 'single' && (
            <div style={{ marginTop: 24 }}>
              <h2>Preview</h2>
              <TemplateViewer data={previewData} />
            </div>
          )}

          {(mode === 'multiple' || mode === 'bulk') && (
            <BulkGenerationPanel key={`${selectedTemplateId}-${mode}`} templateId={selectedTemplateId} mode={mode} />
          )}
        </>
      )}

      {approverModalDoc && (
        <ApproverSelectModal
          title={t('docTracking.card.assignApprover', { ns: 'layout' })}
          description={`Document ${approverModalDoc.doc_uuid} needs an approver. Choose who should review, OTP-confirm, and e-sign it.`}
          submitLabel={t('approvals.approveModal.confirmSign', { ns: 'layout' })}
          onSubmit={handleAssignApprover}
          onSkip={() => {
            const docId = approverModalDoc.id;
            setApproverModalDoc(null);
            navigate(`/document-tracking?highlight=${docId}`);
          }}
        />
      )}
    </div>
  );
}
