import { useEffect, useState } from 'react';
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
  const [password, setPassword] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });
  const [avatar,         setAvatar]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

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
    // Reset verification banner if the user edits the email field again
    if (name === 'email') { setPendingEmail(null); setEmailVerifySent(false); }
  };

  // ── Save profile ───────────────────────────────────────────────────────────
  const saveProfile = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axiosInstance.put('/users/me/settings', {
        ...form,
        session_timeout_minutes: Number(form.session_timeout_minutes),
      });

      if (data.email_verify_sent) {
        // Email changed — verification sent to new address
        setPendingEmail(data.pending_email);
        setEmailVerifySent(true);
        // Keep form email as current (unverified) email
        setForm(cur => ({ ...cur, email: user?.email || cur.email }));
        toast.success(`Verification email sent to ${data.pending_email}`);
      } else {
        updateUser(data);
        toast.success(t('messages.settingsSaved'));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your settings');
    } finally {
      setSaving(false);
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
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200
          rounded-2xl px-5 py-4">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center
            flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">
              {emailVerifySent ? 'Verification email sent' : 'Email change pending verification'}
            </p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              A verification link was sent to{' '}
              <span className="font-bold font-mono">{pendingEmail}</span>.
              Your email address will only change after you click that link.
              The link expires in 24 hours.
            </p>
            <p className="text-[11px] text-amber-600 mt-1.5">
              Your current login email{' '}
              <span className="font-mono font-semibold">{form.email}</span>{' '}
              remains active until verified.
            </p>
          </div>
          <button
            onClick={() => { setPendingEmail(null); setEmailVerifySent(false); }}
            className="text-amber-400 hover:text-amber-600 flex-shrink-0 mt-0.5"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
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

          {/* Email — special treatment */}
          <div className="text-sm font-medium text-[var(--color-text-primary)]">
            <label className="block mb-1.5">{t('settings.email')}</label>
            <div className="relative">
              <input
                type="email" name="email" value={form.email} onChange={change}
                className="w-full h-10 pl-3.5 pr-10 text-sm rounded-lg
                  border bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  focus:outline-none focus:ring-2 transition
                  border-[var(--color-border)] focus:ring-indigo-200 focus:border-indigo-400"/>
              {/* Lock icon when pending */}
              {pendingEmail && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center
                  pointer-events-none">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
              )}
            </div>
            {/* Hint below email field */}
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              Changing email requires verification via a link sent to the new address.
              The domain must be a real mail server.
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
