/**
 * ProfilePage — /profile
 * All-roles page: view and edit the logged-in user's own profile.
 * Uses existing userService endpoints (no new backend routes needed).
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { userService } from '../services/userService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Avatar({ user, preview, size = 80 }) {
  const src = preview || user?.avatar_url;
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };
  if (src) return <img src={src} alt="Profile" style={style} />;
  return (
    <div style={{
      ...style,
      background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700,
    }}>
      {initials(user?.full_name)}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="profile-section">
      <div className="profile-section-title">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="profile-field">
      <label className="profile-field-label">{label}</label>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, updateUser, refreshUser } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef(null);

  // ── Info form
  const [name,     setName]     = useState(user?.full_name || '');
  const [email,    setEmail]    = useState(user?.email || '');
  const [phone,    setPhone]    = useState(user?.phone || '');
  const [infoSaving, setInfoSaving] = useState(false);

  // ── Photo
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoSaving,  setPhotoSaving]  = useState(false);

  // ── Password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError,  setPwError]  = useState('');
  const [showPw, setShowPw]     = useState({ current: false, next: false, confirm: false });

  // Sync state when user context updates (e.g. after avatar upload)
  useEffect(() => {
    setName(user?.full_name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
  }, [user?.full_name, user?.email, user?.phone]);

  // Revoke blob URL on unmount
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  // ── Info save
  const saveInfo = async (e) => {
    e.preventDefault();
    if (!name.trim()) return showToast('Name cannot be empty.', 'error');
    const trimEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) return showToast('Invalid email address.', 'error');
    setInfoSaving(true);
    try {
      const res = await userService.updateOwnProfile({ full_name: name.trim(), email: trimEmail, phone: phone.trim() || null });
      updateUser(res.data);
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setInfoSaving(false);
    }
  };

  // ── Photo pick
  const pickPhoto = () => fileRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      return showToast('Only JPEG, PNG, or WebP images are accepted.', 'error');
    }
    if (f.size > 3 * 1024 * 1024) {
      return showToast('Image must be under 3 MB.', 'error');
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };
  const discardPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null); setPhotoPreview(null);
  };
  const savePhoto = async () => {
    if (!photoFile || photoSaving) return;
    setPhotoSaving(true);
    try {
      const res = await userService.uploadAvatar(photoFile);
      updateUser({ avatar_url: res.data.avatar_url });
      discardPhoto();
      showToast('Profile photo updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Upload failed.', 'error');
    } finally {
      setPhotoSaving(false);
    }
  };
  const removePhoto = async () => {
    if (!user?.avatar_url) return;
    try {
      await userService.removeAvatar();
      updateUser({ avatar_url: null });
      showToast('Photo removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to remove photo.', 'error');
    }
  };

  // ── Password save
  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (!pw.current.trim()) return setPwError('Please enter your current password.');
    if (pw.next.length < 8) return setPwError('New password must be at least 8 characters.');
    if (!/[a-zA-Z]/.test(pw.next)) return setPwError('Password must contain at least one letter.');
    if (pw.next !== pw.confirm) return setPwError('Passwords do not match.');
    setPwSaving(true);
    try {
      await userService.changeOwnPassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      showToast('Password updated.', 'success');
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Password strength helper (shared logic)
  function pwStrength(val) {
    const hasLower  = /[a-z]/.test(val);
    const hasUpper  = /[A-Z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const hasSymbol = /[^A-Za-z0-9]/.test(val);
    const hasLetters = hasLower || hasUpper;
    const longEnough = val.length >= 8;
    let score = 0;
    if (longEnough)              score++;
    if (hasLetters && hasUpper)  score++;
    if (hasLetters && hasNumber) score++;
    if (hasLetters && hasSymbol) score++;
    if (!hasLetters) score = Math.min(score, 1);
    return { score, hasLetters, hasLower, hasUpper, hasNumber, hasSymbol, longEnough };
  }

  // ── Eye icon SVGs (replace emoji)
  const EyeOpen = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const EyeOff = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  const pwField = (key, label, ac) => {
    const isNewPw = key === 'next';
    const isConfirm = key === 'confirm';
    const val = pw[key];
    const st = isNewPw ? pwStrength(val) : null;
    const scoreLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const scoreColors = ['', '#F87171', '#FBBF24', '#34D399', '#0F766E'];
    const scoreCls    = ['', 'weak',   'fair',    'good',    'strong'];

    return (
      <Field label={label}>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw[key] ? 'text' : 'password'}
            className="profile-input"
            value={val}
            onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
            autoComplete={ac}
            style={{ paddingRight: 40 }}
          />
          <button type="button" className="profile-pw-toggle"
            onClick={() => setShowPw((s) => ({ ...s, [key]: !s[key] }))}
            aria-label={showPw[key] ? 'Hide password' : 'Show password'}>
            {showPw[key] ? <EyeOff /> : <EyeOpen />}
          </button>
        </div>

        {/* ── Strength bar + checklist for New Password ── */}
        {isNewPw && val.length > 0 && (() => {
          const { score, longEnough, hasLetters, hasUpper, hasNumber, hasSymbol } = st;
          const reqs = [
            { met: longEnough,  text: 'At least 8 characters' },
            { met: hasLetters,  text: 'Contains letters' },
            { met: hasUpper,    text: 'Uppercase letter (A–Z)' },
            { met: hasNumber,   text: 'Number (0–9)' },
            { met: hasSymbol,   text: 'Symbol (!@#$…)' },
          ];
          return (
            <div style={{ marginTop: 6 }}>
              {/* Bar */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: i <= score ? scoreColors[score] : 'var(--border)',
                    transition: 'background 0.25s',
                  }}/>
                ))}
              </div>
              {/* Label */}
              <div style={{
                fontSize: '0.7rem', textAlign: 'right', marginTop: 2,
                color: score > 0 ? scoreColors[score] : 'var(--text-muted)',
                fontWeight: 600,
              }}>
                {scoreLabels[score]}
              </div>
              {/* Requirements checklist */}
              <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {reqs.map(r => (
                  <li key={r.text} style={{
                    fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5,
                    color: r.met ? '#0F766E' : 'var(--text-muted)',
                  }}>
                    <span>{r.met ? '✓' : '○'}</span>
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* ── Match indicator for Confirm field ── */}
        {isConfirm && val.length > 0 && (
          <div style={{
            fontSize: '0.72rem', marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 4,
            color: pw.next === val ? '#0F766E' : '#F87171',
          }}>
            <span>{pw.next === val ? '✓' : '✗'}</span>
            {pw.next === val ? 'Passwords match' : 'Passwords do not match'}
          </div>
        )}
      </Field>
    );
  };

  return (
    <div className="profile-page">
      <h1 className="profile-page-title">My Profile</h1>

      {/* ── Photo ── */}
      <Section title="Profile Photo">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }} onChange={onFileChange} />
        <div className="profile-photo-row">
          <Avatar user={user} preview={photoPreview} size={80} />
          <div className="profile-photo-actions">
            <button type="button" className="btn-primary profile-btn-sm" onClick={pickPhoto} disabled={photoSaving}>
              {photoSaving ? 'Uploading…' : 'Change Photo'}
            </button>
            {photoFile && (
              <>
                <button type="button" className="btn-primary profile-btn-sm" onClick={savePhoto} disabled={photoSaving}>
                  {photoSaving ? 'Saving…' : 'Save Photo'}
                </button>
                <button type="button" className="btn-secondary profile-btn-sm" onClick={discardPhoto}>
                  Discard
                </button>
              </>
            )}
            {user?.avatar_url && !photoFile && (
              <button type="button" className="profile-remove-link" onClick={removePhoto}>
                Remove current photo
              </button>
            )}
          </div>
        </div>
        <p className="profile-photo-hint">JPEG, PNG or WebP · Max 3 MB</p>
      </Section>

      {/* ── Info ── */}
      <Section title="Account Information">
        <form onSubmit={saveInfo} noValidate>
          <div className="profile-read-row">
            <span className="profile-read-label">Role</span>
            <span className="profile-read-value" style={{ textTransform: 'capitalize' }}>
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
          <Field label="Full Name">
            <input className="profile-input" value={name}
              onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email Address">
            <input className="profile-input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone (optional)">
            <input className="profile-input" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <button type="submit" className="btn-primary profile-btn"
            disabled={infoSaving}>
            {infoSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </Section>

      {/* ── Password ── */}
      <Section title="Change Password">
        <form onSubmit={savePassword} noValidate>
          {pwError && <div className="profile-error">{pwError}</div>}
          {pwField('current', 'Current Password', 'current-password')}
          {pwField('next',    'New Password',     'new-password')}
          {pwField('confirm', 'Confirm New Password', 'new-password')}
          <button type="submit" className="btn-primary profile-btn" disabled={pwSaving}>
            {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </Section>
    </div>
  );
}
