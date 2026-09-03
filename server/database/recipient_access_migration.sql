-- ============================================================
-- Recipient Access Sessions Migration
-- Adds: recipient_access_sessions table
--
-- Each row represents ONE delivery to ONE recipient.
-- The access_token (raw) is sent in the email link.
-- Only its SHA-256 hash is stored here.
-- QR verification and the ON/OFF access gate are tracked here,
-- completely independent of the DocuVault user/auth system.
-- ============================================================

USE pdf_engine_db;

CREATE TABLE IF NOT EXISTS recipient_access_sessions (
  id              INT AUTO_INCREMENT PRIMARY KEY,

  -- Links back to the delivery
  delivery_log_id INT          NOT NULL,
  doc_id          INT          NOT NULL,
  doc_uuid        VARCHAR(100) NOT NULL,

  -- Recipient info (denormalised — delivery exists even if user row is deleted)
  recipient_name  VARCHAR(191) NOT NULL,
  recipient_email VARCHAR(191) NOT NULL,

  -- The secure token sent in the email link (SHA-256 only — raw never stored)
  token_hash      VARCHAR(255) NOT NULL UNIQUE,
  expires_at      DATETIME     NOT NULL,  -- 30 days from delivery

  -- Step 1: QR verification
  qr_verified     TINYINT(1)   NOT NULL DEFAULT 0,
  qr_verified_at  DATETIME     DEFAULT NULL,
  qr_verified_ip  VARCHAR(45)  DEFAULT NULL,

  -- Step 2: Explicit access toggle (ON button)
  access_granted  TINYINT(1)   NOT NULL DEFAULT 0,
  access_granted_at DATETIME   DEFAULT NULL,

  -- Download tracking
  view_count      INT          NOT NULL DEFAULT 0,
  download_count  INT          NOT NULL DEFAULT 0,
  first_viewed_at DATETIME     DEFAULT NULL,
  last_viewed_at  DATETIME     DEFAULT NULL,
  first_downloaded_at DATETIME DEFAULT NULL,

  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (delivery_log_id) REFERENCES delivery_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (doc_id)          REFERENCES generated_docs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ras_token_hash
  ON recipient_access_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_ras_doc_id
  ON recipient_access_sessions (doc_id, created_at DESC);

SELECT 'Recipient access sessions migration complete' AS result;
