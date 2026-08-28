import { useState, useEffect, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';
import { Html5Qrcode } from 'html5-qrcode';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3
      border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs font-semibold text-[var(--color-text-secondary)]
        uppercase tracking-wide flex-shrink-0 w-32">{label}</span>
      <span className="text-sm text-[var(--color-text-primary)] text-right break-all">
        {value ?? '—'}
      </span>
    </div>
  );
}

function ResultBanner({ authentic, message }) {
  return (
    <div className={`rounded-2xl border-2 p-5 flex items-start gap-4 animate-in
      ${authentic ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
        ${authentic ? 'bg-emerald-500' : 'bg-red-500'}`}>
        {authentic
          ? <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
          : <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
        }
      </div>
      <div>
        <p className={`text-base font-bold ${authentic ? 'text-emerald-700' : 'text-red-700'}`}>
          {message}
        </p>
        <p className={`text-xs mt-1 ${authentic ? 'text-emerald-600' : 'text-red-500'}`}>
          {authentic
            ? 'SHA-256 hash verified. This document has not been modified since generation.'
            : 'Hash mismatch detected. This document may have been altered.'}
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const [activeTab,  setActiveTab]  = useState('id'); // 'id' | 'camera'
  const [docId,      setDocId]      = useState('');
  const [result,     setResult]     = useState(null);
  const [notFound,   setNotFound]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [history,    setHistory]    = useState([]);
  const [scanning,   setScanning]   = useState(false);
  const [cameraErr,  setCameraErr]  = useState('');
  const scannerRef   = useRef(null);
  const scannerDivId = 'verify-qr-reader';

  const addHistory = (id, res) => {
    setHistory(prev =>
      [{ id, template: res.template_name || id, authentic: res.authentic },
       ...prev.filter(h => h.id !== id)].slice(0, 5)
    );
  };

  const verifyById = async (overrideId) => {
    const id = (overrideId ?? docId).trim().toUpperCase();
    if (!id) return;
    setLoading(true); setResult(null); setNotFound(false);
    try {
      const res = await axiosInstance.get(`/verify/${id}`);
      setResult(res.data);
      addHistory(id, res.data);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  // ── Extract doc_uuid from scanned URL or raw text ─────────────────────────
  const extractDocUuid = (text) => {
    try {
      const url = new URL(text);
      const pathMatch = url.pathname.match(/\/verify\/([A-Z0-9-]+)/i);
      if (pathMatch) return pathMatch[1].toUpperCase();
      const q = url.searchParams.get('id');
      if (q) return q.toUpperCase();
    } catch {
      if (/^DOC-/i.test(text.trim())) return text.trim().toUpperCase();
    }
    return null;
  };

  const startCamera = async () => {
    setCameraErr(''); setScanning(true); setResult(null); setNotFound(false);
    await new Promise(r => setTimeout(r, 100));
    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded) => {
          await stopCamera();
          const uuid = extractDocUuid(decoded);
          if (uuid) { setDocId(uuid); setActiveTab('id'); verifyById(uuid); }
          else setCameraErr('No valid Document ID found in this QR code.');
        },
        () => {}
      );
    } catch (err) {
      setScanning(false); scannerRef.current = null;
      if (err.name === 'NotAllowedError')
        setCameraErr('Camera permission denied. Allow camera access in browser settings.');
      else if (err.name === 'NotFoundError')
        setCameraErr('No camera found on this device.');
      else
        setCameraErr('Could not start camera. Check permissions and try again.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    if (activeTab !== 'camera' && scanning) stopCamera();
  }, [activeTab]);

  useEffect(() => () => { stopCamera(); }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600
          rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Document Verification
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
          Verify any DocuVault document using SHA-256 cryptographic hash verification.
        </p>
      </div>

      {/* Card */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
        shadow-sm p-6 space-y-5">

        {/* ── 2-tab switcher ──────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-[var(--color-bg)] border border-[var(--color-border)]
          rounded-xl p-1">
          {[
            { key: 'id',     label: 'Document ID',
              icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
            { key: 'camera', label: 'Scan QR Code',
              icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3
                text-xs font-bold rounded-lg transition-all
                ${activeTab === tab.key
                  ? 'bg-[var(--color-surface)] text-[#3b5bdb] shadow-sm border border-[var(--color-border)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon}/>
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Document ID ──────────────────────────────────────────── */}
        {activeTab === 'id' && (
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-secondary)]
              uppercase tracking-wider mb-2">
              Enter Document ID
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4
                  text-[var(--color-text-secondary)] pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  value={docId}
                  onChange={e => { setDocId(e.target.value); setResult(null); setNotFound(false); }}
                  onKeyDown={e => e.key === 'Enter' && verifyById()}
                  placeholder="DOC-YYYYMMDD-XXXXX"
                  className="w-full pl-10 pr-4 py-3 border border-[var(--color-border)] rounded-xl
                    text-sm font-mono bg-[var(--color-bg)] text-[var(--color-text-primary)]
                    placeholder-[var(--color-text-secondary)]
                    focus:outline-none focus:ring-2 focus:ring-indigo-200
                    focus:border-indigo-400 transition"/>
              </div>
              <button onClick={() => verifyById()} disabled={!docId.trim() || loading}
                className="bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                  px-5 py-2.5 rounded-xl disabled:opacity-40 flex items-center gap-2
                  shadow-sm shadow-indigo-200 transition-all">
                {loading
                  ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                }
                Verify
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Camera QR ───────────────────────────────────────────── */}
        {activeTab === 'camera' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-[var(--color-text-secondary)]
                uppercase tracking-wider mb-1">Scan QR Code</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Point your camera at the QR code on any DocuVault document.
              </p>
            </div>

            {/* Camera viewport */}
            <div className={`relative rounded-2xl overflow-hidden border-2 border-dashed
              transition-all ${scanning
                ? 'border-[#3b5bdb]'
                : 'border-[var(--color-border)]'}`}
              style={{ minHeight: '260px' }}>
              <div id={scannerDivId} className="w-full"/>
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3
                  bg-[var(--color-bg)]">
                  <div className="w-14 h-14 bg-[var(--color-surface)] border
                    border-[var(--color-border)] rounded-2xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-[var(--color-text-secondary)]"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Camera ready
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Click Start to scan
                  </p>
                </div>
              )}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2
                    border-[#3b5bdb] rounded-tl-lg"/>
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2
                    border-[#3b5bdb] rounded-tr-lg"/>
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2
                    border-[#3b5bdb] rounded-bl-lg"/>
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2
                    border-[#3b5bdb] rounded-br-lg"/>
                </div>
              )}
            </div>

            {cameraErr && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs
                px-4 py-3 rounded-xl">{cameraErr}</div>
            )}

            {!scanning
              ? <button onClick={startCamera}
                  className="w-full bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm
                    font-bold py-3 rounded-xl flex items-center justify-center gap-2
                    transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Start Camera
                </button>
              : <button onClick={stopCamera}
                  className="w-full border border-[var(--color-border)]
                    text-[var(--color-text-secondary)] hover:border-red-300 hover:text-red-500
                    text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2
                    transition-colors">
                  Stop Camera
                </button>
            }
          </div>
        )}
      </div>

      {/* Not found */}
      {notFound && !result && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5
          flex items-start gap-4 animate-in">
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center
            justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-red-700">Document Not Found</p>
            <p className="text-xs text-red-500 mt-1">
              No document matching{' '}
              <span className="font-mono font-semibold">{docId.toUpperCase()}</span>{' '}
              exists in the system.
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <ResultBanner authentic={result.authentic} message={result.message}/>
          <div className="bg-[var(--color-surface)] rounded-2xl border
            border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-[var(--color-bg)] border-b
              border-[var(--color-border)]">
              <p className="text-xs font-bold text-[var(--color-text-secondary)]
                uppercase tracking-wider">Document Information</p>
            </div>
            <div className="px-5 py-1">
              <InfoRow label="Document ID"
                value={
                  <span className="font-mono text-xs bg-[var(--color-bg)]
                    px-2 py-0.5 rounded">{result.doc_uuid}</span>
                }/>
              <InfoRow label="Status"
                value={<span className="capitalize">{result.status}</span>}/>
              <InfoRow label="Generated At" value={fmt(result.generated_at)}/>
              {result.template_name && (
                <InfoRow label="Template" value={result.template_name}/>
              )}
            </div>
          </div>
          <div className="bg-[var(--color-surface)] rounded-2xl border
            border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-[var(--color-bg)] border-b
              border-[var(--color-border)]">
              <p className="text-xs font-bold text-[var(--color-text-secondary)]
                uppercase tracking-wider">Integrity Check</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)]
                  uppercase tracking-wide mb-1.5">Stored SHA-256 Hash</p>
                <p className="font-mono text-[11px] text-[var(--color-text-secondary)]
                  bg-[var(--color-bg)] border border-[var(--color-border)]
                  rounded-xl px-4 py-3 break-all leading-relaxed">
                  {result.stored_hash || result.file_hash || '—'}
                </p>
              </div>
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${
                result.authentic
                  ? 'bg-emerald-50 border-emerald-100'
                  : 'bg-red-50 border-red-100'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center
                  flex-shrink-0 ${result.authentic ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  {result.authentic
                    ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
                          d="M5 13l4 4L19 7"/>
                      </svg>
                    : <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}
                          d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                  }
                </div>
                <p className={`text-xs font-semibold ${
                  result.authentic ? 'text-emerald-700' : 'text-red-600'
                }`}>
                  {result.authentic
                    ? 'Hashes match — document integrity confirmed'
                    : 'Hash mismatch — document may be tampered'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border
          border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]
            flex items-center justify-between">
            <p className="text-xs font-bold text-[var(--color-text-secondary)]
              uppercase tracking-wider">Recent Verifications</p>
            <button onClick={() => setHistory([])}
              className="text-xs text-[var(--color-text-secondary)]
                hover:text-[var(--color-text-primary)] transition-colors">
              Clear
            </button>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {history.map((h, i) => (
              <button key={i}
                onClick={() => { setDocId(h.id); setActiveTab('id'); setTimeout(() => verifyById(h.id), 50); }}
                className="flex items-center gap-3 w-full px-5 py-3
                  hover:bg-[var(--color-bg)] transition-colors text-left">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center
                  flex-shrink-0 ${h.authentic ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {h.authentic
                    ? <svg className="w-3.5 h-3.5 text-emerald-600" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                          d="M5 13l4 4L19 7"/>
                      </svg>
                    : <svg className="w-3.5 h-3.5 text-red-500" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-semibold
                    text-[var(--color-text-primary)]">{h.id}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
                    {h.template}
                  </p>
                </div>
                <span className={`text-[10px] font-bold flex-shrink-0
                  ${h.authentic ? 'text-emerald-600' : 'text-red-500'}`}>
                  {h.authentic ? '✓ Authentic' : '✗ Invalid'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
