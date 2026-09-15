import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { userService } from '../../services/userService';

// ── Helpers ───────────────────────────────────────────────────────────────────
function initialsFor(n) {
  if (!n) return '?';
  const p = n.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function Avatar({ user, previewUrl, size = 34 }) {
  const s = { width: size, height: size, fontSize: size * 0.38, flexShrink: 0 };
  const src = previewUrl || user?.avatar_url;
  return src
    ? <img src={src} alt="" className="user-avatar-img" style={s} />
    : <div className="user-avatar-fallback" style={s} aria-hidden="true">{initialsFor(user?.full_name)}</div>;
}

// ── SVG icons (inline, currentColor) ─────────────────────────────────────────
const Ic = ({ d, d2, circle, cx, cy, r, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {d  && <path d={d}  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>}
    {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>}
    {circle && <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth="1.8"/>}
  </svg>
);

const IconPerson = () => <Ic d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" d2="M4 20c.5-3.5 3.6-6 8-6s7.5 2.5 8 6"/>;
const IconPower  = () => <Ic d="M12 4v7" d2="M6.5 7C4.9 8.6 4 10.7 4 13a8 8 0 0 0 16 0c0-2.3-.9-4.4-2.5-6"/>;
const IconX      = () => <Ic d="M6 6l12 12M18 6L6 18"/>;
const IconCamera = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 8.5C4 7.4 4.9 6.5 6 6.5H8l1.2-1.7c.4-.5 1-.8 1.6-.8h2.4c.6 0 1.2.3 1.6.8L16 6.5h2c1.1 0 2 .9 2 2V17c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    <circle cx="12" cy="12.5" r="3.4" stroke="currentColor" strokeWidth="1.7"/>
  </svg>
);
const IconEye    = () => <Ic d="M2.5 12C4.5 7.5 8 5 12 5s7.5 2.5 9.5 7-5.5 7-9.5 7-7.5-2.5-9.5-7z" circle cx="12" cy="12" r="3"/>;
const IconEyeOff = () => <Ic d="M3 3l18 18M9.9 5.3C10.6 5.1 11.3 5 12 5c4 0 7.5 2.5 9.5 7a16 16 0 0 1-2.3 3.6M6.5 6.7C4.7 7.9 3.3 9.7 2.5 12c2 4.5 5.5 7 9.5 7 1.2 0 2.4-.2 3.4-.7"/>;

const emptyPw = { current: '', next: '', confirm: '' };

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '8px 38px 8px 11px',
  border: '1.5px solid var(--border-strong)', borderRadius: 8,
  fontSize: '0.86rem', fontFamily: 'inherit',
  background: 'var(--bg-subtle)', color: 'var(--text-primary)',
  boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s',
};

// ── Thin button base ──────────────────────────────────────────────────────────
const btnBase = {
  border: 'none', borderRadius: 7, fontFamily: 'inherit',
  fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
  padding: '8px 0', transition: 'opacity 0.15s',
};

