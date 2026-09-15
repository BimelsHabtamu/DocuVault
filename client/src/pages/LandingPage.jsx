import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import logo from '/public/logo.png';

/* ─────────────────────────────────────────────────────────────────────────────
   Scroll-reveal hook
───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   Slideshow
───────────────────────────────────────────────────────────────────────────── */
const SLIDES = [
  { url: '/image1.png', caption: 'Automated document generation' },
  { url: '/image2.png', caption: 'Secure digital signatures' },
  { url: '/image3.png', caption: 'Real-time approval workflows' },
  { url: '/image4.png', caption: 'Verified document delivery' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Features
───────────────────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    accent: '#0F766E', bg: 'rgba(15,118,110,0.12)',
    title: 'Smart Template Engine',
    desc: 'Build document templates with dynamic placeholders, conditional blocks, and loop support. Connect to any internal or external database table.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9v12a2 2 0 01-2 2z"/></svg>),
  },
  {
    accent: '#3B82F6', bg: 'rgba(59,130,246,0.12)',
    title: 'Bulk PDF Generation',
    desc: 'Generate hundreds of personalized PDFs from a CSV upload or multiple record IDs in one batch. Automatic approver assignment included.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>),
  },
  {
    accent: '#F59E0B', bg: 'rgba(245,158,11,0.12)',
    title: 'E-Signature with OTP',
    desc: 'Approvers review the PDF then confirm approval with a one-time password. Every signature is HMAC-SHA256 verified and NTP-timestamped.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>),
  },
  {
    accent: '#16A34A', bg: 'rgba(22,163,74,0.12)',
    title: 'Cryptographic Verification',
    desc: 'Every document carries a SHA-256 hash. Verify authenticity via Document ID, QR code scan, or PDF upload — no login required.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>),
  },
  {
    accent: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',
    title: 'Secure Delivery',
    desc: 'Recipients receive a one-time link with OTP verification. Ownership confirmation, download tracking, and full delivery audit log included.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>),
  },
  {
    accent: '#EF4444', bg: 'rgba(239,68,68,0.12)',
    title: 'Forensic Audit Trail',
    desc: 'Every action — generate, preview, approve, reject, deliver, verify — is logged immutably. Export full CSV audit reports with filters.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>),
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Roles
───────────────────────────────────────────────────────────────────────────── */
const ROLES = [
  { image: '/super.png',     name: 'Super Admin',   color: '#8B5CF6', desc: 'Full system control — templates, users, settings, audit, and all documents.',          perms: ['Manage all templates', 'Manage all users', 'View full audit logs', 'System settings & DB'] },
  { image: '/system.png',    name: 'System Admin',  color: '#0F766E', desc: 'Manages templates and monitors operations without user/settings access.',               perms: ['Create & edit templates', 'Generate documents', 'View audit & reports', 'Manage approvals'] },
  { image: '/generator.png', name: 'Generator',     color: '#3B82F6', desc: 'Generates PDFs from templates and tracks their delivery status.',                       perms: ['Generate documents', 'Track document status', 'Request e-signature', 'Verify documents'] },
  { image: '/approver.png',  name: 'Approver',      color: '#F59E0B', desc: 'Reviews pending documents and applies cryptographic e-signatures via OTP.',             perms: ['Review pending documents', 'Approve or reject', 'Apply HMAC e-signature', 'Verify documents'] },
  { image: '/Recipient.png', name: 'Recipient',     color: '#16A34A', desc: 'Receives delivered documents via secure link and confirms ownership.',                  perms: ['Receive secure documents', 'OTP identity verification', 'Confirm or reject ownership'] },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Workflow steps
───────────────────────────────────────────────────────────────────────────── */
const STEPS = [
  { num: '01', title: 'Create Template', desc: 'Build a document template with dynamic fields mapped to your data source.' },
  { num: '02', title: 'Generate PDF',    desc: 'Select a record ID and generate a personalized PDF instantly or in bulk.' },
  { num: '03', title: 'Request Approval', desc: 'Route the document to an approver with a secure one-time review link.' },
  { num: '04', title: 'E-Sign with OTP', desc: 'Approver verifies identity with OTP and applies a cryptographic signature.' },
  { num: '05', title: 'Secure Delivery', desc: 'Recipient receives a one-time link and confirms ownership with OTP.' },
  { num: '06', title: 'Verify Anytime',  desc: 'Anyone can verify authenticity via Doc ID, QR scan, or PDF upload.' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Security chain
───────────────────────────────────────────────────────────────────────────── */
const CHAIN = [
  'SHA-256 file hash stored at generation time — any tampering is detectable',
  'HMAC-SHA256 signature applied by the approver using a per-user secret key',
  'OTP 2FA required for both approver sign-off and recipient identity confirmation',
  'JWT-secured single-use delivery tokens that expire after 7 days',
  'Full immutable audit log — every action forensically recorded with timestamp',
];

/* ─────────────────────────────────────────────────────────────────────────────
   Theme toggle icons
───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   Inline Verification Widget — embedded on the landing page, no page redirect
───────────────────────────────────────────────────────────────────────────── */
import { verifyByDocId, verifyByFile, verifyDocumentSignature } from '../services/publicService';

function InlineVerifyWidget() {
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
        if (!pdfFile) { setError('Please select a PDF file.'); setLoading(false); return; }
        res = await verifyByFile(pdfFile);
      } else {
        const id = docId.trim().toUpperCase();
        if (!id) { setError('Please enter a Document ID.'); setLoading(false); return; }
        res = await verifyByDocId(id);
      }
      if (!res.data) throw new Error(res.message || 'Verification failed.');
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySig() {
    if (!result?.docId) return;
    setSigLoading(true); setSigError(null); setSigResult(null);
    try {
      const res = await verifyDocumentSignature(result.docId);
      if (!res.data) throw new Error(res.message || 'Signature verification failed.');
      setSigResult(res.data);
    } catch (err) {
      setSigError(err.message || 'Signature verification failed.');
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
        {[{ id: 'doc_id', label: 'By Document ID' }, { id: 'upload', label: 'Upload PDF' }].map(tab => (
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
            <label htmlFor="lp-verify-id" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--lp-text)', marginBottom: 6 }}>Document ID</label>
            <p style={{ fontSize: '0.74rem', color: 'var(--lp-text-muted)', marginBottom: 8 }}>Format: DOC-YYYYMMDD-XXXXX — printed on the document</p>
            <input id="lp-verify-id" value={docId}
              onChange={e => { setDocId(e.target.value); reset(); }}
              placeholder="e.g. DOC-20260817-A1B2C"
              disabled={loading}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid var(--lp-border-med)', borderRadius: 9, fontSize: '0.9rem', fontFamily: 'inherit', color: 'var(--lp-text)', background: 'var(--lp-bg-card)', outline: 'none', textTransform: 'uppercase', letterSpacing: '0.03em', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = '#0F766E'}
              onBlur={e => e.target.style.borderColor = 'var(--lp-border-med)'} />
          </div>
        )}
        {mode === 'upload' && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="lp-verify-pdf" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--lp-text)', marginBottom: 6 }}>Upload PDF</label>
            <p style={{ fontSize: '0.74rem', color: 'var(--lp-text-muted)', marginBottom: 8 }}>Verify integrity against the original stored hash</p>
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
            <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'lp-spin .65s linear infinite', flexShrink: 0 }} aria-hidden="true" /> Verifying…</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Verify Document</>
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
                {verified ? '✓ Document is Authentic & Untampered' : revoked ? '⚠ Document has been Revoked' : notFound ? 'Document Not Found' : '⚠ Document is Corrupt or Forged'}
              </div>
              <div style={{ fontSize: '0.76rem', color: verified ? '#4ADE80' : revoked ? '#FBBF24' : '#F87171', opacity: 0.8, marginTop: 2 }}>
                {verified ? 'Verified against the original record.' : revoked ? 'This document is no longer valid.' : notFound ? 'No document with this ID exists in our records.' : 'Hash mismatch — content may have been modified.'}
              </div>
            </div>
          </div>

          {/* Detail rows */}
          {(result.docId || result.docStatus || result.generatedAt || result.issuedAt || result.revokedAt) && (
            <div style={{ padding: '12px 16px', background: 'var(--lp-bg-card)', borderTop: '1px solid var(--lp-border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                result.docId && { key: 'Document ID', val: result.docId, mono: true },
                result.docStatus && { key: 'Status', val: result.docStatus },
                (result.generatedAt || result.issuedAt) && { key: 'Recorded', val: new Date(result.generatedAt || result.issuedAt).toLocaleString() },
                result.revokedAt && { key: 'Revoked at', val: new Date(result.revokedAt).toLocaleString() },
              ].filter(Boolean).map(row => (
                <div key={row.key} style={{ display: 'flex', gap: 10, fontSize: '0.81rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--lp-text-muted)', minWidth: 100, flexShrink: 0 }}>{row.key}</span>
                  <span style={{ color: 'var(--lp-text)', fontFamily: row.mono ? 'ui-monospace,SFMono-Regular,Menlo,monospace' : 'inherit' }}>{row.val}</span>
                </div>
              ))}
              {(tampered || result.hashNote === 'content_hash_mismatch') && (
                <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: '0.78rem', background: 'rgba(220,38,38,0.10)', color: '#F87171', fontStyle: 'italic' }}>
                  The document may have been modified after generation. Do not rely on its contents.
                </div>
              )}
            </div>
          )}

          {/* Signature panel */}
          {result.docId && (
            <div style={{ padding: '12px 16px', background: 'var(--lp-bg-card)', borderTop: '1px solid var(--lp-border)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--lp-text-muted)', marginBottom: 8 }}>Digital Signature</div>
              {!sigResult && !sigLoading && !sigError && (
                <button type="button" onClick={handleVerifySig}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--lp-border-med)', background: 'var(--lp-bg-card)', color: 'var(--lp-text)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Verify Digital Signature
                </button>
              )}
              {sigLoading && <div style={{ fontSize: '0.79rem', color: 'var(--lp-text-muted)' }}>Verifying signature…</div>}
              {sigError   && <div style={{ fontSize: '0.79rem', color: '#F87171' }}>{sigError}</div>}
              {sigResult  && (
                <div style={{ fontSize: '0.79rem', color: 'var(--lp-text)' }}>
                  <div style={{ color: sigResult.signatureValid ? '#4ADE80' : sigResult.signed === false ? 'var(--lp-text-muted)' : '#F87171', marginBottom: 4 }}>
                    {sigResult.signed === false ? '— Not yet signed' : sigResult.signatureValid ? '✓ Signature valid' : '✗ Signature HMAC mismatch'}
                  </div>
                  {sigResult.signerName && <div>Approver: <strong>{sigResult.signerName}</strong></div>}
                  {sigResult.signedAt   && <div style={{ marginTop: 2 }}>Signed: {new Date(sigResult.signedAt).toLocaleString()}</div>}
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

  const NAV_LINKS = [
    { href: '#home',         label: 'Home' },
    { href: '#features',     label: 'Features' },
    { href: '#how',          label: 'How It Works' },
    { href: '#security',     label: 'Security' },
    { href: '#about',        label: 'About' },
    { href: '#verification', label: 'Verification' },
  ];

  return (
    <header className={`lp-nav${scrolled ? ' lp-nav-scrolled' : ''}`}>
      <div className="lp-nav-inner">
        {/* Logo + brand — clicking goes back to top */}
        <a href="#home" className="lp-nav-brand">
          <img src={logo} alt="DocuVault" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          <span className="lp-nav-brand-name">DocuVault</span>
        </a>

        {/* Desktop nav */}
        <nav className="lp-desktop-nav" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="lp-nav-link">{label}</a>
          ))}
        </nav>

        {/* Right: 🌙 toggle + Sign In */}
        <div className="lp-nav-actions">
          <button
            type="button"
            onClick={toggleTheme}
            className="lp-theme-btn"
            title={dark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label={dark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <Link to="/login" className="lp-nav-signin-btn">Sign In</Link>
        </div>

        {/* Hamburger */}
        <button type="button" className="lp-hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
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
            <button type="button" onClick={toggleTheme} className="lp-mobile-theme-btn">
              {dark ? <IconSun /> : <IconMoon />}
              {dark ? 'Light Mode' : 'Dark Mode'}
            </button>
            <Link to="/login" onClick={() => setMobileOpen(false)} className="lp-mobile-signin-btn">Sign In</Link>
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
              Enterprise-grade document automation. Generate, approve, sign, verify, and deliver with full cryptographic security.
            </p>
          </div>
          <div className="lp-footer-links-row">
            <div>
              <div className="lp-footer-col-title">Platform</div>
              {[
                { href: '#home',     label: 'Home' },
                { href: '#features', label: 'Features' },
                { href: '#how',      label: 'How It Works' },
                { href: '#security', label: 'Security' },
                { href: '#about',    label: 'About' },
                { href: '#verification', label: 'Verification' },
              ].map(({ href, label }) => (
                <a key={href} href={href} className="lp-footer-link">{label}</a>
              ))}
            </div>
            <div>
              <div className="lp-footer-col-title">Access</div>
              <Link to="/login"  className="lp-footer-link">Sign In</Link>
              <Link to="/verify" className="lp-footer-link">Verify Document</Link>
              <Link to="/faq"    className="lp-footer-link">FAQ &amp; Help</Link>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 DocuVault. All rights reserved.</span>
          <span>Enterprise Document Automation Platform</span>
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
  const refVerify   = useReveal();
  const refFinalCta = useReveal();

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => { setSlideIndex(i => (i + 1) % SLIDES.length); setFadeIn(true); }, 500);
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
          {SLIDES.map((slide, i) => (
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
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => { setSlideIndex(i); setFadeIn(true); }} aria-label={`Slide ${i + 1}`} style={{
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
                <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5EEAD4' }}>Enterprise Document Platform</span>
              </div>
              <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.6rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 20 }}>
                <span style={{ display: 'block', color: '#fff' }}>Automate.</span>
                <span style={{ display: 'block', color: '#fff' }}>Verify.</span>
                <span style={{ display: 'block', background: 'linear-gradient(90deg,#5EEAD4,#0F766E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Deliver with Trust.</span>
              </h1>
              <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 32, maxWidth: 500 }}>
                DocuVault is a full-cycle document automation platform — generate PDFs from templates, route for e-signature approval, deliver securely, and verify authenticity with cryptographic proof.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
                {['SHA-256 Hashing', 'OTP E-Signature', 'Bulk Generation', 'QR Verification', 'Full Audit Trail'].map(f => (
                  <span key={f} style={{ fontSize: '0.75rem', fontWeight: 500, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.80)', padding: '5px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#5EEAD4', flexShrink: 0 }} />{f}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0F766E', color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700, padding: '13px 28px', borderRadius: 10, boxShadow: '0 6px 20px rgba(15,118,110,0.45)', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#115E59'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#0F766E'; e.currentTarget.style.transform = 'none'; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                  Sign In to Workspace
                </Link>
                <Link to="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, padding: '13px 24px', borderRadius: 10, transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.transform = 'none'; }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  Verify a Document
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
              { value: '5 Roles',  label: 'Role-based access control' },
              { value: 'SHA-256', label: 'Cryptographic document hashing' },
              { value: 'OTP 2FA', label: 'Two-factor approval & delivery' },
              { value: '100%',    label: 'Forensic audit coverage' },
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
              <SectionBadge label="Platform Capabilities" />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                Everything you need for{' '}
                <span style={{ color: 'var(--lp-accent)' }}>secure document workflows</span>
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                From template creation to verified delivery — every step is automated, secured, and auditable.
              </p>
            </div>
            <div ref={refFeats} className="lp-reveal lp-reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
              {FEATURES.map(f => (
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
              <SectionBadge label="Workflow" />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                Six steps from{' '}
                <span style={{ color: 'var(--lp-accent)' }}>template to verified delivery</span>
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                A complete, automated workflow that eliminates manual document handling.
              </p>
            </div>
            <div ref={refSteps} className="lp-reveal lp-reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16 }}>
              {STEPS.map((s, i) => {
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
                Start Using the Platform
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
                <SectionBadge label="Security Architecture" />
                <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 16 }}>
                  Cryptographic security{' '}
                  <span style={{ color: 'var(--lp-accent)' }}>at every step</span>
                </h2>
                <p style={{ fontSize: '0.92rem', color: 'var(--lp-text-muted)', lineHeight: 1.75, marginBottom: 28 }}>
                  Every document is cryptographically protected from generation to verification. Tampering is instantly detectable at any stage.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
                  {[
                    { title: 'SHA-256',     sub: 'File integrity hash at generation' },
                    { title: 'HMAC-SHA256', sub: 'Per-approver cryptographic signature' },
                    { title: 'OTP 2FA',     sub: 'Identity-verified approvals & delivery' },
                    { title: 'JWT Tokens',  sub: 'Short-lived single-use access tokens' },
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
                  Try the Verify Portal
                </Link>
              </div>
              <div ref={refSecRight} className="lp-reveal" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 24, background: 'radial-gradient(ellipse at center,rgba(15,118,110,0.10) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <div className="lp-chain-wrap" style={{ position: 'relative' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lp-text-faint)', marginBottom: 16 }}>Document Integrity Chain</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {CHAIN.map((item, i) => (
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
              <SectionBadge label="Access Control" />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                Built for every{' '}
                <span style={{ color: 'var(--lp-accent)' }}>team member's role</span>
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                Five distinct roles with purpose-built permission sets. Everyone sees only what they need.
              </p>
            </div>
            <div ref={refRoles} className="lp-reveal lp-reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
              {ROLES.map(r => (
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

        {/* ══ VERIFICATION — inline, no page redirect ══ */}
        <section id="verification" className="lp-section-dark" style={{ padding: '96px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div ref={refVerify} className="lp-reveal" style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 48px' }}>
              <SectionBadge label="Document Verification" />
              <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--lp-text)', lineHeight: 1.2, marginBottom: 14 }}>
                Verify any document{' '}
                <span style={{ color: 'var(--lp-accent)' }}>instantly — no login needed</span>
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--lp-text-muted)', lineHeight: 1.7 }}>
                Enter a Document ID, upload the PDF, or scan the QR code to confirm authenticity and integrity in seconds.
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
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--lp-text)' }}>DocuVault Verification Portal</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--lp-text-muted)', marginTop: 2 }}>Cryptographic authenticity check · Free · No account required</div>
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
              Ready to transform your{' '}
              <span style={{ color: '#CCFBF1' }}>document workflows?</span>
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
              Sign in to your DocuVault workspace and start generating, approving, and delivering documents with full cryptographic security and a complete audit trail.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', color: '#0F766E', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 800, padding: '14px 32px', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.20)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'none'; }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                Sign In to Workspace
              </Link>
              <Link to="/verify" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.30)', color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700, padding: '14px 28px', borderRadius: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'none'; }}>
                Verify a Document
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
