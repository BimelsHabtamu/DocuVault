/**
 * RecipientAccessPage — /doc/:token
 *
 * No DocuVault login required. The token in the URL is the credential.
 *
 * Stages:
 *   qr      — Show QR code. PC polls every 2 s. Phone scan → stage changes automatically.
 *   verified — "✓ Document Verified" — explicit "Open Secure Link" button required.
 *   access  — Access Status: OFF. Recipient must click the ON button.
 *   active  — Access ON. [ View PDF ] [ Download PDF ] buttons revealed.
 *   expired — Token has expired or is invalid.
 *   error   — Generic load failure.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

// Always use relative /api paths — the Vite proxy forwards them to localhost:5000.
// This works on the PC (via proxy) AND on the phone via ngrok
// (ngrok tunnels the full Vite dev server, including its proxy).
// Never hard-code localhost:5000 here — the phone cannot reach it.
function apiUrl(path) {
  return `/api${path}`;
}

// ── Branded shell ─────────────────────────────────────────────────────────────
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#f7f8fc] flex flex-col">
      {/* Top bar */}
      <div className="bg-[#111827] px-6 py-3 flex items-center gap-3 shadow">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center
          bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0">
          <span className="text-white font-black text-sm">D</span>
        </div>
        <span className="text-white font-bold text-base tracking-tight">DocuVault</span>
        <span className="ml-auto text-xs text-gray-400 font-medium hidden sm:block">
          Secure Document Access
        </span>
      </div>
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
      <div className="text-center pb-6 text-[11px] text-gray-400">
        Powered by DocuVault · Secure Document Management
      </div>
    </div>
  );
}

