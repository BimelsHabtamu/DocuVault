import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import useFormValidation from '../hooks/useFormValidation';
import { isRequired, isValidEmail } from '../utils/validation';
import { ROLES } from '../utils/roles';
import logo from '/public/logo.png';
/*   HELPERS */
function defaultRouteForRole(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
    case ROLES.SYSTEM_ADMIN: return '/templates';
    case ROLES.APPROVER:     return '/approvals';
    default:                 return '/documents';
  }
}

/* Password visibility toggle icons */
function EyeIcon({ off }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

/* Email field prefix icon */
function EmailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

/* Lock/password prefix icon */
function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

/* Shield check — used in trust badges */
function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}
/*  WORKFLOW STEPS — Clean CSS-driven pipeline (replaces the SVG illustration) */
const STEPS = (t) => [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    label: t('login.steps.generate'),
    desc:  t('login.steps.generateDesc'),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    label: t('login.steps.approve'),
    desc:  t('login.steps.approveDesc'),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    label: t('login.steps.sign'),
    desc:  t('login.steps.signDesc'),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
    label: t('login.steps.deliver'),
    desc:  t('login.steps.deliverDesc'),
  },
];

const TRUST_BADGES = (t) => [
  t('login.trustBadges.encryption'),
  t('login.trustBadges.roleAccess'),
  t('login.trustBadges.auditTrail'),
  t('login.trustBadges.digitalSignatures'),
];


