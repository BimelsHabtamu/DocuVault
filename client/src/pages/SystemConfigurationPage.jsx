/**
 * System Settings — Super Admin only
 * "How does the application behave?"
 *
 * API: GET  /api/settings/system  → reads from system_settings table
 *      PUT  /api/settings/system  → writes back (merges with defaults)
 *
 * Three independent sections, each with its own Save button:
 *   1. General Settings
 *   2. Security Settings
 *   3. Email Settings  (SMTP password is intentionally never shown)
 *
 * No mock / hardcoded data. No schema changes.
 */
import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';

// ─────────────────────────────────────────────────────────────────────────────
// Design primitives
// ─────────────────────────────────────────────────────────────────────────────
function Pulse({ h = 'h-4', w = 'w-full' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${h} ${w}`} />;
}

function FieldLabel({ children, required }) {
  return (
    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </span>
  );
}

function Input({ id, type = 'text', value, onChange, placeholder, error,
  min, max, disabled, autoComplete }) {
  return (
    <>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        disabled={disabled}
        autoComplete={autoComplete}
        className={[
          'mt-1.5 w-full h-10 px-3.5 text-sm rounded-xl border transition',
          'bg-white text-gray-900 placeholder-gray-400',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
            : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500',
          disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '',
        ].join(' ')}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </>
  );
}

function Select({ id, value, onChange, options, disabled }) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="mt-1.5 w-full h-10 px-3.5 text-sm rounded-xl border border-gray-200
        bg-white text-gray-900
        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
        transition disabled:bg-gray-50 disabled:text-gray-400"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// Section card wrapper
function Section({ icon, title, description, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100
          flex items-center justify-center flex-shrink-0">
          <svg className="w-[18px] h-[18px] text-blue-600"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

// Per-section save button + status indicator
function SaveBar({ saving, saved, error, onSave, disabled }) {
  return (
    <div className="flex items-center justify-between pt-5 mt-5 border-t border-gray-100">
      {/* Status message */}
      <div className="h-5">
        {saving && (
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Saving…
          </span>
        )}
        {!saving && saved && (
          <span className="text-xs text-emerald-600 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
            Saved successfully
          </span>
        )}
        {!saving && error && (
          <span className="text-xs text-red-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {error}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700
          text-white text-sm font-semibold px-5 py-2 rounded-xl
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving
          ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
        }
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────
function validateGeneral(v) {
  const e = {};
  if (!v.system_name?.trim())          e.system_name   = 'System name is required';
  if (v.system_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.system_email))
                                        e.system_email  = 'Enter a valid email address';
  if (!v.doc_id_prefix?.trim())        e.doc_id_prefix = 'Document ID prefix is required';
  if (!/^[A-Z0-9_-]+$/.test(v.doc_id_prefix?.trim() || ''))
                                        e.doc_id_prefix = 'Use only uppercase letters, digits, _ or -';
  return e;
}

function validateSecurity(v) {
  const e = {};
  const otp = Number(v.otp_expiration);
  const att = Number(v.max_otp_attempts);
  const dl  = Number(v.download_link_expiry_hours);
  const mx  = Number(v.max_access_attempts);
  if (!v.otp_expiration || isNaN(otp) || otp < 1 || otp > 1440)
    e.otp_expiration   = 'Must be 1 – 1440 minutes';
  if (!v.max_otp_attempts || isNaN(att) || att < 1 || att > 20)
    e.max_otp_attempts = 'Must be 1 – 20';
  if (!v.download_link_expiry_hours || isNaN(dl) || dl < 1 || dl > 720)
    e.download_link_expiry_hours = 'Must be 1 – 720 hours';
  if (!v.max_access_attempts || isNaN(mx) || mx < 1 || mx > 20)
    e.max_access_attempts = 'Must be 1 – 20';
  return e;
}

function validateEmail(v) {
  const e = {};
  if (!v.smtp_host?.trim())  e.smtp_host    = 'SMTP host is required';
  const port = Number(v.smtp_port);
  if (!v.smtp_port || isNaN(port) || port < 1 || port > 65535)
    e.smtp_port = 'Port must be 1 – 65535';
  if (!v.smtp_from?.trim())  e.smtp_from    = 'Sender email is required';
  if (v.smtp_from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.smtp_from))
    e.smtp_from = 'Enter a valid email address';
  if (!v.smtp_sender_name?.trim()) e.smtp_sender_name = 'Sender name is required';
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timezone options (limited common set)
// ─────────────────────────────────────────────────────────────────────────────
const TIMEZONES = [
  ['Africa/Addis_Ababa', 'Africa/Addis Ababa (EAT UTC+3)'],
  ['Africa/Cairo',       'Africa/Cairo (EET UTC+2)'],
  ['Africa/Lagos',       'Africa/Lagos (WAT UTC+1)'],
  ['Africa/Nairobi',     'Africa/Nairobi (EAT UTC+3)'],
  ['America/New_York',   'America/New York (EST UTC-5)'],
  ['America/Chicago',    'America/Chicago (CST UTC-6)'],
  ['America/Denver',     'America/Denver (MST UTC-7)'],
  ['America/Los_Angeles','America/Los Angeles (PST UTC-8)'],
  ['Asia/Dubai',         'Asia/Dubai (GST UTC+4)'],
  ['Asia/Kolkata',       'Asia/Kolkata (IST UTC+5:30)'],
  ['Asia/Singapore',     'Asia/Singapore (SGT UTC+8)'],
  ['Asia/Tokyo',         'Asia/Tokyo (JST UTC+9)'],
  ['Europe/London',      'Europe/London (GMT UTC+0)'],
  ['Europe/Paris',       'Europe/Paris (CET UTC+1)'],
  ['Europe/Berlin',      'Europe/Berlin (CET UTC+1)'],
  ['UTC',                'UTC'],
];

const DATE_FORMATS = [
  ['MM/DD/YYYY', 'MM/DD/YYYY  (08/29/2026)'],
  ['DD/MM/YYYY', 'DD/MM/YYYY  (29/08/2026)'],
  ['YYYY-MM-DD', 'YYYY-MM-DD  (2026-08-29)'],
  ['MMM DD, YYYY', 'MMM DD, YYYY  (Aug 29, 2026)'],
  ['DD MMM YYYY', 'DD MMM YYYY  (29 Aug 2026)'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Map between our focused UI fields and the backend config blob
// ─────────────────────────────────────────────────────────────────────────────
function configToGeneral(cfg) {
  return {
    system_name:    cfg.institution?.university_name  || '',
    system_email:   cfg.institution?.contact_email    || '',
    timezone:       cfg.document?.timezone            || 'Africa/Addis_Ababa',
    date_format:    cfg.document?.date_format         || 'DD/MM/YYYY',
    doc_id_prefix:  (cfg.document?.numbering_format   || 'DOC-{YYYY}-{0000}')
                      .split('-')[0] || 'DOC',
  };
}

function generalToConfig(cfg, general) {
  return {
    ...cfg,
    institution: {
      ...cfg.institution,
      university_name: general.system_name,
      contact_email:   general.system_email,
    },
    document: {
      ...cfg.document,
      timezone:         general.timezone,
      date_format:      general.date_format,
      numbering_format: `${general.doc_id_prefix}-{YYYY}-{0000}`,
    },
  };
}

function configToSecurity(cfg) {
  return {
    otp_expiration:           String(cfg.esignature?.otp_expiration_minutes ?? 10),
    max_otp_attempts:         String(cfg.security?.max_login_attempts        ?? 5),
    download_link_expiry_hours: String(cfg.security?.download_link_expiry_hours ?? 48),
    max_access_attempts:      String(cfg.security?.max_access_attempts       ?? 5),
  };
}

function securityToConfig(cfg, sec) {
  return {
    ...cfg,
    esignature: {
      ...cfg.esignature,
      otp_expiration_minutes: Number(sec.otp_expiration),
    },
    security: {
      ...cfg.security,
      max_login_attempts:       Number(sec.max_otp_attempts),
      download_link_expiry_hours: Number(sec.download_link_expiry_hours),
      max_access_attempts:      Number(sec.max_access_attempts),
    },
  };
}

function configToEmail(cfg) {
  return {
    smtp_host:        cfg.notifications?.smtp_host        || '',
    smtp_port:        String(cfg.notifications?.smtp_port ?? 587),
    smtp_from:        cfg.notifications?.smtp_from        || '',
    smtp_sender_name: cfg.notifications?.smtp_sender_name || '',
  };
}

function emailToConfig(cfg, email) {
  return {
    ...cfg,
    notifications: {
      ...cfg.notifications,
      smtp_host:        email.smtp_host,
      smtp_port:        Number(email.smtp_port),
      smtp_from:        email.smtp_from,
      smtp_sender_name: email.smtp_sender_name,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────
export default function SystemConfigurationPage() {
  const { user } = useAuth();

  // Hard gate — system_admin must not reach this page
  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <SystemSettingsContent />;
}

// Extracted into a child so hooks always run after the role guard
function SystemSettingsContent() {
  // ── Raw config from API ──────────────────────────────────────────────────
  const [rawConfig,   setRawConfig]   = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError,   setPageError]   = useState(false);

  // ── Section form state ───────────────────────────────────────────────────
  const [general,  setGeneral]  = useState(null);
  const [security, setSecurity] = useState(null);
  const [email,    setEmail]    = useState(null);

  // ── Per-section validation errors ────────────────────────────────────────
  const [genErrors, setGenErrors] = useState({});
  const [secErrors, setSecErrors] = useState({});
  const [emlErrors, setEmlErrors] = useState({});

  // ── Per-section save state ───────────────────────────────────────────────
  const [genSaving,  setGenSaving]  = useState(false);
  const [genSaved,   setGenSaved]   = useState(false);
  const [genSaveErr, setGenSaveErr] = useState('');

  const [secSaving,  setSecSaving]  = useState(false);
  const [secSaved,   setSecSaved]   = useState(false);
  const [secSaveErr, setSecSaveErr] = useState('');

  const [emlSaving,  setEmlSaving]  = useState(false);
  const [emlSaved,   setEmlSaved]   = useState(false);
  const [emlSaveErr, setEmlSaveErr] = useState('');

  // ── Load config ──────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setPageLoading(true);
    setPageError(false);
    axiosInstance.get('/settings/system')
      .then(r => {
        const cfg = r.data;
        setRawConfig(cfg);
        setGeneral(configToGeneral(cfg));
        setSecurity(configToSecurity(cfg));
        setEmail(configToEmail(cfg));
      })
      .catch(() => setPageError(true))
      .finally(() => setPageLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Clear the "Saved" flash after 3 s
  useEffect(() => {
    if (!genSaved) return;
    const t = setTimeout(() => setGenSaved(false), 3000);
    return () => clearTimeout(t);
  }, [genSaved]);
  useEffect(() => {
    if (!secSaved) return;
    const t = setTimeout(() => setSecSaved(false), 3000);
    return () => clearTimeout(t);
  }, [secSaved]);
  useEffect(() => {
    if (!emlSaved) return;
    const t = setTimeout(() => setEmlSaved(false), 3000);
    return () => clearTimeout(t);
  }, [emlSaved]);

  // ── Save helpers ─────────────────────────────────────────────────────────
  const saveSection = useCallback(async (newConfig, setSaving, setSaved, setSaveErr) => {
    setSaving(true);
    setSaved(false);
    setSaveErr('');
    try {
      await axiosInstance.put('/settings/system', newConfig);
      setRawConfig(newConfig);
      setSaved(true);
    } catch (err) {
      setSaveErr(err.response?.data?.message || 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  }, []);

  const saveGeneral = () => {
    const errs = validateGeneral(general);
    setGenErrors(errs);
    if (Object.keys(errs).length) return;
    setGenSaveErr('');
    const updated = generalToConfig(rawConfig, general);
    saveSection(updated, setGenSaving, setGenSaved, setGenSaveErr);
  };

  const saveSecurity = () => {
    const errs = validateSecurity(security);
    setSecErrors(errs);
    if (Object.keys(errs).length) return;
    setSecSaveErr('');
    const updated = securityToConfig(rawConfig, security);
    saveSection(updated, setSecSaving, setSecSaved, setSecSaveErr);
  };

  const saveEmail = () => {
    const errs = validateEmail(email);
    setEmlErrors(errs);
    if (Object.keys(errs).length) return;
    setEmlSaveErr('');
    const updated = emailToConfig(rawConfig, email);
    saveSection(updated, setEmlSaving, setEmlSaved, setEmlSaveErr);
  };

  // Generic field updater
  const updG = (k, v) => { setGeneral(p => ({ ...p, [k]: v }));  setGenErrors(p => { const n = {...p}; delete n[k]; return n; }); setGenSaved(false); };
  const updS = (k, v) => { setSecurity(p => ({ ...p, [k]: v })); setSecErrors(p => { const n = {...p}; delete n[k]; return n; }); setSecSaved(false); };
  const updE = (k, v) => { setEmail(p => ({ ...p, [k]: v }));    setEmlErrors(p => { const n = {...p}; delete n[k]; return n; }); setEmlSaved(false); };

  // ── Loading state ────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="max-w-3xl space-y-6 pb-8">
        <div>
          <Pulse h="h-8" w="w-56" />
          <Pulse h="h-4" w="w-72 mt-2" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <Pulse h="h-5" w="w-40" />
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(j => (
                <div key={j}>
                  <Pulse h="h-3" w="w-24" />
                  <Pulse h="h-10" w="w-full mt-1.5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (pageError) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10
          flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Failed to load system settings</p>
            <p className="text-xs text-gray-400 mt-1">Check the server connection and try again.</p>
          </div>
          <button onClick={load}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
              font-semibold rounded-xl transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-6 pb-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            How does the application behave? — Super Admin only
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold
          text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg
          flex-shrink-0 self-start">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          Super Admin
        </span>
      </div>

      {/* ── 1. General Settings ─────────────────────────────────────────── */}
      <Section
        icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        title="General Settings"
        description="Core identity and formatting settings for the entire platform."
      >
        <div className="grid sm:grid-cols-2 gap-5">

          {/* System Name */}
          <div className="sm:col-span-2">
            <label htmlFor="system_name">
              <FieldLabel required>System / Organization Name</FieldLabel>
            </label>
            <Input
              id="system_name"
              value={general.system_name}
              onChange={e => updG('system_name', e.target.value)}
              placeholder="e.g. Addis Ababa University"
              error={genErrors.system_name}
            />
          </div>

          {/* System Email */}
          <div className="sm:col-span-2">
            <label htmlFor="system_email">
              <FieldLabel>System Contact Email</FieldLabel>
            </label>
            <Input
              id="system_email"
              type="email"
              value={general.system_email}
              onChange={e => updG('system_email', e.target.value)}
              placeholder="admin@yourdomain.com"
              error={genErrors.system_email}
              autoComplete="off"
            />
          </div>

          {/* Timezone */}
          <div>
            <label htmlFor="timezone">
              <FieldLabel>Timezone</FieldLabel>
            </label>
            <Select
              id="timezone"
              value={general.timezone}
              onChange={e => updG('timezone', e.target.value)}
              options={TIMEZONES}
            />
          </div>

          {/* Date Format */}
          <div>
            <label htmlFor="date_format">
              <FieldLabel>Date Format</FieldLabel>
            </label>
            <Select
              id="date_format"
              value={general.date_format}
              onChange={e => updG('date_format', e.target.value)}
              options={DATE_FORMATS}
            />
          </div>

          {/* Document ID Prefix */}
          <div>
            <label htmlFor="doc_id_prefix">
              <FieldLabel required>Document ID Prefix</FieldLabel>
              <p className="text-[10px] text-gray-400 mt-0.5 normal-case font-normal tracking-normal">
                Combined with date to form e.g.&nbsp;
                <code className="font-mono bg-gray-100 px-1 rounded">
                  {(general.doc_id_prefix || 'DOC').toUpperCase()}-2026-0001
                </code>
              </p>
            </label>
            <Input
              id="doc_id_prefix"
              value={general.doc_id_prefix}
              onChange={e => updG('doc_id_prefix', e.target.value.toUpperCase())}
              placeholder="DOC"
              error={genErrors.doc_id_prefix}
            />
          </div>
        </div>

        <SaveBar
          saving={genSaving}
          saved={genSaved}
          error={genSaveErr}
          onSave={saveGeneral}
          disabled={pageLoading}
        />
      </Section>

      {/* ── 2. Security Settings ─────────────────────────────────────────── */}
      <Section
        icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        title="Security Settings"
        description="OTP expiry, attempt limits, and session security controls."
      >
        <div className="grid sm:grid-cols-2 gap-5">

          {/* OTP Expiration */}
          <div>
            <label htmlFor="otp_expiration">
              <FieldLabel required>OTP Expiration (minutes)</FieldLabel>
              <p className="text-[10px] text-gray-400 mt-0.5 normal-case font-normal tracking-normal">
                How long an OTP code remains valid (1 – 1440 min)
              </p>
            </label>
            <Input
              id="otp_expiration"
              type="number"
              min={1} max={1440}
              value={security.otp_expiration}
              onChange={e => updS('otp_expiration', e.target.value)}
              error={secErrors.otp_expiration}
            />
          </div>

          {/* Max OTP Attempts */}
          <div>
            <label htmlFor="max_otp_attempts">
              <FieldLabel required>Maximum OTP Attempts</FieldLabel>
              <p className="text-[10px] text-gray-400 mt-0.5 normal-case font-normal tracking-normal">
                Wrong OTP entries before the code is locked (1 – 20)
              </p>
            </label>
            <Input
              id="max_otp_attempts"
              type="number"
              min={1} max={20}
              value={security.max_otp_attempts}
              onChange={e => updS('max_otp_attempts', e.target.value)}
              error={secErrors.max_otp_attempts}
            />
          </div>

          {/* Download Link Expiry */}
          <div>
            <label htmlFor="download_link_expiry_hours">
              <FieldLabel required>Download Link Expiration (hours)</FieldLabel>
              <p className="text-[10px] text-gray-400 mt-0.5 normal-case font-normal tracking-normal">
                Hours before a delivery download link expires (1 – 720)
              </p>
            </label>
            <Input
              id="download_link_expiry_hours"
              type="number"
              min={1} max={720}
              value={security.download_link_expiry_hours}
              onChange={e => updS('download_link_expiry_hours', e.target.value)}
              error={secErrors.download_link_expiry_hours}
            />
          </div>

          {/* Max Access Attempts */}
          <div>
            <label htmlFor="max_access_attempts">
              <FieldLabel required>Maximum Access Attempts</FieldLabel>
              <p className="text-[10px] text-gray-400 mt-0.5 normal-case font-normal tracking-normal">
                Failed login attempts before account lockout (1 – 20)
              </p>
            </label>
            <Input
              id="max_access_attempts"
              type="number"
              min={1} max={20}
              value={security.max_access_attempts}
              onChange={e => updS('max_access_attempts', e.target.value)}
              error={secErrors.max_access_attempts}
            />
          </div>
        </div>

        <SaveBar
          saving={secSaving}
          saved={secSaved}
          error={secSaveErr}
          onSave={saveSecurity}
          disabled={pageLoading}
        />
      </Section>

      {/* ── 3. Email Settings ────────────────────────────────────────────── */}
      <Section
        icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        title="Email Settings"
        description="Outbound SMTP configuration for document delivery and OTP emails."
      >
        {/* SMTP password deliberately excluded — never shown in UI */}
        <div className="grid sm:grid-cols-2 gap-5">

          {/* SMTP Host */}
          <div className="sm:col-span-2">
            <label htmlFor="smtp_host">
              <FieldLabel required>SMTP Host</FieldLabel>
            </label>
            <Input
              id="smtp_host"
              value={email.smtp_host}
              onChange={e => updE('smtp_host', e.target.value)}
              placeholder="smtp.gmail.com"
              error={emlErrors.smtp_host}
              autoComplete="off"
            />
          </div>

          {/* SMTP Port */}
          <div>
            <label htmlFor="smtp_port">
              <FieldLabel required>SMTP Port</FieldLabel>
            </label>
            <Input
              id="smtp_port"
              type="number"
              min={1} max={65535}
              value={email.smtp_port}
              onChange={e => updE('smtp_port', e.target.value)}
              placeholder="587"
              error={emlErrors.smtp_port}
            />
          </div>

          {/* Sender Email */}
          <div>
            <label htmlFor="smtp_from">
              <FieldLabel required>Sender Email</FieldLabel>
            </label>
            <Input
              id="smtp_from"
              type="email"
              value={email.smtp_from}
              onChange={e => updE('smtp_from', e.target.value)}
              placeholder="noreply@yourdomain.com"
              error={emlErrors.smtp_from}
              autoComplete="off"
            />
          </div>

          {/* Sender Name */}
          <div className="sm:col-span-2">
            <label htmlFor="smtp_sender_name">
              <FieldLabel required>Sender Display Name</FieldLabel>
            </label>
            <Input
              id="smtp_sender_name"
              value={email.smtp_sender_name}
              onChange={e => updE('smtp_sender_name', e.target.value)}
              placeholder="DocuVault"
              error={emlErrors.smtp_sender_name}
            />
          </div>
        </div>

        {/* Password notice */}
        <div className="mt-5 flex items-start gap-2.5 bg-amber-50 border border-amber-100
          rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>SMTP password</strong> is stored securely in the server environment
            and is never exposed here. To change it, update the{' '}
            <code className="font-mono bg-amber-100 px-1 rounded">MAIL_PASS</code>{' '}
            value in the server <code className="font-mono bg-amber-100 px-1 rounded">.env</code> file
            and restart the server.
          </p>
        </div>

        <SaveBar
          saving={emlSaving}
          saved={emlSaved}
          error={emlSaveErr}
          onSave={saveEmail}
          disabled={pageLoading}
        />
      </Section>

      {/* ── 4. Branding — Company Seal ───────────────────────────────────── */}
      <BrandingSection
        rawConfig={rawConfig}
        onConfigUpdate={setRawConfig}
      />
    </div>
  );
}

// ── Branding / Seal section (self-contained with its own state) ───────────────
function BrandingSection({ rawConfig, onConfigUpdate }) {
  const [sealUrl, setSealUrl]       = useState(rawConfig?.institution?.seal_url || '');
  const [uploading, setUploading]   = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');
  const [dragOver, setDragOver]     = useState(false);

  // Keep in sync when rawConfig reloads
  useEffect(() => {
    setSealUrl(rawConfig?.institution?.seal_url || '');
  }, [rawConfig?.institution?.seal_url]);

  const sealPreviewUrl = sealUrl
    ? (sealUrl.startsWith('http') || sealUrl.startsWith('data:')
        ? sealUrl
        : `/${sealUrl.replace(/^storage\//, '')}`)
    : null;

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp|svg\+xml)$/)) {
      setError('Only PNG, JPG, WebP, or SVG images are supported.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2 MB.');
      return;
    }
    setError('');
    setUploading(true);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.append('seal', file);
      const res = await axiosInstance.post('/settings/seal', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data.seal_url || '';
      setSealUrl(newUrl);
      // Update the shared rawConfig so it stays in sync
      if (onConfigUpdate && rawConfig) {
        onConfigUpdate({
          ...rawConfig,
          institution: { ...rawConfig.institution, seal_url: newUrl },
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => handleUpload(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files?.[0]);
  };

  const handleRemove = async () => {
    if (!sealUrl) return;
    try {
      // Upload a blank slot by sending an empty PUT to system config
      const updated = {
        ...rawConfig,
        institution: { ...rawConfig.institution, seal_url: '' },
      };
      await axiosInstance.put('/settings/system', updated);
      setSealUrl('');
      if (onConfigUpdate) onConfigUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to remove seal.');
    }
  };

  return (
    <Section
      icon="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      title="Branding — Company Seal"
      description="Official stamp or seal automatically embedded in templates and PDFs."
    >
      <div className="grid sm:grid-cols-2 gap-6">

        {/* Current seal preview */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div style={{
            width: 120, height: 120,
            borderRadius: '50%',
            border: sealPreviewUrl ? '2px solid #7c3aed' : '2.5px dashed #d8b4fe',
            background: sealPreviewUrl ? '#faf5ff' : '#f5f3ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {sealPreviewUrl ? (
              <img
                src={sealPreviewUrl}
                alt="Company Seal"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#7c3aed' }}>
                <div style={{ fontSize: 28 }}>◉</div>
                <div style={{ fontSize: 10, marginTop: 4 }}>No seal</div>
              </div>
            )}
          </div>
          {sealPreviewUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Remove seal
            </button>
          )}
          {saved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              Saved
            </span>
          )}
        </div>

        {/* Upload zone */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Upload New Seal
          </label>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('seal-file-input')?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#7c3aed' : '#d8b4fe'}`,
              borderRadius: 12,
              padding: '20px 12px',
              background: dragOver ? '#f5f3ff' : '#faf5ff',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-purple-600">
                <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-sm font-medium">Uploading…</span>
              </div>
            ) : (
              <>
                <div className="text-3xl mb-2">◉</div>
                <p className="text-sm font-semibold text-gray-700">Drop seal image here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP — max 2 MB</p>
              </>
            )}
            <input
              id="seal-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {error}
            </p>
          )}

          <p className="text-xs text-gray-400 leading-relaxed">
            The seal is stored in system settings and referenced in templates via{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">{'{{system.company_seal}}'}</code>.
            It is automatically embedded in PDFs using the stored image.
          </p>
        </div>
      </div>
    </Section>
  );
}
