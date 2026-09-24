import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import FaqAccordion from '../components/common/FaqAccordion';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import logo from '/public/logo.png';

/*  Scroll-reveal hook */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/*  Slideshow */
const SLIDES = (t) => [
  { url: '/image1.png', caption: t('landing.slides.autoGen') },
  { url: '/image2.png', caption: t('landing.slides.secureSignatures') },
  { url: '/image3.png', caption: t('landing.slides.approvalWorkflows') },
  { url: '/image4.png', caption: t('landing.slides.verifiedDelivery') },
  { url: '/image5.png', caption: t('landing.slides.streamlined') },
  { url: '/image6.png', caption: t('landing.slides.multiRole') },
  { url: '/image7.png', caption: t('landing.slides.auditTrail') },
  { url: '/image8.png', caption: t('landing.slides.enterpriseSecurity') },
];

/*   Features */
const FEATURES = (t) => [
  {
    accent: '#0F766E', bg: 'rgba(15,118,110,0.12)',
    title: t('landing.features.templatesTitle'),
    desc: t('landing.features.templatesDesc'),
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9v12a2 2 0 01-2 2z"/></svg>),
  },
  {
    accent: '#3B82F6', bg: 'rgba(59,130,246,0.12)',
    title: t('landing.features.bulkPdfTitle'),
    desc: t('landing.features.bulkPdfDesc'),
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>),
  },
  {
    accent: '#F59E0B', bg: 'rgba(245,158,11,0.12)',
    title: t('landing.features.esignTitle'),
    desc: t('landing.features.esignDesc'),
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>),
  },
  {
    accent: '#16A34A', bg: 'rgba(22,163,74,0.12)',
    title: t('landing.features.cryptoTitle'),
    desc: t('landing.features.cryptoDesc'),
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>),
  },
  {
    accent: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',
    title: t('landing.features.deliveryTitle'),
    desc: t('landing.features.deliveryDesc'),
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>),
  },
  {
    accent: '#EF4444', bg: 'rgba(239,68,68,0.12)',
    title: t('landing.features.forensicTitle'),
    desc: t('landing.features.forensicDesc'),
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>),
  },
];

/* Roles*/
const ROLES = (t) => [
  { image: '/super.png',     name: t('landing.roles.superAdminName'),   color: '#8B5CF6', desc: t('landing.roles.superAdminDesc'),          perms: [t('landing.roles.superAdminPerm1'), t('landing.roles.superAdminPerm2'), t('landing.roles.superAdminPerm3'), t('landing.roles.superAdminPerm4')] },
  { image: '/system.png',    name: t('landing.roles.systemAdminName'),  color: '#0F766E', desc: t('landing.roles.systemAdminDesc'),               perms: [t('landing.roles.systemAdminPerm1'), t('landing.roles.systemAdminPerm2'), t('landing.roles.systemAdminPerm3'), t('landing.roles.systemAdminPerm4')] },
  { image: '/generator.png', name: t('landing.roles.generatorName'),     color: '#3B82F6', desc: t('landing.roles.generatorDesc'),                       perms: [t('landing.roles.generatorPerm1'), t('landing.roles.generatorPerm2'), t('landing.roles.generatorPerm3'), t('landing.roles.generatorPerm4')] },
  { image: '/approver.png',  name: t('landing.roles.approverName'),      color: '#F59E0B', desc: t('landing.roles.approverDesc'),             perms: [t('landing.roles.approverPerm1'), t('landing.roles.approverPerm2'), t('landing.roles.approverPerm3'), t('landing.roles.approverPerm4')] },
  { image: '/Recipient.png', name: t('landing.roles.recipientName'),     color: '#16A34A', desc: t('landing.roles.recipientDesc'),                  perms: [t('landing.roles.recipientPerm1'), t('landing.roles.recipientPerm2'), t('landing.roles.recipientPerm3')] },
];

/*  Workflow steps*/
const STEPS = (t) => [
  { num: '01', title: t('landing.steps.createTitle'), desc: t('landing.steps.createDesc') },
  { num: '02', title: t('landing.steps.generateTitle'),    desc: t('landing.steps.generateDesc') },
  { num: '03', title: t('landing.steps.requestTitle'), desc: t('landing.steps.requestDesc') },
  { num: '04', title: t('landing.steps.esignTitle'), desc: t('landing.steps.esignDesc') },
  { num: '05', title: t('landing.steps.deliverTitle'), desc: t('landing.steps.deliverDesc') },
  { num: '06', title: t('landing.steps.verifyTitle'),  desc: t('landing.steps.verifyDesc') },
];

/*  Security chain */
const CHAIN = (t) => [
  t('landing.chain.hash'),
  t('landing.chain.hmac'),
  t('landing.chain.otp'),
  t('landing.chain.jwt'),
  t('landing.chain.audit'),
];

/* Theme toggle icons */
function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
import { verifyByDocId, verifyByFile, verifyDocumentSignature } from '../services/publicService';

