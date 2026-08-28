import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';

// ── States: loading | success | invalid | expired | conflict ─────────────────

export default function VerifyEmailPage() {
  const [searchParams]    = useSearchParams();
  const token             = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading'); // loading|success|invalid|expired|conflict
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage]   = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }

    axiosInstance.get(`/users/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => {
        setNewEmail(res.data.new_email || '');
        setStatus('success');
      })
      .catch(err => {
        const code = err.response?.status;
        setMessage(err.response?.data?.message || 'Something went wrong.');
        if (code === 410)      setStatus('expired');
        else if (code === 409) setStatus('conflict');
        else                   setStatus('invalid');
      });
  }, [token]);

  // ── Icon helper ─────────────────────────────────────────────────────────────
  const icons = {
    loading: (
      <svg className="animate-spin w-8 h-8 text-[#3b5bdb]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    ),
    success: (
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
        </svg>
      </div>
    ),
    expired: (
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
    ),
    invalid: (
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </div>
    ),
    conflict: (
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
    ),
  };

  const content = {
    loading: {
      title: 'Verifying your email…',
      body:  'Please wait while we confirm your new email address.',
    },
    success: {
      title: 'Email Updated Successfully',
      body:  `Your email address has been changed to ${newEmail}. Use this email to log in from now on.`,
    },
    expired: {
      title: 'Verification Link Expired',
      body:  message || 'This link has expired (24-hour limit). Go to Settings and request an email change again.',
    },
    invalid: {
      title: 'Invalid Verification Link',
      body:  message || 'This link is invalid or has already been used.',
    },
    conflict: {
      title: 'Email Already Taken',
      body:  message || 'This email was claimed by another account before you verified it. Please request a new email change.',
    },
  };

  const c = content[status] || content.invalid;

  return (
    <div className="min-h-screen bg-[#f7f8fc] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px] space-y-6">

        {/* Logo */}
        <div className="text-center">
          <img src="/logo.png" alt="DocuVault" className="h-14 w-14 object-contain mx-auto mb-4"/>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-8 space-y-5 text-center">

          {/* Icon */}
          <div className="flex justify-center">
            {icons[status] || icons.invalid}
          </div>

          {/* Title + body */}
          <div className="space-y-2">
            <h1 className={`text-lg font-bold ${
              status === 'success' ? 'text-emerald-700'
              : status === 'loading' ? 'text-gray-700'
              : 'text-gray-900'
            }`}>
              {c.title}
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">{c.body}</p>
          </div>

          {/* Actions */}
          {status === 'success' && (
            <Link to="/login"
              className="inline-flex items-center justify-center gap-2 w-full
                bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                py-3 rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14"/>
              </svg>
              Sign in with new email
            </Link>
          )}

          {(status === 'expired' || status === 'conflict') && (
            <Link to="/settings"
              className="inline-flex items-center justify-center gap-2 w-full
                border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50
                text-gray-700 text-sm font-semibold py-3 rounded-xl transition-colors">
              Go to Settings
            </Link>
          )}

          {status === 'invalid' && (
            <Link to="/"
              className="text-sm text-[#3b5bdb] font-semibold hover:underline">
              ← Return to Home
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