export default function Login() {
  const LOGIN_ENABLED = true;

  const { t } = useTranslation(['translation', 'auth']);
  const { login }      = useAuth();
  const navigate       = useNavigate();
  const location       = useLocation();

  const steps       = STEPS(t);
  const trustBadges = TRUST_BADGES(t);

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [remember,     setRemember]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [serverError,  setServerError]  = useState(null);

  const { errors, runValidation, clearFieldError } = useFormValidation();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!LOGIN_ENABLED) return;

    const isValid = runValidation({
      email: (v) => {
        if (!isRequired(v)) return t('login.errors.requiredWorkEmail');
        if (!isValidEmail(v)) return t('translation:common.invalidEmail');
        return '';
      },
      password: (v) => !isRequired(v) ? t('login.errors.requiredPassword') : '',
    }, { email, password });
    if (!isValid) return;

    setServerError(null);
    setSubmitting(true);
    try {
      const u  = await login(email.trim(), password, remember);
      const to = location.state?.from?.pathname || defaultRouteForRole(u.role);
      navigate(to, { replace: true, state: location.state?.from?.state });
    } catch (err) {
      setServerError(err.message || t('login.errors.invalidCredentials'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    
      <style>{`
        /* ── reset ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── page shell ── */
        .lp {
          display: flex;
          width: 100vw;
          min-height: 100vh;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background: #0F766E;
          overflow: hidden;
        }

        /* ════════════════════════════════════════
           LEFT HERO — 52%
        ════════════════════════════════════════ */
        .lp-hero {
          flex: 0 0 52%;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 36px 48px 36px 48px;
          overflow: hidden;
          background: linear-gradient(155deg, #0a4f4a 0%, #0F766E 45%, #0e6b64 75%, #0a4f4a 100%);
        }

        /* Layered radial orbs */
        .lp-orb1, .lp-orb2, .lp-orb3 {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .lp-orb1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 65%);
          top: -160px; left: -120px;
          animation: lp-drift 16s ease-in-out infinite alternate;
        }
        .lp-orb2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 60%);
          bottom: -80px; right: -60px;
          animation: lp-drift 22s ease-in-out infinite alternate-reverse;
        }
        .lp-orb3 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(20,184,166,0.10) 0%, transparent 65%);
          top: 45%; right: 10%;
          animation: lp-drift 19s ease-in-out infinite alternate;
        }
        @keyframes lp-drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(24px, 20px) scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-orb1, .lp-orb2, .lp-orb3 { animation: none; }
        }

        /* Subtle dot grid */
        .lp-grid {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
        }

        /* Hero inner layout */
        .lp-hi {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          height: 100%; gap: 0;
        }

        /* ── Brand mark (top) ── */
        .lp-brand {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 0; flex-shrink: 0;
        }
        .lp-brand-logo-wrap {
          width: 46px; height: 46px;
          border-radius: 12px; overflow: hidden;
          background: rgba(255,255,255,0.10);
          border: 1.5px solid rgba(255,255,255,0.18);
          box-shadow: 0 4px 16px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.20);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .lp-brand-logo-wrap img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .lp-brand-text { display: flex; flex-direction: column; gap: 1px; }
        .lp-brand-name {
          font-size: 0.95rem; font-weight: 800;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #ffffff; line-height: 1;
        }
        .lp-brand-tagline {
          font-size: 0.60rem; font-weight: 500;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(94, 234, 212, 0.75);
        }

        /* ── Centre block ── */
        .lp-centre {
          flex: 1;
          display: flex; flex-direction: column;
          justify-content: center;
          padding: 48px 0 32px;
          min-height: 0;
        }

        .lp-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(94,234,212,0.80);
          background: rgba(20,184,166,0.12);
          border: 1px solid rgba(20,184,166,0.22);
          border-radius: 20px; padding: 4px 12px;
          width: fit-content; margin-bottom: 22px;
        }
        .lp-eyebrow-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #14B8A6;
          box-shadow: 0 0 6px rgba(20,184,166,0.8);
        }

        .lp-headline {
          font-size: clamp(1.75rem, 2.6vw, 2.6rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #ffffff;
          line-height: 1.12;
          margin-bottom: 18px;
        }
        .lp-headline-accent {
          background: linear-gradient(90deg, #F59E0B 0%, #FDE68A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-desc {
          font-size: 0.875rem;
          color: rgba(204, 251, 241, 0.65);
          line-height: 1.65;
          max-width: 360px;
          margin-bottom: 40px;
        }

        /* ── Workflow steps ── */
        .lp-steps {
          display: flex; flex-direction: column;
          gap: 0; margin-bottom: 40px;
        }
        .lp-step {
          display: flex; align-items: flex-start;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .lp-step:last-child { border-bottom: none; }
        .lp-step-icon-wrap {
          flex-shrink: 0;
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
          color: rgba(94,234,212,0.85);
        }
        .lp-step:nth-child(2) .lp-step-icon-wrap { color: rgba(134,239,172,0.85); }
        .lp-step:nth-child(3) .lp-step-icon-wrap { color: rgba(253,230,138,0.85); }
        .lp-step:nth-child(4) .lp-step-icon-wrap { color: rgba(147,197,253,0.85); }
        .lp-step-body { display: flex; flex-direction: column; gap: 2px; padding-top: 2px; }
        .lp-step-label {
          font-size: 0.825rem; font-weight: 700;
          color: rgba(255,255,255,0.92);
          letter-spacing: 0.01em;
        }
        .lp-step-desc {
          font-size: 0.74rem;
          color: rgba(204,251,241,0.50);
          line-height: 1.45;
        }

        /* ── Trust badges (bottom) ── */
        .lp-badges {
          display: flex; flex-wrap: wrap; gap: 8px;
          flex-shrink: 0;
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 11px;
          border-radius: 6px;
          font-size: 0.64rem; font-weight: 600;
          letter-spacing: 0.03em;
          color: rgba(204,251,241,0.55);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
        }

        .lp-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 40px;
          background: #F0F4F8;
          position: relative;
          overflow-y: auto;
        }
        html.dark .lp-right {
          background: #080F1A;
        }
        .lp-right::before {
          content: '';
          position: absolute; inset: 0;
          background-image: radial-gradient(circle at 30% 20%, rgba(15,118,110,0.04) 0%, transparent 55%),
                            radial-gradient(circle at 75% 80%, rgba(245,158,11,0.03) 0%, transparent 45%);
          pointer-events: none;
        }
        html.dark .lp-right::before {
          background-image: radial-gradient(circle at 30% 20%, rgba(20,184,166,0.06) 0%, transparent 55%),
                            radial-gradient(circle at 75% 80%, rgba(245,158,11,0.04) 0%, transparent 45%);
        }

        .lp-card {
          position: relative;
          width: 100%;
          max-width: 460px;
          background: #ffffff;
          border-radius: 20px;
          padding: 44px 44px 36px;
          border: 1px solid rgba(0,0,0,0.07);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.8) inset,
            0 2px 4px rgba(0,0,0,0.04),
            0 8px 24px rgba(0,0,0,0.07),
            0 32px 64px rgba(0,0,0,0.08);
          animation: lp-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes lp-card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        html.dark .lp-card {
          background: #0C1929;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 2px 4px rgba(0,0,0,0.3),
            0 8px 24px rgba(0,0,0,0.45),
            0 32px 64px rgba(0,0,0,0.50);
        }

        /* Teal top accent line on card */
        .lp-card::before {
          content: '';
          position: absolute;
          top: 0; left: 24px; right: 24px;
          height: 3px;
          background: linear-gradient(90deg, #0F766E, #14B8A6, #F59E0B);
          border-radius: 0 0 4px 4px;
        }

        /* ── Card header: logo + title ── */
        .lp-card-header {
          display: flex; flex-direction: column;
          align-items: flex-start;
          margin-bottom: 32px;
        }
        .lp-card-logo-row {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 24px;
        }
        .lp-card-logo-wrap {
          width: 42px; height: 42px;
          border-radius: 10px; overflow: hidden;
          border: 1.5px solid rgba(15,118,110,0.15);
          box-shadow: 0 2px 8px rgba(15,118,110,0.15);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #f0fdfb;
        }
        .lp-card-logo-wrap img {
          width: 100%; height: 100%; object-fit: cover;
        }
        html.dark .lp-card-logo-wrap {
          background: rgba(15,118,110,0.12);
          border-color: rgba(20,184,166,0.20);
        }
        .lp-card-brand-name {
          font-size: 0.80rem; font-weight: 800;
          letter-spacing: 0.10em; text-transform: uppercase;
          color: #0F766E;
        }
        html.dark .lp-card-brand-name { color: #5EEAD4; }

        .lp-card-title {
          font-size: 1.60rem; font-weight: 800;
          letter-spacing: -0.03em;
          color: #0F172A;
          line-height: 1.15;
          margin-bottom: 10px;
        }
        html.dark .lp-card-title { color: #E2F4F2; }

        .lp-card-sub {
          font-size: 0.835rem;
          color: #64748B;
          line-height: 1.5;
        }
        html.dark .lp-card-sub { color: #7A9E99; }

        /* ── Server error ── */
        .lp-err {
          display: flex; align-items: flex-start; gap: 9px;
          padding: 11px 13px;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 10px;
          font-size: 0.80rem;
          color: #DC2626;
          margin-bottom: 16px;
          animation: lp-shake 0.3s ease;
        }
        @keyframes lp-shake {
          0%,100% { transform: translateX(0); }
          25%      { transform: translateX(-4px); }
          75%      { transform: translateX(4px); }
        }
        html.dark .lp-err {
          background: rgba(220,38,38,0.10);
          border-color: rgba(248,113,113,0.25);
          color: #F87171;
        }
        .lp-err-icon { flex-shrink: 0; margin-top: 1px; }

        /* ── Form fields ── */
        .lp-field {
          display: flex; flex-direction: column;
          gap: 6px; margin-bottom: 18px;
        }
        .lp-lbl {
          font-size: 0.75rem; font-weight: 600;
          color: #374151;
          letter-spacing: 0.015em;
        }
        html.dark .lp-lbl { color: #8BB4AE; }

        .lp-inp-wrap {
          position: relative;
          display: flex; align-items: center;
        }
        .lp-inp-prefix {
          position: absolute; left: 13px;
          color: #94A3B8; pointer-events: none;
          display: flex; align-items: center;
          transition: color 0.18s;
        }
        html.dark .lp-inp-prefix { color: #4B7069; }

        .lp-inp {
          width: 100%;
          padding: 11px 13px 11px 38px;
          border: 1.5px solid #D1D9E0;
          border-radius: 10px;
          font-size: 0.875rem;
          font-family: inherit;
          color: #0F172A;
          background: #F8FAFC;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          -webkit-appearance: none;
        }
        .lp-inp:hover:not(:focus) {
          border-color: #A0AEC0;
          background: #F4F7FA;
        }
        .lp-inp:focus {
          border-color: #0F766E;
          background: #ffffff;
          box-shadow: 0 0 0 3.5px rgba(15,118,110,0.12);
        }
        .lp-inp:focus + .lp-inp-prefix,
        .lp-inp-wrap:focus-within .lp-inp-prefix {
          color: #0F766E;
        }
        .lp-inp::placeholder { color: #A0AEC0; }

        html.dark .lp-inp {
          background: #0F1E2E;
          border-color: #1A3245;
          color: #E2F4F2;
        }
        html.dark .lp-inp:hover:not(:focus) {
          border-color: #1F4060;
          background: #111E2D;
        }
        html.dark .lp-inp:focus {
          border-color: #14B8A6;
          background: #0B1A28;
          box-shadow: 0 0 0 3.5px rgba(20,184,166,0.13);
        }
        html.dark .lp-inp-wrap:focus-within .lp-inp-prefix { color: #14B8A6; }
        html.dark .lp-inp::placeholder { color: #3D6860; }

        /* password input: extra right padding for eye button */
        .lp-inp-pw { padding-right: 42px; }

        /* aria-invalid states */
        .lp-inp[aria-invalid="true"] {
          border-color: #DC2626 !important;
          background: #FFF8F8;
        }
        .lp-inp[aria-invalid="true"]:focus {
          box-shadow: 0 0 0 3.5px rgba(220,38,38,0.12) !important;
        }
        html.dark .lp-inp[aria-invalid="true"] { background: #1A0F0F; }
        .lp-field-err {
          font-size: 0.74rem; color: #DC2626;
          display: flex; align-items: center; gap: 4px;
        }
        html.dark .lp-field-err { color: #F87171; }

        /* eye toggle */
        .lp-eye {
          position: absolute; right: 11px;
          background: none; border: none; cursor: pointer;
          color: #94A3B8;
          display: flex; align-items: center;
          padding: 5px; border-radius: 6px;
          transition: color 0.15s, background 0.15s;
          line-height: 0;
        }
        .lp-eye:hover {
          color: #0F766E;
          background: rgba(15,118,110,0.07);
        }
        .lp-eye:focus-visible {
          outline: 2px solid #0F766E;
          outline-offset: 1px;
        }
        html.dark .lp-eye { color: #3D6860; }
        html.dark .lp-eye:hover {
          color: #14B8A6;
          background: rgba(20,184,166,0.10);
        }
        html.dark .lp-eye:focus-visible { outline-color: #14B8A6; }

        /* ── Options row (remember + forgot) ── */
        .lp-opts {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 8px; flex-wrap: wrap;
        }
        .lp-rem {
          display: flex; align-items: center; gap: 7px;
          cursor: pointer;
          font-size: 0.78rem; color: #4B5563;
          user-select: none;
        }
        html.dark .lp-rem { color: #7A9E99; }
        .lp-chk {
          width: 14px; height: 14px;
          border-radius: 4px;
          cursor: pointer;
          accent-color: #0F766E;
          flex-shrink: 0;
        }
        .lp-forgot {
          font-size: 0.78rem; font-weight: 600;
          color: #0F766E; text-decoration: none;
          transition: color 0.15s;
        }
        .lp-forgot:hover { color: #115E59; text-decoration: underline; }
        .lp-forgot:focus-visible {
          outline: 2px solid #0F766E;
          outline-offset: 2px; border-radius: 3px;
        }
        html.dark .lp-forgot { color: #14B8A6; }
        html.dark .lp-forgot:hover { color: #5EEAD4; }
        html.dark .lp-forgot:focus-visible { outline-color: #14B8A6; }

        /* ── Submit button ── */
        .lp-btn {
          width: 100%;
          padding: 13px 20px;
          background: linear-gradient(135deg, #0F766E 0%, #0a5e57 100%);
          color: #ffffff;
          border: none; border-radius: 10px;
          font-size: 0.825rem; font-weight: 700;
          font-family: inherit;
          letter-spacing: 0.06em; text-transform: uppercase;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 4px 16px rgba(15,118,110,0.32);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .lp-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.14), 0 8px 22px rgba(15,118,110,0.42);
        }
        .lp-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 4px 12px rgba(15,118,110,0.28);
        }
        .lp-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .lp-btn:focus-visible {
          outline: 3px solid rgba(15,118,110,0.5);
          outline-offset: 2px;
        }
        html.dark .lp-btn {
          background: linear-gradient(135deg, #0F766E 0%, #0d6560 100%);
          box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(15,118,110,0.25);
        }
        html.dark .lp-btn:hover:not(:disabled) {
          box-shadow: 0 2px 4px rgba(0,0,0,0.4), 0 8px 22px rgba(20,184,166,0.30);
        }

        /* Spinner */
        .lp-spin {
          display: inline-block;
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.30);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: lp-spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }

        /* ── Back to Home — top-left of right panel ── */
        .lp-back-top {
          position: absolute;
          top: 24px; left: 32px;
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.775rem; font-weight: 600;
          color: #64748B; text-decoration: none;
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(0,0,0,0.07);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          transition: color 0.15s, background 0.15s, border-color 0.15s;
          z-index: 2;
        }
        .lp-back-top:hover {
          color: #0F766E;
          background: rgba(255,255,255,0.92);
          border-color: rgba(15,118,110,0.18);
        }
        .lp-back-top:focus-visible {
          outline: 2px solid #0F766E; outline-offset: 2px; border-radius: 8px;
        }
        html.dark .lp-back-top {
          background: rgba(12,25,41,0.70);
          border-color: rgba(255,255,255,0.07);
          color: #5A7A80;
        }
        html.dark .lp-back-top:hover {
          color: #14B8A6;
          background: rgba(12,25,41,0.90);
          border-color: rgba(20,184,166,0.20);
        }
        html.dark .lp-back-top:focus-visible { outline-color: #14B8A6; }

      
        @media (max-width: 960px) {
          .lp { flex-direction: column; min-height: 100vh; }

          .lp-hero {
            flex: 0 0 auto;
            padding: 24px 28px 20px;
          }
          .lp-centre {
            padding: 20px 0 16px;
          }
          .lp-steps { display: none; }
          .lp-desc  { margin-bottom: 4px; max-width: 100%; font-size: 0.82rem; }
          .lp-eyebrow { margin-bottom: 14px; }
          .lp-headline { font-size: clamp(1.4rem, 4vw, 2rem); margin-bottom: 10px; }

          .lp-right {
            flex: 1;
            padding: 64px 20px 32px;
            align-items: flex-start;
          }
          .lp-back-top { top: 18px; left: 20px; }
          .lp-card {
            max-width: 520px;
            margin: 0 auto;
          }
        }

        @media (max-width: 600px) {
          .lp-hero { padding: 18px 20px 16px; }
          .lp-badges { display: none; }
          .lp-card {
            padding: 32px 26px 28px;
            border-radius: 16px;
          }
          .lp-card-title { font-size: 1.4rem; }
          .lp-right { padding: 60px 14px 28px; }
          .lp-back-top { top: 16px; left: 14px; font-size: 0.72rem; padding: 5px 10px; }
        }

        @media (max-width: 400px) {
          .lp-card { padding: 26px 18px 22px; border-radius: 14px; }
          .lp-card-title { font-size: 1.3rem; }
          .lp-btn { font-size: 0.80rem; }
        }
      `}</style>

      <div className="lp">

        <aside className="lp-hero" aria-hidden="true">
          <div className="lp-orb1" />
          <div className="lp-orb2" />
          <div className="lp-orb3" />
          <div className="lp-grid" />

          <div className="lp-hi">

            {/* Brand mark */}
            <div className="lp-brand">
              <div className="lp-brand-logo-wrap">
                <img src={logo} alt="" />
              </div>
              <div className="lp-brand-text">
                <div className="lp-brand-name">DocuVault</div>
                <div className="lp-brand-tagline">{t('login.brandTagline')}</div>
              </div>
            </div>

            {/* Headline + description */}
            <div className="lp-centre">
              <div className="lp-eyebrow">
                <span className="lp-eyebrow-dot" />
                {t('login.eyebrow')}
              </div>

              <h2 className="lp-headline">
                {t('login.headlineLine1')}<br />
                <span className="lp-headline-accent">{t('login.headlineLine2')}</span><br />
                {t('login.headlineLine3')}
              </h2>

              <p className="lp-desc">
                {t('login.description')}
              </p>

              {/* Workflow steps */}
              <div className="lp-steps" role="list">
                {steps.map((step) => (
                  <div className="lp-step" key={step.label} role="listitem">
                    <div className="lp-step-icon-wrap">{step.icon}</div>
                    <div className="lp-step-body">
                      <span className="lp-step-label">{step.label}</span>
                      <span className="lp-step-desc">{step.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div className="lp-badges" role="list">
              {trustBadges.map((badge) => (
                <span className="lp-badge" key={badge} role="listitem">
                  <ShieldIcon />
                  {badge}
                </span>
              ))}
            </div>

          </div>
        </aside>

        {
            // RIGHT PANEL — Login form
  }
        <main className="lp-right">

          {/* Back to Home — top-left of right panel */}
          <Link to="/landing" className="lp-back-top">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('login.backToHome')}
          </Link>
          <div className="lp-card">

            {/* Card header: logo + brand name */}
            <header className="lp-card-header">
              <div className="lp-card-logo-row">
                <div className="lp-card-logo-wrap">
                  <img src={logo} alt="DocuVault" />
                </div>
                <span className="lp-card-brand-name">DocuVault</span>
              </div>
              <h1 className="lp-card-title">{t('login.welcomeBack')}</h1>
              <p className="lp-card-sub">{t('login.cardSubtitle')}</p>
            </header>

            {/* Server-side error */}
            {serverError && (
              <div className="lp-err" role="alert" id="lp-serr">
                <span className="lp-err-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                {serverError}
              </div>
            )}

            {/* Login form */}
            <form onSubmit={handleSubmit} noValidate>

              {/* Email */}
              <div className="lp-field">
                <label htmlFor="lp-email" className="lp-lbl">
                  {t('login.emailLabel')}
                </label>
                <div className="lp-inp-wrap">
                  <span className="lp-inp-prefix"><EmailIcon /></span>
                  <input
                    id="lp-email"
                    type="email"
                    className="lp-inp"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setServerError(null);
                      clearFieldError('email');
                    }}
                    placeholder={t('login.emailPlaceholder')}
                    autoComplete="username"
                    autoFocus
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={
                      serverError ? 'lp-serr' : errors.email ? 'lp-email-err' : undefined
                    }
                  />
                </div>
                {errors.email && (
                  <p className="lp-field-err" id="lp-email-err" role="alert">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="lp-field">
                <label htmlFor="lp-pw" className="lp-lbl">
                  {t('login.passwordLabel')}
                </label>
                <div className="lp-inp-wrap">
                  <span className="lp-inp-prefix"><LockIcon /></span>
                  <input
                    id="lp-pw"
                    type={showPw ? 'text' : 'password'}
                    className="lp-inp lp-inp-pw"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setServerError(null);
                      clearFieldError('password');
                    }}
                    placeholder={t('login.passwordPlaceholder')}
                    autoComplete="current-password"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={
                      serverError ? 'lp-serr' : errors.password ? 'lp-pw-err' : undefined
                    }
                  />
                  <button
                    type="button"
                    className="lp-eye"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    <EyeIcon off={showPw} />
                  </button>
                </div>
                {errors.password && (
                  <p className="lp-field-err" id="lp-pw-err" role="alert">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember me + Forgot password */}
              <div className="lp-opts">
                <label className="lp-rem">
                  <input
                    type="checkbox"
                    className="lp-chk"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    aria-label={t('login.keepMeSignedIn')}
                  />
                  {t('login.rememberMe')}
                </label>
                <Link to="/forgot-password" className="lp-forgot">
                  {t('login.forgotPassword')}
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="lp-btn"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <span className="lp-spin" aria-hidden="true" />
                    {t('login.signingIn')}
                  </>
                ) : (
                  t('login.signIn')
                )}
              </button>

            </form>



          </div>
        </main>
      </div>
    </>
  );
}
