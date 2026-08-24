import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axiosInstance from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext.jsx';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

function PasswordField({ label, name, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input type="password" name={name} value={value} onChange={onChange}
        className="w-full h-10 px-3.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const { setTheme } = useTheme();
  const { t } = useTranslation();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', language: 'en', theme: 'system', notification_email: true, session_timeout_minutes: 60 });
  const [password, setPassword] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [avatar,    setAvatar]    = useState(null);
  const [signature, setSignature] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    axiosInstance.get('/users/me/settings').then(({ data }) => {
      setForm(data);
      if (data.language) i18n.changeLanguage(data.language);
      if (data.theme) setTheme(data.theme);
    }).catch((err) => {
      const status = err.response?.status;
      if (status === 401) {
        // axiosInstance interceptor already redirects to /login — nothing to do here
      } else if (status === 403) {
        toast.error('You do not have permission to access settings.');
      } else if (status === 404) {
        toast.error('Settings not found. Please contact your administrator.');
      } else {
        toast.error(err.response?.data?.message || 'Could not load your settings. Please try again.');
      }
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ intentionally empty — runs once on mount only.
  // setTheme and toast are intentionally excluded: setTheme is stable (from context),
  // and toast is a new object on every render which would cause an infinite loop.

  const change = e => {
    const { name, value, type, checked } = e.target;
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'language') i18n.changeLanguage(value);
    if (name === 'theme') setTheme(value);
  };
  const saveProfile = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axiosInstance.put('/users/me/settings', { ...form, session_timeout_minutes: Number(form.session_timeout_minutes) });
      updateUser(data);
      toast.success(t('messages.settingsSaved'));
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save your settings'); }
    finally { setSaving(false); }
  };
  const uploadAvatar = async e => {
    e.preventDefault();
    if (!avatar) return;
    const body = new FormData();
    body.append('avatar', avatar);
    try {
      const { data } = await axiosInstance.post('/users/me/avatar', body);
      setForm(current => ({ ...current, avatar_url: data.avatar_url }));
      updateUser({ ...user, avatar_url: data.avatar_url });
      toast.success('Profile photo updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Could not upload profile photo'); }
  };

  const uploadSignature = async () => {
    if (!signature) return;
    setSigUploading(true);
    try {
      const body = new FormData();
      body.append('signature', signature);
      const { data } = await axiosInstance.post('/users/me/signature', body);
      setForm(current => ({ ...current, signature_url: data.signature_url }));
      updateUser({ ...user, signature_url: data.signature_url });
      toast.success('Signature image uploaded');
    } catch (err) { toast.error(err.response?.data?.message || 'Could not upload signature'); }
    finally { setSigUploading(false); }
  };
  const changePassword = async e => {
    e.preventDefault();
    if (password.new_password !== password.confirm_password) return toast.error(t('messages.passwordsMismatch'));
    setPasswordSaving(true);
    try {
      await axiosInstance.post('/users/change-password', { current_password: password.current_password, new_password: password.new_password });
      setPassword({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed successfully');
    } catch (err) { toast.error(err.response?.data?.message || 'Could not change password'); }
    finally { setPasswordSaving(false); }
  };

  if (loading) return <div className="text-sm text-gray-500">{t('settings.title')}...</div>;
  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1><p className="text-sm text-gray-400 mt-0.5">{t('settings.description')}</p></div>
      <form onSubmit={saveProfile} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div><h2 className="text-sm font-bold text-gray-800">{t('settings.profile')}</h2><p className="text-xs text-gray-400 mt-1">{t('settings.profileDescription')}</p></div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 overflow-hidden flex items-center justify-center flex-shrink-0">
            {form.avatar_url ? <img src={form.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-lg font-bold text-white">{(form.full_name || user?.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>}
          </div>
          <div><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setAvatar(e.target.files?.[0] || null)} className="text-xs text-gray-500" /><button type="button" onClick={uploadAvatar} className="block mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">{t('settings.uploadPhoto')}</button></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-gray-700">{t('settings.name')}<input name="full_name" value={form.full_name} onChange={change} className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg border border-gray-300" /></label>
          <label className="text-sm font-medium text-gray-700">{t('settings.email')}<input type="email" name="email" value={form.email} onChange={change} className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg border border-gray-300" /></label>
          <label className="text-sm font-medium text-gray-700">{t('settings.phone')}<input name="phone" value={form.phone || ''} onChange={change} className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg border border-gray-300" /></label>
          <label className="text-sm font-medium text-gray-700">{t('settings.language')}<select name="language" value={form.language} onChange={change} className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg border border-gray-300"><option value="en">{t('actions.english')}</option><option value="am">{t('actions.amharic')}</option></select></label>
          <label className="text-sm font-medium text-gray-700">{t('settings.theme')}<select name="theme" value={form.theme} onChange={change} className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg border border-gray-300"><option value="system">{t('settings.systemDefault')}</option><option value="light">{t('settings.light')}</option><option value="dark">{t('settings.dark')}</option></select></label>
          <label className="text-sm font-medium text-gray-700">{t('settings.sessionTimeout')}<input type="number" min="5" max="1440" name="session_timeout_minutes" value={form.session_timeout_minutes} onChange={change} className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-lg border border-gray-300" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="notification_email" checked={!!form.notification_email} onChange={change} /> {t('settings.emailNotifications')}</label>
        <button disabled={saving} className="h-10 px-5 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{saving ? t('settings.saving') : t('settings.save')}</button>
      </form>
      {/* ── Signature Image ─────────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
            My Signature Image
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            This signature image will be embedded in every document you approve.
            Upload a scanned handwritten signature on a white or transparent background.
          </p>
        </div>

        <div className="flex items-start gap-5">
          {/* Preview box */}
          <div className="w-48 h-24 rounded-xl border-2 border-dashed border-[var(--color-border)]
            bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden flex-shrink-0">
            {(signaturePreview || form.signature_url)
              ? <img
                  src={signaturePreview || `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${form.signature_url}`}
                  alt="Signature" className="max-w-full max-h-full object-contain p-2"/>
              : <div className="text-center space-y-1">
                  <svg className="w-6 h-6 text-[var(--color-text-secondary)] mx-auto" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">No signature</p>
                </div>
            }
          </div>

          {/* Upload controls */}
          <div className="flex-1 space-y-3">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSignature(file);
                setSignaturePreview(URL.createObjectURL(file));
              }}
              className="text-xs text-[var(--color-text-secondary)]
                file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0
                file:bg-indigo-50 file:text-[#3b5bdb] file:font-semibold file:text-xs
                hover:file:bg-indigo-100 transition-all"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              PNG or JPEG · max 2 MB · white or transparent background recommended
            </p>
            {signature && (
              <button
                type="button"
                onClick={uploadSignature}
                disabled={sigUploading}
                className="flex items-center gap-2 bg-[#3b5bdb] hover:bg-[#2f4ac4]
                  text-white text-sm font-semibold px-4 py-2 rounded-xl
                  disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200"
              >
                {sigUploading
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>Uploading…</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                      </svg>Upload Signature</>
                }
              </button>
            )}
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-start gap-2">
          <svg className="w-4 h-4 text-[#3b5bdb] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-xs text-[#3b5bdb]/80">
            Use <code className="bg-white px-1 rounded font-mono">{'{{approver.signature_image}}'}</code> in
            your template footer to automatically insert this signature when you approve a document.
          </p>
        </div>
      </div>

      <form onSubmit={changePassword} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div><h2 className="text-sm font-bold text-gray-800">{t('settings.password')}</h2><p className="text-xs text-gray-400 mt-1">{t('settings.passwordDescription')}</p></div>
        <div className="grid sm:grid-cols-3 gap-4"><PasswordField label={t('settings.currentPassword')} name="current_password" value={password.current_password} onChange={e => setPassword({ ...password, [e.target.name]: e.target.value })} /><PasswordField label={t('settings.newPassword')} name="new_password" value={password.new_password} onChange={e => setPassword({ ...password, [e.target.name]: e.target.value })} /><PasswordField label={t('settings.confirmPassword')} name="confirm_password" value={password.confirm_password} onChange={e => setPassword({ ...password, [e.target.name]: e.target.value })} /></div>
        <button disabled={passwordSaving} className="h-10 px-5 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{passwordSaving ? t('settings.saving') : t('settings.updatePassword')}</button>
      </form>
    </div>
  );
}
