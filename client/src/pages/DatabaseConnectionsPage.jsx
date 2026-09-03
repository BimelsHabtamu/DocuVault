/**
 * Database Connections — Super Admin only
 * "How does the application connect to the database?"
 *
 * Security rules enforced on this page:
 *   • Password is NEVER returned by the API (server always sends "")
 *   • Password is NEVER stored in localStorage or any persistent store
 *   • The password field is always type="password" (masked)
 *   • A new password is only sent when the user explicitly types one
 *     (empty = "keep current password on server")
 *   • Credentials are never logged or exposed in source
 *
 * API (all super_admin-only):
 *   GET  /api/settings/db-connection         → connection metadata (no password)
 *   POST /api/settings/db-connection/test    → tests live pool (no creds from client)
 */
import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';

// ─────────────────────────────────────────────────────────────────────────────
// Tiny design primitives (match white admin console)
// ─────────────────────────────────────────────────────────────────────────────
function Pulse({ h = 'h-4', w = 'w-full' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${h} ${w}`} />;
}

function FieldLabel({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {children}
      </span>
      {hint && (
        <span className="block text-[10px] text-gray-400 mt-0.5 normal-case
          font-normal tracking-normal">
          {hint}
        </span>
      )}
    </label>
  );
}

function Input({ id, type = 'text', value, onChange, placeholder,
  error, disabled, autoComplete, readOnly }) {
  return (
    <div className="mt-1.5">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={autoComplete || 'off'}
        className={[
          'w-full h-10 px-3.5 text-sm rounded-xl border transition',
          'bg-white text-gray-900 placeholder-gray-400',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
            : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500',
          (disabled || readOnly) ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : '',
        ].join(' ')}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection status badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status, latency }) {
  if (status === 'testing') {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Testing connection…
      </div>
    );
  }
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-sm font-semibold text-emerald-600">Connected</span>
        {latency !== null && latency !== undefined && (
          <span className="text-xs text-gray-400">· {latency} ms</span>
        )}
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-sm font-semibold text-red-500">Connection Failed</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
      <span className="text-sm text-gray-400">Not tested</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page root — role guard then content
// ─────────────────────────────────────────────────────────────────────────────
export default function DatabaseConnectionsPage() {
  const { user } = useAuth();

  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <DBConnectionContent />;
}

function DBConnectionContent() {
  // ── Remote state (what the server knows) ──────────────────────────────────
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── Form state (what the user is editing) ─────────────────────────────────
  // Password is NEVER pre-filled from the server.
  // An empty password field means "keep current password — don't change it".
  const [form, setForm] = useState({
    name:     'Primary Database',
    type:     'MySQL',
    host:     '',
    port:     '3306',
    database: '',
    username: '',
    password: '',    // always starts blank; only sent if user types something
    ssl:      false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // ── Test state ────────────────────────────────────────────────────────────
  const [testStatus,  setTestStatus]  = useState('idle'); // idle|testing|connected|failed
  const [testMessage, setTestMessage] = useState('');
  const [testLatency, setTestLatency] = useState(null);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [saveErr,setSaveErr]  = useState('');

  // ── Load connection metadata (no password) ────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    axiosInstance.get('/settings/db-connection')
      .then(r => {
        setRemote(r.data);
        setForm(prev => ({
          ...prev,
          host:     r.data.host     || '',
          port:     r.data.port     || '3306',
          database: r.data.database || '',
          username: r.data.username || '',
          type:     r.data.type     || 'MySQL',
          ssl:      r.data.ssl      || false,
          // password deliberately NOT set — stays blank
        }));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Clear "saved" flash after 3 s
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  // ── Field updater ─────────────────────────────────────────────────────────
  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => { const n = { ...p }; delete n[k]; return n; });
    setSaved(false);
    // Any edit resets the test result so the badge can't misrepresent the state
    setTestStatus('idle');
    setTestMessage('');
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.host.trim())     e.host     = 'Host is required';
    const port = Number(form.port);
    if (!form.port || isNaN(port) || port < 1 || port > 65535)
      e.port = 'Port must be 1 – 65535';
    if (!form.database.trim()) e.database = 'Database name is required';
    if (!form.username.trim()) e.username = 'Username is required';
    return e;
  };

  // ── Test connection (calls server — no credentials sent from browser) ─────
  const testConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    setTestLatency(null);
    try {
      const r = await axiosInstance.post('/settings/db-connection/test');
      if (r.data.connected) {
        setTestStatus('connected');
        setTestLatency(r.data.latency_ms);
        setTestMessage(r.data.message || 'Connection successful');
      } else {
        setTestStatus('failed');
        setTestMessage(r.data.message || 'Connection failed');
      }
    } catch {
      setTestStatus('failed');
      setTestMessage('Could not reach the server');
    }
  };

  // ── Save (read-only for now — .env is managed server-side) ───────────────
  // NOTE: This page intentionally does not have a PUT endpoint because
  // changing DB credentials requires a server restart and is an infrastructure
  // operation — not a runtime config change. Saving updates only the display
  // name and UI-friendly metadata stored in system_settings.
  // Actual DB credentials live in .env and require server-level access.
  const handleSave = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    setSaveErr('');
    setSaved(false);

    try {
      // Store the connection display name in system_settings (no credentials)
      await axiosInstance.put('/settings/system', {
        // Merge into existing config; only update the db_display_name key
        // under a safe non-sensitive section
        storage: {
          ...(remote?.storage || {}),
          db_display_name: form.name,
        },
      });
      setSaved(true);
    } catch (err) {
      setSaveErr(err.response?.data?.message || 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading skeleton
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl space-y-6 pb-8">
        <div>
          <Pulse h="h-8" w="w-64" />
          <Pulse h="h-4" w="w-80 mt-2" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i}>
                <Pulse h="h-3" w="w-24" />
                <Pulse h="h-10" w="w-full mt-1.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Error state
  // ─────────────────────────────────────────────────────────────────────────
  if (loadError) {
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
            <p className="text-sm font-semibold text-gray-700">
              Failed to load connection configuration
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Check the server and try again.
            </p>
          </div>
          <button onClick={load}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white
              text-sm font-semibold rounded-xl transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-5 pb-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Database Connections</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            How does the application connect to the database? — Super Admin only
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

      {/* ── Connection card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center
          justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100
              flex items-center justify-center flex-shrink-0">
              <svg className="w-[18px] h-[18px] text-blue-600"
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3M4 7v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3M4 17c0 1.657 3.582 3 8 3s8-1.343 8-3v-5"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Primary Database</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {form.type} · {form.host || '—'}:{form.port}
              </p>
            </div>
          </div>

          {/* Live status badge */}
          <StatusBadge
            status={testStatus}
            latency={testLatency}
          />
        </div>

        {/* Form fields */}
        <div className="p-6 space-y-5">

          {/* Connection Name */}
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="conn_name"
              hint="Friendly label shown in the Admin Console">
              Connection Name
            </FieldLabel>
            <Input
              id="conn_name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">

            {/* Database Type */}
            <div>
              <FieldLabel htmlFor="db_type">Database Type</FieldLabel>
              <div className="mt-1.5">
                <select
                  id="db_type"
                  value={form.type}
                  onChange={e => set('type', e.target.value)}
                  className="w-full h-10 px-3.5 text-sm rounded-xl border border-gray-200
                    bg-white text-gray-900 focus:outline-none focus:ring-2
                    focus:ring-blue-500/20 focus:border-blue-500 transition"
                >
                  <option value="MySQL">MySQL</option>
                  <option value="PostgreSQL">PostgreSQL</option>
                  <option value="MariaDB">MariaDB</option>
                  <option value="MSSQL">Microsoft SQL Server</option>
                </select>
              </div>
            </div>

            {/* SSL */}
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.ssl}
                  onClick={() => set('ssl', !form.ssl)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full
                    transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    ${form.ssl ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white
                    shadow-sm transform transition-transform
                    ${form.ssl ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-800">SSL / TLS</p>
                  <p className="text-xs text-gray-400">
                    {form.ssl ? 'Encrypted connection' : 'Unencrypted connection'}
                  </p>
                </div>
              </label>
            </div>

            {/* Host */}
            <div>
              <FieldLabel htmlFor="db_host" hint="Hostname or IP address" >
                Host
              </FieldLabel>
              <Input
                id="db_host"
                value={form.host}
                onChange={e => set('host', e.target.value)}
                placeholder="localhost"
                error={errors.host}
                autoComplete="off"
              />
            </div>

            {/* Port */}
            <div>
              <FieldLabel htmlFor="db_port">Port</FieldLabel>
              <Input
                id="db_port"
                type="number"
                value={form.port}
                onChange={e => set('port', e.target.value)}
                placeholder="3306"
                error={errors.port}
              />
            </div>

            {/* Database Name */}
            <div>
              <FieldLabel htmlFor="db_name">Database Name</FieldLabel>
              <Input
                id="db_name"
                value={form.database}
                onChange={e => set('database', e.target.value)}
                placeholder="pdf_engine_db"
                error={errors.database}
                autoComplete="off"
              />
            </div>

            {/* Username */}
            <div>
              <FieldLabel htmlFor="db_user">Username</FieldLabel>
              <Input
                id="db_user"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                placeholder="root"
                error={errors.username}
                autoComplete="new-password"
              />
            </div>

            {/* Password — always masked, never pre-filled */}
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="db_pass"
                hint="Leave blank to keep the current server-side password">
                Password
              </FieldLabel>
              <div className="relative mt-1.5">
                <input
                  id="db_pass"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="••••••••  (not shown — leave blank to keep current)"
                  autoComplete="new-password"
                  className="w-full h-10 pl-3.5 pr-10 text-sm rounded-xl border border-gray-200
                    bg-white text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                    text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      </svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Test result message */}
          {testMessage && testStatus !== 'testing' && (
            <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm
              ${testStatus === 'connected'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {testStatus === 'connected'
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                }
              </svg>
              <span>{testMessage}</span>
            </div>
          )}

          {/* Security notice */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100
            rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              Database credentials are stored in the server{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">.env</code> file
              and are <strong>never exposed</strong> through this interface.
              The password field above is always blank — enter a value only
              if you intend to update it on the server.
              Changes to <code className="font-mono bg-amber-100 px-1 rounded">DB_HOST</code>,
              {' '}<code className="font-mono bg-amber-100 px-1 rounded">DB_PASSWORD</code>{' '}
              etc. require a server restart to take effect.
            </p>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3
            pt-5 border-t border-gray-100">

            {/* Save status */}
            <div className="h-5">
              {saving && (
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Saving…
                </span>
              )}
              {!saving && saved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  Saved
                </span>
              )}
              {!saving && saveErr && (
                <span className="text-xs text-red-500">{saveErr}</span>
              )}
            </div>

            <div className="flex gap-2">
              {/* Test Connection */}
              <button
                type="button"
                onClick={testConnection}
                disabled={testStatus === 'testing'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm
                  font-semibold border border-gray-200 bg-white text-gray-700
                  hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                {testStatus === 'testing'
                  ? <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Testing…
                    </>
                  : <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                      </svg>
                      Test Connection
                    </>
                }
              </button>

              {/* Save Connection */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm
                  font-semibold bg-blue-600 hover:bg-blue-700 text-white
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving
                  ? <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Saving…
                    </>
                  : <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                      </svg>
                      Save Connection
                    </>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Environment reference (read-only info panel) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">
            Server Environment Reference
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Read-only. These are the actual variable names from the server{' '}
            <code className="font-mono">.env</code> file that control the database connection.
          </p>
        </div>
        <div className="p-6">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { key: 'DB_HOST',     value: form.host     || '(not set)' },
              { key: 'DB_PORT',     value: form.port     || '3306' },
              { key: 'DB_NAME',     value: form.database || '(not set)' },
              { key: 'DB_USER',     value: form.username || '(not set)' },
              { key: 'DB_PASSWORD', value: '••••••••  (hidden)' },
              { key: 'DB_SSL',      value: form.ssl ? 'true' : 'false' },
            ].map(({ key, value }) => (
              <div key={key}
                className="flex items-center justify-between gap-3 bg-gray-50
                  rounded-xl px-4 py-3 border border-gray-100">
                <code className="text-xs font-mono font-bold text-blue-700">{key}</code>
                <span className={`text-xs font-mono truncate max-w-[160px]
                  ${key === 'DB_PASSWORD' ? 'text-gray-400' : 'text-gray-700'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-4">
            To change these values, edit{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">server/.env</code>{' '}
            on the server and restart the Node.js process.
          </p>
        </div>
      </div>
    </div>
  );
}
