import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';

// ── States: loading | success | invalid | expired | used | conflict ──────────

export default function VerifyEmailPage() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const { updateUser }    = useAuth();
  const token             = searchParams.get('token') || '';

  const [status,   setStatus]   = useState('loading');
  const [newEmail, setNewEmail] = useState('');
  const [message,  setMessage]  = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }

    axiosInstance.get(`/users/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => {
        setNewEmail(res.data.new_email || '');
        setStatus('success');

        // Refresh the auth context so the displayed email updates immediately
        // everywhere in the app — user does not need to re-login.
        axiosInstance.get('/auth/me')
          .then(meRes => {
            const freshUser = meRes.data.user ?? meRes.data;
            updateUser(freshUser);
          })
          .catch(() => {
            // Non-fatal — user can re-login to get the updated email in context
          });
      })
      .catch(err => {
        const code = err.response?.status;
        setMessage(err.response?.data?.message || 'Something went wrong.');
        if (code === 410)      setStatus(err.response?.data?.message?.includes('already been used') ? 'used' : 'expired');
        else if (code === 409) setStatus('conflict');
        else                   setStatus('invalid');
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

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
    used: (
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
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
      title: '✓ Email Updated Successfully',
      body:  `Your email address has been changed to ${newEmail}. You can now sign in with your new email.`,
    },
    expired: {
      title: 'Verification Link Expired',
      body:  message || 'This link has expired (24-hour limit). Go to Settings and request a new email change.',
    },
    used: {
      title: 'Link Already Used',
      body:  'This verification link has already been used. Your email was previously updated.',
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
            <div className="space-y-2">
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center justify-center gap-2 w-full
                  bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold
                  py-3 rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                Go to My Settings
              </button>
              <Link to="/login"
                className="inline-flex items-center justify-center gap-2 w-full
                  border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50
                  text-gray-600 text-sm font-semibold py-3 rounded-xl transition-colors">
                Sign in with new email
              </Link>
            </div>
          )}

          {status === 'used' && (
            <Link to="/settings"
              className="inline-flex items-center justify-center gap-2 w-full
                bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                py-3 rounded-xl transition-colors">
              Go to Settings
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
