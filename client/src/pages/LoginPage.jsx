import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useForm, required, email as emailRule } from '../hooks/useForm';
import axiosInstance from '../api/axiosInstance';

const RULES = {
  email:    [required('Email is required'), emailRule('Enter a valid email address')],
  password: [required('Please enter your password')],
};

export default function LoginPage() {
  const { login }         = useAuth();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();
  const redirectTo        = searchParams.get('redirect') || '/dashboard';
  const toast             = useToast();
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { values, errors, touched, handleChange, handleBlur, validateAll } = useForm(
    { email: '', password: '' }, RULES
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/login', values);
      login(res.data.user, res.data.token);
      toast.success(`Welcome, ${res.data.user.full_name}`);
      // Redirect to the ?redirect= param if present, otherwise /dashboard
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const hasError = (field) => touched[field] && errors[field];

  return (
    <div className="relative min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center px-4
      transition-colors duration-200">

      {/* Back to Home */}
      <Link
        to="/"
        className="absolute left-5 top-5 inline-flex items-center gap-2 text-sm
          text-[var(--color-text-secondary)] hover:text-[#3b5bdb]
          transition-colors sm:left-8 sm:top-8"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        <span>Back to Home</span>
      </Link>

      <div className="w-full max-w-[360px]">

        {/* Header */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="DocuVault"
            className="mx-auto mb-5 h-20 w-20 object-contain" />
          <h1 className="text-[22px] font-semibold text-[var(--color-text-primary)] tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1.5 font-normal">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
          shadow-sm px-8 py-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email"
                className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="you@example.com"
                autoComplete="email"
                className={`w-full h-10 px-3.5 text-sm rounded-lg border
                  bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  placeholder-[var(--color-text-secondary)]
                  focus:outline-none focus:ring-2 transition-all
                  ${hasError('email')
                    ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                    : 'border-[var(--color-border)] focus:ring-indigo-100 focus:border-indigo-400'
                  }`}
              />
              {hasError('email') && (
                <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password"
                className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full h-10 pl-3.5 pr-10 text-sm rounded-lg border
                    bg-[var(--color-bg)] text-[var(--color-text-primary)]
                    placeholder-[var(--color-text-secondary)]
                    focus:outline-none focus:ring-2 transition-all
                    ${hasError('password')
                      ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                      : 'border-[var(--color-border)] focus:ring-indigo-100 focus:border-indigo-400'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center
                    text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                    transition-colors"
                  tabIndex={-1}
                >
                  {showPass
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      </svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                  }
                </button>
              </div>
              {hasError('password') && (
                <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#3b5bdb] hover:bg-[#2f4ac4] active:bg-[#2640b0]
                text-white text-sm font-medium rounded-lg
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>Signing in…</>
                : 'Sign in'
              }
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