function InlineVerifyWidget() {
  const { t } = useTranslation(['translation', 'auth']);
  const [mode,       setMode]       = useState('doc_id');
  const [docId,      setDocId]      = useState('');
  const [pdfFile,    setPdfFile]    = useState(null);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [sigResult,  setSigResult]  = useState(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigError,   setSigError]   = useState(null);

  function reset() { setResult(null); setError(null); setSigResult(null); setSigError(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      let res;
      if (mode === 'upload') {
        if (!pdfFile) { setError(t('landing.verifyWidget.errors.selectPdf')); setLoading(false); return; }
        res = await verifyByFile(pdfFile);
      } else {
        const id = docId.trim().toUpperCase();
        if (!id) { setError(t('landing.verifyWidget.errors.enterDocId')); setLoading(false); return; }
        res = await verifyByDocId(id);
      }
      if (!res.data) throw new Error(res.message || t('landing.verifyWidget.errors.verificationFailed'));
      setResult(res.data);
    } catch (err) {
      setError(err.message || t('landing.verifyWidget.errors.verificationFailedRetry'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySig() {
    if (!result?.docId) return;
    setSigLoading(true); setSigError(null); setSigResult(null);
    try {
      const res = await verifyDocumentSignature(result.docId);
      if (!res.data) throw new Error(res.message || t('landing.verifyWidget.errors.signatureFailed'));
      setSigResult(res.data);
    } catch (err) {
      setSigError(err.message || t('landing.verifyWidget.errors.signatureFailed'));
    } finally {
      setSigLoading(false);
    }
  }

  const verified = result?.verified === true;
  const notFound = result?.verified === false && result?.reason === 'not_found';
  const revoked  = result?.result === 'REVOKED';
  const tampered = result?.verified === false && !notFound && !revoked;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--lp-border-med)', borderRadius: 10, overflow: 'hidden' }}>
        {[{ id: 'doc_id', label: t('landing.verifyWidget.byDocId') }, { id: 'upload', label: t('landing.verifyWidget.uploadPdf') }].map(tab => (
          <button key={tab.id} type="button"
            onClick={() => { setMode(tab.id); reset(); setDocId(''); setPdfFile(null); }}
            style={{ flex: 1, padding: '10px 4px', fontSize: '0.84rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: mode === tab.id ? '#0F766E' : 'var(--lp-bg-card)', color: mode === tab.id ? '#fff' : 'var(--lp-text-muted)' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.30)', borderRadius: 8, fontSize: '0.82rem', color: '#F87171', marginBottom: 14 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {mode === 'doc_id' && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="lp-verify-id" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--lp-text)', marginBottom: 6 }}>{t('landing.verifyWidget.docIdLabel')}</label>
            <p style={{ fontSize: '0.74rem', color: 'var(--lp-text-muted)', marginBottom: 8 }}>{t('landing.verifyWidget.docIdHint')}</p>
            <input id="lp-verify-id" value={docId}
              onChange={e => { setDocId(e.target.value); reset(); }}
              placeholder={t('landing.verifyWidget.docIdPlaceholder')}
              disabled={loading}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid var(--lp-border-med)', borderRadius: 9, fontSize: '0.9rem', fontFamily: 'inherit', color: 'var(--lp-text)', background: 'var(--lp-bg-card)', outline: 'none', textTransform: 'uppercase', letterSpacing: '0.03em', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = '#0F766E'}
              onBlur={e => e.target.style.borderColor = 'var(--lp-border-med)'} />
          </div>
        )}
        {mode === 'upload' && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="lp-verify-pdf" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--lp-text)', marginBottom: 6 }}>{t('landing.verifyWidget.uploadLabel')}</label>
            <p style={{ fontSize: '0.74rem', color: 'var(--lp-text-muted)', marginBottom: 8 }}>{t('landing.verifyWidget.uploadHint')}</p>
            <input id="lp-verify-pdf" type="file" accept="application/pdf" disabled={loading}
              onChange={e => { setPdfFile(e.target.files[0] || null); reset(); }}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--lp-border-med)', borderRadius: 9, fontSize: '0.84rem', fontFamily: 'inherit', color: 'var(--lp-text)', background: 'var(--lp-bg-card)', cursor: 'pointer', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* Submit */}
        <button type="submit"
          disabled={loading || (mode === 'doc_id' ? !docId.trim() : !pdfFile)}
          style={{ width: '100%', padding: '12px', background: '#0F766E', color: '#fff', border: 'none', borderRadius: 9, fontSize: '0.86rem', fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (loading || (mode === 'doc_id' ? !docId.trim() : !pdfFile)) ? 0.55 : 1, boxShadow: '0 4px 14px rgba(15,118,110,0.35)', transition: 'opacity 0.15s' }}>
          {loading ? (
            <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'lp-spin .65s linear infinite', flexShrink: 0 }} aria-hidden="true" /> {t('landing.verifyWidget.verifying')}</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> {t('landing.verifyWidget.verifyDocument')}</>
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--lp-border-med)' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: verified ? 'rgba(22,163,74,0.12)' : revoked ? 'rgba(245,158,11,0.12)' : 'rgba(220,38,38,0.12)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: verified ? 'rgba(22,163,74,0.20)' : revoked ? 'rgba(245,158,11,0.20)' : 'rgba(220,38,38,0.20)' }}>
              {verified
                ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                : revoked
                  ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              }
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: verified ? '#4ADE80' : revoked ? '#FBBF24' : '#F87171' }}>
                {verified ? t('landing.verifyWidget.authenticTitle') : revoked ? t('landing.verifyWidget.revokedTitle') : notFound ? t('landing.verifyWidget.notFoundTitle') : t('landing.verifyWidget.corruptTitle')}
              </div>
              <div style={{ fontSize: '0.76rem', color: verified ? '#4ADE80' : revoked ? '#FBBF24' : '#F87171', opacity: 0.8, marginTop: 2 }}>
                {verified ? t('landing.verifyWidget.authenticMsg') : revoked ? t('landing.verifyWidget.revokedMsg') : notFound ? t('landing.verifyWidget.notFoundMsg') : t('landing.verifyWidget.corruptMsg')}
              </div>
            </div>
          </div>

          {/* Detail rows */}
          {(result.docId || result.docStatus || result.generatedAt || result.issuedAt || result.revokedAt) && (
            <div style={{ padding: '12px 16px', background: 'var(--lp-bg-card)', borderTop: '1px solid var(--lp-border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                result.docId && { key: t('landing.verifyWidget.docIdRow'), val: result.docId, mono: true },
                result.docStatus && { key: t('landing.verifyWidget.statusRow'), val: result.docStatus },
                (result.generatedAt || result.issuedAt) && { key: t('landing.verifyWidget.recordedRow'), val: new Date(result.generatedAt || result.issuedAt).toLocaleString() },
                result.revokedAt && { key: t('landing.verifyWidget.revokedRow'), val: new Date(result.revokedAt).toLocaleString() },
              ].filter(Boolean).map(row => (
                <div key={row.key} style={{ display: 'flex', gap: 10, fontSize: '0.81rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--lp-text-muted)', minWidth: 100, flexShrink: 0 }}>{row.key}</span>
                  <span style={{ color: 'var(--lp-text)', fontFamily: row.mono ? 'ui-monospace,SFMono-Regular,Menlo,monospace' : 'inherit' }}>{row.val}</span>
                </div>
              ))}
              {(tampered || result.hashNote === 'content_hash_mismatch') && (
                <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: '0.78rem', background: 'rgba(220,38,38,0.10)', color: '#F87171', fontStyle: 'italic' }}>
                  {t('landing.verifyWidget.tamperWarning')}
                </div>
              )}
            </div>
          )}

          {/* Signature panel */}
          {result.docId && (
            <div style={{ padding: '12px 16px', background: 'var(--lp-bg-card)', borderTop: '1px solid var(--lp-border)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--lp-text-muted)', marginBottom: 8 }}>{t('landing.verifyWidget.digitalSignature')}</div>
              {!sigResult && !sigLoading && !sigError && (
                <button type="button" onClick={handleVerifySig}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--lp-border-med)', background: 'var(--lp-bg-card)', color: 'var(--lp-text)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t('landing.verifyWidget.verifySignature')}
                </button>
              )}
              {sigLoading && <div style={{ fontSize: '0.79rem', color: 'var(--lp-text-muted)' }}>{t('landing.verifyWidget.verifyingSignature')}</div>}
              {sigError   && <div style={{ fontSize: '0.79rem', color: '#F87171' }}>{sigError}</div>}
              {sigResult  && (
                <div style={{ fontSize: '0.79rem', color: 'var(--lp-text)' }}>
                  <div style={{ color: sigResult.signatureValid ? '#4ADE80' : sigResult.signed === false ? 'var(--lp-text-muted)' : '#F87171', marginBottom: 4 }}>
                    {sigResult.signed === false ? t('landing.verifyWidget.notSigned') : sigResult.signatureValid ? t('landing.verifyWidget.signatureValid') : t('landing.verifyWidget.signatureMismatch')}
                  </div>
                  {sigResult.signerName && <div>{t('landing.verifyWidget.approver', { name: sigResult.signerName })}</div>}
                  {sigResult.signedAt   && <div style={{ marginTop: 2 }}>{t('landing.verifyWidget.signed', { date: new Date(sigResult.signedAt).toLocaleString() })}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes lp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
function Navbar({ scrolled, dark, toggleTheme }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation(['translation', 'auth']);

  // Where the logo/brand takes the user when clicked
  const dashboardPath = user?.role === 'recipient' ? '/my-documents' : '/dashboard';

  const NAV_LINKS = [
    { href: '#home',         label: t('landing.nav.home') },
    { href: '#features',     label: t('landing.nav.features') },
    { href: '#how',          label: t('landing.nav.howItWorks') },
    { href: '#security',     label: t('landing.nav.security') },
    { href: '#about',        label: t('landing.nav.about') },
    { href: '#faq',          label: t('landing.nav.faq') },
    { href: '#verification', label: t('landing.nav.verification') },
  ];

  return (
    <header className={`lp-nav${scrolled ? ' lp-nav-scrolled' : ''}`}>
      <div className="lp-nav-inner">
        {/* Logo + brand — logged-in users go to dashboard, guests scroll to top */}
        {user ? (
          <Link to={dashboardPath} className="lp-nav-brand">
            <img src={logo} alt="DocuVault" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            <span className="lp-nav-brand-name">DocuVault</span>
          </Link>
        ) : (
          <a href="#home" className="lp-nav-brand">
            <img src={logo} alt="DocuVault" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            <span className="lp-nav-brand-name">DocuVault</span>
          </a>
        )}

        {/* Desktop nav */}
        <nav className="lp-desktop-nav" aria-label={t('landing.nav.mainNavigation')}>
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="lp-nav-link">{label}</a>
          ))}
        </nav>

        {/* Right: language + 🌙 toggle + Sign In / Dashboard */}
        <div className="lp-nav-actions">
          <LanguageSwitcher variant="navbar" />
          <button
            type="button"
            onClick={toggleTheme}
            className="lp-theme-btn"
            title={dark ? t('landing.nav.switchToLight') : t('landing.nav.switchToDark')}
            aria-label={dark ? t('landing.nav.switchToLight') : t('landing.nav.switchToDark')}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          {user ? (
            <Link to={dashboardPath} className="lp-nav-signin-btn">{t('landing.nav.dashboard')}</Link>
          ) : (
            <Link to="/login" className="lp-nav-signin-btn">{t('landing.nav.signIn')}</Link>
          )}
        </div>

        {/* Hamburger */}
        <button type="button" className="lp-hamburger" onClick={() => setMobileOpen(o => !o)} aria-label={t('landing.nav.toggleMenu')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lp-mobile-menu">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)} className="lp-mobile-link">{label}</a>
          ))}
          <div className="lp-mobile-actions">
            <LanguageSwitcher variant="menu" />
            <button type="button" onClick={toggleTheme} className="lp-mobile-theme-btn">
              {dark ? <IconSun /> : <IconMoon />}
              {dark ? t('landing.nav.lightMode') : t('landing.nav.darkMode')}
            </button>
            {user ? (
              <Link to={dashboardPath} onClick={() => setMobileOpen(false)} className="lp-mobile-signin-btn">{t('landing.nav.dashboard')}</Link>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)} className="lp-mobile-signin-btn">{t('landing.nav.signIn')}</Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Footer
