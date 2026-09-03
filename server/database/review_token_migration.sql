-- ============================================================
-- Review Token Migration
-- Adds: review_token_hash to signature_requests
-- This is the secure one-time token embedded in the email link.
-- The approver clicks: /review/<raw_token>
-- Backend hashes it with SHA-256 and looks up this column.
-- ============================================================

USE pdf_engine_db;

ALTER TABLE signature_requests
  ADD COLUMN IF NOT EXISTS review_token_hash VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_token_used  TINYINT(1)  NOT NULL DEFAULT 0;

SELECT 'Review token migration complete' AS result;
