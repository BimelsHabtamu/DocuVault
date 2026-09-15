import { useEffect, useRef, useState } from 'react';
import { settingsService } from '../services/workflowService';
import { useToast } from '../hooks/useToast';
import { getAuthToken } from '../services/api';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export default function SettingsPage() {
  const { showToast } = useToast();
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
      .catch((err) => showToast(err.message || 'Failed to load settings.', 'error'));
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
      showToast('Settings saved.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
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
      if (!res.ok) throw new Error(payload.message || 'Logo upload failed.');
      setSettings((prev) => ({ ...prev, orgLogoUrl: payload.data.url }));
      showToast('Logo uploaded — save settings to keep it.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to upload logo.', 'error');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = () => setSettings((prev) => ({ ...prev, orgLogoUrl: '' }));

  if (!settings) return <div className="settings-page">Loading settings…</div>;

  return (
    <div className="settings-page">
      <h1>System Settings</h1>

      <form className="template-form" onSubmit={handleSave} noValidate style={{ maxWidth: 520 }}>
        {/* ── Organization branding (used on the account invitation / set-password email) ── */}
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px', color: 'var(--brand-text)' }}>
          Organization Branding
        </h2>
        <p className="settings-note">
          Used to personalize the welcome email sent to newly created accounts. Keep
          empty to use the organization typed on each invitation instead.
        </p>

        <div className="form-field">
          <label htmlFor="org-name">
            Organization / Company / Institution name
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>— optional</span>
          </label>
          <input
            id="org-name"
            value={settings.orgName || ''}
            onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
            placeholder="e.g. Your Organization's Name"
          />
        </div>

        <div className="form-field">
          <label htmlFor="org-logo">
            Organization logo
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>— optional</span>
          </label>

          {settings.orgLogoUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <img
                src={settings.orgLogoUrl}
                alt="Organization logo"
                style={{ maxWidth: 120, maxHeight: 48, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', padding: 4 }}
              />
              <button type="button" className="btn-danger" onClick={removeLogo} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                Remove
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
              {uploadingLogo ? 'Uploading…' : 'Upload logo'}
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
          Document Lifecycle
        </h2>

        <div className="form-field">
          <label htmlFor="escalation-hours">Escalation reminder threshold (hours)</label>
          <input
            id="escalation-hours"
            type="number"
            min={1}
            value={settings.escalationHours}
            onChange={(e) => setSettings({ ...settings, escalationHours: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="archive-years">Auto-archive documents older than (years)</label>
          <input
            id="archive-years"
            type="number"
            min={1}
            value={settings.archiveYears}
            onChange={(e) => setSettings({ ...settings, archiveYears: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label htmlFor="minutes-saved">Estimated minutes saved per document (for reports)</label>
          <input
            id="minutes-saved"
            type="number"
            min={1}
            value={settings.minutesSavedPerDoc}
            onChange={(e) => setSettings({ ...settings, minutesSavedPerDoc: e.target.value })}
          />
        </div>

        <p className="settings-note">
          Note: OTP expiry (5 min), max attempts (3), and lockout duration (15 min) are fixed
          business rules (BR-004) and aren't configurable here by design.
        </p>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}