───────────────────────────────────────────────────────────────────────────── */
function Footer() {
  const { t } = useTranslation(['translation', 'auth']);
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-top">
          <div className="lp-footer-brand-col">
            <div className="lp-footer-brand">
              <img src={logo} alt="DocuVault" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover' }} />
              <span className="lp-footer-brand-name">DocuVault</span>
            </div>
            <p className="lp-footer-tagline">
              {t('landing.footer.tagline')}
            </p>
          </div>
          <div className="lp-footer-links-row">
            <div>
              <div className="lp-footer-col-title">{t('landing.footer.platform')}</div>
              {[
                { href: '#home',     label: t('landing.nav.home') },
                { href: '#features', label: t('landing.nav.features') },
                { href: '#how',      label: t('landing.nav.howItWorks') },
                { href: '#security', label: t('landing.nav.security') },
                { href: '#about',    label: t('landing.nav.about') },
                { href: '#faq',      label: t('landing.nav.faq') },
                { href: '#verification', label: t('landing.nav.verification') },
              ].map(({ href, label }) => (
                <a key={href} href={href} className="lp-footer-link">{label}</a>
              ))}
            </div>
            <div>
              <div className="lp-footer-col-title">{t('landing.footer.access')}</div>
              <Link to="/login"  className="lp-footer-link">{t('landing.nav.signIn')}</Link>
              <Link to="/verify" className="lp-footer-link">{t('landing.footer.verifyDocument')}</Link>
              <Link to="/faq"    className="lp-footer-link">{t('landing.footer.faqHelp')}</Link>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>{t('landing.footer.copyright')}</span>
          <span>{t('landing.footer.taglineBottom')}</span>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Section badge helper
───────────────────────────────────────────────────────────────────────────── */
function SectionBadge({ label }) {
  return <div className="lp-section-badge">{label}</div>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main LandingPage
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { dark, toggle: toggleTheme } = useTheme();
  const { t } = useTranslation(['translation', 'auth']);

  const [activeStep, setActiveStep] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [fadeIn,     setFadeIn]     = useState(true);
  const [scrolled,   setScrolled]   = useState(false);

  const refStats    = useReveal();
  const refFeatHead = useReveal();
  const refFeats    = useReveal();
  const refHowHead  = useReveal();
  const refSteps    = useReveal();
  const refSecLeft  = useReveal();
  const refSecRight = useReveal();
  const refRoleHead = useReveal();
  const refRoles    = useReveal();
  const refFaq      = useReveal();
  const refVerify   = useReveal();
  const refFinalCta = useReveal();

  const slides  = SLIDES(t);
  const features = FEATURES(t);
  const steps   = STEPS(t);
  const roles   = ROLES(t);
  const chain   = CHAIN(t);

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % steps.length), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => { setSlideIndex(i => (i + 1) % slides.length); setFadeIn(true); }, 500);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /* Hero overlay adapts to theme — lighter overlay in light mode */
  const heroOverlay = dark
    ? 'linear-gradient(105deg, rgba(7,15,28,0.90) 0%, rgba(7,15,28,0.70) 50%, rgba(7,15,28,0.40) 100%)'
    : 'linear-gradient(105deg, rgba(15,30,55,0.82) 0%, rgba(15,30,55,0.60) 50%, rgba(15,30,55,0.30) 100%)';

  return (
    <>
      {/* ── All landing-page styles ── */}
      <style>{`
        /* ── reset ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        /* ── CSS variables scoped to .lp-root ── */
        .lp-root {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          /* dark defaults */
          --lp-bg:          #070F1C;
          --lp-bg-alt:      #0A1628;
          --lp-bg-card:     rgba(255,255,255,0.03);
          --lp-border:      rgba(255,255,255,0.07);
          --lp-border-med:  rgba(255,255,255,0.12);
          --lp-text:        #FFFFFF;
          --lp-text-muted:  rgba(255,255,255,0.50);
          --lp-text-faint:  rgba(255,255,255,0.28);
          --lp-accent:      #5EEAD4;
          --lp-accent-dim:  rgba(94,234,212,0.70);
          --lp-brand:       #0F766E;
          --lp-brand-dark:  #115E59;
          --lp-stat-border: rgba(255,255,255,0.06);
          --lp-nav-bg-scrolled: rgba(10,22,40,0.96);
          --lp-nav-mobile-bg:   rgba(10,22,40,0.97);
          --lp-hero-bottom: #070F1C;
          --lp-footer-bg:   #050D1A;
          --lp-section-badge-bg:     rgba(15,118,110,0.15);
          --lp-section-badge-border: rgba(15,118,110,0.35);
          --lp-chain-item-bg:   rgba(255,255,255,0.03);
          --lp-chain-item-border: rgba(255,255,255,0.06);
          --lp-step-active-bg:     rgba(15,118,110,0.15);
          --lp-step-active-border: rgba(15,118,110,0.50);
          --lp-step-active-shadow: 0 12px 32px rgba(15,118,110,0.20);
          --lp-cta-bg: linear-gradient(135deg,#0D5E58 0%,#0F766E 60%,#115E59 100%);
          --lp-cta-text: #CCFBF1;
          background: var(--lp-bg);
          color: var(--lp-text);
          transition: background 0.2s, color 0.2s;
        }

        /* ── light mode overrides ── */
        html:not(.dark) .lp-root {
          --lp-bg:          #F8FAFC;
          --lp-bg-alt:      #FFFFFF;
          --lp-bg-card:     rgba(0,0,0,0.02);
          --lp-border:      rgba(0,0,0,0.07);
          --lp-border-med:  rgba(0,0,0,0.12);
          --lp-text:        #1E293B;
          --lp-text-muted:  #64748B;
          --lp-text-faint:  #94A3B8;
          --lp-accent:      #0F766E;
          --lp-accent-dim:  #0F766E;
          --lp-stat-border: rgba(0,0,0,0.06);
          --lp-nav-bg-scrolled: rgba(255,255,255,0.96);
          --lp-nav-mobile-bg:   rgba(255,255,255,0.98);
          --lp-hero-bottom: #F8FAFC;
          --lp-footer-bg:   #1E293B;
          --lp-section-badge-bg:     rgba(15,118,110,0.10);
          --lp-section-badge-border: rgba(15,118,110,0.25);
          --lp-chain-item-bg:   rgba(0,0,0,0.02);
          --lp-chain-item-border: rgba(0,0,0,0.07);
          --lp-step-active-bg:     rgba(15,118,110,0.08);
          --lp-step-active-border: rgba(15,118,110,0.35);
          --lp-step-active-shadow: 0 8px 24px rgba(15,118,110,0.12);
          --lp-cta-bg: linear-gradient(135deg,#0D5E58 0%,#0F766E 60%,#115E59 100%);
          --lp-cta-text: #CCFBF1;
        }

        /* ── Scroll-reveal ── */
        .lp-reveal { opacity:0; transform:translateY(28px); transition:opacity 0.6s ease,transform 0.6s ease; }
        .lp-reveal.lp-visible { opacity:1; transform:translateY(0); }
        .lp-reveal-stagger > * { opacity:0; transform:translateY(22px); transition:opacity 0.5s ease,transform 0.5s ease; }
        .lp-reveal-stagger.lp-visible > *:nth-child(1){opacity:1;transform:none;transition-delay:0.05s;}
        .lp-reveal-stagger.lp-visible > *:nth-child(2){opacity:1;transform:none;transition-delay:0.12s;}
        .lp-reveal-stagger.lp-visible > *:nth-child(3){opacity:1;transform:none;transition-delay:0.19s;}
        .lp-reveal-stagger.lp-visible > *:nth-child(4){opacity:1;transform:none;transition-delay:0.26s;}
        .lp-reveal-stagger.lp-visible > *:nth-child(5){opacity:1;transform:none;transition-delay:0.33s;}
        .lp-reveal-stagger.lp-visible > *:nth-child(6){opacity:1;transform:none;transition-delay:0.40s;}
        @media (prefers-reduced-motion:reduce){
          .lp-reveal,.lp-reveal-stagger>*{transition:none!important;opacity:1!important;transform:none!important;}
        }

        /* -- Navbar -- */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          background: transparent;
          transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
        }
        .lp-nav.lp-nav-scrolled {
          background: var(--lp-nav-bg-scrolled);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--lp-border);
          box-shadow: 0 1px 0 var(--lp-border), 0 4px 24px rgba(0,0,0,0.08);
        }
        .lp-nav-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 40px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
          margin-right: 40px;
        }
        .lp-nav-brand img {
          width: 34px; height: 34px;
          border-radius: 8px; object-fit: cover; flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        .lp-nav-brand-name {
          font-size: 1rem; font-weight: 800;
          letter-spacing: 0.10em; text-transform: uppercase;
          color: #ffffff; white-space: nowrap;
        }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-nav-brand-name { color: var(--lp-text); }
        .lp-desktop-nav {
          display: flex; align-items: center; gap: 2px;
          flex: 1; justify-content: center;
        }
        .lp-nav-link {
          color: rgba(255,255,255,0.75);
          text-decoration: none;
          font-size: 0.875rem; font-weight: 500;
          padding: 8px 14px; border-radius: 8px;
          white-space: nowrap; letter-spacing: 0.01em;
          transition: color 0.15s, background 0.15s;
        }
        .lp-nav-link:hover { color: #fff; background: rgba(255,255,255,0.10); }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-nav-link { color: #475569; }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-nav-link:hover { color: #0F766E; background: rgba(15,118,110,0.07); }
        .lp-nav-actions {
          display: flex; align-items: center; gap: 10px;
          flex-shrink: 0; margin-left: 32px;
        }
        .lp-theme-btn {
          width: 38px; height: 38px;
          border-radius: 10px;
          border: 1.5px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
          transition: all 0.18s;
        }
        .lp-theme-btn:hover {
          background: rgba(255,255,255,0.16);
          border-color: rgba(255,255,255,0.45);
          color: #fff; transform: scale(1.06);
        }
        .lp-nav-actions .lang-switcher-navbar {
          color: rgba(255,255,255,0.85);
          border-color: rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.08);
          padding: 7px 10px;
        }
        .lp-nav-actions .lang-switcher-navbar .lang-code { display: none; }
        .lp-nav-actions .lang-switcher-navbar:hover {
          background: rgba(255,255,255,0.16);
          border-color: rgba(255,255,255,0.45);
          color: #fff;
        }
        .lp-nav-actions .lang-switcher-navbar:focus-visible {
          outline: 2px solid rgba(255,255,255,0.6);
          outline-offset: 2px;
        }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-nav-actions .lang-switcher-navbar {
          border-color: #E2E8F0; background: #F8FAFC; color: #475569;
        }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-nav-actions .lang-switcher-navbar:hover {
          background: rgba(15,118,110,0.08); border-color: #0F766E; color: #0F766E;
        }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-theme-btn {
          border-color: #E2E8F0; background: #F8FAFC; color: #475569;
        }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-theme-btn:hover {
          background: rgba(15,118,110,0.08); border-color: #0F766E; color: #0F766E;
        }
        .lp-nav-signin-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: #0F766E; color: #ffffff; text-decoration: none;
          font-size: 0.875rem; font-weight: 700;
          padding: 9px 22px; border-radius: 10px;
          white-space: nowrap; letter-spacing: 0.02em;
          box-shadow: 0 2px 10px rgba(15,118,110,0.40), inset 0 1px 0 rgba(255,255,255,0.12);
          transition: background 0.18s, box-shadow 0.18s, transform 0.15s;
        }
        .lp-nav-signin-btn:hover {
          background: #115E59;
          box-shadow: 0 4px 18px rgba(15,118,110,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
          transform: translateY(-1px);
        }
        .lp-hamburger {
          display: none; background: none; border: none;
          color: rgba(255,255,255,0.85); cursor: pointer;
          padding: 6px; border-radius: 8px; margin-left: 8px;
          transition: background 0.15s;
        }
        .lp-hamburger:hover { background: rgba(255,255,255,0.10); }
        html:not(.dark) .lp-nav.lp-nav-scrolled .lp-hamburger { color: var(--lp-text); }
        .lp-mobile-menu {
          background: var(--lp-nav-mobile-bg);
          border-top: 1px solid var(--lp-border);
          padding: 16px 24px 24px;
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        }
        .lp-mobile-link {
          display: block; text-decoration: none;
          font-size: 0.95rem; font-weight: 500; padding: 12px 0;
          border-bottom: 1px solid var(--lp-border);
          color: var(--lp-text); letter-spacing: 0.01em;
          transition: color 0.15s, padding-left 0.15s;
        }
        .lp-mobile-link:hover { color: #0F766E; padding-left: 6px; }
        .lp-mobile-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
        .lp-mobile-theme-btn {
          display: flex; align-items: center; gap: 10px;
          background: var(--lp-bg-card); border: 1.5px solid var(--lp-border-med);
          border-radius: 10px; padding: 11px 16px;
          color: var(--lp-text); font-size: 0.9rem; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: border-color 0.15s;
        }
        .lp-mobile-theme-btn:hover { border-color: #0F766E; }
        .lp-mobile-signin-btn {
          display: block; text-align: center; padding: 12px;
          background: #0F766E; border-radius: 10px; color: #fff;
          text-decoration: none; font-size: 0.9rem; font-weight: 700;
          letter-spacing: 0.02em; box-shadow: 0 2px 10px rgba(15,118,110,0.35);
          transition: background 0.15s;
        }
        .lp-mobile-signin-btn:hover { background: #115E59; }
        @media (max-width: 960px) {
          .lp-nav-inner { padding: 0 24px; }
          .lp-nav-brand  { margin-right: 20px; }
          .lp-nav-actions { margin-left: 16px; }
          .lp-nav-link   { padding: 7px 10px; font-size: 0.84rem; }
        }
        @media (max-width: 768px) {
          .lp-desktop-nav { display: none !important; }
          .lp-hamburger   { display: flex !important; }
          .lp-nav-brand   { margin-right: 0; }
          .lp-nav-actions { margin-left: auto; }
          .lp-nav-inner   { height: 64px; padding: 0 20px; }
          .lp-stats-grid  { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 480px) {
          .lp-nav-signin-btn { padding: 8px 16px; font-size: 0.82rem; }
          .lp-stats-grid { grid-template-columns: 1fr; }
        }
        /* ── Section badge ── */
        .lp-section-badge {
          display:inline-block;font-size:0.7rem;font-weight:700;
          letter-spacing:0.15em;text-transform:uppercase;
          color:var(--lp-accent-dim);
          background:var(--lp-section-badge-bg);
          border:1px solid var(--lp-section-badge-border);
          padding:4px 14px;border-radius:999px;margin-bottom:16px;
        }

        /* ── Stats bar ── */
        .lp-stats-section {
          background:var(--lp-bg-alt);
          border-top:1px solid var(--lp-stat-border);
          border-bottom:1px solid var(--lp-stat-border);
        }
        .lp-stats-grid {
          max-width:1200px;margin:0 auto;padding:0 24px;
          display:grid;grid-template-columns:repeat(4,1fr);gap:0;
        }
        .lp-stat-cell {
          padding:28px 24px;text-align:center;
        }
        .lp-stat-value { font-size:1.65rem;font-weight:900;color:var(--lp-accent);margin-bottom:4px; }
        .lp-stat-label { font-size:0.78rem;color:var(--lp-text-muted);font-weight:500;line-height:1.4; }

        /* ── Cards ── */
        .lp-feat-card {
          background:var(--lp-bg-card);border:1px solid var(--lp-border);
          border-radius:16px;padding:24px;
          transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s;
        }
        .lp-feat-card:hover { transform:translateY(-4px);border-color:var(--lp-border-med); }
        html.dark .lp-feat-card:hover  { box-shadow:0 16px 40px rgba(0,0,0,0.35); }
        html:not(.dark) .lp-feat-card:hover { box-shadow:0 12px 32px rgba(0,0,0,0.10); }

        .lp-role-card {
          background:var(--lp-bg-card);border:1px solid var(--lp-border);
          border-radius:16px;padding:22px 18px;
          transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s;
        }
        .lp-role-card:hover { transform:translateY(-4px);border-color:var(--lp-border-med); }
        html.dark .lp-role-card:hover  { box-shadow:0 16px 40px rgba(0,0,0,0.30); }
        html:not(.dark) .lp-role-card:hover { box-shadow:0 10px 28px rgba(0,0,0,0.10); }

        /* ── Section backgrounds ── */
        .lp-section-dark { background:var(--lp-bg);border-top:1px solid var(--lp-border); }
        .lp-section-alt  { background:var(--lp-bg-alt);border-top:1px solid var(--lp-border); }

        /* ── Security chain ── */
        .lp-chain-wrap {
          background:var(--lp-bg-card);border:1px solid var(--lp-border);
          border-radius:20px;padding:24px;
        }
        .lp-chain-item {
          display:flex;align-items:flex-start;gap:12px;
          background:var(--lp-chain-item-bg);border:1px solid var(--lp-chain-item-border);
          border-radius:10px;padding:12px 14px;
        }

        /* ── Tech badge grid ── */
        .lp-tech-badge {
          background:var(--lp-bg-card);border:1px solid var(--lp-border);
          border-radius:10px;padding:12px 14px;
          transition:border-color 0.15s;cursor:default;
        }
        .lp-tech-badge:hover { border-color:rgba(94,234,212,0.30); }
        html:not(.dark) .lp-tech-badge:hover { border-color:rgba(15,118,110,0.30); }

        /* ── Footer ── */
        .lp-footer { background:var(--lp-footer-bg);border-top:1px solid rgba(255,255,255,0.06);padding:40px 24px; }
        .lp-footer-inner { max-width:1200px;margin:0 auto; }
        .lp-footer-top { display:flex;flex-wrap:wrap;gap:32px;justify-content:space-between;margin-bottom:32px; }
        .lp-footer-brand-col { max-width:260px; }
        .lp-footer-brand { display:flex;align-items:center;gap:10px;margin-bottom:12px; }
        .lp-footer-brand-name { font-weight:800;font-size:0.9rem;letter-spacing:0.08em;text-transform:uppercase;color:#fff; }
        .lp-footer-tagline { font-size:0.8rem;color:rgba(255,255,255,0.4);line-height:1.7;margin:0; }
        .lp-footer-links-row { display:flex;gap:48px;flex-wrap:wrap; }
        .lp-footer-col-title { font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:12px; }
        .lp-footer-link { display:block;font-size:0.82rem;color:rgba(255,255,255,0.45);text-decoration:none;margin-bottom:8px;transition:color 0.15s; }
        .lp-footer-link:hover { color:#5EEAD4; }
        .lp-footer-bottom { border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px; }
        .lp-footer-bottom span { font-size:0.75rem;color:rgba(255,255,255,0.25); }

        /* ── Responsive ── */
        @media (max-width:768px) {
          .lp-desktop-nav { display:none!important; }
          .lp-hamburger   { display:block!important; }
          .lp-nav-verify-btn { display:none; }
          .lp-stats-grid  { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width:480px) {
          .lp-stats-grid { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="lp-root">
        <Navbar scrolled={scrolled} dark={dark} toggleTheme={toggleTheme} />

        {/* ══════════════════════════════════════════════════════
            HERO — always dark/photo regardless of theme
        ══════════════════════════════════════════════════════ */}
        <section id="home" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {slides.map((slide, i) => (
            <div key={slide.url} style={{
              position: 'absolute', inset: 0,
              opacity: i === slideIndex ? (fadeIn ? 1 : 0) : 0,
              transition: 'opacity 0.7s ease',
            }}>
              <img src={slide.url} alt={slide.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
            </div>
          ))}
          <div style={{ position: 'absolute', inset: 0, background: heroOverlay }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle,#ffffff 1px,transparent 1px)', backgroundSize: '36px 36px' }} />

          {/* Slide dots */}
          <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 10 }}>
            {slides.map((_, i) => (
              <button key={i} onClick={() => { setSlideIndex(i); setFadeIn(true); }} aria-label={t('landing.hero.slideLabel', { number: i + 1 })} style={{
                borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'all 0.3s',
                width: i === slideIndex ? 24 : 8, height: 8,
                background: i === slideIndex ? '#fff' : 'rgba(255,255,255,0.35)',
              }} />
            ))}
          </div>

          {/* Hero text */}
          <div style={{ position: 'relative', zIndex: 5, maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px', width: '100%' }}>
            <div style={{ maxWidth: 640 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(15,118,110,0.20)', border: '1px solid rgba(15,118,110,0.50)', borderRadius: 999, padding: '5px 14px', marginBottom: 24 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5EEAD4', boxShadow: '0 0 0 3px rgba(94,234,212,0.25)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5EEAD4' }}>{t('landing.hero.badge')}</span>
              </div>
              <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.6rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 20 }}>
                <span style={{ display: 'block', color: '#fff' }}>{t('landing.hero.title1')}</span>
                <span style={{ display: 'block', color: '#fff' }}>{t('landing.hero.title2')}</span>
                <span style={{ display: 'block', background: 'linear-gradient(90deg,#5EEAD4,#0F766E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('landing.hero.title3')}</span>
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0F766E', color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, padding: '13px 28px', borderRadius: 10, boxShadow: '0 6px 20px rgba(15,118,110,0.45)', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#115E59'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#0F766E'; e.currentTarget.style.transform = 'none'; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                  {t('landing.hero.signInToWorkspace')}
                </Link>
                <Link to="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, padding: '13px 24px', borderRadius: 10, transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.transform = 'none'; }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  {t('landing.hero.verifyDocument')}
                </Link>
              </div>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(to top,var(--lp-hero-bottom),transparent)`, pointerEvents: 'none', zIndex: 4 }} />
        </section>

        {/* ══ STATS ══ */}
        <section className="lp-stats-section">
          <div ref={refStats} className="lp-stats-grid lp-reveal lp-reveal-stagger">
            {[
              { value: t('landing.stats.fiveRoles'),  label: t('landing.stats.roleAccessLabel') },
              { value: 'SHA-256', label: t('landing.stats.shaLabel') },
              { value: 'OTP 2FA', label: t('landing.stats.otpLabel') },
              { value: '100%',    label: t('landing.stats.auditLabel') },
            ].map(({ value, label }, i) => (
              <div key={value} className="lp-stat-cell" style={{ borderRight: i < 3 ? '1px solid var(--lp-stat-border)' : 'none' }}>
                <div className="lp-stat-value">{value}</div>
                <div className="lp-stat-label">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ══ FEATURES ══ */}
        <section id="features" className="lp-section-dark" style={{ padding: '96px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div ref={refFeatHead} className="lp-reveal" style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 60px' }}>
              <SectionBadge label={t('landing.featuresSection.badge')} />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                {t('landing.featuresSection.titleBefore')}
                <span style={{ color: 'var(--lp-accent)' }}>{t('landing.featuresSection.titleAccent')}</span>
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                {t('landing.featuresSection.subtitle')}
              </p>
            </div>
            <div ref={refFeats} className="lp-reveal lp-reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
              {features.map(f => (
                <div key={f.title} className="lp-feat-card">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.accent, marginBottom: 16 }}>{f.icon}</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--lp-text)', marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--lp-text-muted)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section id="how" className="lp-section-alt" style={{ padding: '96px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div ref={refHowHead} className="lp-reveal" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 60px' }}>
              <SectionBadge label={t('landing.howSection.badge')} />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                {t('landing.howSection.titleBefore')}
                <span style={{ color: 'var(--lp-accent)' }}>{t('landing.howSection.titleAccent')}</span>
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                {t('landing.howSection.subtitle')}
              </p>
            </div>
            <div ref={refSteps} className="lp-reveal lp-reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16 }}>
              {steps.map((s, i) => {
                const isActive = activeStep === i;
                return (
                  <div key={s.num} style={{
                    background: isActive ? 'var(--lp-step-active-bg)' : 'var(--lp-bg-card)',
                    border: `1px solid ${isActive ? 'var(--lp-step-active-border)' : 'var(--lp-border)'}`,
                    borderRadius: 14, padding: '20px 16px', textAlign: 'center',
                    transition: 'all 0.35s ease',
                    transform: isActive ? 'translateY(-4px)' : 'none',
                    boxShadow: isActive ? 'var(--lp-step-active-shadow)' : 'none',
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? '#0F766E' : 'var(--lp-bg-card)', border: '1px solid var(--lp-border)', fontSize: '0.75rem', fontWeight: 900, color: isActive ? '#fff' : 'var(--lp-text-muted)', transition: 'all 0.35s' }}>{s.num}</div>
                    <h4 style={{ fontSize: '0.87rem', fontWeight: 700, marginBottom: 6, color: isActive ? 'var(--lp-accent)' : 'var(--lp-text)', transition: 'color 0.35s' }}>{s.title}</h4>
                    <p style={{ fontSize: '0.76rem', color: 'var(--lp-text-muted)', lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0F766E', color: '#fff', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700, padding: '12px 28px', borderRadius: 10, boxShadow: '0 4px 16px rgba(15,118,110,0.35)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#115E59'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0F766E'; e.currentTarget.style.transform = 'none'; }}>
                {t('landing.howSection.cta')}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ══ SECURITY ══ */}
        <section id="security" className="lp-section-dark" style={{ padding: '96px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 64, alignItems: 'center' }}>
              <div ref={refSecLeft} className="lp-reveal">
                <SectionBadge label={t('landing.securitySection.badge')} />
                <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 16 }}>
                  {t('landing.securitySection.titleBefore')}
                  <span style={{ color: 'var(--lp-accent)' }}>{t('landing.securitySection.titleAccent')}</span>
                </h2>
                <p style={{ fontSize: '0.92rem', color: 'var(--lp-text-muted)', lineHeight: 1.75, marginBottom: 28 }}>
                  {t('landing.securitySection.subtitle')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
                  {[
                    { title: 'SHA-256',     sub: t('landing.securitySection.tech.shaSub') },
                    { title: 'HMAC-SHA256', sub: t('landing.securitySection.tech.hmacSub') },
                    { title: 'OTP 2FA',     sub: t('landing.securitySection.tech.otpSub') },
                    { title: 'JWT Tokens',  sub: t('landing.securitySection.tech.jwtSub') },
                  ].map(({ title, sub }) => (
                    <div key={title} className="lp-tech-badge">
                      <div style={{ fontSize: '0.87rem', fontWeight: 700, color: 'var(--lp-text)', marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--lp-text-muted)', lineHeight: 1.4 }}>{sub}</div>
                    </div>
                  ))}
                </div>
                <Link to="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--lp-section-badge-border)', color: 'var(--lp-accent)', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 600, padding: '9px 18px', borderRadius: 9, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--lp-step-active-bg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  {t('landing.securitySection.tryVerifyPortal')}
                </Link>
              </div>
              <div ref={refSecRight} className="lp-reveal" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 24, background: 'radial-gradient(ellipse at center,rgba(15,118,110,0.10) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <div className="lp-chain-wrap" style={{ position: 'relative' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lp-text-faint)', marginBottom: 16 }}>{t('landing.securitySection.integrityChain')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {chain.map((item, i) => (
                      <div key={i} className="lp-chain-item">
                        <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--lp-text-muted)', lineHeight: 1.5, margin: 0 }}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ ROLES / ABOUT ══ */}
        <section id="about" className="lp-section-alt" style={{ padding: '96px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div ref={refRoleHead} className="lp-reveal" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 56px' }}>
              <SectionBadge label={t('landing.rolesSection.badge')} />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                {t('landing.rolesSection.titleBefore')}
                <span style={{ color: 'var(--lp-accent)' }}>{t('landing.rolesSection.titleAccent')}</span>
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                {t('landing.rolesSection.subtitle')}
              </p>
            </div>
            <div ref={refRoles} className="lp-reveal lp-reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
              {roles.map(r => (
                <div key={r.name} className="lp-role-card">
                  <img src={r.image} alt={r.name} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', marginBottom: 14, background: 'rgba(128,128,128,0.08)', padding: 4 }} />
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--lp-text)', marginBottom: 6 }}>{r.name}</h4>
                  <p style={{ fontSize: '0.77rem', color: 'var(--lp-text-muted)', lineHeight: 1.55, marginBottom: 14 }}>{r.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {r.perms.map(p => (
                      <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '0.75rem', color: 'var(--lp-text-muted)' }}>
                        <svg style={{ flexShrink: 0, marginTop: 2, color: r.color }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FAQ — public, any visitor can read the help center ══ */}
        <section id="faq" className="lp-section-alt" style={{ padding: '96px 24px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div ref={refFaq} className="lp-reveal" style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 48px' }}>
              <SectionBadge label={t('landing.faqSection.badge')} />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                {t('landing.faqSection.titleBefore')}
                <span style={{ color: 'var(--lp-accent)' }}>{t('landing.faqSection.titleAccent')}</span>
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                {t('landing.faqSection.subtitle')}
              </p>
            </div>

            <div style={{
              background: 'var(--lp-bg-alt)', border: '1px solid var(--lp-border-med)',
              borderRadius: 20, padding: '32px 28px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
            }}>
              <FaqAccordion roleAware={false} />
            </div>
          </div>
        </section>

        {/* ══ VERIFICATION — inline, no page redirect ══ */}
        <section id="verification" className="lp-section-dark" style={{ padding: '96px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div ref={refVerify} className="lp-reveal" style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 48px' }}>
              <SectionBadge label={t('landing.verificationSection.badge')} />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                {t('landing.verificationSection.titleBefore')}
                <span style={{ color: 'var(--lp-accent)' }}>{t('landing.verificationSection.titleAccent')}</span>
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                {t('landing.verificationSection.subtitle')}
              </p>
            </div>

            {/* Inline verify widget — rendered right here, no page navigation */}
            <div style={{
              maxWidth: 560, margin: '0 auto',
              background: 'var(--lp-bg-alt)', border: '1px solid var(--lp-border-med)',
              borderRadius: 20, padding: '32px 28px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}>
              {/* Shield icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--lp-section-badge-bg)', border: '1px solid var(--lp-section-badge-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-accent)', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--lp-text)' }}>{t('landing.verificationSection.portalTitle')}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--lp-text-muted)', marginTop: 2 }}>{t('landing.verificationSection.portalSubtitle')}</div>
                </div>
              </div>
              <InlineVerifyWidget />
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ══ */}
        <section style={{ background: 'var(--lp-cta-bg)', padding: '96px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle,#ffffff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
          <div ref={refFinalCta} className="lp-reveal" style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <img src={logo} alt="DocuVault" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }} />
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#fff', marginBottom: 16, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              {t('landing.cta.titleBefore')}
              <span style={{ color: '#CCFBF1' }}>{t('landing.cta.titleAccent')}</span>
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
              {t('landing.cta.subtitle')}
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', color: '#0F766E', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 800, padding: '14px 32px', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.20)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'none'; }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                {t('landing.cta.signInToWorkspace')}
              </Link>
              <Link to="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.30)', color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, padding: '14px 28px', borderRadius: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'none'; }}>
                {t('landing.footer.verifyDocument')}
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
