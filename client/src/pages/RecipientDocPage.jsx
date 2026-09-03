import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import axiosInstance from '../api/axiosInstance';
import { useToast } from '../context/ToastContext';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5
      border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs text-[var(--color-text-secondary)] font-medium w-32 flex-shrink-0">
        {label}
      </span>
      <span className="text-xs text-[var(--color-text-primary)] text-right font-semibold break-all">
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function RecipientDocPage() {
  const { doc_uuid } = useParams();
  const navigate     = useNavigate();
  const toast        = useToast();

  // Document data
  const [doc,        setDoc]        = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [error,      setError]      = useState(null);

  // Stable session ID for this page load — sent as X-Poll-Session so the
  // backend can bind phone QR audit events to this exact browser session.
  // useMemo with no deps generates it once per component mount.
  const pollSessionId = useMemo(() => crypto.randomUUID(), []);

  // Cross-device QR polling
  const [verifyStatus, setVerifyStatus] = useState(null); // null | { verified, authentic, verified_at }
  const pollRef = useRef(null);

  // Download state
  const [downloading, setDownloading] = useState(false);

  // ── Load document ─────────────────────────────────────────────────────────
  useEffect(() => {
    axiosInstance.get(`/recipient/documents/${doc_uuid}`)
      .then(r => { setDoc(r.data); })
      .catch(err => {
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(err.response?.data?.message || 'Failed to load document. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  }, [doc_uuid]);

  // ── Start polling once doc is loaded ─────────────────────────────────────
  // Polls /api/verify/status/:doc_uuid every 2 seconds.
  // Sends X-Poll-Session so the server scopes the result to this session.
  const startPolling = useCallback(() => {
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/verify/status/${doc_uuid}`, {
          headers: { 'X-Poll-Session': pollSessionId },
        });
        if (res.data.verified) {
          setVerifyStatus(res.data);
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // silent — polling continues
      }
    }, 2000);
  }, [doc_uuid, pollSessionId]);

  useEffect(() => {
    if (doc && !verifyStatus) {
      startPolling();
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [doc, verifyStatus, startPolling]);

  // ── Manual "Verify on this screen" ───────────────────────────────────────
  // Sends X-Poll-Session so the audit log is bound to this session and the
  // polling query can match it. The authenticated axiosInstance also sends
  // the JWT so user_id is recorded in the audit log (task 5).
  const verifyNow = async () => {
    try {
      const res = await axiosInstance.get(`/verify/${doc_uuid}`, {
        headers: { 'X-Poll-Session': pollSessionId },
      });
      setVerifyStatus({
        verified:    true,
        authentic:   res.data.authentic,
        verified_at: new Date().toISOString(),
      });
    } catch {
      toast.error('Verification failed. Please try again.');
    }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!doc?.doc_id) return;
    setDownloading(true);
    try {
      const res = await axiosInstance.get(`/documents/${doc.doc_id}/download`, {
        responseType: 'blob',
      });
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href     = url;
      link.download = `${doc_uuid}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Document downloaded successfully');
      // Refresh doc to show updated downloaded_at
      axiosInstance.get(`/recipient/documents/${doc_uuid}`)
        .then(r => setDoc(r.data))
        .catch(() => {});
    } catch {
      toast.error('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-8 h-8 text-[#3b5bdb]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">Failed to load document</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xs mx-auto">{error}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              axiosInstance.get(`/recipient/documents/${doc_uuid}`)
                .then(r => setDoc(r.data))
                .catch(err => {
                  if (err.response?.status === 404) setNotFound(true);
                  else setError(err.response?.data?.message || 'Failed to load document. Please try again.');
                })
                .finally(() => setLoading(false));
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold
              px-4 py-2 rounded-lg bg-[#3b5bdb] text-white hover:bg-[#2f4ac4] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Retry
          </button>
          <button onClick={() => navigate('/my-documents')}
            className="text-xs text-[var(--color-text-secondary)] font-semibold hover:text-[#3b5bdb] transition-colors">
            ← Back to My Documents
          </button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <p className="text-sm font-bold text-[var(--color-text-primary)]">Document not found</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          This document was not delivered to your account.
        </p>
        <button onClick={() => navigate('/my-documents')}
          className="text-xs text-[#3b5bdb] font-semibold hover:underline">
          ← Back to My Documents
        </button>
      </div>
    );
  }

  const verifyUrl = doc?.verify_url || `${window.location.origin}/verify/${doc_uuid}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Back */}
      <button onClick={() => navigate('/my-documents')}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]
          hover:text-[#3b5bdb] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
        </svg>
        My Documents
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-tight">
            {doc?.template_name}
          </h1>
          <p className="font-mono text-xs text-[var(--color-text-secondary)] mt-1">{doc_uuid}</p>
        </div>
        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-shrink-0 inline-flex items-center gap-2
            bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white
            text-sm font-bold px-5 py-2.5 rounded-xl
            shadow-md shadow-indigo-200 transition-all hover:scale-105
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {downloading
            ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>Downloading…</>
            : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>Download PDF</>
          }
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── LEFT: QR Code panel ──────────────────────────────────────── */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
          shadow-sm p-6 space-y-5">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Verify Authenticity
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Scan with phone or click to verify on this screen
              </p>
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${verifyStatus ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}/>
              <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">
                {verifyStatus ? 'Verified' : 'Waiting…'}
              </span>
            </div>
          </div>

          {/* QR Code — clickable → opens verify page in new tab, also scannable on phone */}
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Click to verify on this screen, or scan with your phone"
            className="flex justify-center p-5 bg-white rounded-2xl border-2
              border-dashed border-[var(--color-border)]
              hover:border-[#3b5bdb] hover:shadow-md transition-all duration-200
              cursor-pointer group"
          >
            <div className="relative">
              <QRCodeSVG
                value={verifyUrl}
                size={200}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#111827"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-[#3b5bdb]/10 rounded-lg opacity-0
                group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-white rounded-xl px-3 py-1.5 shadow">
                  <p className="text-xs font-bold text-[#3b5bdb]">Click to Verify →</p>
                </div>
              </div>
            </div>
          </a>

          {/* Instructions */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#3b5bdb] text-white
                flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5">
                1
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <strong className="text-[var(--color-text-primary)]">On your phone:</strong>{' '}
                Open your camera app and point it at the QR code to verify on your phone.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#3b5bdb] text-white
                flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5">
                2
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <strong className="text-[var(--color-text-primary)]">On this screen:</strong>{' '}
                Click the QR code above to open the verification page in a new tab instantly.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#3b5bdb] text-white
                flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5">
                3
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <strong className="text-[var(--color-text-primary)]">Live sync:</strong>{' '}
                When your phone scans and verifies, this screen automatically shows the result below.
              </p>
            </div>
          </div>

          {/* Manual verify button */}
          {!verifyStatus && (
            <button
              onClick={verifyNow}
              className="w-full border border-[#3b5bdb] text-[#3b5bdb]
                hover:bg-indigo-50 text-xs font-bold py-2.5 rounded-xl
                flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              Verify on this screen now
            </button>
          )}

          {/* Live verification result */}
          {verifyStatus && (
            <div className={`rounded-xl border-2 p-4 flex items-start gap-3 animate-in ${
              verifyStatus.authentic
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                verifyStatus.authentic ? 'bg-emerald-500' : 'bg-red-500'
              }`}>
                {verifyStatus.authentic
                  ? <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                  : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                }
              </div>
              <div>
                <p className={`text-sm font-bold ${
                  verifyStatus.authentic ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {verifyStatus.authentic
                    ? '✓ Document is Authentic & Untampered'
                    : '✗ Document Integrity Check Failed'
                  }
                </p>
                <p className={`text-[10px] mt-1 ${
                  verifyStatus.authentic ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  SHA-256 verified at {fmt(verifyStatus.verified_at)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Document details ──────────────────────────────────── */}
        <div className="space-y-5">

          {/* Document info card */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-[var(--color-bg)] border-b border-[var(--color-border)]
              flex items-center gap-2">
              <div className="w-2 h-2 bg-[#3b5bdb] rounded-full"/>
              <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Document Details
              </p>
            </div>
            <div className="px-5 py-1">
              <InfoRow label="Document ID"   value={
                <span className="font-mono text-[11px] bg-[var(--color-bg)] px-2 py-0.5 rounded">
                  {doc_uuid}
                </span>
              }/>
              <InfoRow label="Template"       value={doc?.template_name} />
              <InfoRow label="Category"       value={doc?.template_category} />
              <InfoRow label="Delivered"      value={fmt(doc?.delivered_at)} />
              <InfoRow label="Downloaded"     value={doc?.downloaded_at ? fmt(doc.downloaded_at) : 'Not yet downloaded'} />
              {doc?.record_identifier && (
                <InfoRow label="Record ID"    value={
                  <span className="font-mono text-[11px]">{doc.record_identifier}</span>
                }/>
              )}
            </div>
          </div>

          {/* Download card */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">Download PDF</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {doc?.downloaded_at ? 'You have downloaded this document' : 'Not yet downloaded'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 transition-colors"
            >
              {downloading
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>Downloading…</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>Download PDF</>
              }
            </button>
            <p className="text-[10px] text-[var(--color-text-secondary)] text-center mt-2">
              Downloading notifies system administrators
            </p>
          </div>

          {/* Verify URL reference */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-4">
            <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Public Verify URL
            </p>
            <p className="font-mono text-[11px] text-[#3b5bdb] break-all leading-relaxed bg-[var(--color-bg)]
              border border-[var(--color-border)] rounded-xl px-3 py-2">
              {verifyUrl}
            </p>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">
              Anyone can verify this document at the URL above — no login required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
