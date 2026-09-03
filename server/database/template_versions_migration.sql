-- ============================================================
-- Template Versions Migration (FR-006)
-- Adds: template_versions table for content snapshots
--       template_version column on generated_docs
--
-- Strategy:
--   - template_versions stores a snapshot of each template
--     version's content BEFORE it is overwritten by an edit.
--   - generated_docs.template_version records which version
--     number was active when each document was generated.
--   - Existing templates (all currently v1) get a v1 snapshot
--     backfilled so version history is complete from day 1.
--   - Existing generated_docs are backfilled with version = 1
--     (the only version that existed when they were created).
--
-- Run after: all previous migrations
-- ============================================================

USE pdf_engine_db;

-- ── 1. template_versions table ────────────────────────────────
CREATE TABLE IF NOT EXISTS template_versions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  template_id     INT          NOT NULL,
  version         INT          NOT NULL,
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(50)  NOT NULL,
  description     VARCHAR(500) DEFAULT NULL,
  header_html     LONGTEXT     DEFAULT NULL,
  body_html       LONGTEXT     NOT NULL,
  footer_html     LONGTEXT     DEFAULT NULL,
  watermark_text  VARCHAR(100) DEFAULT NULL,
  data_source     VARCHAR(100) DEFAULT NULL,
  created_by      INT          DEFAULT NULL,  -- user who saved this version
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_version (template_id, version),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL
);

-- ── 2. Backfill: snapshot every existing template at its current version ──────
-- This gives every template a complete v1 history record so nothing is lost.
INSERT IGNORE INTO template_versions
  (template_id, version, name, category, description,
   header_html, body_html, footer_html, watermark_text, data_source, created_at)
SELECT
  id, version, name, category, description,
  header_html, body_html, footer_html, watermark_text, data_source, created_at
FROM templates;

-- ── 3. Add template_version column to generated_docs ─────────────────────────
ALTER TABLE generated_docs
  ADD COLUMN IF NOT EXISTS template_version INT DEFAULT NULL
  COMMENT 'Version number of templates row at generation time';

-- ── 4. Backfill: all existing docs used version 1 (the only version) ─────────
UPDATE generated_docs gd
JOIN templates t ON t.id = gd.template_id
SET gd.template_version = t.version
WHERE gd.template_version IS NULL;

SELECT 'Template versions migration complete' AS result;
