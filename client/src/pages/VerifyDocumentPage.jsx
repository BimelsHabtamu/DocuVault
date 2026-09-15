import { useState } from 'react';
import { Link } from 'react-router-dom';
import { verifyByDocId, verifyByFile, verifyDocumentSignature } from '../services/publicService';
import { useAuth } from '../hooks/useAuth';
import logo from '/public/logo.png';

/* -----------------------------------------------------------------------------
   Shared verification logic � used by BOTH the in-app and public variants.
----------------------------------------------------------------------------- */
function useVerification() {
  const [mode,       setMode]       = useState('doc_id');
  const [docId,      setDocId]      = useState('');
  const [pdfFile,    setPdfFile]    = useState(null);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [sigResult,  setSigResult]  = useState(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigError,   setSigError]   = useState(null);

  function reset() {
    setResult(null); setError(null); setSigResult(null); setSigError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      let res;
      if (mode === 'upload') {
        if (!pdfFile) { setError('Please select a PDF file to upload.'); setLoading(false); return; }
        res = await verifyByFile(pdfFile);
      } else {
        const id = docId.trim().toUpperCase();
        if (!id) { setError('Please enter a Document ID.'); setLoading(false); return; }
        res = await verifyByDocId(id);
      }
      if (!res.data) throw new Error(res.message || 'Verification failed.');
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySignature() {
    const id = result?.docId;
    if (!id) return;
    setSigLoading(true);
    setSigError(null);
    setSigResult(null);
    try {
      const res = await verifyDocumentSignature(id);
      if (!res.data) throw new Error(res.message || 'Signature verification failed.');
      setSigResult(res.data);
    } catch (err) {
      setSigError(err.message || 'Signature verification failed.');
    } finally {
      setSigLoading(false);
    }
  }

  return {
    mode, setMode, docId, setDocId, pdfFile, setPdfFile,
    result, loading, error, sigResult, sigLoading, sigError,
    reset, handleSubmit, handleVerifySignature,
  };
}

/* -----------------------------------------------------------------------------
   IN-APP version � renders inside the Layout sidebar/navbar, no full-screen bg.
----------------------------------------------------------------------------- */

/* -----------------------------------------------------------------------------
   IN-APP version � renders inside the Layout sidebar/navbar.
   Matches the clean workspace verify page design: centered shield, tabs, input.
----------------------------------------------------------------------------- */
function InAppVerifyPage() {
  const {
    mode, setMode, docId, setDocId, pdfFile, setPdfFile,
    result, loading, error, sigResult, sigLoading, sigError,
    reset, handleSubmit, handleVerifySignature,
  } = useVerification();

  const verified = result?.verified === true;
  const notFound = result?.verified === false && result?.reason === 'not_found';
  const revoked  = result?.result === 'REVOKED';
  const tampered = result?.verified === false && !notFound && !revoked;

  return (
    <div className="vfy-page">
      <style>{`
        /* -- Verify page � in-app workspace layout -- */
        .vfy-page {
          min-height: calc(100vh - var(--navbar-height) - 64px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 48px 24px 64px;
        }

        /* -- Shield icon -- */
        .vfy-icon-wrap {
          width: 68px; height: 68px;
          background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
          box-shadow: 0 8px 24px rgba(99,102,241,0.35);
        }

        /* -- Header text -- */
        .vfy-heading {
          font-size: 1.6rem; font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 8px; text-align: center;
        }
        .vfy-subheading {
          font-size: 0.9rem; color: var(--text-muted);
          text-align: center; margin: 0 0 32px;
          max-width: 420px; line-height: 1.5;
        }

        /* -- Card -- */
        .vfy-card {
          width: 100%; max-width: 560px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-md);
          overflow: hidden;
        }

        /* -- Tab strip -- */
        .vfy-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          background: var(--bg-subtle);
        }
        .vfy-tab {
          flex: 1; padding: 13px 8px;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          font-size: 0.84rem; font-weight: 600;
          border: none; background: transparent;
          cursor: pointer; font-family: inherit;
          color: var(--text-muted);
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
          margin-bottom: -1px;
        }
        .vfy-tab:hover:not(.vfy-tab-active) {
          color: var(--text-primary);
          background: var(--bg-surface);
        }
        .vfy-tab-active {
          color: var(--accent);
          border-bottom-color: var(--accent);
          background: var(--bg-surface);
        }

        /* -- Card body -- */
        .vfy-body { padding: 28px 28px 24px; }

        /* -- Section label -- */
        .vfy-field-label {
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted); margin-bottom: 10px;
        }

        /* -- Search-style input row -- */
        .vfy-input-row {
          display: flex; align-items: center; gap: 0;
          border: 1.5px solid var(--border-strong);
          border-radius: 10px; overflow: hidden;
          background: var(--bg-surface);
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .vfy-input-row:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(15,118,110,0.14);
        }
        .vfy-input-icon {
          padding: 0 12px; color: var(--text-muted);
          display: flex; align-items: center; flex-shrink: 0;
        }
        .vfy-input {
          flex: 1; padding: 12px 4px 12px 0;
          border: none; outline: none; background: transparent;
          font-size: 0.95rem; font-family: inherit;
          color: var(--text-primary);
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .vfy-input::placeholder {
          text-transform: none; letter-spacing: normal;
          color: var(--text-muted);
        }
        .vfy-verify-btn {
          padding: 11px 22px;
          background: var(--accent); color: #fff;
          border: none; cursor: pointer; font-family: inherit;
          font-size: 0.85rem; font-weight: 700;
          display: flex; align-items: center; gap: 7px;
          transition: background 0.15s;
          flex-shrink: 0;
          border-radius: 0;
        }
        .vfy-verify-btn:hover:not(:disabled) { background: var(--accent-dark); }
        .vfy-verify-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* -- File input -- */
        .vfy-file-wrap {
          border: 2px dashed var(--border-strong); border-radius: 10px;
          padding: 24px; text-align: center;
          background: var(--bg-subtle);
          transition: border-color 0.15s, background 0.15s;
          cursor: pointer;
        }
        .vfy-file-wrap:hover { border-color: var(--accent); background: var(--bg-surface); }
        .vfy-file-input { display: none; }
        .vfy-file-label {
          font-size: 0.85rem; color: var(--text-secondary);
          cursor: pointer; display: block;
        }
        .vfy-file-chosen {
          font-size: 0.82rem; color: var(--accent);
          font-weight: 600; margin-top: 6px;
        }
        .vfy-file-submit {
          margin-top: 16px; width: 100%; padding: 12px;
          background: var(--accent); color: #fff;
          border: none; border-radius: 10px;
          font-size: 0.86rem; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; gap: 8px;
          transition: background 0.15s; letter-spacing: 0.04em;
        }
        .vfy-file-submit:hover:not(:disabled) { background: var(--accent-dark); }
        .vfy-file-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        /* -- Spinner -- */
        .vfy-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: vfy-spin .65s linear infinite; flex-shrink: 0;
        }
        @keyframes vfy-spin { to { transform: rotate(360deg); } }

        /* -- Scan bar -- */
        .vfy-scan {
          height: 2px; background: var(--bg-muted);
          border-radius: 2px; overflow: hidden; margin-bottom: 0;
        }
        .vfy-scan-bar {
          height: 100%; width: 40%; background: var(--accent);
          border-radius: 2px; animation: vfy-scan .9s ease-in-out infinite;
        }
        @keyframes vfy-scan { 0%{margin-left:-40%} 100%{margin-left:140%} }

        /* -- Error -- */
        .vfy-error {
          margin: 0 28px 16px; padding: 10px 14px;
          background: var(--error-bg); border: 1px solid var(--error-border);
          border-radius: 8px; font-size: 0.82rem; color: var(--error-text);
          display: flex; align-items: flex-start; gap: 8px;
        }

        /* -- Result panel -- */
        .vfy-result {
          margin: 20px 28px 0;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .vfy-result-head {
          padding: 16px 18px;
          display: flex; align-items: center; gap: 14px;
        }
        .vfy-result-head-ok   { background: var(--success-bg); }
        .vfy-result-head-fail { background: var(--error-bg); }
        .vfy-result-head-warn { background: var(--warn-bg); }
        .vfy-result-icon {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .vfy-result-icon-ok   { background: rgba(22,163,74,0.15); }
        .vfy-result-icon-fail { background: rgba(220,38,38,0.15); }
        .vfy-result-icon-warn { background: rgba(217,119,6,0.15); }
        .vfy-result-title {
          font-size: 0.95rem; font-weight: 700; line-height: 1.25; margin: 0;
        }
        .vfy-result-title-ok   { color: var(--success-text); }
        .vfy-result-title-fail { color: var(--error-text); }
        .vfy-result-title-warn { color: var(--warn-text); }
        .vfy-result-sub {
          font-size: 0.78rem; margin: 3px 0 0; opacity: 0.85; font-weight: 400;
        }
        .vfy-result-body {
          padding: 14px 18px; border-top: 1px solid var(--border);
          background: var(--bg-subtle);
          display: flex; flex-direction: column; gap: 9px;
        }
        .vfy-result-row { display: flex; gap: 10px; font-size: 0.82rem; line-height: 1.4; }
        .vfy-result-key {
          font-weight: 600; color: var(--text-secondary);
          min-width: 112px; flex-shrink: 0;
        }
        .vfy-result-val {
          color: var(--text-primary);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.8rem; word-break: break-all;
        }
        .vfy-result-val-plain {
          font-family: inherit; text-transform: capitalize; font-size: 0.82rem;
        }
        .vfy-tamper-note {
          padding: 8px 12px; border-radius: 7px;
          font-size: 0.78rem; font-style: italic;
          background: var(--error-bg); color: var(--error-text);
        }

        /* -- Signature sub-panel -- */
        .vfy-sig {
          padding: 14px 18px; border-top: 1px solid var(--border);
          background: var(--bg-surface);
        }
        .vfy-sig-title {
          font-size: 0.74rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 10px;
        }
        .vfy-sig-btn {
          padding: 7px 16px; border-radius: 8px;
          border: 1px solid var(--border-strong);
          background: var(--bg-subtle); color: var(--text-primary);
          font-size: 0.8rem; font-weight: 600;
          cursor: pointer; font-family: inherit;
          transition: background 0.15s;
        }
        .vfy-sig-btn:hover { background: var(--bg-muted); }
        .vfy-sig-ok   { color: var(--success-text); font-size: 0.82rem; font-weight: 600; }
        .vfy-sig-fail { color: var(--error-text);   font-size: 0.82rem; font-weight: 600; }
        .vfy-sig-muted{ color: var(--text-muted);   font-size: 0.82rem; }
        .vfy-sig-detail { font-size: 0.8rem; color: var(--text-primary); margin-top: 5px; }

        /* -- Bottom padding inside card -- */
        .vfy-card-foot { padding-bottom: 24px; }
      `}</style>

      {/* -- Shield icon -- */}
      <div className="vfy-icon-wrap" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>

      {/* -- Heading -- */}
      <h1 className="vfy-heading">Document Verification</h1>
      <p className="vfy-subheading">
        Verify any document using SHA-256 cryptographic hash verification.
      </p>

      {/* -- Card -- */}
      <div className="vfy-card">

        {/* Scan progress bar */}
        {loading && (
          <div className="vfy-scan">
            <div className="vfy-scan-bar" />
          </div>
        )}

        {/* -- Tab strip -- */}
        <div className="vfy-tabs" role="tablist" aria-label="Verification method">
          <button
            type="button" role="tab"
            className={`vfy-tab${mode === 'doc_id' ? ' vfy-tab-active' : ''}`}
            aria-selected={mode === 'doc_id'}
            onClick={() => { setMode('doc_id'); reset(); setPdfFile(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            Document ID
          </button>
          <button
            type="button" role="tab"
            className={`vfy-tab${mode === 'upload' ? ' vfy-tab-active' : ''}`}
            aria-selected={mode === 'upload'}
            onClick={() => { setMode('upload'); reset(); setDocId(''); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload PDF
          </button>
        </div>

        {/* -- Error -- */}
        {error && (
          <div className="vfy-error" role="alert">
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

        {/* -- Body -- */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Document ID mode */}
          {mode === 'doc_id' && (
            <div className="vfy-body">
              <p className="vfy-field-label">Enter Document ID</p>
              <div className="vfy-input-row">
                <span className="vfy-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                </span>
                <input
                  id="vfy-doc-id"
                  className="vfy-input"
                  value={docId}
                  onChange={(e) => { setDocId(e.target.value); reset(); }}
                  placeholder="DOC-YYYYMMDD-XXXXX"
                  autoFocus
                  disabled={loading}
                  aria-label="Document ID"
                />
                <button
                  type="submit"
                  className="vfy-verify-btn"
                  disabled={loading || !docId.trim()}
                  aria-busy={loading}
                >
                  {loading
                    ? <span className="vfy-spinner" aria-hidden="true" />
                    : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    )
                  }
                  Verify
                </button>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 8 }}>
                The Document ID is printed on every generated document � format: DOC-YYYYMMDD-XXXXX
              </p>
            </div>
          )}

          {/* Upload PDF mode */}
          {mode === 'upload' && (
            <div className="vfy-body">
              <p className="vfy-field-label">Upload PDF File</p>
              <label className="vfy-file-wrap" htmlFor="vfy-pdf-input">
                <input
                  id="vfy-pdf-input"
                  type="file"
                  accept="application/pdf"
                  className="vfy-file-input"
                  onChange={(e) => { setPdfFile(e.target.files[0] || null); reset(); }}
                  disabled={loading}
                />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true" style={{ margin: '0 auto 8px', display: 'block' }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span className="vfy-file-label">
                  {pdfFile ? '' : 'Click to choose a PDF file or drag it here'}
                </span>
                {pdfFile && <span className="vfy-file-chosen">?? {pdfFile.name}</span>}
              </label>
              {pdfFile && (
                <button
                  type="submit"
                  className="vfy-file-submit"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading
                    ? <><span className="vfy-spinner" aria-hidden="true" /> Verifying�</>
                    : <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        Verify Document
                      </>
                  }
                </button>
              )}
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 10 }}>
                The PDF will be hashed and compared against the original stored value to detect tampering.
              </p>
            </div>
          )}
        </form>

        {/* -- Result -- */}
        {result && (
          <div className="vfy-result" style={{ margin: '0 28px 28px' }}>
            {/* Head */}
            <div className={`vfy-result-head ${verified ? 'vfy-result-head-ok' : revoked ? 'vfy-result-head-warn' : 'vfy-result-head-fail'}`}>
              <div className={`vfy-result-icon ${verified ? 'vfy-result-icon-ok' : revoked ? 'vfy-result-icon-warn' : 'vfy-result-icon-fail'}`}>
                {verified ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="var(--success-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                ) : revoked ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="var(--warn-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="var(--error-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                )}
              </div>
              <div>
                <p className={`vfy-result-title ${verified ? 'vfy-result-title-ok' : revoked ? 'vfy-result-title-warn' : 'vfy-result-title-fail'}`}>
                  {verified   ? '? Document is Authentic & Untampered'
                  : revoked   ? '? Document has been Revoked'
                  : notFound  ? 'Document Not Found'
                  :             '? Document is Corrupt or Forged'}
                </p>
                <p className={`vfy-result-sub ${verified ? 'vfy-result-title-ok' : revoked ? 'vfy-result-title-warn' : 'vfy-result-title-fail'}`}>
                  {verified   ? 'Verified against the original stored record.'
                  : revoked   ? 'This document has been revoked and is no longer valid.'
                  : notFound  ? 'No document with this ID exists in our records.'
                  :             'Hash mismatch � content may have been modified after generation.'}
                </p>
              </div>
            </div>

            {/* Detail rows */}
            {(result.docId || result.docStatus || result.generatedAt || result.issuedAt || result.revokedAt) && (
              <div className="vfy-result-body">
                {result.docId && (
                  <div className="vfy-result-row">
                    <span className="vfy-result-key">Document ID</span>
                    <span className="vfy-result-val">{result.docId}</span>
                  </div>
                )}
                {result.docStatus && (
                  <div className="vfy-result-row">
                    <span className="vfy-result-key">Status</span>
                    <span className="vfy-result-val vfy-result-val-plain">{result.docStatus}</span>
                  </div>
                )}
                {(result.generatedAt || result.issuedAt) && (
                  <div className="vfy-result-row">
                    <span className="vfy-result-key">Recorded at</span>
                    <span className="vfy-result-val vfy-result-val-plain">
                      {new Date(result.generatedAt || result.issuedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {result.revokedAt && (
                  <div className="vfy-result-row">
                    <span className="vfy-result-key">Revoked at</span>
                    <span className="vfy-result-val vfy-result-val-plain">
                      {new Date(result.revokedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {(tampered || result.hashNote === 'content_hash_mismatch') && (
                  <p className="vfy-tamper-note">
                    The document may have been modified after generation. Do not rely on its contents.
                  </p>
                )}
              </div>
            )}

            {/* Digital signature */}
            {result.docId && (
              <div className="vfy-sig">
                <p className="vfy-sig-title">Digital Signature</p>
                {!sigResult && !sigLoading && !sigError && (
                  <button type="button" className="vfy-sig-btn" onClick={handleVerifySignature}>
                    Verify Digital Signature
                  </button>
                )}
                {sigLoading && <p className="vfy-sig-muted" aria-live="polite">Verifying signature�</p>}
                {sigError   && <p className="vfy-sig-fail"  role="alert">{sigError}</p>}
                {sigResult  && (
                  <>
                    <p className={sigResult.signatureValid ? 'vfy-sig-ok' : sigResult.signed === false ? 'vfy-sig-muted' : 'vfy-sig-fail'}>
                      {sigResult.signed === false
                        ? '� Not yet signed'
                        : sigResult.signatureValid ? '? Signature valid'
                        : '? Signature HMAC mismatch'}
                    </p>
                    {sigResult.signerName && (
                      <p className="vfy-sig-detail">Approver: <strong>{sigResult.signerName}</strong></p>
                    )}
                    {sigResult.signedAt && (
                      <p className="vfy-sig-detail">
                        Signed: {new Date(sigResult.signedAt).toLocaleString()}
                      </p>
                    )}
                    {sigResult.usedLegacySecret && (
                      <p className="vfy-sig-detail" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        Verified using legacy signing key.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="vfy-card-foot" />
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
   PUBLIC (standalone) version � full-screen dark page, no sidebar/navbar.
   Shown when the user is NOT logged in, or navigates directly via email link.
----------------------------------------------------------------------------- */
function PublicVerifyPage() {
  const {
    mode, setMode, docId, setDocId, pdfFile, setPdfFile,
    result, loading, error, sigResult, sigLoading, sigError,
    reset, handleSubmit, handleVerifySignature,
  } = useVerification();

  const verified = result?.verified === true;
  const notFound = result?.verified === false && result?.reason === 'not_found';
  const tampered = result?.verified === false && result?.reason !== 'not_found' && result?.result !== 'REVOKED';
  const revoked  = result?.result === 'REVOKED';

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .vp {
          width: 100vw; height: 100vh; overflow: hidden;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
          background: linear-gradient(155deg, #0A1628 0%, #0F766E 60%, #115E59 100%);
          position: relative;
        }
        .vp::before {
          content:''; position:fixed; inset:0;
          background-image: linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);
          background-size:42px 42px; pointer-events:none; z-index:0;
        }
        .vp::after {
          content:''; position:fixed; width:600px; height:600px; border-radius:50%;
          background:radial-gradient(circle,rgba(20,184,166,0.16) 0%,transparent 65%);
          top:-160px; left:50%; transform:translateX(-50%);
          pointer-events:none; z-index:0; animation:vglow 11s ease-in-out infinite alternate;
        }
        @keyframes vglow { from{transform:translateX(-50%) scale(1);} to{transform:translateX(-50%) scale(1.12);} }
        @media (prefers-reduced-motion:reduce){ .vp::after{animation:none;} }
        .vp-bar { position:relative;z-index:2;width:100%;max-width:520px;display:flex;align-items:center;justify-content:space-between;padding:0 0 14px;flex-shrink:0; }
        .vp-bar-brand { display:flex;align-items:center;gap:9px; }
        .vp-bar-logo { width:30px;height:30px;border-radius:8px;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.4); }
        .vp-bar-logo img { width:100%;height:100%;object-fit:cover; }
        .vp-bar-name { font-size:0.75rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#fff; }
        .vp-bar-back { font-size:0.72rem;font-weight:600;color:rgba(232,238,247,0.5);text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:color .15s; }
        .vp-bar-back:hover { color:#14B8A6; }
        .vp-shield-wrap { position:relative;z-index:2;display:flex;justify-content:center;margin-bottom:12px;flex-shrink:0; }
        .vp-shield { position:relative;width:60px;height:60px; }
        .vp-ring { position:absolute;inset:0;border-radius:50%;border:2px solid rgba(20,184,166,0.35);animation:ring-pulse 2.8s ease-in-out infinite; }
        .vp-ring:nth-child(2){inset:-9px;border-color:rgba(20,184,166,0.18);animation-delay:.7s;}
        .vp-ring:nth-child(3){inset:-18px;border-color:rgba(20,184,166,0.08);animation-delay:1.4s;}
        @keyframes ring-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(1.06);}}
        @media (prefers-reduced-motion:reduce){ .vp-ring{animation:none;} }
        .vp-shield-icon { position:absolute;inset:0;background:linear-gradient(135deg,#115E59,#0F766E);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(15,118,110,0.45); }
        .vp-hero { position:relative;z-index:2;text-align:center;margin-bottom:18px;flex-shrink:0; }
        .vp-hero-badge { font-size:0.62rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#14B8A6;background:rgba(20,184,166,0.12);padding:3px 12px;border-radius:20px;display:inline-block;margin-bottom:10px; }
        .vp-hero h1 { font-size:clamp(1.4rem,3vw,1.85rem);font-weight:800;letter-spacing:-0.03em;color:#fff;line-height:1.15;margin-bottom:7px; }
        .vp-hero-desc { font-size:0.8rem;color:rgba(232,238,247,0.52);line-height:1.55;max-width:360px;margin:0 auto; }
        .vp-card { position:relative;z-index:2;width:calc(100% - 32px);max-width:480px;background:rgba(255,255,255,0.97);border-radius:18px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,0.07),0 8px 24px rgba(0,0,0,0.28),0 28px 64px rgba(0,0,0,0.38);animation:card-in .5s cubic-bezier(0.22,1,0.36,1) both;flex-shrink:0; }
        @keyframes card-in{from{opacity:0;transform:translateY(16px) scale(0.98);}to{opacity:1;transform:translateY(0) scale(1);}}
        html.dark .vp-card { background:var(--bg-raised);box-shadow:var(--shadow-overlay); }
        .vp-body{padding:22px 24px 20px;}
        .vp-scan{position:relative;height:2px;background:rgba(15,118,110,0.10);border-radius:2px;margin-bottom:16px;overflow:hidden;}
        .vp-scan-bar{position:absolute;left:0;top:0;height:100%;width:38%;background:linear-gradient(90deg,transparent,#0F766E,transparent);animation:scan-mv 1.1s ease-in-out infinite;}
        @keyframes scan-mv{0%{left:-38%;}100%{left:138%;}}
        @media (prefers-reduced-motion:reduce){.vp-scan{display:none;}}
        .vp-err{display:flex;align-items:flex-start;gap:7px;padding:9px 11px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;font-size:0.78rem;color:#DC2626;margin-bottom:13px;animation:shake .3s ease;}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
        html.dark .vp-err{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text);}
        .vp-tabs{display:flex;gap:0;margin-bottom:16px;border:1.5px solid var(--border-strong);border-radius:9px;overflow:hidden;}
        .vp-tab{flex:1;padding:8px 4px;font-size:0.75rem;font-weight:600;background:var(--bg-subtle);color:var(--text-secondary);border:none;cursor:pointer;transition:background .15s,color .15s;font-family:inherit;}
        .vp-tab.active{background:linear-gradient(135deg,#0F766E 0%,#115E59 100%);color:#fff;}
        .vp-tab:hover:not(.active){background:var(--bg-surface);color:var(--text-primary);}
        .vp-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px;}
        .vp-lbl{font-size:0.75rem;font-weight:600;color:var(--text-primary);letter-spacing:0.01em;}
        .vp-hint{font-size:0.7rem;color:var(--text-muted);}
        .vp-inp{width:100%;padding:10px 13px;border:1.5px solid var(--border-strong);border-radius:9px;font-size:0.9rem;font-family:inherit;color:var(--text-primary);background:var(--bg-subtle);outline:none;transition:border-color .18s,box-shadow .18s,background .18s;text-transform:uppercase;letter-spacing:0.04em;}
        .vp-inp:focus{border-color:var(--accent);background:var(--bg-surface);box-shadow:0 0 0 3px rgba(15,118,110,0.15);}
        .vp-inp::placeholder{color:var(--text-muted);text-transform:none;letter-spacing:normal;}
        html.dark .vp-inp{background:var(--bg-raised);border-color:var(--border);color:var(--text-primary);}
        .vp-btn{width:100%;padding:11px;background:linear-gradient(135deg,#0F766E 0%,#115E59 100%);color:#fff;border:none;border-radius:9px;font-size:0.8rem;font-weight:700;font-family:inherit;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:opacity .2s,transform .15s,box-shadow .2s;box-shadow:0 4px 14px rgba(15,118,110,.38);display:flex;align-items:center;justify-content:center;gap:7px;}
        .vp-btn:hover:not(:disabled){opacity:.9;transform:translateY(-1px);box-shadow:0 5px 18px rgba(15,118,110,.48);}
        .vp-btn:active:not(:disabled){transform:translateY(0);}
        .vp-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;}
        .vp-spin{width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .65s linear infinite;flex-shrink:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .vp-result{margin-top:16px;border-radius:11px;overflow:hidden;animation:card-in .38s cubic-bezier(0.22,1,0.36,1) both;}
        .vp-rhead{padding:13px 15px;display:flex;align-items:center;gap:11px;}
        .vp-rhead.ok{background:#F0FDF4;}.vp-rhead.fail{background:#FEF2F2;}.vp-rhead.revoked{background:#FFF7ED;}
        .dark .vp-rhead.ok{background:var(--success-bg);}.dark .vp-rhead.fail{background:var(--error-bg);}
        .vp-rico{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ok .vp-rico{background:rgba(22,163,74,0.15);}.fail .vp-rico{background:rgba(220,38,38,0.15);}
        .vp-rtitle{font-size:0.9rem;font-weight:700;line-height:1.2;}
        .ok .vp-rtitle{color:#15803D;}.fail .vp-rtitle{color:#B91C1C;}.revoked .vp-rtitle{color:#92400E;}
        .dark .ok .vp-rtitle{color:var(--success-text);}.dark .fail .vp-rtitle{color:var(--error-text);}
        .vp-rsub{font-size:0.73rem;margin-top:2px;}
        .ok .vp-rsub{color:#16A34A;}.fail .vp-rsub{color:#DC2626;}.revoked .vp-rsub{color:#B45309;}
        .dark .ok .vp-rsub{color:var(--success-text);}.dark .fail .vp-rsub{color:var(--error-text);}
        .vp-rbody{padding:12px 15px;border-top:1px solid var(--border);background:var(--bg-surface);display:flex;flex-direction:column;gap:7px;}
        .dark .vp-rbody{background:var(--bg-raised);border-top-color:var(--border);}
        .vp-rrow{display:flex;gap:8px;font-size:0.79rem;line-height:1.4;}
        .vp-rkey{font-weight:600;color:var(--text-secondary);min-width:110px;flex-shrink:0;}
        .vp-rval{color:var(--text-primary);font-family:'SFMono-Regular',Consolas,monospace;font-size:0.78rem;}
        .vp-rval.cap{text-transform:capitalize;font-family:inherit;font-size:0.79rem;}
        .vp-rwarn{padding:9px 12px;border-radius:7px;font-size:0.76rem;line-height:1.5;font-style:italic;background:#FEF2F2;color:#B91C1C;}
        .dark .vp-rwarn{background:var(--error-bg);color:var(--error-text);}
        .vp-sig{margin:0 0 0;padding:12px 14px;border-radius:10px;background:var(--bg-subtle);border:1px solid var(--border);}
        .vp-sig-title{font-size:0.76rem;font-weight:700;color:var(--text-secondary);margin-bottom:8px;}
        .vp-sig-ok{color:#15803D;}.vp-sig-fail{color:#B91C1C;}
        .vp-sig-row{font-size:0.77rem;color:var(--text-primary);margin-top:4px;line-height:1.5;}
        .vp-sig-note{font-size:0.7rem;color:var(--text-muted);margin-top:3px;font-style:italic;}
        .vp-foot{position:relative;z-index:2;margin-top:14px;flex-shrink:0;text-align:center;font-size:0.7rem;color:rgba(232,238,247,0.28);}
        .vp-foot a{color:rgba(20,184,166,0.65);text-decoration:none;font-weight:600;}
        .vp-foot a:hover{color:#14B8A6;text-decoration:underline;}
        @media (max-height:620px){.vp{overflow-y:auto;height:auto;min-height:100vh;justify-content:flex-start;padding:24px 0 32px;}}
        @media (max-width:520px){.vp-body{padding:18px 16px 16px;}.vp-hero h1{font-size:1.3rem;}}
        @media (max-width:380px){.vp-body{padding:14px 12px 12px;}.vp-rkey{min-width:90px;}}
      `}</style>

      <div className="vp">
        <div className="vp-bar">
          <div className="vp-bar-brand">
            <div className="vp-bar-logo"><img src={logo} alt="DocuVault"/></div>
            <span className="vp-bar-name">DocuVault</span>
          </div>
          <Link to="/login" className="vp-bar-back">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Sign In
          </Link>
        </div>

        <div className="vp-shield-wrap">
          <div className="vp-shield">
            <div className="vp-ring"/><div className="vp-ring"/><div className="vp-ring"/>
            <div className="vp-shield-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="vp-hero">
          <div className="vp-hero-badge">Public Verification Portal</div>
          <h1>Verify Your Document</h1>
          <p className="vp-hero-desc">Confirm the authenticity and integrity of a document � no account required.</p>
        </div>

        <div className="vp-card" role="main">
          <div className="vp-body">
            {loading && <div className="vp-scan"><div className="vp-scan-bar"/></div>}
            {error && (
              <div className="vp-err" role="alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{flexShrink:0,marginTop:1}} aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="vp-tabs" role="tablist" aria-label="Verification method">
                <button type="button" role="tab"
                  className={`vp-tab${mode === 'doc_id' ? ' active' : ''}`}
                  aria-selected={mode === 'doc_id'}
                  onClick={() => { setMode('doc_id'); reset(); setPdfFile(null); }}>
                  By Document ID
                </button>
                <button type="button" role="tab"
                  className={`vp-tab${mode === 'upload' ? ' active' : ''}`}
                  aria-selected={mode === 'upload'}
                  onClick={() => { setMode('upload'); reset(); setDocId(''); }}>
                  Upload PDF
                </button>
              </div>

              {mode === 'doc_id' && (
                <div className="vp-field">
                  <label htmlFor="vp-id" className="vp-lbl">Document ID</label>
                  <p className="vp-hint">Printed on the document � format: DOC-YYYYMMDD-XXXXX</p>
                  <input id="vp-id" className="vp-inp" value={docId}
                    onChange={e => { setDocId(e.target.value); reset(); }}
                    placeholder="e.g. DOC-20260817-A1B2C" autoFocus disabled={loading} />
                </div>
              )}
              {mode === 'upload' && (
                <div className="vp-field">
                  <label htmlFor="vp-pdf" className="vp-lbl">Upload PDF</label>
                  <p className="vp-hint">Upload the document to verify its integrity against the original stored hash.</p>
                  <input id="vp-pdf" type="file" accept="application/pdf" className="vp-inp"
                    style={{padding:'8px 10px',cursor:'pointer'}}
                    onChange={e => { setPdfFile(e.target.files[0] || null); reset(); }} disabled={loading} />
                </div>
              )}

              <button type="submit" className="vp-btn"
                disabled={loading || (mode === 'doc_id' ? !docId.trim() : !pdfFile)} aria-busy={loading}>
                {loading ? (
                  <><div className="vp-spin" aria-hidden="true"/>Verifying�</>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    VERIFY DOCUMENT
                  </>
                )}
              </button>
            </form>

            {result && (
              <div className={`vp-result ${verified ? 'ok' : revoked ? 'revoked' : 'fail'}`}>
                <div className={`vp-rhead ${verified ? 'ok' : revoked ? 'revoked' : 'fail'}`}>
                  <div className="vp-rico">
                    {verified ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    ) : revoked ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    )}
                  </div>
                  <div>
                    <div className="vp-rtitle">
                      {verified ? '? Document is Authentic & Untampered' : revoked ? '? Document has been Revoked' : notFound ? 'Document Not Found' : '? Document is Corrupt or Forged'}
                    </div>
                    <div className="vp-rsub">
                      {verified ? 'Verified against the original record.' : revoked ? 'This document is no longer valid.' : notFound ? 'No document with this ID exists in our records.' : 'Hash mismatch � content may have been modified.'}
                    </div>
                  </div>
                </div>

                {(result.docId || result.docStatus || result.generatedAt || result.issuedAt || result.revokedAt) && (
                  <div className="vp-rbody">
                    {result.docId     && <div className="vp-rrow"><span className="vp-rkey">Document ID</span><span className="vp-rval">{result.docId}</span></div>}
                    {result.docStatus && <div className="vp-rrow"><span className="vp-rkey">Status</span><span className="vp-rval cap">{result.docStatus}</span></div>}
                    {(result.generatedAt || result.issuedAt) && <div className="vp-rrow"><span className="vp-rkey">Recorded at</span><span className="vp-rval">{new Date(result.generatedAt || result.issuedAt).toLocaleString()}</span></div>}
                    {result.revokedAt && <div className="vp-rrow"><span className="vp-rkey">Revoked at</span><span className="vp-rval">{new Date(result.revokedAt).toLocaleString()}</span></div>}
                    {result.hashNote === 'content_hash_mismatch' && <div className="vp-rwarn">The QR content hash does not match the stored value � the document body may have been altered after generation.</div>}
                    {tampered && !result.hashNote && <div className="vp-rwarn">The document may have been modified after generation. Do not rely on its contents.</div>}
                  </div>
                )}

                {result.docId && (
                  <div className="vp-sig" style={{margin:'0 15px 15px'}}>
                    <div className="vp-sig-title">Digital Signature</div>
                    {!sigResult && !sigLoading && !sigError && (
                      <button type="button" onClick={handleVerifySignature}
                        style={{padding:'6px 14px',borderRadius:7,border:'1px solid var(--border-strong)',background:'var(--bg-surface)',color:'var(--text-primary)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                        Verify Digital Signature
                      </button>
                    )}
                    {sigLoading && <div className="vp-sig-row" aria-live="polite">Verifying signature�</div>}
                    {sigError   && <div className="vp-sig-row vp-sig-fail" role="alert">{sigError}</div>}
                    {sigResult  && (
                      <>
                        <div className={`vp-sig-row ${sigResult.signatureValid ? 'vp-sig-ok' : sigResult.signed === false ? '' : 'vp-sig-fail'}`}>
                          {sigResult.signed === false ? '� Not yet signed' : sigResult.signatureValid ? '? Signature valid' : '? Signature HMAC mismatch'}
                        </div>
                        {sigResult.signerName && <div className="vp-sig-row">Approver: <strong>{sigResult.signerName}</strong></div>}
                        {sigResult.signedAt   && <div className="vp-sig-row">Signed: {new Date(sigResult.signedAt).toLocaleString()}</div>}
                        {sigResult.usedLegacySecret && <div className="vp-sig-note">Verified using legacy signing key.</div>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="vp-foot">
          <Link to="/login">Sign in</Link> to access the full DocuVault workspace.
        </div>
      </div>
    </>
  );
}

/* -----------------------------------------------------------------------------
   Default export � picks the right variant based on auth state.
----------------------------------------------------------------------------- */
export default function VerifyDocumentPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  // Logged-in users see the in-app version (inside Layout with sidebar/navbar).
  // Non-logged-in users (public, email links) see the full-screen standalone version.
  return user ? <InAppVerifyPage /> : <PublicVerifyPage />;
}
