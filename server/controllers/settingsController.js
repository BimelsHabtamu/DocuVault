const db   = require('../config/db');
const path = require('path');
const fs   = require('fs');

const DEFAULTS = {
  institution: {
    university_name:      '',
    institute_department: '',
    logo_url:             '',
    seal_url:             '',   // company seal image path
    address:              '',
    contact_email:        '',
    contact_phone:        '',
  },
  document: {
    numbering_format: 'DOC-{YYYY}-{0000}',
    default_status:   'draft',
    pdf_page_size:    'A4',
    pdf_orientation:  'portrait',
    categories:       'Academic, Finance, HR, General',
  },
  security: {
    session_timeout_minutes: 60,
    min_password_length:     8,
    max_login_attempts:      5,
    otp_enabled:             true,
    verification_rate_limit: 60,
  },
  esignature: {
    otp_expiration_minutes: 10,
    approval_required:      true,
    signature_provider:     'internal',
  },
  notifications: {
    smtp_host:             '',
    smtp_port:             587,
    smtp_from:             '',
    system_email_enabled:  true,
    in_app_enabled:        true,
  },
  storage: {
    storage_driver:     'local',
    storage_path:       'server/storage/pdfs',
    max_upload_mb:      10,
    allowed_file_types: 'pdf',
  },
  verification: {
    public_verification_enabled: true,
    qr_verification_enabled:     true,
    show_document_metadata:      true,
  },
  audit: {
    retention_days:       365,
    log_system_events:    true,
    log_security_events:  true,
  },
};

function mergeDefaults(value) {
  const parsed = value ? JSON.parse(value) : {};
  return Object.fromEntries(
    Object.entries(DEFAULTS).map(([section, fields]) => [
      section,
      { ...fields, ...(parsed[section] || {}) },
    ])
  );
}

// ── GET /settings/system ─────────────────────────────────────────────────────
exports.getSystemConfiguration = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT config_json FROM system_settings WHERE config_key = ?',
      ['platform']
    );
    res.json(mergeDefaults(rows[0]?.config_json));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load system configuration', error: err.message });
  }
};

// ── PUT /settings/system ─────────────────────────────────────────────────────
exports.updateSystemConfiguration = async (req, res) => {
  try {
    const configuration = mergeDefaults(JSON.stringify(req.body));
    await db.query(
      `INSERT INTO system_settings (config_key, config_json, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE config_json = VALUES(config_json), updated_by = VALUES(updated_by)`,
      ['platform', JSON.stringify(configuration), req.user.id]
    );
    res.json({ message: 'System configuration saved', configuration });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save system configuration', error: err.message });
  }
};

// ── POST /settings/seal — upload company seal image ──────────────────────────
exports.uploadSeal = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    // Load current config
    const [rows] = await db.query(
      'SELECT config_json FROM system_settings WHERE config_key = ?',
      ['platform']
    );
    const config = mergeDefaults(rows[0]?.config_json);

    // Delete old seal file if it exists
    if (config.institution.seal_url) {
      const oldPath = path.join(__dirname, '..', config.institution.seal_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Store relative path
    const relativePath = `storage/uploads/${req.file.filename}`;
    config.institution.seal_url = relativePath;

    await db.query(
      `INSERT INTO system_settings (config_key, config_json, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE config_json = VALUES(config_json), updated_by = VALUES(updated_by)`,
      ['platform', JSON.stringify(config), req.user.id]
    );

    res.json({
      message:  'Company seal uploaded successfully',
      seal_url: relativePath,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload seal', error: err.message });
  }
};

// ── GET /settings/db-connection ──────────────────────────────────────────────
// Returns the current database connection configuration.
// PASSWORD IS ALWAYS REDACTED — never returned to the client.
exports.getDbConnection = (req, res) => {
  res.json({
    host:     process.env.DB_HOST || '',
    port:     process.env.DB_PORT || '3306',
    database: process.env.DB_NAME || '',
    username: process.env.DB_USER || '',
    password: '',   // intentionally empty — never sent to client
    ssl:      process.env.DB_SSL === 'true',
    type:     'MySQL',
  });
};

// ── POST /settings/db-connection/test ────────────────────────────────────────
// Tests the LIVE database connection using the existing pool (SELECT 1).
// No credentials are accepted from or sent to the client.
exports.testDbConnection = async (req, res) => {
  const start = Date.now();
  try {
    const [[row]] = await db.query('SELECT 1 AS ok');
    const latency = Date.now() - start;
    if (row?.ok === 1) {
      return res.json({ connected: true,  message: 'Connection successful', latency_ms: latency });
    }
    res.json({ connected: false, message: 'Unexpected response from database', latency_ms: null });
  } catch (err) {
    res.status(200).json({
      connected: false,
      message:   err.message || 'Connection failed',
      latency_ms: null,
    });
  }
};
