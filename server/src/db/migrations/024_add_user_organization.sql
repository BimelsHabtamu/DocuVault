-- Adds users.organization — the free-text organization/company/institution name the
-- admin types when creating an account. It drives the "You've been invited to join
-- <organization> on DocuVault" line and account-details block in the professional
-- welcome email. Deliberately free text (not a dropdown) so the same platform
-- serves colleges, universities, ministries, corporations, etc.
-- Also applied automatically on boot by config/db.js's ensureSchema() self-heal, so
-- running this by hand is only needed if that self-heal is ever disabled.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization VARCHAR(255) NULL AFTER phone;