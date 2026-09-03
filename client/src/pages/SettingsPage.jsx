import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axiosInstance from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext.jsx';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

function PasswordField({ label, name, value, onChange, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          className="w-full h-10 pl-3.5 pr-10 text-sm rounded-lg border border-gray-300
            bg-white text-gray-900 focus:outline-none focus:ring-2
            focus:ring-blue-100 focus:border-blue-400"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center
            text-gray-400 hover:text-gray-600"
        >
          {show
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
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const toast    = useToast();
  const { setTheme } = useTheme();
  const { t }    = useTranslation();

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    language: 'en', theme: 'system',
    notification_email: true, session_timeout_minutes: 60,
  });
  const [pendingEmail,    setPendingEmail]    = useState(null);  // new email awaiting verification
  const [emailVerifySent, setEmailVerifySent] = useState(false); // just sent this session
  const [newEmailInput,   setNewEmailInput]   = useState('');    // typed in the change-email field
  const [emailChanging,   setEmailChanging]   = useState(false); // loading state for email change
  const [emailCancelling, setEmailCancelling] = useState(false); // loading state for cancel
  const [emailResending,  setEmailResending]  = useState(false); // loading state for resend
  const [password, setPassword] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });
  const [avatar,         setAvatar]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  // Guard: prevent double-fire from double-click or React StrictMode
  const savingRef = useRef(false);

  // ── Load settings ──────────────────────────────────────────────────────────
  useEffect(() => {
    axiosInstance.get('/users/me/settings')
      .then(({ data }) => {
        setForm(data);
        setPendingEmail(data.pending_email || null);
        if (data.language) i18n.changeLanguage(data.language);
        if (data.theme)    setTheme(data.theme);
      })
      .catch(err => {
        const status = err.response?.status;
        if (status === 403) toast.error('You do not have permission to access settings.');
        else if (status === 404) toast.error('Settings not found. Please contact your administrator.');
        else toast.error(err.response?.data?.message || 'Could not load your settings.');
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = e => {
    const { name, value, type, checked } = e.target;
    setForm(cur => ({ ...cur, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'language') i18n.changeLanguage(value);
    if (name === 'theme')    setTheme(value);
  };

  // ── Save profile (name, phone, prefs ONLY — never touches email) ───────────
  const saveProfile = async e => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      // Deliberately exclude email — email has its own dedicated endpoint
      const { data } = await axiosInstance.put('/users/me/settings', {
        full_name:               form.full_name,
        phone:                   form.phone,
        language:                form.language,
        theme:                   form.theme,
        notification_email:      form.notification_email,
        session_timeout_minutes: Number(form.session_timeout_minutes),
      });
      updateUser(data);
      toast.success(t('messages.settingsSaved'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your settings');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  // ── Submit email change (dedicated endpoint, separate from profile save) ───
  const submitEmailChange = async () => {
    const trimmed = newEmailInput.trim();
    if (!trimmed) { toast.error('Please enter a new email address'); return; }
    if (trimmed === form.email) { toast.error('That is already your current email address'); return; }
    setEmailChanging(true);
    try {
      const { data } = await axiosInstance.post('/users/me/change-email', { email: trimmed });
      setPendingEmail(data.pending_email);
      setEmailVerifySent(true);
      setNewEmailInput('');
      toast.success(`Verification email sent to ${data.pending_email}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not request email change');
    } finally {
      setEmailChanging(false);
    }
  };

  // ── Cancel pending email change ────────────────────────────────────────────
  const cancelEmailChange = async () => {
    setEmailCancelling(true);
    try {
      await axiosInstance.post('/users/me/cancel-email-change');
      setPendingEmail(null);
      setEmailVerifySent(false);
      setNewEmailInput('');
      toast.success('Email change cancelled. Your current email remains active.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel email change');
    } finally {
      setEmailCancelling(false);
    }
  };

  // ── Resend verification email ──────────────────────────────────────────────
  const resendEmailVerification = async () => {
    setEmailResending(true);
    try {
      const { data } = await axiosInstance.post('/users/me/resend-email-verification');
      toast.success(`New verification email sent to ${data.pending_email}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend verification email');
    } finally {
      setEmailResending(false);
    }
  };

  // ── Upload avatar ──────────────────────────────────────────────────────────
  const uploadAvatar = async e => {
    e.preventDefault();
    if (!avatar) return;
    const body = new FormData();
    body.append('avatar', avatar);
    try {
      const { data } = await axiosInstance.post('/users/me/avatar', body);
      setForm(cur => ({ ...cur, avatar_url: data.avatar_url }));
      updateUser({ ...user, avatar_url: data.avatar_url });
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not upload profile photo');
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const changePassword = async e => {
    e.preventDefault();
    if (password.new_password !== password.confirm_password) {
      return toast.error(t('messages.passwordsMismatch'));
    }
    if (password.new_password.length < 8) {
      return toast.error('New password must be at least 8 characters');
    }
    setPasswordSaving(true);
    try {
      await axiosInstance.post('/users/change-password', {
        current_password: password.current_password,
        new_password:     password.new_password,
      });
      setPassword({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed — a confirmation email has been sent to your address');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-10">
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {t('settings.title')}…
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          {t('settings.description')}
        </p>
      </div>

      {/* ── Pending email verification banner ─────────────────────────────── */}
      {pendingEmail && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center
              flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">
                Verification email sent
              </p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                A verification link was sent to{' '}
                <span className="font-bold font-mono">{pendingEmail}</span>.
                Your email only changes after you click that link.
                Link expires in 24 hours.
              </p>
              <p className="text-[11px] text-amber-600 mt-1">
                Current login email{' '}
                <span className="font-mono font-semibold">{form.email}</span>{' '}
                remains active until verified.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pl-11">
            <button
              type="button"
              onClick={resendEmailVerification}
              disabled={emailResending || emailCancelling}
              className="inline-flex items-center gap-1.5 text-xs font-semibold
                px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700
                bg-white hover:bg-amber-50 disabled:opacity-50 transition-colors">
              {emailResending
                ? <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
              }
              {emailResending ? 'Sending…' : 'Resend Email'}
            </button>

            <button
              type="button"
              onClick={cancelEmailChange}
              disabled={emailCancelling || emailResending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold
                px-3 py-1.5 rounded-lg border border-red-200 text-red-600
                bg-white hover:bg-red-50 disabled:opacity-50 transition-colors">
              {emailCancelling
                ? <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
              }
              {emailCancelling ? 'Cancelling…' : 'Cancel Change'}
            </button>
          </div>
        </div>
      )}

      {/* ── Profile form ───────────────────────────────────────────────────── */}
      <form onSubmit={saveProfile}
        className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
          shadow-sm p-6 space-y-5">

        <div>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('settings.profile')}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {t('settings.profileDescription')}
          </p>
        </div>

        {/* Avatar row */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 overflow-hidden
            flex items-center justify-center flex-shrink-0">
            {form.avatar_url
              ? <img src={form.avatar_url} alt="Profile" className="w-full h-full object-cover"/>
              : <span className="text-lg font-bold text-white">
                  {(form.full_name || user?.full_name || 'U')
                    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
            }
          </div>
          <div>
            <input
              type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e => setAvatar(e.target.files?.[0] || null)}
              className="text-xs text-[var(--color-text-secondary)]"/>
            <button type="button" onClick={uploadAvatar}
              className="block mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">
              {t('settings.uploadPhoto')}
            </button>
          </div>
        </div>

        {/* Fields grid */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Full name */}
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('settings.name')}
            <input
              name="full_name" value={form.full_name} onChange={change}
              className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg
                border border-[var(--color-border)] bg-[var(--color-bg)]
                text-[var(--color-text-primary)] focus:outline-none
                focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"/>
          </label>

          {/* Email — dedicated change-email section, NOT part of profile save */}
          <div className="text-sm font-medium text-[var(--color-text-primary)] sm:col-span-2">
            <label className="block mb-1.5">{t('settings.email')}</label>

            {/* Current email — read-only display */}
            <div className="flex items-center gap-2 h-10 px-3.5 rounded-lg border
              border-[var(--color-border)] bg-[var(--color-surface-raised)]
              text-[var(--color-text-secondary)] text-sm mb-2">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span className="font-medium text-[var(--color-text-primary)]">{form.email}</span>
              <span className="ml-auto text-[10px] text-emerald-600 font-semibold
                bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Current
              </span>
            </div>

            {/* Change email input + button */}
            {!pendingEmail ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmailInput}
                  onChange={e => setNewEmailInput(e.target.value)}
                  placeholder="Enter new email address…"
                  onKeyDown={e => e.key === 'Enter' && submitEmailChange()}
                  className="flex-1 h-10 px-3.5 text-sm rounded-lg border
                    border-[var(--color-border)] bg-[var(--color-bg)]
                    text-[var(--color-text-primary)]
                    placeholder-[var(--color-text-secondary)]
                    focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400
                    transition"
                />
                <button
                  type="button"
                  onClick={submitEmailChange}
                  disabled={emailChanging || !newEmailInput.trim()}
                  className="h-10 px-4 rounded-lg bg-[#3b5bdb] hover:bg-[#2f4ac4]
                    text-white text-xs font-bold disabled:opacity-40 transition
                    flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
                  {emailChanging
                    ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                  }
                  {emailChanging ? 'Sending…' : 'Change Email'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-amber-50 border
                border-amber-200 rounded-lg px-3.5 py-2.5">
                <p className="text-xs text-amber-700">
                  Awaiting verification of{' '}
                  <span className="font-mono font-bold">{pendingEmail}</span>
                </p>
                <button
                  type="button"
                  onClick={cancelEmailChange}
                  disabled={emailCancelling}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold
                    underline ml-3 flex-shrink-0 disabled:opacity-50">
                  {emailCancelling ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            )}
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">
              The system validates that the new email domain is real before sending the link.
              Your current email remains active until you click the verification link.
            </p>
          </div>

          {/* Phone */}
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('settings.phone')}
            <input
              name="phone" value={form.phone || ''} onChange={change}
              className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg
                border border-[var(--color-border)] bg-[var(--color-bg)]
                text-[var(--color-text-primary)] focus:outline-none
                focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"/>
          </label>

          {/* Language */}
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('settings.language')}
            <select
              name="language" value={form.language} onChange={change}
              className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg
                border border-[var(--color-border)] bg-[var(--color-bg)]
                text-[var(--color-text-primary)] focus:outline-none">
              <option value="en">{t('actions.english')}</option>
              <option value="am">{t('actions.amharic')}</option>
            </select>
          </label>

          {/* Theme */}
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('settings.theme')}
            <select
              name="theme" value={form.theme} onChange={change}
              className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg
                border border-[var(--color-border)] bg-[var(--color-bg)]
                text-[var(--color-text-primary)] focus:outline-none">
              <option value="system">{t('settings.systemDefault')}</option>
              <option value="light">{t('settings.light')}</option>
              <option value="dark">{t('settings.dark')}</option>
            </select>
          </label>

          {/* Session timeout */}
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('settings.sessionTimeout')}
            <input
              type="number" min="5" max="1440"
              name="session_timeout_minutes"
              value={form.session_timeout_minutes} onChange={change}
              className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg
                border border-[var(--color-border)] bg-[var(--color-bg)]
                text-[var(--color-text-primary)] focus:outline-none
                focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"/>
          </label>
        </div>

        {/* Email notifications checkbox */}
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input
            type="checkbox" name="notification_email"
            checked={!!form.notification_email} onChange={change}
            className="rounded"/>
          {t('settings.emailNotifications')}
        </label>

        <button
          disabled={saving}
          className="h-10 px-6 rounded-xl bg-[#3b5bdb] hover:bg-[#2f4ac4]
            text-white text-sm font-bold disabled:opacity-50 transition-colors">
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </form>

      {/* ── Change password ────────────────────────────────────────────────── */}
      <form onSubmit={changePassword}
        className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
          shadow-sm p-6 space-y-4">

        <div>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('settings.password')}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {t('settings.passwordDescription')}
          </p>
        </div>

        {/* Info banner — password change sends email */}
        <div className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-100
          rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-[#3b5bdb] flex-shrink-0" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-xs text-[#3b5bdb]/80">
            After changing your password, a security confirmation email will be
            sent to <span className="font-semibold">{form.email}</span>.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <PasswordField
            label={t('settings.currentPassword')}
            name="current_password"
            value={password.current_password}
            onChange={e => setPassword({ ...password, [e.target.name]: e.target.value })}
          />
          <PasswordField
            label={t('settings.newPassword')}
            name="new_password"
            value={password.new_password}
            onChange={e => setPassword({ ...password, [e.target.name]: e.target.value })}
            hint="Minimum 8 characters"
          />
          <PasswordField
            label={t('settings.confirmPassword')}
            name="confirm_password"
            value={password.confirm_password}
            onChange={e => setPassword({ ...password, [e.target.name]: e.target.value })}
            hint={
              password.confirm_password && password.new_password !== password.confirm_password
                ? '⚠ Passwords do not match'
                : password.confirm_password && password.new_password === password.confirm_password
                ? '✓ Passwords match'
                : ''
            }
          />
        </div>

        <button
          disabled={passwordSaving}
          className="h-10 px-6 rounded-xl bg-gray-900 hover:bg-gray-800
            text-white text-sm font-bold disabled:opacity-50 transition-colors">
          {passwordSaving ? t('settings.saving') : t('settings.updatePassword')}
        </button>
      </form>

    </div>
  );
}
