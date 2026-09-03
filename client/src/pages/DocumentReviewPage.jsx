/**
 * DocumentReviewPage — FR-022 / FR-023
 *
 * Opened when the Approver clicks the secure link in their email:
 *   /review/:token
 *
 * Flow:
 *   1. Page loads → validates token via GET /esign/review/:token
 *   2. Shows document metadata + embedded PDF viewer
 *   3. Approver reads the PDF
 *   4. Approver enters the 6-digit OTP from the same email
 *   5. Clicks "Approve & Sign" or "Reject"
 *   6. On approve: OTP verified → POST /esign/otp/verify → POST /esign/approve
 *   7. On reject:  reason required → POST /esign/reject
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useToast } from '../context/ToastContext';

// ── Lockout countdown hook ─────────────────────────────────────────────────────
// Ticks every second. Returns seconds remaining (0 when expired).
// lockedUntil is a Date object or null. Security note: this is display-only —
// the server enforces the actual lockout on every request.
function useLockoutCountdown(lockedUntil) {
  const [secsLeft, setSecsLeft] = useState(0);

  useEffect(() => {
    if (!lockedUntil) { setSecsLeft(0); return; }

    const tick = () => {
      const diff = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecsLeft(diff);
    };

    tick(); // run immediately
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  return secsLeft;
}

function fmtCountdown(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── OTP input — 6 individual digit boxes ─────────────────────────────────────
// Supports:
//   • Digit-by-digit typing with auto-advance
//   • Paste of a 6-digit string from anywhere in the field — fills all boxes
//     instantly and fires onAutoSubmit so the user never needs to click verify
//   • Backspace to delete and move focus backward
function OtpInput({ value, onChange, onAutoSubmit, disabled }) {
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleKey = (e, i) => {
    if (disabled) return;
    if (e.key === 'Backspace') {
      const next = value.slice(0, i) + value.slice(i + 1);
      onChange(next);
      if (i > 0) document.getElementById(`rv-otp-${i - 1}`)?.focus();
    } else if (/^\d$/.test(e.key)) {
      const next = (value.slice(0, i) + e.key + value.slice(i + 1)).slice(0, 6);
      onChange(next);
      if (i < 5) {
        document.getElementById(`rv-otp-${i + 1}`)?.focus();
      } else if (next.length === 6) {
        // Last digit typed — auto-submit
        onAutoSubmit(next);
      }
    }
  };

  // Paste handler — works regardless of which box the cursor is in.
  // Strips non-digits, takes the first 6, fills all boxes, then auto-submits.
  const handlePaste = (e) => {
    if (disabled) return;
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    // Focus the box after the last pasted digit (or the last box)
    const focusIdx = Math.min(pasted.length, 5);
    document.getElementById(`rv-otp-${focusIdx}`)?.focus();
    if (pasted.length === 6) {
      onAutoSubmit(pasted);
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          id={`rv-otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={() => {}}
          onKeyDown={e => handleKey(e, i)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          disabled={disabled}
          className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl
            focus:outline-none transition-all bg-white text-gray-900
            disabled:opacity-40 disabled:cursor-not-allowed
            ${d ? 'border-[#3b5bdb] bg-indigo-50' : 'border-gray-300'}
            focus:border-[#3b5bdb]`}
        />
      ))}
    </div>
  );
}

function fmt(d) {
  return d ? new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({ requestId, docUuid, onClose, onDone }) {
  const toast = useToast();
  const [reason,  setReason]  = useState('');
  const [error,   setError]   = useState('');
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { setError('Rejection reason is required.'); return; }
    setWorking(true);
    try {
      await axiosInstance.post('/esign/reject', {
        request_id: requestId,
        rejection_reason: reason.trim(),
      });
      toast.success('Document rejected — generator has been notified');
      onDone('rejected');
    } catch (e) {
      setError(e.response?.data?.message || 'Rejection failed.');
    } finally { setWorking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Reject Document</h3>
            <p className="text-xs text-gray-500 mt-0.5">The generator will be notified with your reason.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          <p className="font-mono text-xs font-semibold text-red-600">{docUuid}</p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setError(''); }}
            placeholder="Explain why this document is being rejected…"
            rows={4}
            className={`w-full px-4 py-3 text-sm border rounded-xl resize-none bg-white
              text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2
              focus:ring-red-500/20 focus:border-red-400 transition
              ${error ? 'border-red-400' : 'border-gray-300'}`}
          />
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} disabled={working}
            className="flex-1 border border-gray-300 text-gray-600 text-sm font-semibold
              py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={working || !reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold
              py-2.5 rounded-xl disabled:opacity-40 transition flex items-center
              justify-center gap-2">
            {working
              ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>Rejecting…</>
              : 'Reject Document'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DocumentReviewPage() {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const toast      = useToast();

  // Page states
  const [status,    setStatus]   = useState('loading'); // loading|ready|invalid|done
  const [request,   setRequest]  = useState(null);
  const [doneState, setDoneState]= useState(null); // 'approved'|'rejected'
  const [message,   setMessage]  = useState('');

  // PDF viewer
  const [pdfUrl,    setPdfUrl]   = useState(null);
  const [pdfLoaded, setPdfLoaded]= useState(false);

  // OTP state
  const [otp,         setOtp]        = useState('');
  const [otpVerified, setOtpVerified]= useState(false);
  const [otpError,    setOtpError]   = useState('');
  const [otpWorking,  setOtpWorking] = useState(false);
  // lockedUntil: Date object when lockout expires, or null when not locked.
  // Timer is display-only — server enforces the real lockout on every request.
  const [lockedUntil,  setLockedUntil]  = useState(null);
  const lockoutSecs = useLockoutCountdown(lockedUntil);
  const isLocked    = lockoutSecs > 0;
  const otpSubmitting = useRef(false); // guard against double-fire from auto-submit

  // Approve state
  const [approving, setApproving] = useState(false);

  // Reject modal
  const [showReject, setShowReject] = useState(false);

  // ── 1. Validate token on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('invalid'); setMessage('No review token provided.'); return; }

    axiosInstance.get(`/esign/review/${token}`)
      .then(res => {
        setRequest(res.data);
        setOtpVerified(res.data.otp_verified || false);
        setStatus('ready');
      })
      .catch(err => {
        const code = err.response?.status;
        setMessage(err.response?.data?.message || 'This review link is invalid.');
        if (code === 410) {
          setDoneState(err.response?.data?.status || 'approved');
          setStatus('done');
        } else {
          setStatus('invalid');
        }
      });
  }, [token]);

  // ── 2. Load PDF blob ONLY after OTP verified ─────────────────────────────
  const loadPdf = useCallback(async (docId) => {
    try {
      const res = await axiosInstance.get(`/documents/${docId}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      setPdfUrl(url);
    } catch (e) {
      toast.error('Could not load the PDF. Please try again.');
    }
  }, [toast]);

  // Trigger PDF load only after OTP is verified — never before
  useEffect(() => {
    if (otpVerified && request?.doc_id && !pdfUrl) {
      loadPdf(request.doc_id);
    }
  }, [otpVerified, request, pdfUrl, loadPdf]);

  // ── 3. Verify OTP ──────────────────────────────────────────────────────────
  // Called by button click OR auto-submit (paste / last digit typed).
  // otpOverride is passed by auto-submit so the latest value is used even
  // before React has re-rendered with the new `otp` state.
  const verifyOtp = useCallback(async (otpOverride) => {
    if (otpSubmitting.current) return; // guard against double-fire
    const code = otpOverride || otp;
    if (code.length !== 6) { setOtpError('Enter all 6 digits.'); return; }
    otpSubmitting.current = true;
    setOtpWorking(true); setOtpError('');
    try {
      await axiosInstance.post('/esign/otp/verify', {
        request_id: request.request_id,
        otp: code,
      });
      setOtpVerified(true);
      toast.success('Identity confirmed — you can now approve');
    } catch (e) {
      const msg      = e.response?.data?.message || 'Invalid OTP. Try again.';
      const isLocked = e.response?.status === 429;
      setOtpError(msg);
      setOtp('');
      if (isLocked) {
        // Use the server-provided locked_until timestamp so the countdown is accurate.
        // Fall back to 15 minutes from now if the server didn't return one (shouldn't happen).
        const until = e.response?.data?.locked_until
          ? new Date(e.response.data.locked_until)
          : new Date(Date.now() + 15 * 60 * 1000);
        setLockedUntil(until);
      }
    } finally {
      setOtpWorking(false);
      otpSubmitting.current = false;
    }
  }, [otp, request]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. Resend OTP ──────────────────────────────────────────────────────────
  const resendOtp = async () => {
    setOtpWorking(true); setOtpError('');
    try {
      await axiosInstance.post('/esign/otp/send', { request_id: request.request_id });
      setOtp('');
      setOtpVerified(false);
      setLockedUntil(null);
      toast.success('A fresh OTP has been sent to your email (valid 5 minutes)');
    } catch (e) {
      const msg      = e.response?.data?.message || 'Failed to send OTP.';
      const isLocked = e.response?.status === 429;
      setOtpError(msg);
      if (isLocked && e.response?.data?.locked_until) {
        setLockedUntil(new Date(e.response.data.locked_until));
      }
    } finally { setOtpWorking(false); }
  };

  // ── 5. Approve ─────────────────────────────────────────────────────────────
  const approve = async () => {
    setApproving(true);
    try {
      await axiosInstance.post('/esign/approve', { request_id: request.request_id });
      toast.success('Document approved and digitally signed!');
      setDoneState('approved');
      setStatus('done');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Approval failed.');
    } finally { setApproving(false); }
  };

  const onRejectDone = (state) => {
    setShowReject(false);
    setDoneState(state);
    setStatus('done');
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <svg className="animate-spin w-8 h-8 text-[#3b5bdb] mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm text-gray-500 font-medium">Loading document for review…</p>
        </div>
      </div>
    );
  }

  // ── Invalid token ──────────────────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200
          max-w-sm w-full p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center
            justify-center mx-auto">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Invalid Review Link</h2>
          <p className="text-sm text-gray-500">{message || 'This review link is invalid or has expired.'}</p>
          <button onClick={() => navigate('/approvals')}
            className="w-full bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm
              font-bold py-2.5 rounded-xl transition">
            Go to Approvals
          </button>
        </div>
      </div>
    );
  }

  // ── Already actioned ───────────────────────────────────────────────────────
  if (status === 'done') {
    const isApproved = doneState === 'approved';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200
          max-w-sm w-full p-8 text-center space-y-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto
            ${isApproved ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {isApproved
              ? <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
              : <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
            }
          </div>
          <h2 className={`text-lg font-bold ${isApproved ? 'text-emerald-700' : 'text-red-700'}`}>
            {isApproved ? 'Document Approved & Signed' : 'Document Rejected'}
          </h2>
          <p className="text-sm text-gray-500">
            {isApproved
              ? 'Your digital signature has been applied. The generator has been notified.'
              : 'The document has been rejected. The generator has been notified with your reason.'
            }
          </p>
          <button onClick={() => navigate('/approvals')}
            className="w-full bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm
              font-bold py-2.5 rounded-xl transition">
            Back to Approvals
          </button>
        </div>
      </div>
    );
  }

  // ── Main review page ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-3
        flex items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="DocuVault" className="h-7 w-auto object-contain flex-shrink-0"/>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">Document Review</p>
            <p className="text-[11px] text-gray-500 truncate hidden sm:block">
              {request?.doc_uuid}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {otpVerified && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold
              px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
              Identity Verified
            </span>
          )}
          <button onClick={() => navigate('/approvals')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900
              flex items-center gap-1 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            <span className="hidden sm:inline">All Approvals</span>
          </button>
        </div>
      </div>

      {/* ── STEP 1: OTP verification screen — shown until OTP is verified ── */}
      {!otpVerified && (
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
          <div className="bg-white rounded-2xl shadow-md border border-gray-200
            w-full max-w-md p-8 space-y-6">

            {/* Document info */}
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center
                justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955
                       11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824
                       10.29 9 11.622 5.176-1.332 9-6.03 9-11.622
                       0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Approve &amp; Sign Document</h1>
              <p className="text-sm text-gray-500">{request?.template_name}</p>
            </div>

            {/* Doc details */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Document</span>
                <span className="font-mono font-bold text-[#3b5bdb]">{request?.doc_uuid}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Requested By</span>
                <span className="font-semibold text-gray-800">{request?.generator_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Assigned To</span>
                <span className="font-semibold text-gray-800">{request?.approver_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Requested</span>
                <span className="text-gray-600">{fmt(request?.requested_at)}</span>
              </div>
            </div>

            {/* OTP instructions */}
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-900 text-center">
                Enter your 6-digit OTP
              </p>
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                This document requires identity verification before you can view or sign it.
                Enter the OTP from the request email.
              </p>
            </div>

            <OtpInput
              value={otp}
              onChange={setOtp}
              onAutoSubmit={verifyOtp}
              disabled={otpWorking || isLocked}
            />
            <p className="text-[10px] text-gray-400 text-center -mt-2">
              OTP valid for 5 minutes · 3 attempts max · paste or type to auto-verify
            </p>

            {otpError && (
              <div className={`border text-xs px-4 py-3 rounded-xl flex items-center gap-2
                ${isLocked
                  ? 'bg-red-100 border-red-300 text-red-700'
                  : 'bg-red-50 border-red-200 text-red-600'}`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7
                    4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102
                    0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {otpError}
              </div>
            )}

            {!isLocked ? (
              <button
                onClick={() => verifyOtp()}
                disabled={otp.length !== 6 || otpWorking}
                className="w-full bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm
                  font-bold py-3.5 rounded-xl disabled:opacity-40 transition
                  flex items-center justify-center gap-2">
                {otpWorking
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>Verifying…</>
                  : <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955
                             11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824
                             10.29 9 11.622 5.176-1.332 9-6.03 9-11.622
                             0-1.042-.133-2.052-.382-3.016z"/>
                      </svg>
                      Verify OTP &amp; View Document
                    </>
                }
              </button>
            ) : (
              /* Lockout card — shows a live server-derived countdown */
              <div className="w-full bg-red-50 border border-red-200 rounded-xl
                px-4 py-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-red-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0
                         00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <p className="text-sm font-bold">OTP Locked</p>
                </div>
                <p className="text-xs text-red-600">
                  3 failed attempts. Resend available in:
                </p>
                <p className="text-2xl font-black text-red-700 font-mono tracking-widest">
                  {fmtCountdown(lockoutSecs)}
                </p>
                <p className="text-[11px] text-red-400">
                  You cannot resend or verify until the lockout expires.
                </p>
              </div>
            )}

            <button
              onClick={resendOtp}
              disabled={otpWorking || isLocked}
              className="w-full text-xs font-semibold text-[#3b5bdb]
                hover:underline disabled:opacity-40 disabled:cursor-not-allowed py-1
                transition-opacity">
              {isLocked
                ? `Resend locked — wait ${fmtCountdown(lockoutSecs)}`
                : "Didn't get the code? Resend OTP to your email"
              }
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: PDF review + approve/reject — shown only after OTP verified ── */}
      {otpVerified && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">

          {/* ── Left: PDF Viewer ── */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">Document Preview</h2>
              <span className="text-[11px] text-gray-400">Read the full document before deciding</span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
              {!pdfUrl ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <svg className="animate-spin w-8 h-8 text-[#3b5bdb]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <p className="text-sm text-gray-400">Loading PDF…</p>
                </div>
              ) : (
                <iframe
                  src={pdfUrl}
                  title="Document to review"
                  className="w-full h-full border-0"
                  onLoad={() => setPdfLoaded(true)}
                />
              )}
            </div>
          </div>

          {/* ── Right: Action panel ── */}
          <div className="w-full lg:w-96 flex-shrink-0 space-y-4">

            {/* Document info */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-bold text-gray-900">Document Details</h2>
              <div className="space-y-2.5">
                {[
                  { label: 'Document ID',  value: request?.doc_uuid,        mono: true  },
                  { label: 'Template',     value: request?.template_name                },
                  { label: 'Category',     value: request?.template_category            },
                  { label: 'Requested By', value: request?.generator_name              },
                  { label: 'Requested',    value: fmt(request?.requested_at)            },
                ].map(row => row.value ? (
                  <div key={row.label} className="flex items-start gap-2">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase
                      tracking-wide w-24 flex-shrink-0 pt-0.5">
                      {row.label}
                    </p>
                    <p className={`text-xs text-gray-900 font-medium break-all
                      ${row.mono ? 'font-mono text-[#3b5bdb]' : ''}`}>
                      {row.value}
                    </p>
                  </div>
                ) : null)}
              </div>
              {request?.file_hash && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-1">
                    SHA-256
                  </p>
                  <p className="text-[10px] font-mono text-gray-500 break-all leading-relaxed">
                    {request.file_hash}
                  </p>
                </div>
              )}
            </div>

            {/* Identity verified badge */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3
              flex items-start gap-2.5">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <p className="text-xs font-bold text-emerald-800">Identity Confirmed</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  OTP verified. You may now approve or reject this document.
                </p>
              </div>
            </div>

            {/* Decision panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-bold text-gray-900">Your Decision</h2>
              <p className="text-xs text-gray-500">
                Read the full document above, then choose your action.
              </p>

              <button
                onClick={approve}
                disabled={approving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm
                  font-bold py-3.5 rounded-xl disabled:opacity-50 transition
                  flex items-center justify-center gap-2.5">
                {approving
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>Approving…</>
                  : <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      Approve &amp; Apply E-Signature
                    </>
                }
              </button>

              <button
                onClick={() => setShowReject(true)}
                disabled={approving}
                className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50
                  text-sm font-bold py-3.5 rounded-xl disabled:opacity-50 transition
                  flex items-center justify-center gap-2.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0
                       11-18 0 9 9 0 0118 0z"/>
                </svg>
                Reject with Reason
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <RejectModal
          requestId={request.request_id}
          docUuid={request.doc_uuid}
          onClose={() => setShowReject(false)}
          onDone={onRejectDone}
        />
      )}
    </div>
  );
}
