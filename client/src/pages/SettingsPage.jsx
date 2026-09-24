import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { settingsService } from '../services/workflowService';
import { useToast } from '../hooks/useToast';
import { getAuthToken } from '../services/api';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { t } = useTranslation(['translation', 'settings']);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    settingsService.get()
      .then((res) => setSettings({
        ...res.data,
        orgName: res.data.orgName || '',
        orgLogoUrl: res.data.orgLogoUrl || '',
      }))
      .catch((err) => showToast(err.message || t('toasts.loadSettingsFailed'), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await settingsService.update({
        ...settings,
        orgName: (settings.orgName || '').trim(),
        orgLogoUrl: settings.orgLogoUrl || '',
      });
      setSettings(res.data);
      showToast(t('toasts.settingsSaved'), 'success');
    } catch (err) {
      showToast(err.message || t('toasts.saveSettingsFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Upload the organization logo via the shared logo endpoint, then persist its URL. */
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch(`${BASE_URL}/templates/upload-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || t('toasts.logoUploadFailed'));
      setSettings((prev) => ({ ...prev, orgLogoUrl: payload.data.url }));
      showToast(t('toasts.logoUploaded'), 'success');
    } catch (err) {
      showToast(err.message || t('toasts.logoUploadFailedToUpload'), 'error');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = () => setSettings((prev) => ({ ...prev, orgLogoUrl: '' }));

  if (!settings) return <div className="settings-page">{t('loading.settings')}</div>;

  return (
    <div className="settings-page">
      <h1>{t('page.settingsTitle')}</h1>

      <form className="template-form" onSubmit={handleSave} noValidate style={{ maxWidth: 520 }}>
        {/* ── Organization branding (used on the account invitation / set-password email) ── */}
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px', color: 'var(--brand-text)' }}>
          {t('branding.title')}
        </h2>
        <p className="settings-note">
          {t('branding.note')}
        </p>

        <div className="form-field">
          <label htmlFor="org-name">
            {t('branding.orgNameLabel')}
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>{t('branding.optionalDash')}</span>
          </label>
          <input
            id="org-name"
            value={settings.orgName || ''}
            onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
            placeholder={t('branding.orgNamePlaceholder')}
          />
        </div>

        <div className="form-field">
          <label htmlFor="org-logo">
            {t('branding.logoLabel')}
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>{t('branding.optionalDash')}</span>
          </label>

          {settings.orgLogoUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <img
                src={settings.orgLogoUrl}
                alt={t('branding.logoAlt')}
                style={{ maxWidth: 120, maxHeight: 48, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', padding: 4 }}
              />
              <button type="button" className="btn-danger" onClick={removeLogo} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                {t('branding.remove')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              style={{ fontSize: '0.85rem', padding: '8px 14px' }}
            >
              {uploadingLogo ? t('actions.uploading') : t('branding.uploadLogo')}
            </button>
          )}
          <input
            ref={logoInputRef}
            id="org-logo"
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            style={{ display: 'none' }}
          />
        </div>
        {/* ── Document lifecycle settings ── */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

        <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px', color: 'var(--brand-text)' }}>
          {t('lifecycle.title')}
        </h2>

        <div className="form-field">
          <label htmlFor="escalation-hours">{t('lifecycle.escalationLabel')}</label>
          <input
            id="escalation-hours"
            type="number"
            min={1}
            value={settings.escalationHours}
            onChange={(e) => setSettings({ ...settings, escalationHours: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="archive-years">{t('lifecycle.archiveYearsLabel')}</label>
          <input
            id="archive-years"
            type="number"
            min={1}
            value={settings.archiveYears}
            onChange={(e) => setSettings({ ...settings, archiveYears: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="minutes-saved">{t('lifecycle.minutesSavedLabel')}</label>
          <input
            id="minutes-saved"
            type="number"
            min={1}
            value={settings.minutesSavedPerDoc}
            onChange={(e) => setSettings({ ...settings, minutesSavedPerDoc: e.target.value })}
          />
        </div>

        <p className="settings-note">
          {t('lifecycle.note')}
        </p>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('actions.saving') : t('actions.saveSettings')}
        </button>
      </form>
    </div>
  );
}