// =============================================================================
export default function SidebarUserMenu() {
  const { user, logout, updateUser } = useAuth();
  const { showToast }                = useToast();
  const navigate                     = useNavigate();

  // 'closed' | 'menu' | 'profile'
  const [view, setView] = useState('closed');

  // Photo
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [savingPh, setSavingPh] = useState(false);
  const [removePh, setRemovePh] = useState(false);

  // Password
  const [pw,      setPw]      = useState(emptyPw);
  const [pwBusy,  setPwBusy]  = useState(false);
  const [pwErr,   setPwErr]   = useState(null);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);

  const wrapRef = useRef(null);
  const fileRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setView('closed');
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Revoke blob URL on unmount
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!user) return null;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const resetPhoto = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null);
  };
  const resetPw = () => {
    setPw(emptyPw); setPwErr(null);
    setShowCur(false); setShowNew(false); setShowCon(false);
  };
  const openProfile = () => { setView('profile'); resetPhoto(); resetPw(); };
  const closeAll    = () => { setView('closed'); resetPhoto(); resetPw(); };

  const handleLogout = async () => {
    closeAll();
    await logout();
    navigate('/login', { replace: true });
  };

  const pickFile = () => fileRef.current?.click();

  const onFileChange = (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const savePhoto = async () => {
    if (!file || savingPh) return;
    setSavingPh(true);
    try {
      const res = await userService.uploadAvatar(file);
      updateUser({ avatar_url: res.data.avatar_url });
      showToast('Profile photo updated.', 'success');
      resetPhoto();
    } catch (err) {
      showToast(err.message || 'Upload failed.', 'error');
    } finally { setSavingPh(false); }
  };

  const removePhoto = async () => {
    if (!user.avatar_url || removePh) return;
    setRemovePh(true);
    try {
      await userService.removeAvatar();
      updateUser({ avatar_url: null });
      showToast('Photo removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed.', 'error');
    } finally { setRemovePh(false); }
  };

  const submitPw = async (e) => {
    e.preventDefault(); setPwErr(null);
    if (!pw.current.trim())        return setPwErr('Please enter your current password.');
    if (pw.next.length < 8)        return setPwErr('New password must be at least 8 characters.');
    if (!/[a-zA-Z]/.test(pw.next)) return setPwErr('Password must contain at least one letter.');
    if (pw.next !== pw.confirm)    return setPwErr('Passwords do not match.');
    setPwBusy(true);
    try {
      await userService.changeOwnPassword(pw.current, pw.next);
      showToast('Password updated.', 'success');
      resetPw();
    } catch (err) {
      setPwErr(err.message || 'Failed to update password.');
    } finally { setPwBusy(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="sidebar-user-menu" ref={wrapRef} style={{ position: 'relative' }}>

      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        className="sidebar-user-trigger"
        onClick={() => setView((v) => v === 'closed' ? 'menu' : 'closed')}
        aria-expanded={view !== 'closed'}
        title="Account"
      >
        <Avatar user={user} size={34} />
        <span className="sidebar-user-trigger-text">
          <span className="sidebar-user-trigger-name">{user.full_name}</span>
          <span className="sidebar-user-trigger-role">{user.role.replace(/_/g, ' ')}</span>
        </span>
        <svg
          className={`sidebar-user-chevron${view !== 'closed' ? ' sidebar-user-chevron-open' : ''}`}
          width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        >
          <path d="M6 15L12 9L18 15" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Compact dropdown — appears below the trigger in the navbar ── */}
      {view === 'menu' && (
        <div style={{
          position: 'absolute', top: '100%', right: 0,
          width: 'var(--sidebar-width)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: '0 0 10px 10px', boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden', zIndex: 10,
        }} role="menu">

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: '1px solid var(--border)',
          }}>
            <Avatar user={user} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 1 }}>
                {user.role.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          {/* My Profile */}
          <button type="button" role="menuitem"
            className="sidebar-user-dropdown-item"
            style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem' }}
            onClick={() => { closeAll(); navigate('/profile'); }}
          >
            <span className="sidebar-user-dropdown-item-icon"><IconPerson /></span>
            My Profile
          </button>

          {/* Logout */}
          <button type="button" role="menuitem"
            className="sidebar-user-dropdown-item sidebar-user-dropdown-item-danger"
            style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem' }}
            onClick={handleLogout}
          >
            <span className="sidebar-user-dropdown-item-icon"><IconPower /></span>
            Logout
          </button>
        </div>
      )}

      {/* ── My Profile panel — covers full sidebar height, same width ──────── */}
      {view === 'profile' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 'var(--sidebar-width)',
          height: '100vh',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1300, // above sidebar (1200) so it covers it
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>

          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 16px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>My Profile</span>
            <button type="button" onClick={closeAll} aria-label="Close profile"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <IconX size={16} />
            </button>
          </div>

          {/* ── Avatar section ── */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, padding: '20px 16px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange} style={{ display: 'none' }} />

            {/* Avatar + camera badge */}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Avatar user={user} previewUrl={preview} size={80} />
              <button type="button" onClick={pickFile} disabled={savingPh}
                title="Change photo" aria-label="Change photo"
                style={{
                  position: 'absolute', bottom: 0, right: -2,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  border: '2px solid var(--bg-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}>
                {savingPh ? <span className="user-avatar-spinner" /> : <IconCamera />}
              </button>
            </div>

            {/* Name / role / email */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{user.full_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize', marginTop: 2 }}>
                {user.role.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
            </div>

            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Click the camera icon to change your photo
            </p>

            {/* Only show Save button when a file is staged; camera badge handles picking */}
            {file && (
              <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                <button type="button"
                  onClick={resetPhoto}
                  disabled={savingPh}
                  style={{ ...btnBase, flex: 1, background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  Discard
                </button>
                <button type="button"
                  onClick={savePhoto}
                  disabled={savingPh}
                  style={{ ...btnBase, flex: 1, background: 'var(--accent)', color: '#fff', opacity: savingPh ? 0.6 : 1 }}>
                  {savingPh ? 'Saving…' : 'Save Photo'}
                </button>
              </div>
            )}

            {user.avatar_url && !file && (
              <button type="button" onClick={removePhoto} disabled={removePh}
                style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: 'var(--error-text)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                {removePh ? 'Removing…' : 'Remove current photo'}
              </button>
            )}
          </div>

          {/* ── Change Password section ── */}
          <form onSubmit={submitPw} noValidate style={{ padding: '16px', flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.76rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Change Password
            </div>

            {pwErr && (
              <div style={{
                background: 'var(--error-bg)', border: '1px solid var(--error-border)',
                color: 'var(--error-text)', borderRadius: 7,
                padding: '7px 10px', fontSize: '0.8rem', marginBottom: 10,
              }}>
                {pwErr}
              </div>
            )}

            {(() => {
              // ── shared strength calculator ──
              const calcStrength = (val) => {
                const hasLower   = /[a-z]/.test(val);
                const hasUpper   = /[A-Z]/.test(val);
                const hasNumber  = /[0-9]/.test(val);
                const hasSymbol  = /[^A-Za-z0-9]/.test(val);
                const hasLetters = hasLower || hasUpper;
                const longEnough = val.length >= 8;
                let score = 0;
                if (longEnough)              score++;
                if (hasLetters && hasUpper)  score++;
                if (hasLetters && hasNumber) score++;
                if (hasLetters && hasSymbol) score++;
                if (!hasLetters) score = Math.min(score, 1);
                return { score, longEnough, hasLetters, hasUpper, hasNumber, hasSymbol };
              };
              const scoreColors = ['', '#F87171', '#FBBF24', '#34D399', '#0F766E'];
              const scoreLabels = ['', 'Weak',    'Fair',    'Good',    'Strong'];

              const fields = [
                { id: 'cur', label: 'Current Password', val: pw.current, show: showCur, toggle: setShowCur, field: 'current', ac: 'current-password' },
                { id: 'new', label: 'New Password',     val: pw.next,    show: showNew, toggle: setShowNew, field: 'next',    ac: 'new-password' },
                { id: 'con', label: 'Confirm New',      val: pw.confirm, show: showCon, toggle: setShowCon, field: 'confirm', ac: 'new-password' },
              ];

              return fields.map(({ id, label, val, show, toggle, field, ac }) => {
                const isNew     = field === 'next';
                const isConfirm = field === 'confirm';
                const st        = isNew ? calcStrength(val) : null;

                return (
                  <div key={id} style={{ marginBottom: isNew && val.length > 0 ? 14 : 10 }}>
                    {/* Label */}
                    <label htmlFor={`spw-${id}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {label}
                    </label>

                    {/* Input + eye toggle */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id={`spw-${id}`}
                        type={show ? 'text' : 'password'}
                        autoComplete={ac}
                        value={val}
                        onChange={(e) => setPw((p) => ({ ...p, [field]: e.target.value }))}
                        disabled={pwBusy}
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={(e)  => (e.target.style.borderColor = 'var(--border-strong)')}
                      />
                      <button type="button" onClick={() => toggle((s) => !s)}
                        aria-label={show ? 'Hide password' : 'Show password'}
                        style={{ position: 'absolute', right: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                        {show ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>

                    {/* Strength bar + checklist — New Password only */}
                    {isNew && val.length > 0 && (() => {
                      const { score, longEnough, hasLetters, hasUpper, hasNumber, hasSymbol } = st;
                      const reqs = [
                        { met: longEnough, text: 'At least 8 characters' },
                        { met: hasLetters, text: 'Contains letters' },
                        { met: hasUpper,   text: 'Uppercase (A–Z)' },
                        { met: hasNumber,  text: 'Number (0–9)' },
                        { met: hasSymbol,  text: 'Symbol (!@#$…)' },
                      ];
                      return (
                        <div style={{ marginTop: 6 }}>
                          {/* Bar */}
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[1,2,3,4].map(i => (
                              <div key={i} style={{
                                flex: 1, height: 3, borderRadius: 2,
                                background: i <= score ? scoreColors[score] : 'var(--border)',
                                transition: 'background 0.25s',
                              }}/>
                            ))}
                          </div>
                          {/* Score label */}
                          <div style={{
                            fontSize: '0.67rem', textAlign: 'right', marginTop: 2,
                            fontWeight: 600,
                            color: score > 0 ? scoreColors[score] : 'var(--text-muted)',
                          }}>
                            {scoreLabels[score]}
                          </div>
                          {/* Requirements */}
                          <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {reqs.map(r => (
                              <li key={r.text} style={{
                                fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4,
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

                    {/* Match indicator — Confirm field only */}
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
                  </div>
                );
              });
            })()}

            {/* Cancel + Update row */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {/* Cancel closes the entire profile panel */}
              <button type="button"
                onClick={closeAll}
                disabled={pwBusy}
                style={{ ...btnBase, flex: 1, background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button type="submit" disabled={pwBusy}
                style={{ ...btnBase, flex: 1, background: 'var(--accent)', color: '#fff', opacity: pwBusy ? 0.6 : 1 }}>
                {pwBusy ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </form>

        </div>
      )}
    </div>
  );
}
