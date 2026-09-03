import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useToast } from '../context/ToastContext';
import { SkeletonTableRow } from '../components/ui/Skeleton';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_META = {
  pending:  { bg: 'bg-yellow-100',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  label: 'Pending'  },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
  rejected: { bg: 'bg-red-100',     text: 'text-red-600',     dot: 'bg-red-400',     label: 'Rejected' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold
      px-2.5 py-1 rounded-full ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmt(d) {
  return d
    ? new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';
}

// ── OTP input — 6 individual digit boxes ─────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleKey = (e, i) => {
    if (disabled) return;
    if (e.key === 'Backspace') {
      const next = value.slice(0, i) + value.slice(i + 1);
      onChange(next);
      if (i > 0) document.getElementById(`otp-box-${i - 1}`)?.focus();
    } else if (/^\d$/.test(e.key)) {
      const next = (value.slice(0, i) + e.key + value.slice(i + 1)).slice(0, 6);
      onChange(next);
      if (i < 5) document.getElementById(`otp-box-${i + 1}`)?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-box-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={() => {}}
          onKeyDown={e => handleKey(e, i)}
          onFocus={e => e.target.select()}
          disabled={disabled}
          className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-xl
            focus:outline-none focus:border-[#3b5bdb] transition-all
            bg-[var(--color-bg)] text-[var(--color-text-primary)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${d ? 'border-[#3b5bdb] bg-indigo-50/50' : 'border-[var(--color-border)]'}`}
        />
      ))}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, border, color }) {
  return (
    <div className={`bg-[var(--color-surface)] rounded-2xl border-l-4 ${border} shadow-sm p-5`}>
      <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

// ── Inline approve modal (3-step OTP flow) ────────────────────────────────────
function ApproveModal({ request, onClose, onSuccess }) {
  const toast = useToast();

  const [otpSent,     setOtpSent]     = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp,         setOtp]         = useState('');
  const [otpError,    setOtpError]    = useState('');
  const [working,     setWorking]     = useState(false);

  const otpStep = !otpSent ? 1 : !otpVerified ? 2 : 3;

  const sendOtp = async () => {
    setWorking(true); setOtpError('');
    try {
      await axiosInstance.post('/esign/otp/send', { request_id: request.id });
      setOtpSent(true); setOtpVerified(false); setOtp('');
      toast.success('OTP sent to your registered email');
    } catch (e) {
      setOtpError(e.response?.data?.message || 'Failed to send OTP');
    } finally { setWorking(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setOtpError('Enter all 6 digits'); return; }
    setWorking(true); setOtpError('');
    try {
      await axiosInstance.post('/esign/otp/verify', { request_id: request.id, otp });
      setOtpVerified(true); setOtpError('');
      toast.success('OTP verified — ready to approve');
    } catch (e) {
      setOtpError(e.response?.data?.message || 'Invalid OTP');
      setOtp('');
    } finally { setWorking(false); }
  };

  const approveDoc = async () => {
    setWorking(true); setOtpError('');
    try {
      await axiosInstance.post('/esign/approve', { request_id: request.id });
      toast.success('Document approved and digitally signed');
      onSuccess();
    } catch (e) {
      setOtpError(e.response?.data?.message || 'Approval failed');
    } finally { setWorking(false); }
  };

  const viewPdf = async () => {
    try {
      const res = await axiosInstance.get(`/documents/${request.doc_id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Unable to open document');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl
        w-full max-w-md p-6 space-y-5">

        {/* Title */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)] text-base">
              Approve &amp; Sign Document
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              3-step identity verification required
            </p>
          </div>
          <button onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
              transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Document info card */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-[#3b5bdb] truncate">
                {request.doc_uuid}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {request.template_name}
                {request.template_category && (
                  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5
                    rounded-full bg-blue-100 text-blue-700">
                    {request.template_category}
                  </span>
                )}
              </p>
            </div>
            <button onClick={viewPdf}
              title="Preview PDF before approving"
              className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold
                text-[#3b5bdb] bg-white border border-indigo-200 px-2 py-1 rounded-lg
                hover:bg-indigo-50 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943
                     7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274
                     4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              Review PDF
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1
            border-t border-indigo-100 text-[11px]">
            <div>
              <p className="text-[9px] text-indigo-400 font-semibold uppercase">Requested By</p>
              <p className="text-[var(--color-text-primary)] font-medium">{request.generator_name}</p>
            </div>
            <div>
              <p className="text-[9px] text-indigo-400 font-semibold uppercase">Requested</p>
              <p className="text-[var(--color-text-secondary)]">{fmt(request.created_at)}</p>
            </div>
            {request.file_hash && (
              <div className="col-span-2">
                <p className="text-[9px] text-indigo-400 font-semibold uppercase">SHA-256</p>
                <p className="font-mono text-[10px] text-[var(--color-text-secondary)] truncate"
                  title={request.file_hash}>
                  {request.file_hash}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: 'Check Email', done: otpSent },
            { n: 2, label: 'Verify OTP',  done: otpVerified },
            { n: 3, label: 'Approve',     done: false },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center
                text-xs font-bold flex-shrink-0
                ${s.done
                  ? 'bg-emerald-500 text-white'
                  : otpStep === s.n
                  ? 'bg-[#3b5bdb] text-white'
                  : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                {s.done
                  ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                    </svg>
                  : s.n}
              </div>
              <span className={`text-[11px] font-medium hidden sm:block
                ${otpStep === s.n ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                {s.label}
              </span>
              {i < 2 && (
                <div className={`flex-1 h-px ${s.done ? 'bg-emerald-300' : 'bg-[var(--color-border)]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {otpError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs
            px-4 py-3 rounded-xl flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7
                4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102
                0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            {otpError}
          </div>
        )}

        {/* Step 1 — Send OTP */}
        {!otpVerified && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
              Step 1 — Your OTP was included in the request email
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5
              flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs text-blue-700">
                A 6-digit OTP was sent to your email when this request was created.
                Check your inbox. Click below only if you need a fresh code.
              </p>
            </div>
            <button onClick={sendOtp} disabled={working}
              className="w-full border border-[#3b5bdb] text-[#3b5bdb] text-sm font-semibold
                py-2.5 rounded-xl hover:bg-indigo-50 transition-colors
                flex items-center justify-center gap-2 disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0
                     002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              {working && !otpSent ? 'Sending…' : otpSent ? 'Resend OTP' : 'Resend OTP'}
            </button>
          </div>
        )}

        {/* Step 2 — Enter OTP */}
        {otpSent && !otpVerified && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
              Step 2 — Enter the 6-digit OTP from your email
            </p>
            <OtpInput value={otp} onChange={setOtp} disabled={working} />
            <p className="text-[10px] text-[var(--color-text-secondary)] text-center">
              Expires in 5 min · Max 3 attempts (BR-004)
            </p>
            <button onClick={verifyOtp} disabled={otp.length !== 6 || working}
              className="w-full bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm
                font-semibold py-2.5 rounded-xl disabled:opacity-40 transition-colors
                flex items-center justify-center gap-2">
              {working
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>Verifying…</>
                : 'Verify OTP'
              }
            </button>
          </div>
        )}

        {/* Step 3 — Approve */}
        {otpVerified && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl
              px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs font-semibold text-emerald-700">
                Identity verified. You can now approve and digitally sign this document.
              </p>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Step 3 — Confirm approval. A cryptographic HMAC-SHA256 signature will
              be applied and the generator will be notified.
            </p>
            <button onClick={approveDoc} disabled={working}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm
                font-bold py-3 rounded-xl disabled:opacity-50 transition-colors
                flex items-center justify-center gap-2">
              {working
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>Approving…</>
                : <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Approve &amp; Apply E-Signature
                  </>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({ request, onClose, onSuccess }) {
  const toast = useToast();
  const [reason,  setReason]  = useState('');
  const [error,   setError]   = useState('');
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setWorking(true); setError('');
    try {
      await axiosInstance.post('/esign/reject', {
        request_id: request.id,
        rejection_reason: reason.trim(),
      });
      toast.success('Document rejected — generator has been notified');
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.message || 'Rejection failed. Please try again.');
    } finally { setWorking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl
        w-full max-w-md p-6 space-y-4">

        {/* Title */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)] text-base">
              Reject Document
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              The generator will be notified with your reason.
            </p>
          </div>
          <button onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
              transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Doc info */}
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <p className="font-mono text-xs font-semibold text-red-600 truncate">
            {request.doc_uuid}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {request.template_name} · by {request.generator_name}
          </p>
        </div>

        {/* Reason field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setError(''); }}
            placeholder="Explain why this document is being rejected…"
            rows={4}
            className={`w-full px-4 py-3 text-sm border rounded-xl resize-none
              bg-[var(--color-bg)] text-[var(--color-text-primary)]
              placeholder-[var(--color-text-secondary)]
              focus:outline-none focus:ring-2 focus:ring-red-500/20
              focus:border-red-400 transition
              ${error ? 'border-red-400' : 'border-[var(--color-border)]'}`}
          />
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7
                  4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0
                  102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {error}
            </p>
          )}
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            {reason.length}/500 characters
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} disabled={working}
            className="flex-1 border border-[var(--color-border)] text-[var(--color-text-secondary)]
              text-sm font-semibold py-2.5 rounded-xl hover:bg-[var(--color-surface-raised)]
              transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={working || !reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold
              py-2.5 rounded-xl disabled:opacity-40 transition-colors
              flex items-center justify-center gap-2">
            {working
              ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>Rejecting…</>
              : <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0
                         11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Reject Document
                </>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { key: 'pending',  label: 'Pending',  color: 'text-yellow-600',  dotColor: 'bg-yellow-400'  },
  { key: 'approved', label: 'Approved', color: 'text-emerald-600', dotColor: 'bg-emerald-500' },
  { key: 'rejected', label: 'Rejected', color: 'text-red-500',     dotColor: 'bg-red-400'     },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const toast    = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab driven by ?tab= URL param (defaults to 'pending')
  const paramTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TABS.some(t => t.key === paramTab) ? paramTab : 'pending'
  );

  // Keep tab in sync when URL param changes externally (e.g. dashboard link)
  useEffect(() => {
    const p = searchParams.get('tab');
    if (TABS.some(t => t.key === p)) setActiveTab(p);
  }, [searchParams]);

  const switchTab = (key) => {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
    setSearch('');
  };

  const [requests, setRequests]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [search,   setSearch]     = useState('');

  // Modal state
  const [approveTarget, setApproveTarget] = useState(null); // request obj | null
  const [rejectTarget,  setRejectTarget]  = useState(null); // request obj | null

  // Load ALL statuses once — split client-side into tabs
  const load = useCallback(() => {
    setLoading(true); setError(null);
    axiosInstance.get('/esign/pending', { params: { status: 'all' } })
      .then(r => setRequests(r.data))
      .catch(e => {
        setRequests([]);
        setError(e.response?.data?.message || 'Failed to load approval requests.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Per-tab filtered rows
  const tabRows = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter(r => {
      const matchTab    = r.status === activeTab;
      const matchSearch = !q
        || (r.doc_uuid        || '').toLowerCase().includes(q)
        || (r.template_name   || '').toLowerCase().includes(q)
        || (r.generator_name  || '').toLowerCase().includes(q)
        || (r.approver_name   || '').toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [requests, activeTab, search]);

  // Counts per tab for badge display
  const counts = useMemo(() => ({
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests]);

  // View document PDF in new tab
  const viewDoc = async (r) => {
    try {
      const res = await axiosInstance.get(`/documents/${r.doc_id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Unable to open document');
    }
  };

  const onModalSuccess = () => {
    setApproveTarget(null);
    setRejectTarget(null);
    load();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Approvals</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          Review, approve, and reject document signature requests
        </p>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Pending"  value={counts.pending}
          border="border-yellow-500"  color="text-yellow-600" />
        <KpiCard label="Approved" value={counts.approved}
          border="border-emerald-500" color="text-emerald-600" />
        <KpiCard label="Rejected" value={counts.rejected}
          border="border-red-500"     color="text-red-500" />
        <KpiCard label="Total"    value={requests.length}
          border="border-[#3b5bdb]"   color="text-[#3b5bdb]" />
      </div>

      {/* ── Tabs + search bar ── */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
        shadow-sm overflow-hidden">

        {/* Tab row */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)]
          px-4 pt-3 pb-0 flex-wrap gap-2">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                  rounded-t-lg transition-colors border-b-2 -mb-px
                  ${activeTab === tab.key
                    ? `border-[#3b5bdb] ${tab.color} bg-[var(--color-surface)]`
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
              >
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                    ${activeTab === tab.key
                      ? tab.key === 'pending'  ? 'bg-yellow-100 text-yellow-700'
                      : tab.key === 'approved' ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-600'
                      : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]'
                    }`}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5
              text-[var(--color-text-secondary)] pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search doc, template, generator…"
              className="pl-9 pr-4 py-2 text-xs border border-[var(--color-border)]
                rounded-xl bg-[var(--color-bg)] text-[var(--color-text-primary)]
                placeholder-[var(--color-text-secondary)]
                focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                focus:border-indigo-400 transition w-52"
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                {activeTab === 'pending' && (
                  <>
                    {['Document ID', 'Template', 'Generated By', 'Record ID',
                      'Requested', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold
                        text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </>
                )}
                {activeTab === 'approved' && (
                  <>
                    {['Document ID', 'Template', 'Generated By', 'Approved By',
                      'Approved Date', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold
                        text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </>
                )}
                {activeTab === 'rejected' && (
                  <>
                    {['Document ID', 'Template', 'Generated By', 'Rejected By',
                      'Rejected Date', 'Rejection Reason', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold
                        text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border)]">

              {/* Loading */}
              {loading && [1, 2, 3, 4].map(i => (
                <SkeletonTableRow key={i}
                  cols={activeTab === 'rejected' ? 8 : 7} />
              ))}

              {/* Error */}
              {!loading && error && (
                <tr>
                  <td colSpan={activeTab === 'rejected' ? 8 : 7}
                    className="px-5 py-12 text-center">
                    <svg className="w-10 h-10 text-red-300 mx-auto mb-3"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2
                           2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      Something went wrong
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-4">{error}</p>
                    <button onClick={load}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold
                        px-4 py-2 rounded-lg bg-[#3b5bdb] text-white
                        hover:bg-[#2f4ac4] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11
                             11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                      Retry
                    </button>
                  </td>
                </tr>
              )}

              {/* Empty */}
              {!loading && !error && tabRows.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'rejected' ? 8 : 7}
                    className="px-5 py-14 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-raised)]
                      flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-[var(--color-text-secondary)]"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {search
                        ? 'No requests match your search'
                        : `No ${activeTab} requests`}
                    </p>
                  </td>
                </tr>
              )}

              {/* ── PENDING rows ── */}
              {!loading && !error && activeTab === 'pending' && tabRows.map(r => (
                <tr key={r.id}
                  className="hover:bg-[var(--color-surface-raised)] transition-colors group">
                  {/* Document ID */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-[var(--color-surface-raised)]
                      text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg">
                      {r.doc_uuid}
                    </span>
                    {r.template_category && (
                      <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5
                        rounded-full bg-blue-50 text-blue-600">
                        {r.template_category}
                      </span>
                    )}
                  </td>
                  {/* Template */}
                  <td className="px-5 py-4 text-sm font-medium
                    text-[var(--color-text-primary)] whitespace-nowrap">
                    {r.template_name}
                  </td>
                  {/* Generated By */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400
                        to-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">
                          {(r.generator_name || 'U').charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {r.generator_name}
                      </span>
                    </div>
                  </td>
                  {/* Record ID */}
                  <td className="px-5 py-4 text-xs font-mono
                    text-[var(--color-text-secondary)]">
                    {r.record_identifier || '—'}
                  </td>
                  {/* Requested */}
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)]
                    whitespace-nowrap">
                    {fmt(r.created_at)}
                  </td>
                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status} />
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      {/* Review = opens approve modal */}
                      <button
                        onClick={() => setApproveTarget(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold
                          text-white bg-[#3b5bdb] hover:bg-[#2f4ac4] transition-colors
                          whitespace-nowrap">
                        Review
                      </button>
                      <button
                        onClick={() => setRejectTarget(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold
                          text-red-600 bg-red-50 hover:bg-red-100 transition-colors
                          whitespace-nowrap">
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* ── APPROVED rows ── */}
              {!loading && !error && activeTab === 'approved' && tabRows.map(r => (
                <tr key={r.id}
                  className="hover:bg-[var(--color-surface-raised)] transition-colors group">
                  {/* Document ID */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-[var(--color-surface-raised)]
                      text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg">
                      {r.doc_uuid}
                    </span>
                  </td>
                  {/* Template */}
                  <td className="px-5 py-4 text-sm font-medium
                    text-[var(--color-text-primary)] whitespace-nowrap">
                    {r.template_name}
                  </td>
                  {/* Generated By */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400
                        to-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">
                          {(r.generator_name || 'U').charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {r.generator_name}
                      </span>
                    </div>
                  </td>
                  {/* Approved By */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400
                        to-teal-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">
                          {(r.approver_name || 'A').charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {r.approver_name || '—'}
                      </span>
                    </div>
                  </td>
                  {/* Approved Date */}
                  <td className="px-5 py-4 text-xs text-emerald-600 whitespace-nowrap">
                    {fmt(r.approved_at)}
                  </td>
                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status} />
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => viewDoc(r)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold
                          text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                        View
                      </button>
                      <button
                        onClick={() => navigate(
                          `/verify-doc?doc_uuid=${encodeURIComponent(r.doc_uuid)}`
                        )}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold
                          text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                        Verify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* ── REJECTED rows ── */}
              {!loading && !error && activeTab === 'rejected' && tabRows.map(r => (
                <tr key={r.id}
                  className="hover:bg-[var(--color-surface-raised)] transition-colors group">
                  {/* Document ID */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-[var(--color-surface-raised)]
                      text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg">
                      {r.doc_uuid}
                    </span>
                  </td>
                  {/* Template */}
                  <td className="px-5 py-4 text-sm font-medium
                    text-[var(--color-text-primary)] whitespace-nowrap">
                    {r.template_name}
                  </td>
                  {/* Generated By */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400
                        to-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">
                          {(r.generator_name || 'U').charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {r.generator_name}
                      </span>
                    </div>
                  </td>
                  {/* Rejected By */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400
                        to-rose-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">
                          {(r.approver_name || 'A').charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {r.approver_name || '—'}
                      </span>
                    </div>
                  </td>
                  {/* Rejected Date — no approved_at for rejected, use updated_at or created_at */}
                  <td className="px-5 py-4 text-xs text-red-500 whitespace-nowrap">
                    {fmt(r.approved_at || r.created_at)}
                  </td>
                  {/* Rejection Reason */}
                  <td className="px-5 py-4 max-w-[180px]">
                    {r.rejection_reason
                      ? <span
                          title={r.rejection_reason}
                          className="text-xs text-[var(--color-text-secondary)]
                            line-clamp-2 block">
                          {r.rejection_reason}
                        </span>
                      : <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                    }
                  </td>
                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status} />
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => viewDoc(r)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold
                          text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                        View
                      </button>
                      <button
                        onClick={() => navigate(
                          `/verify-doc?doc_uuid=${encodeURIComponent(r.doc_uuid)}`
                        )}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold
                          text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                        Verify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border)]
          flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Showing {tabRows.length} of {requests.length} total requests
          </p>
          <p className="text-xs text-emerald-600 font-medium">● Live from database</p>
        </div>
      </div>

      {/* ── Modals ── */}
      {approveTarget && (
        <ApproveModal
          request={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={onModalSuccess}
        />
      )}
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSuccess={onModalSuccess}
        />
      )}
    </div>
  );
}
