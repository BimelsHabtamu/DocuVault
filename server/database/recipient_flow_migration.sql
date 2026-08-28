-- ============================================================
-- Recipient Flow Migration
-- Adds: password_reset_tokens, delivery_logs extensions,
--       DOWNLOAD audit action, recipient_user_id linkage
-- Run after: fr_compliance_migration.sql
-- ============================================================

USE pdf_engine_db;

-- ────────────────────────────────────────────────────────────
-- 1. password_reset_tokens
--    Stores secure set-password / reset tokens.
--    token_hash = SHA-256 of the raw random token sent in email.
--    Expires 48 hours after creation (enforced by app logic).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  token_hash   VARCHAR(255) NOT NULL UNIQUE,
  doc_uuid     VARCHAR(100) DEFAULT NULL,   -- document to highlight after set-password
  expires_at   DATETIME     NOT NULL,
  used         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ────────────────────────────────────────────────────────────
-- 2. delivery_logs — add doc_uuid column
--    Allows recipient inbox to look up by doc_uuid directly
--    without joining generated_docs every time.
-- ────────────────────────────────────────────────────────────
ALTER TABLE delivery_logs
  ADD COLUMN IF NOT EXISTS doc_uuid VARCHAR(100) DEFAULT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. delivery_logs — add recipient_user_id
--    Links a delivery log row to the recipient's users.id
--    (set by Option C hybrid logic in deliveryController).
-- ────────────────────────────────────────────────────────────
ALTER TABLE delivery_logs
  ADD COLUMN IF NOT EXISTS recipient_user_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recipient_name    VARCHAR(150) DEFAULT NULL;

-- Add the FK separately so it doesn't fail if column already exists
ALTER TABLE delivery_logs
  ADD CONSTRAINT fk_delivery_recipient_user
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 4. audit_logs.action — add DOWNLOAD action
--    Distinct from DELIVER (which means "email sent").
--    DOWNLOAD means "recipient physically downloaded the PDF".
-- ────────────────────────────────────────────────────────────
ALTER TABLE audit_logs
  MODIFY COLUMN action
    ENUM(
      'PREVIEW',
      'GENERATE',
      'SIGN',
      'DELIVER',
      'VERIFY',
      'DOWNLOAD',
      'BULK_GENERATE'
    ) NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 5. users — add password_set flag
--    Tracks whether a newly auto-created recipient has
--    completed the set-password step.
-- ────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_set TINYINT(1) NOT NULL DEFAULT 1;
-- NOTE: Default is 1 (set) for all existing users.
-- New auto-created recipients will have password_set = 0 until
-- they complete the set-password flow, at which point is_active
-- is also flipped to 1.

-- Mark all existing users as having their password set
UPDATE users SET password_set = 1 WHERE password_set = 0 OR password_set IS NULL;

-- Done
SELECT 'Recipient flow migration complete' AS result;
