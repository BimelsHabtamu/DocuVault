import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import axiosInstance from '../api/axiosInstance';
import PublicLayout from '../components/PublicLayout';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3
      border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide
        flex-shrink-0 w-36">
        {label}
      </span>
      <span className="text-sm text-[var(--color-text-primary)] text-right break-all">{value ?? '—'}</span>
    </div>
  );
}

function ResultBanner({ authentic, message, shaVerified, shaMismatch }) {
  return (
    <div className={`rounded-2xl border-2 p-5 flex items-start gap-4 animate-in ${
      authentic ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
        authentic ? 'bg-emerald-500' : 'bg-red-500'
      }`}>
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
        <p className={`text-xs mt-1 leading-relaxed ${authentic ? 'text-emerald-600' : 'text-red-500'}`}>
          {authentic ? shaVerified : shaMismatch}
        </p>
      </div>
    </div>
  );
}

export default function PublicVerifyPage() {
  const { t } = useTranslation();
  const { doc_uuid: paramId } = useParams();

  // Active input tab: 'id' | 'upload' | 'camera'
  const [activeTab, setActiveTab] = useState(paramId ? 'id' : 'id');

  const [docId,    setDocId]    = useState(paramId ?? '');
  const [file,     setFile]     = useState(null);
  const [result,   setResult]   = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [history,  setHistory]  = useState([]);

  // Camera QR scanner state
  const [scanning,    setScanning]    = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef  = useRef(null); // Html5Qrcode instance
  const scannerDivId = 'qr-reader-container';

  const addHistory = (id, res) => {
    setHistory(prev => {
      const entry = { id, template: res.template_name || id, authentic: res.authentic };
      return [entry, ...prev.filter(h => h.id !== id)].slice(0, 5);
    });
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

  const verifyByUpload = async () => {
    if (!file) return;
    setLoading(true); setResult(null); setNotFound(false);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const res = await axiosInstance.post('/verify/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.doc_uuid) addHistory(res.data.doc_uuid, res.data);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  // ── Camera scanner helpers ──────────────────────────────────────────────
  // Extract doc_uuid from a scanned QR value.
  // Handles: /verify/DOC-... path, ?id=DOC-... query, or raw DOC-... string.
  const extractDocUuid = (text) => {
    try {
      const url = new URL(text);
      // Path format: /verify/DOC-20240101-ABCDEF
      const pathMatch = url.pathname.match(/\/verify\/([A-Z0-9-]+)/i);
      if (pathMatch) return pathMatch[1].toUpperCase();
      // Query format: ?id=DOC-...
      const qParam = url.searchParams.get('id');
      if (qParam) return qParam.toUpperCase();
    } catch {
      // Not a URL — treat the raw text as a doc UUID
      if (/^DOC-/i.test(text.trim())) return text.trim().toUpperCase();
    }
    return null;
  };

  const startCamera = async () => {
    setCameraError('');
    setScanning(true);
    setResult(null);
    setNotFound(false);

    // Small delay to let the div render before Html5Qrcode attaches
    await new Promise(r => setTimeout(r, 100));

    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // back camera preferred
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          // On successful scan — stop camera and verify
          await stopCamera();
          const uuid = extractDocUuid(decodedText);
          if (uuid) {
            setDocId(uuid);
            setActiveTab('id');
            verifyById(uuid);
          } else {
            setCameraError('QR code scanned but no valid Document ID found. Please try again.');
          }
        },
        () => {} // ignore frame errors
      );
    } catch (err) {
      setScanning(false);
      scannerRef.current = null;
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not start camera. Please check permissions and try again.');
      }
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Stop camera when switching away from camera tab or unmounting
  useEffect(() => {
    if (activeTab !== 'camera' && scanning) {
      stopCamera();
    }
  }, [activeTab]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  // Auto-verify if URL contains a doc_uuid param
  useEffect(() => {
    if (paramId) {
      verifyById(paramId);
    }
  }, [paramId]);

  return (
    <PublicLayout>

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="bg-[var(--color-bg)] pt-28 pb-12 px-4 relative overflow-hidden
        border-b border-[var(--color-border)]">

        <div className="absolute top-0 right-0 w-[500px] h-[400px]
          bg-gradient-to-bl from-indigo-100/50 to-transparent rounded-full
          pointer-events-none -translate-y-1/4 translate-x-1/4"/>

        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #3b5bdb 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}/>

        <div className="relative max-w-3xl mx-auto text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-sm flex items-center justify-center mx-auto">
            <img src="/logo.png" alt="DocuVault" className="w-10 h-10 object-contain"/>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)]">
              {t('verify.title')}
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              {t('verify.sub')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600
              font-semibold bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"/>
              {t('verify.badgePublic')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#3b5bdb]
              font-semibold bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              {t('verify.badgeSha')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]
              font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-full">
              <svg className="w-3 h-3 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              {t('verify.badgeInstant')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────── */}
      <div className="bg-[var(--color-bg)] py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Search card */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-6 space-y-5">

            {/* ── Tab switcher — 2 tabs only ─────────────────────────────── */}
            <div className="flex gap-1 bg-[var(--color-bg)] border border-[var(--color-border)]
              rounded-xl p-1">
              {[
                { key: 'id',     label: 'Document ID',  icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
                { key: 'camera', label: 'Scan QR Code', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3
                    text-xs font-bold rounded-lg transition-all
                    ${activeTab === tab.key
                      ? 'bg-[var(--color-surface)] text-[#3b5bdb] shadow-sm border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon}/>
                  </svg>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab: By Doc ID ──────────────────────────────────────── */}
            {activeTab === 'id' && (
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  {t('verify.byIdLabel')}
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
                      placeholder={t('verify.byIdPlaceholder')}
                      className="w-full pl-10 pr-4 py-3 border border-[var(--color-border)] rounded-xl
                        text-sm font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]
                        focus:outline-none focus:ring-2 focus:ring-indigo-200
                        focus:border-indigo-400 bg-[var(--color-bg)] transition"
                    />
                  </div>
                  <button
                    onClick={() => verifyById()}
                    disabled={!docId.trim() || loading}
                    className="bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                      px-5 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed
                      flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all"
                  >
                    {loading && !file
                      ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                    }
                    {t('verify.verifyBtn')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Camera QR Scanner ──────────────────────────────── */}
            {activeTab === 'camera' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Scan QR Code
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Point your camera at the QR code on any DocuVault document to verify it instantly.
                  </p>
                </div>

                {/* Camera view */}
                <div className={`relative rounded-2xl overflow-hidden border-2 border-dashed
                  transition-all ${scanning ? 'border-[#3b5bdb]' : 'border-[var(--color-border)]'}`}
                  style={{ minHeight: '280px' }}>

                  {/* Html5Qrcode mounts here */}
                  <div id={scannerDivId} className="w-full" />

                  {/* Placeholder when not scanning */}
                  {!scanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3
                      bg-[var(--color-bg)]">
                      <div className="w-16 h-16 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-[var(--color-text-secondary)]"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Camera ready to scan
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          Click Start Camera to begin
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Scanning overlay corners */}
                  {scanning && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[#3b5bdb] rounded-tl-lg"/>
                      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[#3b5bdb] rounded-tr-lg"/>
                      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[#3b5bdb] rounded-bl-lg"/>
                      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[#3b5bdb] rounded-br-lg"/>
                    </div>
                  )}
                </div>

                {/* Camera error */}
                {cameraError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3 rounded-xl">
                    {cameraError}
                  </div>
                )}

                {/* Controls */}
                <div className="flex gap-3">
                  {!scanning
                    ? <button
                        onClick={startCamera}
                        className="flex-1 bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                          py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        Start Camera
                      </button>
                    : <button
                        onClick={stopCamera}
                        className="flex-1 border border-[var(--color-border)] text-[var(--color-text-secondary)]
                          hover:border-red-300 hover:text-red-500 text-sm font-bold
                          py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
                        </svg>
                        Stop Camera
                      </button>
                  }
                </div>
              </div>
            )}

          </div>

          {/* Not found */}
          {notFound && !result && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5
              flex items-start gap-4 animate-in">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center
                justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-red-700">{t('verify.notFoundTitle')}</p>
                <p className="text-xs text-red-500 mt-1">
                  {t('verify.notFoundSub')}{' '}
                  <span className="font-mono font-semibold">{docId.toUpperCase()}</span>
                  {' '}{t('verify.notFoundSub2')}
                </p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              <ResultBanner
                authentic={result.authentic}
                message={result.message}
                shaVerified={t('verify.shaVerified')}
                shaMismatch={t('verify.shaMismatch')}
              />

              {/* Doc info */}
              <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 bg-[var(--color-bg)] border-b border-[var(--color-border)]
                  flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3b5bdb] rounded-full"/>
                  <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t('verify.docInfoTitle')}
                  </p>
                </div>
                <div className="px-5 py-1">
                  <InfoRow label={t('verify.docId')}
                    value={
                      <span className="font-mono text-xs bg-[var(--color-bg)] px-2 py-0.5 rounded">
                        {result.doc_uuid}
                      </span>
                    }
                  />
                  <InfoRow label={t('verify.status')}
                    value={
                      <span className={`capitalize text-xs font-bold px-2.5 py-1 rounded-full ${
                        result.status === 'signed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : result.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
                      }`}>
                        {result.status}
                      </span>
                    }
                  />
                  <InfoRow label={t('verify.generatedAt')} value={fmt(result.generated_at)} />
                  {result.template_name && (
                    <InfoRow label={t('verify.template')} value={result.template_name} />
                  )}
                </div>
              </div>

              {/* Integrity */}
              <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 bg-[var(--color-bg)] border-b border-[var(--color-border)]
                  flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3b5bdb] rounded-full"/>
                  <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t('verify.integrityTitle')}
                  </p>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">
                      {t('verify.storedHash')}
                    </p>
                    <p className="font-mono text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg)]
                      border border-[var(--color-border)] rounded-xl px-4 py-3 break-all leading-relaxed">
                      {result.stored_hash || result.file_hash || '—'}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${
                    result.authentic
                      ? 'bg-emerald-50 border-emerald-100'
                      : 'bg-red-50 border-red-100'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      result.authentic ? 'bg-emerald-500' : 'bg-red-500'
                    }`}>
                      {result.authentic
                        ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                          </svg>
                        : <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                      }
                    </div>
                    <p className={`text-xs font-semibold ${
                      result.authentic ? 'text-emerald-700' : 'text-red-600'
                    }`}>
                      {result.authentic ? t('verify.hashMatch') : t('verify.hashMismatch')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
                <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {t('verify.recentTitle')}
                </p>
                <button onClick={() => setHistory([])}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                  {t('verify.clear')}
                </button>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {history.map((h, i) => (
                  <button key={i}
                    onClick={() => { setDocId(h.id); verifyById(h.id); }}
                    className="flex items-center gap-3 w-full px-5 py-3
                      hover:bg-[var(--color-bg)] transition-colors text-left">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      h.authentic ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {h.authentic
                        ? <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                          </svg>
                        : <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">{h.id}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)] truncate">{h.template}</p>
                    </div>
                    <span className={`text-[10px] font-bold flex-shrink-0 ${
                      h.authentic ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {h.authentic ? t('verify.authentic') : t('verify.invalid')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Back to home */}
          <div className="text-center pb-4">
            <Link to="/"
              className="inline-flex items-center gap-2 text-sm text-[#3b5bdb]
                font-semibold hover:text-[#2f4ac4] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              {t('verify.backHome')}
            </Link>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}
