-- ============================================================
-- Email Verification Migration
-- Adds: email_verifications table for pending email changes.
-- When a user requests an email change, we store the new
-- address here and send a verification link.  The current
-- email in users.email is NOT changed until the link is clicked.
-- ============================================================

USE pdf_engine_db;

CREATE TABLE IF NOT EXISTS email_verifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  new_email    VARCHAR(191) NOT NULL,
  token_hash   VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 of raw token
  expires_at   DATETIME     NOT NULL,           -- 24 hours from creation
  used         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ev_user_id
  ON email_verifications (user_id, created_at DESC);

SELECT 'Email verification migration complete' AS result;