// ── Doc info card ──────────────────────────────────────────────────────────────
function DocCard({ session }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-5 space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document</p>
      <p className="text-sm font-bold text-gray-900 leading-snug">{session.template_name}</p>
      <p className="font-mono text-[11px] text-indigo-600 bg-indigo-50 rounded px-2 py-0.5
        inline-block">{session.doc_uuid}</p>
      <div className="pt-1 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">Recipient</span>
        <span className="text-xs font-semibold text-gray-800">{session.recipient_name}</span>
      </div>
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Verify', 'Access', 'View'];
  const idx   = current === 'qr' ? 0 : current === 'verified' || current === 'access' ? 1 : 2;
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-1.5 ${i <= idx ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px]
              font-black border-2 transition-all
              ${i < idx  ? 'bg-indigo-600 border-indigo-600 text-white'
              : i === idx ? 'bg-white border-indigo-600 text-indigo-600'
              :             'bg-white border-gray-300 text-gray-400'}`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className="text-[11px] font-semibold hidden sm:inline">{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 rounded transition-all
              ${i < idx ? 'bg-indigo-400' : 'bg-gray-200'}`}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RecipientAccessPage() {
  const { token } = useParams();

  // stage: loading | qr | verified | access | active | expired | error
  const [stage,    setStage]   = useState('loading');
  const [session,  setSession] = useState(null);   // data from GET /api/access/:token
  const [errMsg,   setErrMsg]  = useState('');

  // PDF display
  const [pdfMode,     setPdfMode]     = useState(null);   // 'view' | 'download' | null
  const [pdfUrl,      setPdfUrl]      = useState(null);
  const [pdfLoading,  setPdfLoading]  = useState(false);

  const pollRef     = useRef(null);
  const grantingRef = useRef(false);

  // ── Load session ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStage('error'); setErrMsg('No access token provided.'); return; }

    fetch(apiUrl(`/access/${token}`))
      .then(async r => {
        const data = await r.json();
        if (!r.ok) {
          if (r.status === 410) { setStage('expired'); setErrMsg(data.message); return; }
          setStage('error'); setErrMsg(data.message || 'Could not load document.'); return;
        }
        setSession(data);
        // Resume from wherever the session already is
        if (data.access_granted) { setStage('active'); }
        else if (data.qr_verified) { setStage('verified'); }
        else { setStage('qr'); }
      })
      .catch(() => { setStage('error'); setErrMsg('Network error. Please check your connection.'); });
  }, [token]);

  // ── Poll for QR verification ──────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const r    = await fetch(apiUrl(`/access/${token}/qr-poll`));
        const data = await r.json();
        if (data.qr_verified && stage === 'qr') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStage('verified');
        }
      } catch { /* silent */ }
    }, 2000);
  }, [token, stage]);

  useEffect(() => {
    if (stage === 'qr') startPolling();
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [stage, startPolling]);

  // ── Grant access (ON button) ──────────────────────────────────────────────
  const grantAccess = async () => {
    if (grantingRef.current) return;
    grantingRef.current = true;
    try {
      const r = await fetch(apiUrl(`/access/${token}/grant`), { method: 'POST' });
      if (r.ok) { setStage('active'); }
      else {
        const d = await r.json();
        setErrMsg(d.message || 'Could not grant access.');
      }
    } catch {
      setErrMsg('Network error. Please try again.');
    } finally { grantingRef.current = false; }
  };

  // ── Load PDF (view inline) ────────────────────────────────────────────────
  const handleView = async () => {
    if (pdfUrl) { setPdfMode('view'); return; }
    setPdfLoading(true);
    try {
      const r   = await fetch(apiUrl(`/access/${token}/pdf`));
      if (!r.ok) { const d = await r.json(); setErrMsg(d.message); return; }
      const blob = await r.blob();
      setPdfUrl(URL.createObjectURL(blob));
      setPdfMode('view');
    } catch { setErrMsg('Could not load the PDF. Please try again.'); }
    finally { setPdfLoading(false); }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownload = async () => {
    setPdfLoading(true);
    try {
      const r = await fetch(apiUrl(`/access/${token}/download`), { method: 'POST' });
      if (!r.ok) { const d = await r.json(); setErrMsg(d.message); return; }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${session?.doc_uuid || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { setErrMsg('Download failed. Please try again.'); }
    finally { setPdfLoading(false); }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <svg className="animate-spin w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm text-gray-500">Loading your document…</p>
        </div>
      </Shell>
    );
  }

  if (stage === 'expired') {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Link Expired</h1>
          <p className="text-sm text-gray-500">{errMsg}</p>
        </div>
      </Shell>
    );
  }

  if (stage === 'error') {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Invalid Link</h1>
          <p className="text-sm text-gray-500">{errMsg || 'This link is invalid or has already been used.'}</p>
        </div>
      </Shell>
    );
  }

  // ── PDF viewer overlay ────────────────────────────────────────────────────
  if (pdfMode === 'view' && pdfUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        {/* Top bar */}
        <div className="bg-[#111827] px-4 py-2 flex items-center gap-3 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center
            bg-gradient-to-br from-blue-500 to-indigo-600">
            <span className="text-white font-black text-xs">D</span>
          </div>
          <span className="text-white font-bold text-sm">DocuVault</span>
          <span className="text-gray-400 text-xs ml-1">· {session?.doc_uuid}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-emerald-400 font-semibold hidden sm:inline">
              ✓ Verified · Read Only
            </span>
            <button
              onClick={() => setPdfMode(null)}
              className="text-gray-400 hover:text-white transition ml-2 p-1 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        {/* PDF — read-only, no toolbar controls for editing */}
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
          className="flex-1 w-full border-0"
          title="Document Viewer"
        />
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  const qrUrl = `${window.location.origin}/doc/${token}/verify`;

  return (
    <Shell>
      <Steps current={stage} />
      {session && <DocCard session={session} />}

      {/* Error banner */}
      {errMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs
          px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0
              11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"/>
          </svg>
          {errMsg}
          <button onClick={() => setErrMsg('')} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── STAGE: QR ─────────────────────────────────────────────────────── */}
      {stage === 'qr' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-gray-900">Document Access</h1>
            <p className="text-sm text-gray-500">
              Verify this document before accessing it.
            </p>
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl
              hover:border-indigo-400 transition-colors">
              <QRCodeSVG
                value={qrUrl}
                size={200}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#111827"
              />
            </div>

            {/* Live status */}
            <div className="flex items-center gap-2 text-sm text-amber-600 font-medium
              bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>
              Waiting for verification…
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">How to verify:</p>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px]
                font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <p className="text-xs text-gray-500">
                Open your phone's camera and scan the QR code above.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px]
                font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <p className="text-xs text-gray-500">
                Your phone will open a verification page. Tap "Confirm Verification".
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px]
                font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <p className="text-xs text-gray-500">
                This page will automatically update. No need to refresh.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: VERIFIED ───────────────────────────────────────────────── */}
      {stage === 'verified' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8
          text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center
            justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-emerald-700">✓ Document Verified</h1>
            <p className="text-sm text-gray-500">
              Your document has been successfully verified using your mobile device.
            </p>
          </div>

          <button
            onClick={() => setStage('access')}
            className="w-full bg-[#111827] hover:bg-gray-800 text-white
              font-bold text-sm py-3.5 rounded-xl transition-colors
              flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
            </svg>
            Open Secure Link
          </button>
        </div>
      )}

      {/* ── STAGE: ACCESS (ON/OFF toggle) ─────────────────────────────────── */}
      {stage === 'access' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-gray-900">Document Access</h1>
            <p className="text-sm text-gray-500">{session?.template_name}</p>
            <p className="font-mono text-[11px] text-indigo-600">{session?.doc_uuid}</p>
          </div>

          {/* Verification badge */}
          <div className="flex items-center justify-center gap-2 text-emerald-700
            bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            <span className="text-sm font-semibold">Verification: ✓ Verified</span>
          </div>

          {/* Access toggle */}
          <div className="border border-gray-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Access Status</p>
                <p className="text-xs text-gray-400 mt-0.5">Document is currently locked</p>
              </div>
              {/* OFF indicator */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-full
                px-4 py-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400"/>
                <span className="text-sm font-bold text-gray-500">OFF</span>
              </div>
            </div>

            <button
              onClick={grantAccess}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white
                font-bold text-sm py-3.5 rounded-xl transition-colors
                flex items-center justify-center gap-2 shadow-md shadow-indigo-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0
                     01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622
                     5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              Turn Access ON
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE: ACTIVE (View + Download) ──────────────────────────────── */}
      {stage === 'active' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-gray-900">Document Access</h1>
            <p className="text-sm text-gray-500">{session?.template_name}</p>
            <p className="font-mono text-[11px] text-indigo-600">{session?.doc_uuid}</p>
          </div>

          {/* Verification badge */}
          <div className="flex items-center justify-center gap-2 text-emerald-700
            bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            <span className="text-sm font-semibold">Verified</span>
          </div>

          {/* Access ON indicator */}
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Access Status</p>
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">Document is unlocked</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-600 rounded-full
                px-4 py-1.5 shadow">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"/>
                <span className="text-sm font-bold text-white">ON</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* View PDF */}
              <button
                onClick={handleView}
                disabled={pdfLoading}
                className="flex flex-col items-center gap-2.5 bg-white
                  hover:bg-gray-50 border border-gray-200 hover:border-indigo-300
                  rounded-xl px-4 py-5 transition-all disabled:opacity-50
                  hover:shadow-md group">
                {pdfLoading
                  ? <svg className="animate-spin w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  : <svg className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542
                           7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                }
                <span className="text-xs font-bold text-gray-800">View PDF</span>
              </button>

              {/* Download PDF */}
              <button
                onClick={handleDownload}
                disabled={pdfLoading}
                className="flex flex-col items-center gap-2.5 bg-white
                  hover:bg-gray-50 border border-gray-200 hover:border-emerald-300
                  rounded-xl px-4 py-5 transition-all disabled:opacity-50
                  hover:shadow-md group">
                {pdfLoading
                  ? <svg className="animate-spin w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  : <svg className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                }
                <span className="text-xs font-bold text-gray-800">Download PDF</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-center text-gray-400">
            Read-only access · You cannot edit, sign, or modify this document.
          </p>
        </div>
      )}
    </Shell>
  );
}
