import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';

export default function SetPasswordPage() {
  const [searchParams]  = useSearchParams();
  const token           = searchParams.get('token') || '';
  const navigate        = useNavigate();
  const { login }       = useAuth();

  // Token validation state
  const [tokenState, setTokenState] = useState('loading'); // loading | valid | invalid | expired
  const [tokenInfo,  setTokenInfo]  = useState(null);       // { email, full_name, doc_uuid }

  // Form state
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  // ── Validate token on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setTokenState('invalid'); return; }

    axiosInstance.get(`/auth/validate-token?token=${encodeURIComponent(token)}`)
      .then(res => {
        setTokenInfo(res.data);
        setTokenState('valid');
      })
      .catch(err => {
        const status = err.response?.status;
        setTokenState(status === 410 ? 'expired' : 'invalid');
      });
  }, [token]);

  // ── Password strength helper ──────────────────────────────────────────────
  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)  s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'][strength];

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    try {
      const res = await axiosInstance.post('/auth/set-password', { token, password });
      // Auto-login with the JWT returned by the server
      login(res.data.user, res.data.token);
      // Redirect to the specific doc if available, otherwise inbox
      const dest = res.data.doc_uuid
        ? `/my-documents/${res.data.doc_uuid}`
        : '/my-documents';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (tokenState === 'loading') {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-[#3b5bdb]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm text-gray-500">Validating your link…</p>
        </div>
      </div>
    );
  }

  // ── Invalid / Expired ─────────────────────────────────────────────────────
  if (tokenState === 'invalid' || tokenState === 'expired') {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {tokenState === 'expired' ? 'Link Expired' : 'Invalid Link'}
            </h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {tokenState === 'expired'
                ? 'This set-password link has expired (48-hour limit). Please contact the person who sent you the document to resend it.'
                : 'This link is invalid or has already been used. Please contact the sender.'
              }
            </p>
          </div>
          <a href="/"
            className="inline-flex items-center gap-2 text-sm text-[#3b5bdb] font-semibold hover:underline">
            ← Return to Home
          </a>
        </div>
      </div>
    );
  }

  // ── Valid — show form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f8fc] flex flex-col items-center justify-center px-4 py-12">

      <div className="w-full max-w-[380px] space-y-6">

        {/* Logo + header */}
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="DocuVault" className="h-16 w-16 object-contain mx-auto"/>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Your Password</h1>
            <p className="text-sm text-gray-500 mt-1">
              Welcome, <strong>{tokenInfo?.full_name || tokenInfo?.email}</strong>
            </p>
          </div>
        </div>

        {/* Document preview badge */}
        {tokenInfo?.doc_uuid && (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100
            rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-[#3b5bdb] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-indigo-600 font-semibold">Document ready for you</p>
              <p className="font-mono text-xs text-[#3b5bdb] truncate">{tokenInfo.doc_uuid}</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-7 py-7 space-y-5">

          <p className="text-xs text-gray-500 leading-relaxed">
            Set a secure password to activate your DocuVault account. After setting your password
            you will be taken directly to your document.
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full h-10 pl-3.5 pr-10 text-sm border border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400
                    bg-gray-50 transition"
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                  {showPass
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
              {/* Strength meter */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i}
                        className={`flex-1 h-1 rounded-full transition-all duration-300
                          ${i <= strength ? strengthColor : 'bg-gray-200'}`}/>
                    ))}
                  </div>
                  <p className={`text-[10px] font-semibold ${
                    strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-amber-500'
                    : strength === 3 ? 'text-blue-500' : 'text-emerald-600'
                  }`}>{strengthLabel}</p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConf ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(''); }}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className={`w-full h-10 pl-3.5 pr-10 text-sm border rounded-xl
                    focus:outline-none focus:ring-2 transition bg-gray-50
                    ${confirm && confirm !== password
                      ? 'border-red-300 focus:ring-red-200'
                      : confirm && confirm === password
                      ? 'border-emerald-300 focus:ring-emerald-200'
                      : 'border-gray-200 focus:ring-indigo-200 focus:border-indigo-400'
                    }`}
                />
                <button type="button" onClick={() => setShowConf(p => !p)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                  {showConf
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
              {confirm && confirm === password && (
                <p className="text-xs text-emerald-600 mt-1">✓ Passwords match</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !password || !confirm}
              className="w-full h-11 bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white text-sm font-bold
                rounded-xl disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 transition-colors mt-1"
            >
              {submitting
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>Setting password…</>
                : 'Set Password & Access My Document →'
              }
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          Already have an account?{' '}
          <a href="/login" className="text-[#3b5bdb] font-semibold hover:underline">Sign in</a>
        </p>

      </div>
    </div>
  );
}
