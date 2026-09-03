-- ============================================================
-- Email Verification V2 Migration
-- Adds: current_email, status, verified_at, cancelled_at
--       to email_verifications
-- Adds: email_verified_at to users
-- Extends: audit_logs.action enum with email-change actions
-- ============================================================

USE pdf_engine_db;

-- email_verifications improvements
ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS current_email VARCHAR(191) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status        ENUM('pending','verified','cancelled','expired') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at   DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at  DATETIME DEFAULT NULL;

-- Back-fill: rows that are used=1 without a verified_at are treated as verified
UPDATE email_verifications
  SET status = 'verified'
  WHERE used = 1 AND status = 'pending';

-- users: timestamp for when account email was first verified
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at DATETIME DEFAULT NULL;

-- audit_logs: extend action enum to include email-change audit events
ALTER TABLE audit_logs
  MODIFY COLUMN action
    ENUM(
      'PREVIEW','GENERATE','SIGN','DELIVER','VERIFY',
      'DOWNLOAD','BULK_GENERATE','ARCHIVE',
      'EMAIL_CHANGE_REQUESTED','EMAIL_CHANGE_VERIFIED',
      'EMAIL_CHANGED','EMAIL_CHANGE_CANCELLED'
    ) NOT NULL;

SELECT 'Email verification v2 migration complete' AS result;
