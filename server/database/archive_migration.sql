-- ─────────────────────────────────────────────────────────────────────────────
-- FR-040: Document Archive Migration
-- Safe to run multiple times (uses IF NOT EXISTS / MODIFY only when needed)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add 'archived' to generated_docs.status ENUM
--    MODIFY re-declares the full ENUM including the new value.
--    Existing rows are untouched; MySQL ignores the change if the value is
--    already present (the ENUM spec is idempotent for column re-declarations
--    on MySQL 8).
ALTER TABLE generated_docs
  MODIFY COLUMN status
    ENUM('draft','pending','signed','rejected','delivered','hand_delivered','archived')
    NOT NULL DEFAULT 'draft';

-- 2. Add archived_at column (when the document was archived)
ALTER TABLE generated_docs
  ADD COLUMN IF NOT EXISTS archived_at   DATETIME      DEFAULT NULL AFTER generated_at;

-- 3. Add archive_path column (relative path inside cold-storage directory)
ALTER TABLE generated_docs
  ADD COLUMN IF NOT EXISTS archive_path  VARCHAR(500)  DEFAULT NULL AFTER archived_at;

-- 4. Add 'ARCHIVE' to audit_logs.action ENUM
ALTER TABLE audit_logs
  MODIFY COLUMN action
    ENUM('PREVIEW','GENERATE','SIGN','DELIVER','VERIFY','DOWNLOAD','BULK_GENERATE','ARCHIVE')
    NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'FR-040 archive migration complete' AS result;
