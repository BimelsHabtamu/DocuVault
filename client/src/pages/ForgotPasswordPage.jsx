import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../services/authService';
import useFormValidation from '../hooks/useFormValidation';
import { isRequired, isValidEmail } from '../utils/validation';
import logo from '/public/logo.png';

export default function ForgotPasswordPage() {
  const { t } = useTranslation(['translation', 'auth']);
  const [email,      setEmail]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [sent,       setSent]       = useState(false);
  const { errors, runValidation, clearFieldError } = useFormValidation();

  async function handleSubmit(e) {
    e.preventDefault();
    const isValid = runValidation({
      email: (v) => {
        if (!isRequired(v)) return t('forgotPassword.errors.pleaseEnterWorkEmail');
        if (!isValidEmail(v)) return t('translation:common.invalidEmail');
        return '';
      },
    }, { email });
    if (!isValid) return;
    setServerError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setServerError(err.message || t('forgotPassword.errors.somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── same two-panel shell as Login ── */
        .fp {
          display: flex;
          height: 100vh;
          overflow: hidden;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background: #0F766E;
        }

        /* ══ LEFT HERO — same palette, simplified ══ */
        .fp-hero {
          flex: 0 0 55%;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 36px 48px;
          overflow: hidden;
          background: linear-gradient(150deg, #0D5E58 0%, #0F766E 45%, #115E59 100%);
        }
        .fp-hero::before {
          content: '';
          position: absolute;
          width: 500px; height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(20,184,166,0.20) 0%, transparent 70%);
          top: -80px; left: -60px;
          animation: fp-orb 16s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .fp-hero::after {
          content: '';
          position: absolute;
          width: 360px; height: 360px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%);
          bottom: -80px; right: -40px;
          animation: fp-orb 20s ease-in-out infinite alternate-reverse;
          pointer-events: none;
        }
        @keyframes fp-orb {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(20px,15px) scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fp-hero::before, .fp-hero::after { animation: none; }
        }
        .fp-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 44px 44px;
          pointer-events: none;
        }
        .fp-hero-inner {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; height: 100%;
        }

        /* brand */
        .fp-brand {
          display: flex; align-items: center; gap: 12px; margin-bottom: 48px;
        }
        .fp-brand-logo {
          width: 40px; height: 40px; border-radius: 10px; overflow: hidden;
          flex-shrink: 0; box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        }
        .fp-brand-logo img { width: 100%; height: 100%; object-fit: cover; }
        .fp-brand-name {
          font-size: 0.95rem; font-weight: 800; letter-spacing: 0.1em;
          text-transform: uppercase; color: #fff;
        }
        .fp-brand-sub {
          font-size: 0.62rem; font-weight: 600; letter-spacing: 0.18em;
          text-transform: uppercase; color: #5EEAD4; margin-top: 3px;
        }

        /* centre content */
        .fp-hero-body {
          flex: 1; display: flex; flex-direction: column; justify-content: center;
        }
        .fp-hero-label {
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.16em;
          text-transform: uppercase; color: #5EEAD4; margin-bottom: 14px;
        }
        .fp-hero-heading {
          font-size: clamp(1.5rem, 2.6vw, 2.1rem);
          font-weight: 800; letter-spacing: -0.03em;
          color: #fff; line-height: 1.2; margin-bottom: 16px;
        }
        .fp-hero-heading span {
          background: linear-gradient(90deg, #14B8A6, #5EEAD4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .fp-hero-desc {
          font-size: 0.88rem; color: rgba(232,238,247,0.58);
          line-height: 1.65; max-width: 340px; margin-bottom: 36px;
        }

        /* security steps */
        .fp-steps {
          display: flex; flex-direction: column; gap: 12px;
        }
        .fp-step {
          display: flex; align-items: flex-start; gap: 12px;
        }
        .fp-step-num {
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(20,184,166,0.15);
          border: 1px solid rgba(20,184,166,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.65rem; font-weight: 800; color: #14B8A6;
          flex-shrink: 0; margin-top: 1px;
        }
        .fp-step-text {
          font-size: 0.8rem; color: rgba(232,238,247,0.6); line-height: 1.5;
        }
        .fp-step-text strong { color: rgba(232,238,247,0.88); font-weight: 600; }

        /* footer pills */
        .fp-pills {
          display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;
        }
        .fp-pill {
          padding: 4px 12px; border-radius: 20px;
          font-size: 0.68rem; font-weight: 500;
          color: rgba(232,238,247,0.45);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
        }

        /* ══ RIGHT PANEL ══ */
        .fp-right {
          flex: 1; display: flex; align-items: center;
          justify-content: center; padding: 24px 32px;
          background: #F8FAFC; overflow-y: auto;
        }
        html.dark .fp-right { background: #0A1628; }

        /* card */
        .fp-card {
          width: 100%; max-width: 380px;
          background: #fff; border-radius: 18px;
          padding: 36px 32px 30px;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.06),
            0 4px 12px rgba(0,0,0,0.06),
            0 20px 48px rgba(0,0,0,0.10);
          animation: card-in .45s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes card-in {
          from { opacity:0; transform:translateY(16px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        html.dark .fp-card {
          background: #0F1E30;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.06),
            0 4px 12px rgba(0,0,0,0.4),
            0 20px 48px rgba(0,0,0,0.55);
        }

        /* headings */
        .fp-card h1 {
          font-size: 1.4rem; font-weight: 800; letter-spacing: -0.025em;
          color: #1E293B; margin-bottom: 3px; line-height: 1.2;
        }
        html.dark .fp-card h1 { color:#E8F4F2; }
        .fp-card-sub {
          font-size: 0.83rem; color: #64748B;
          margin-bottom: 22px; line-height: 1.5;
        }
        html.dark .fp-card-sub { color:#8BB4AE; }

        /* error */
        .fp-err {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 12px; background: #FEF2F2;
          border: 1px solid #FECACA; border-radius: 9px;
          font-size: 0.81rem; color: #DC2626; margin-bottom: 14px;
          animation: shake .3s ease;
        }
        @keyframes shake {
          0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)}
        }
        html.dark .fp-err { background:rgba(220,38,38,.12); border-color:rgba(248,113,113,.3); color:#F87171; }
        .fp-field-err { margin: 3px 0 0; font-size: 12px; color: #DC2626; }
        html.dark .fp-field-err { color: #F87171; }
        .fp-req { color: #DC2626; }
        .fp-inp[aria-invalid="true"] { border-color: #DC2626 !important; }
        .fp-inp[aria-invalid="true"]:focus {
          border-color: #DC2626;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.14) !important;
        }

        /* success */
        .fp-success {
          display: flex; flex-direction: column; gap: 16px;
          animation: card-in .4s cubic-bezier(0.22,1,0.36,1) both;
        }
        .fp-success-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: rgba(15,118,110,0.12);
          border: 1.5px solid rgba(20,184,166,0.35);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 4px;
        }
        .fp-success h1 {
          font-size: 1.35rem; font-weight: 800; color: #1E293B;
          text-align: center; line-height: 1.2;
        }
        html.dark .fp-success h1 { color:#E8F4F2; }
        .fp-success-msg {
          font-size: 0.83rem; color: #64748B; text-align: center; line-height: 1.6;
        }
        html.dark .fp-success-msg { color:#8BB4AE; }
        .fp-success-notice {
          padding: 10px 14px;
          background: rgba(15,118,110,0.07);
          border: 1px solid rgba(20,184,166,0.2);
          border-radius: 9px;
          font-size: 0.78rem; color: #0F766E; line-height: 1.5;
        }
        html.dark .fp-success-notice { background:rgba(20,184,166,.10); border-color:rgba(20,184,166,.25); color:#14B8A6; }

        /* field */
        .fp-field { display:flex; flex-direction:column; gap:5px; margin-bottom:18px; }
        .fp-lbl { font-size:0.77rem; font-weight:600; color:#374151; letter-spacing:0.01em; }
        html.dark .fp-lbl { color:#8BB4AE; }
        .fp-inp {
          width:100%; padding:10px 13px;
          border:1.5px solid #CBD5E1; border-radius:9px;
          font-size:0.9rem; font-family:inherit; color:#1E293B;
          background:#F8FAFC; outline:none;
          transition:border-color .18s,box-shadow .18s,background .18s;
        }
        .fp-inp:focus {
          border-color:#0F766E; background:#fff;
          box-shadow:0 0 0 3px rgba(15,118,110,0.15);
        }
        .fp-inp::placeholder { color:#94A3B8; }
        html.dark .fp-inp { background:#1A2F42; border-color:#1E3D4F; color:#E8F4F2; }
        html.dark .fp-inp:focus { border-color:#14B8A6; background:#142538; box-shadow:0 0 0 3px rgba(20,184,166,.15); }
        html.dark .fp-inp::placeholder { color:#5A8880; }

        /* submit */
        .fp-btn {
          width:100%; padding:11px;
          background:linear-gradient(135deg,#0F766E 0%,#115E59 100%);
          color:#fff; border:none; border-radius:10px;
          font-size:0.83rem; font-weight:700; font-family:inherit;
          letter-spacing:0.08em; text-transform:uppercase;
          cursor:pointer; transition:opacity .2s,transform .15s,box-shadow .2s;
          box-shadow:0 4px 14px rgba(15,118,110,0.38);
          margin-bottom:14px;
        }
        .fp-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); box-shadow:0 6px 20px rgba(15,118,110,.48); }
        .fp-btn:active:not(:disabled) { transform:translateY(0); }
        .fp-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
        .fp-spin {
          display:inline-block; width:13px; height:13px;
          border:2px solid rgba(255,255,255,.3); border-top-color:#fff;
          border-radius:50%; animation:spin .6s linear infinite;
          vertical-align:middle; margin-right:6px;
        }
        @keyframes spin { to{transform:rotate(360deg)} }

        /* back link */
        .fp-back {
          font-size:0.8rem; font-weight:600; color:#0F766E;
          text-decoration:none; display:inline-flex; align-items:center; gap:5px;
          transition:color .15s;
        }
        .fp-back:hover { color:#115E59; text-decoration:underline; }
        html.dark .fp-back { color:#14B8A6; }
        html.dark .fp-back:hover { color:#5EEAD4; }

        /* ══ RESPONSIVE ══ */
        @media (max-width: 960px) {
          .fp { flex-direction:column; height:auto; overflow:visible; }
          .fp-hero { flex:none; min-height:0; padding:24px 24px 20px; }
          .fp-steps { display:none; }
          .fp-hero-desc { margin-bottom:16px; }
          .fp-right { flex:none; padding:24px 20px 40px; min-height:auto; }
          .fp-card { max-width:440px; }
        }
        @media (max-width: 600px) {
          .fp-hero { padding:18px; }
          .fp-hero-heading { font-size:1.35rem; }
          .fp-pills { display:none; }
          .fp-right { padding:18px 14px 36px; }
          .fp-card { padding:26px 18px 22px; border-radius:14px; }
        }
        @media (max-width: 380px) {
          .fp-card { padding:20px 14px 18px; }
        }
      `}</style>

      <div className="fp">

        {/* ══ LEFT HERO ══ */}
        <aside className="fp-hero" aria-hidden="true">
          <div className="fp-grid"/>
          <div className="fp-hero-inner">

            <div className="fp-brand">
              <div className="fp-brand-logo"><img src={logo} alt=""/></div>
              <div>
                <div className="fp-brand-name">DocuVault</div>
                <div className="fp-brand-sub">{t('forgotPassword.brandSub')}</div>
              </div>
            </div>

            <div className="fp-hero-body">
              <div className="fp-hero-label">{t('forgotPassword.heroLabel')}</div>
              <h2 className="fp-hero-heading">
                {t('forgotPassword.heroLine1')}<br/><span>{t('forgotPassword.heroLine2')}</span>
              </h2>
              <p className="fp-hero-desc">
                {t('forgotPassword.heroDescription')}
              </p>

              <div className="fp-steps">
                {[
                  { n:'1', title: t('forgotPassword.steps.enterEmail'), body: t('forgotPassword.steps.enterEmailBody') },
                  { n:'2', title: t('forgotPassword.steps.checkInbox'), body: t('forgotPassword.steps.checkInboxBody') },
                  { n:'3', title: t('forgotPassword.steps.setNewPassword'), body: t('forgotPassword.steps.setNewPasswordBody') },
                ].map(s => (
                  <div key={s.n} className="fp-step">
                    <div className="fp-step-num">{s.n}</div>
                    <div className="fp-step-text"><strong>{s.title}</strong> — {s.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fp-pills">
              {[
                t('forgotPassword.pills.encryptedDelivery'),
                t('forgotPassword.pills.sixtyMinuteExpiry'),
                t('forgotPassword.pills.oneTimeLink'),
                t('forgotPassword.pills.auditLogged'),
              ].map(t => (
                <span key={t} className="fp-pill">{t}</span>
              ))}
            </div>

          </div>
        </aside>

        {/* ══ RIGHT PANEL ══ */}
        <main className="fp-right">
          <div className="fp-card">

            {sent ? (
              /* ── Success state ── */
              <div className="fp-success">
                <div className="fp-success-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="#0F766E" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <h1>{t('forgotPassword.successTitle')}</h1>
                <p className="fp-success-msg">
                  {t('forgotPassword.successMessage', { email: email.trim() })}
                </p>
                <div className="fp-success-notice">
                  {t('forgotPassword.successNotice')}
                </div>
                <Link to="/login" className="fp-back" style={{alignSelf:'center'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  {t('forgotPassword.backToSignIn')}
                </Link>
              </div>
            ) : (
              /* ── Request form ── */
              <>
                <h1>{t('forgotPassword.title')}</h1>
                <p className="fp-card-sub">
                  {t('forgotPassword.subtitle')}
                </p>

                {serverError && (
                  <div className="fp-err" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{flexShrink:0,marginTop:1}} aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {serverError}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="fp-field">
                    <label htmlFor="fp-email" className="fp-lbl">{t('forgotPassword.workEmailLabel')} <span className="fp-req" aria-hidden="true">*</span></label>
                    <input
                      id="fp-email"
                      type="email"
                      className="fp-inp"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setServerError(null); clearFieldError('email'); }}
                      placeholder={t('forgotPassword.emailPlaceholder')}
                      autoComplete="username"
                      autoFocus
                      disabled={submitting}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={serverError ? 'fp-err' : (errors.email ? 'fp-email-err' : undefined)}
                    />
                    {errors.email && <p className="fp-field-err" id="fp-email-err" role="alert">{errors.email}</p>}
                  </div>

                  <button type="submit" className="fp-btn"
                    disabled={submitting} aria-busy={submitting}>
                    {submitting
                      ? <><span className="fp-spin" aria-hidden="true"/>{t('forgotPassword.sending')}</>
                      : t('forgotPassword.sendResetLink')}
                  </button>
                </form>

                <Link to="/login" className="fp-back">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  {t('forgotPassword.backToSignIn')}
                </Link>
              </>
            )}

          </div>
        </main>

      </div>
    </>
  );
}
