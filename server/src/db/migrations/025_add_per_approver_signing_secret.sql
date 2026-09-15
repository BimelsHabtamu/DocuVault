-- FR-024: per-approver HMAC-SHA256 signing secret.
-- Stored AES-256-GCM encrypted (encryption.js). NULL until first signing call,
-- at which point hmac.js:getApproverSecret() generates and stores the value.
-- Applied automatically on boot by config/db.js ensureSchema().

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signing_secret_enc TEXT NULL
  COMMENT 'AES-256-GCM encrypted per-approver HMAC signing secret (FR-024). NULL until first signing.'
  AFTER organization;
