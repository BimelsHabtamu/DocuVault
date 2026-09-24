/**
 * VerifyModal — opens over any page in the workspace.
 * Triggered by the Sidebar "Verify Document" button.
 * All verify logic is self-contained; no route change happens.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { verifyByDocId, verifyByFile, verifyDocumentSignature } from '../../services/publicService';

/* ── small inline icons ── */
function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  );
}
function IconWarn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

export default function VerifyModal({ open, onClose }) {
  const { t } = useTranslation(['translation', 'layout']);
  const [mode,       setMode]       = useState('doc_id');
  const [docId,      setDocId]      = useState('');
  const [pdfFile,    setPdfFile]    = useState(null);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [sigResult,  setSigResult]  = useState(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigError,   setSigError]   = useState(null);

  /* Reset state every time the modal opens */
  useEffect(() => {
    if (open) {
      setMode('doc_id');
      setDocId('');
      setPdfFile(null);
      setResult(null);
      setError(null);
      setSigResult(null);
      setSigError(null);
    }
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Lock body scroll while open */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function reset() {
    setResult(null); setError(null); setSigResult(null); setSigError(null);
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      let res;
      if (mode === 'upload') {
        if (!pdfFile) { setError(t('verify.errSelectPdf')); setLoading(false); return; }
        res = await verifyByFile(pdfFile);
      } else {
        const id = docId.trim().toUpperCase();
        if (!id) { setError(t('verify.errEnterDocId')); setLoading(false); return; }
        res = await verifyByDocId(id);
      }
      if (!res.data) throw new Error(res.message || t('verify.verificationFailed'));
      setResult(res.data);
    } catch (err) {
      setError(err.message || t('verify.verificationFailedRetry'));
    } finally {
      setLoading(false);
    }
  }, [mode, docId, pdfFile, t]);

  const handleVerifySig = useCallback(async () => {
    if (!result?.docId) return;
    setSigLoading(true); setSigError(null); setSigResult(null);
    try {
      const res = await verifyDocumentSignature(result.docId);
      if (!res.data) throw new Error(res.message || t('verify.sigFailed'));
      setSigResult(res.data);
    } catch (err) {
      setSigError(err.message || t('verify.sigFailed'));
    } finally {
      setSigLoading(false);
    }
  }, [result?.docId, t]);

  if (!open) return null;

  const verified = result?.verified === true;
  const notFound = result?.verified === false && result?.reason === 'not_found';
  const revoked  = result?.result === 'REVOKED';
  const tampered = result?.verified === false && !notFound && !revoked;

  return (
    <>
      {/* ── styles (scoped to .vm-) ── */}
      <style>{`
        .vm-overlay {
          position: fixed; inset: 0; z-index: 2000;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: vm-fade-in 0.18s ease;
        }
        @keyframes vm-fade-in { from { opacity: 0; } to { opacity: 1; } }

        .vm-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          width: 100%; max-width: 500px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          box-shadow: var(--shadow-overlay);
          display: flex; flex-direction: column;
          animation: vm-slide-in 0.22s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes vm-slide-in {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── header ── */
        .vm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .vm-header-left {
          display: flex; align-items: center; gap: 10px;
        }
        .vm-header-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: var(--accent-light);
          color: var(--accent);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .vm-title {
          font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0;
        }
        .vm-subtitle {
          font-size: 0.76rem; color: var(--text-muted); margin: 2px 0 0;
        }
        .vm-close-btn {
          width: 32px; height: 32px; border-radius: 8px;
          border: none; background: none; cursor: pointer;
          color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .vm-close-btn:hover {
          background: var(--bg-subtle); color: var(--text-primary);
        }

        /* ── body ── */
        .vm-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

        /* ── mode tabs ── */
        .vm-tabs {
          display: flex; border: 1.5px solid var(--border-strong);
          border-radius: 9px; overflow: hidden;
        }
        .vm-tab {
          flex: 1; padding: 9px 8px; border: none; cursor: pointer;
          font-size: 0.82rem; font-weight: 600; font-family: inherit;
          transition: background 0.15s, color 0.15s;
          background: var(--bg-subtle); color: var(--text-secondary);
        }
        .vm-tab.vm-tab-active {
          background: var(--accent); color: #fff;
        }
        .vm-tab:not(.vm-tab-active):hover {
          background: var(--bg-muted); color: var(--text-primary);
        }

        /* ── field ── */
        .vm-field { display: flex; flex-direction: column; gap: 5px; }
        .vm-label { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); }
        .vm-hint  { font-size: 0.74rem; color: var(--text-muted); margin: 0; }
        .vm-input {
          width: 100%; padding: 10px 13px;
          border: 1.5px solid var(--border-strong); border-radius: 9px;
          font-size: 0.9rem; font-family: inherit;
          color: var(--text-primary); background: var(--bg-subtle);
          outline: none;
          text-transform: uppercase; letter-spacing: 0.04em;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          box-sizing: border-box;
        }
        .vm-input:focus {
          border-color: var(--accent);
          background: var(--bg-surface);
          box-shadow: 0 0 0 3px rgba(15,118,110,0.15);
        }
        .vm-input::placeholder { text-transform: none; letter-spacing: normal; color: var(--text-muted); }
        .vm-file-input {
          width: 100%; padding: 9px 12px;
          border: 1.5px solid var(--border-strong); border-radius: 9px;
          font-size: 0.84rem; font-family: inherit;
          color: var(--text-primary); background: var(--bg-subtle);
          cursor: pointer; box-sizing: border-box;
        }

        /* ── error ── */
        .vm-error {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 12px;
          background: var(--error-bg); border: 1px solid var(--error-border);
          border-radius: 8px; font-size: 0.82rem; color: var(--error-text);
        }

        /* ── submit button ── */
        .vm-submit-btn {
          width: 100%; padding: 11px;
          background: var(--accent); color: #fff;
          border: none; border-radius: 9px;
          font-size: 0.85rem; font-weight: 700; font-family: inherit;
          letter-spacing: 0.06em; text-transform: uppercase;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; gap: 8px;
          box-shadow: 0 3px 10px rgba(15,118,110,0.30);
          transition: background 0.15s, opacity 0.15s, transform 0.12s;
        }
        .vm-submit-btn:hover:not(:disabled) {
          background: var(--accent-dark); transform: translateY(-1px);
        }
        .vm-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .vm-spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; animation: vm-spin .65s linear infinite; flex-shrink: 0;
        }
        @keyframes vm-spin { to { transform: rotate(360deg); } }

        /* ── result ── */
        .vm-result {
          border-radius: 11px; overflow: hidden;
          border: 1px solid var(--border);
        }
        .vm-result-head {
          display: flex; align-items: center; gap: 12px; padding: 13px 15px;
        }
        .vm-result-head-ok     { background: var(--success-bg); }
        .vm-result-head-fail   { background: var(--error-bg); }
        .vm-result-head-warn   { background: var(--warn-bg); }
        .vm-result-icon {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .vm-result-icon-ok   { background: rgba(74,222,128,0.15); }
        .vm-result-icon-fail { background: rgba(248,113,113,0.15); }
        .vm-result-icon-warn { background: rgba(251,191,36,0.15); }
        .vm-result-title {
          font-size: 0.9rem; font-weight: 700; line-height: 1.2;
        }
        .vm-result-title-ok   { color: var(--success-text); }
        .vm-result-title-fail { color: var(--error-text); }
        .vm-result-title-warn { color: var(--warn-text); }
        .vm-result-sub {
          font-size: 0.74rem; margin-top: 3px; opacity: 0.85;
        }
        .vm-result-body {
          padding: 12px 15px; border-top: 1px solid var(--border);
          background: var(--bg-subtle);
          display: flex; flex-direction: column; gap: 8px;
        }
        .vm-result-row { display: flex; gap: 10px; font-size: 0.8rem; line-height: 1.4; }
        .vm-result-key {
          font-weight: 600; color: var(--text-secondary);
          min-width: 106px; flex-shrink: 0;
        }
        .vm-result-val {
          color: var(--text-primary);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78rem; word-break: break-all;
        }
        .vm-result-val-plain { font-family: inherit; font-size: 0.8rem; text-transform: capitalize; }
        .vm-tamper-warn {
          padding: 8px 10px; border-radius: 7px; font-size: 0.77rem;
          font-style: italic; background: var(--error-bg); color: var(--error-text);
        }

        /* ── signature sub-panel ── */
        .vm-sig-panel {
          padding: 12px 15px; border-top: 1px solid var(--border);
          background: var(--bg-surface);
        }
        .vm-sig-title { font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; }
        .vm-sig-btn {
          padding: 6px 14px; border-radius: 7px;
          border: 1px solid var(--border-strong);
          background: var(--bg-subtle); color: var(--text-primary);
          font-size: 0.78rem; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: background 0.15s;
        }
        .vm-sig-btn:hover { background: var(--bg-muted); }
        .vm-sig-ok   { color: var(--success-text); font-size: 0.8rem; font-weight: 600; }
        .vm-sig-fail { color: var(--error-text);   font-size: 0.8rem; font-weight: 600; }
        .vm-sig-muted { color: var(--text-muted); font-size: 0.8rem; }
        .vm-sig-detail { font-size: 0.78rem; color: var(--text-primary); margin-top: 4px; }
      `}</style>

      {/* ── Overlay ── */}
      <div
        className="vm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.verifyDocument')}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="vm-panel">

          {/* ── Header ── */}
          <div className="vm-header">
            <div className="vm-header-left">
              <div className="vm-header-icon">
                <IconShield />
              </div>
              <div>
                <h2 className="vm-title">{t('nav.verifyDocument')}</h2>
                <p className="vm-subtitle">{t('verify.subtitle')}</p>
              </div>
            </div>
            <button type="button" className="vm-close-btn" onClick={onClose} aria-label={t('common.close')}>
              <IconClose />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="vm-body">

            {/* Scanning progress bar */}
            {loading && (
              <div style={{ height: 2, background: 'var(--bg-muted)', borderRadius: 2, overflow: 'hidden', marginBottom: -8 }}>
                <div style={{ height: '100%', width: '40%', background: 'var(--accent)', animation: 'vm-scan 1.1s ease-in-out infinite', borderRadius: 2 }} />
              </div>
            )}
            <style>{`@keyframes vm-scan { 0%{margin-left:-40%} 100%{margin-left:140%} }`}</style>

            {/* Mode tabs */}
            <div className="vm-tabs" role="tablist" aria-label={t('verify.methodLabel')}>
              <button
                type="button" role="tab"
                className={`vm-tab${mode === 'doc_id' ? ' vm-tab-active' : ''}`}
                aria-selected={mode === 'doc_id'}
                onClick={() => { setMode('doc_id'); reset(); setPdfFile(null); }}
              >
                {t('verify.byDocId')}
              </button>
              <button
                type="button" role="tab"
                className={`vm-tab${mode === 'upload' ? ' vm-tab-active' : ''}`}
                aria-selected={mode === 'upload'}
                onClick={() => { setMode('upload'); reset(); setDocId(''); }}
              >
                {t('verify.uploadPdf')}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="vm-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              {mode === 'doc_id' && (
                <div className="vm-field" style={{ marginBottom: 12 }}>
                  <label htmlFor="vm-doc-id" className="vm-label">{t('verify.docIdLabel')}</label>
                  <p className="vm-hint">{t('verify.docIdHint')}</p>
                  <input
                    id="vm-doc-id"
                    className="vm-input"
                    value={docId}
                    onChange={(e) => { setDocId(e.target.value); reset(); }}
                    placeholder={t('verify.docIdPlaceholder')}
                    autoFocus
                    disabled={loading}
                  />
                </div>
              )}
              {mode === 'upload' && (
                <div className="vm-field" style={{ marginBottom: 12 }}>
                  <label htmlFor="vm-pdf" className="vm-label">{t('verify.uploadPdf')}</label>
                  <p className="vm-hint">{t('verify.uploadPdfHint')}</p>
                  <input
                    id="vm-pdf"
                    type="file"
                    accept="application/pdf"
                    className="vm-file-input"
                    onChange={(e) => { setPdfFile(e.target.files[0] || null); reset(); }}
                    disabled={loading}
                  />
                </div>
              )}

              <button
                type="submit"
                className="vm-submit-btn"
                disabled={loading || (mode === 'doc_id' ? !docId.trim() : !pdfFile)}
                aria-busy={loading}
              >
                {loading
                  ? <><span className="vm-spinner" aria-hidden="true" />{t('verify.verifying')}</>
                  : <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      {t('nav.verifyDocument')}
                    </>
                }
              </button>
            </form>

            {/* ── Result ── */}
            {result && (
              <div className="vm-result">
                {/* Head */}
                <div className={`vm-result-head ${verified ? 'vm-result-head-ok' : revoked ? 'vm-result-head-warn' : 'vm-result-head-fail'}`}>
                  <div className={`vm-result-icon ${verified ? 'vm-result-icon-ok' : revoked ? 'vm-result-icon-warn' : 'vm-result-icon-fail'}`}>
                    {verified ? <IconCheck /> : revoked ? <IconWarn /> : <IconX />}
                  </div>
                  <div>
                    <div className={`vm-result-title ${verified ? 'vm-result-title-ok' : revoked ? 'vm-result-title-warn' : 'vm-result-title-fail'}`}>
                      {verified   ? `✓ ${t('verify.authenticTitle')}`
                      : revoked   ? `⚠ ${t('verify.revokedTitle')}`
                      : notFound  ? t('verify.notFoundTitle')
                      :             `⚠ ${t('verify.corruptTitle')}`}
                    </div>
                    <div className={`vm-result-sub ${verified ? 'vm-result-title-ok' : revoked ? 'vm-result-title-warn' : 'vm-result-title-fail'}`}>
                      {verified   ? t('verify.authenticSub')
                      : revoked   ? t('verify.revokedSub')
                      : notFound  ? t('verify.notFoundSub')
                      :             t('verify.corruptSub')}
                    </div>
                  </div>
                </div>

                {/* Detail rows */}
                {(result.docId || result.docStatus || result.generatedAt || result.issuedAt || result.revokedAt) && (
                  <div className="vm-result-body">
                    {result.docId && (
                      <div className="vm-result-row">
                        <span className="vm-result-key">{t('verify.resultDocId')}</span>
                        <span className="vm-result-val">{result.docId}</span>
                      </div>
                    )}
                    {result.docStatus && (
                      <div className="vm-result-row">
                        <span className="vm-result-key">{t('common.status')}</span>
                        <span className="vm-result-val vm-result-val-plain">{result.docStatus}</span>
                      </div>
                    )}
                    {(result.generatedAt || result.issuedAt) && (
                      <div className="vm-result-row">
                        <span className="vm-result-key">{t('verify.recordedAt')}</span>
                        <span className="vm-result-val vm-result-val-plain">
                          {new Date(result.generatedAt || result.issuedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {result.revokedAt && (
                      <div className="vm-result-row">
                        <span className="vm-result-key">{t('verify.revokedAt')}</span>
                        <span className="vm-result-val vm-result-val-plain">
                          {new Date(result.revokedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {(tampered || result.hashNote === 'content_hash_mismatch') && (
                      <p className="vm-tamper-warn">
                        {t('verify.tamperWarning')}
                      </p>
                    )}
                  </div>
                )}

                {/* Digital signature panel */}
                {result.docId && (
                  <div className="vm-sig-panel">
                    <div className="vm-sig-title">{t('verify.digitalSignature')}</div>
                    {!sigResult && !sigLoading && !sigError && (
                      <button type="button" className="vm-sig-btn" onClick={handleVerifySig}>
                        {t('verify.verifyDigitalSignature')}
                      </button>
                    )}
                    {sigLoading && <p className="vm-sig-muted" aria-live="polite">{t('verify.verifyingSignature')}</p>}
                    {sigError   && <p className="vm-sig-fail" role="alert">{sigError}</p>}
                    {sigResult  && (
                      <>
                        <p className={sigResult.signatureValid ? 'vm-sig-ok' : sigResult.signed === false ? 'vm-sig-muted' : 'vm-sig-fail'}>
                          {sigResult.signed === false
                            ? t('verify.notYetSigned')
                            : sigResult.signatureValid
                              ? `✓ ${t('verify.signatureValid')}`
                              : `✗ ${t('verify.signatureHmacMismatch')}`}
                        </p>
                        {sigResult.signerName && (
                          <p className="vm-sig-detail">{t('verify.approverLabel')} <strong>{sigResult.signerName}</strong></p>
                        )}
                        {sigResult.signedAt && (
                          <p className="vm-sig-detail">
                            {t('verify.signedLabel')} {new Date(sigResult.signedAt).toLocaleString()}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
