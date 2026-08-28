/**
 * Runs all missing schema fixes in one go.
 * Run with: node database/run_all_fixes.js
 */
require('dotenv').config();
const db = require('../config/db');

const fixes = [
  // ── users table ─────────────────────────────────────────────────────
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set TINYINT(1) NOT NULL DEFAULT 1",
  "UPDATE users SET password_set = 1 WHERE password_set IS NULL",
  "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','system_admin','admin','generator','approver','recipient') NOT NULL",

  // ── delivery_logs extra columns ──────────────────────────────────────
  "ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS doc_uuid VARCHAR(100) DEFAULT NULL",
  "ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS recipient_user_id INT DEFAULT NULL",
  "ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150) DEFAULT NULL",

  // ── audit_logs action ENUM ───────────────────────────────────────────
  "ALTER TABLE audit_logs MODIFY COLUMN action ENUM('PREVIEW','GENERATE','SIGN','DELIVER','VERIFY','DOWNLOAD','BULK_GENERATE') NOT NULL",

  // ── generated_docs status ENUM ───────────────────────────────────────
  "ALTER TABLE generated_docs MODIFY COLUMN status ENUM('draft','pending','signed','rejected','delivered','hand_delivered') NOT NULL DEFAULT 'draft'",

  // ── signature_requests extras ────────────────────────────────────────
  "ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS otp_verified TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS reminder_24h_sent_at DATETIME DEFAULT NULL",
  "ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS escalation_72h_sent_at DATETIME DEFAULT NULL",

  // ── templates extras ─────────────────────────────────────────────────
  "ALTER TABLE templates MODIFY COLUMN category ENUM('HR','Finance','Academic','Procurement','General') NOT NULL",
  "ALTER TABLE templates ADD COLUMN IF NOT EXISTS data_source VARCHAR(100) DEFAULT NULL",
  "ALTER TABLE templates ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL",

  // ── notifications table ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS notifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    type       VARCHAR(50)  NOT NULL DEFAULT 'system',
    title      VARCHAR(255) NOT NULL,
    body       TEXT         NOT NULL,
    link       VARCHAR(500) DEFAULT NULL,
    doc_uuid   VARCHAR(100) DEFAULT NULL,
    is_read    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ── bulk_jobs table ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS bulk_jobs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    job_uuid    VARCHAR(100) NOT NULL UNIQUE,
    template_id INT NOT NULL,
    created_by  INT NOT NULL,
    total       INT NOT NULL DEFAULT 0,
    completed   INT NOT NULL DEFAULT 0,
    failed      INT NOT NULL DEFAULT 0,
    status      ENUM('queued','processing','done','error') NOT NULL DEFAULT 'queued',
    error_log   JSON DEFAULT NULL,
    zip_path    VARCHAR(500) DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE RESTRICT
  )`,

  // ── password_reset_tokens table ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    doc_uuid   VARCHAR(100) DEFAULT NULL,
    expires_at DATETIME     NOT NULL,
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ── email_verifications table ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS email_verifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    new_email  VARCHAR(191) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME     NOT NULL,
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
];

(async () => {
  console.log('\n── Running schema fixes ────────────────────────────\n');
  let ok = 0; let skipped = 0;

  for (const sql of fixes) {
    const label = sql.trim().slice(0, 65).replace(/\s+/g, ' ');
    try {
      await db.query(sql);
      console.log('  ✓', label);
      ok++;
    } catch (e) {
      console.log('  –', label);
      console.log('     skip:', e.message.slice(0, 90));
      skipped++;
    }
  }

  console.log(`\n── Done: ${ok} applied, ${skipped} skipped ───────────────\n`);

  // Final verification
  const [tables] = await db.query('SHOW TABLES');
  console.log('Tables now:', tables.map(t => Object.values(t)[0]).join(', '));

  const [ucols] = await db.query('SHOW COLUMNS FROM users');
  console.log('users cols:', ucols.map(c => c.Field).join(', '));

  process.exit(0);
})();
