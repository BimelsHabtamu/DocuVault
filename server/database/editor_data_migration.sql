-- ============================================================
-- Editor Data Migration
-- Adds structured canvas editor storage to the template system.
--
-- Strategy:
--   - Two new JSON columns are added to `templates` and
--     `template_versions`:
--       layout_config  — page-level settings (size, margins, etc.)
--       editor_data    — full structured element tree for all
--                        three sections (header / body / footer)
--   - All new columns DEFAULT NULL so existing rows are
--     completely unaffected.  The legacy header_html / body_html /
--     footer_html columns are left in place; the pdfService
--     continues to use them.  The editor writes both when it saves
--     (rendered HTML + structured data) so backward compatibility
--     is maintained.
--   - The field_mappings table is created here because its
--     CREATE TABLE statement was missing from previous migrations
--     (see Task-1 analysis).
--
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Run with: node database/run_editor_data_migration.js
-- ============================================================

USE pdf_engine_db;

-- ── 1.  templates — layout_config ────────────────────────────────────────────
-- Stores page-level settings.
-- Schema documented in server/models/templateEditorSchema.js
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS layout_config JSON DEFAULT NULL
  COMMENT 'Page-level editor settings: pageSize, orientation, margins, background';

-- ── 2.  templates — editor_data ──────────────────────────────────────────────
-- Stores the full structured element tree for the three document sections.
-- Schema documented in server/models/templateEditorSchema.js
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS editor_data JSON DEFAULT NULL
  COMMENT 'Structured element tree: { header: [...], body: [...], footer: [...] }';

-- ── 3.  template_versions — layout_config ────────────────────────────────────
ALTER TABLE template_versions
  ADD COLUMN IF NOT EXISTS layout_config JSON DEFAULT NULL
  COMMENT 'Snapshot of page-level settings at this version';

-- ── 4.  template_versions — editor_data ──────────────────────────────────────
ALTER TABLE template_versions
  ADD COLUMN IF NOT EXISTS editor_data JSON DEFAULT NULL
  COMMENT 'Snapshot of element tree at this version';

-- ── 5.  field_mappings — CREATE TABLE (missing from previous migrations) ──────
-- datasourceController.js uses this table but no CREATE statement existed.
CREATE TABLE IF NOT EXISTS field_mappings (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  template_id      INT          NOT NULL,
  static_field_key VARCHAR(200) NOT NULL  COMMENT 'Placeholder key used in template, e.g. employee_name',
  db_table         VARCHAR(100) NOT NULL  COMMENT 'Source table, e.g. users',
  db_column        VARCHAR(100) NOT NULL  COMMENT 'Source column, e.g. full_name',
  mapping_type     VARCHAR(50)  NOT NULL DEFAULT 'direct',
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- ── 6.  Verify ────────────────────────────────────────────────────────────────
SELECT 'Editor data migration complete' AS result;

SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_DEFAULT,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'templates'
  AND COLUMN_NAME IN ('layout_config', 'editor_data')
ORDER BY COLUMN_NAME;

SELECT
  COLUMN_NAME,
  DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'template_versions'
  AND COLUMN_NAME IN ('layout_config', 'editor_data')
ORDER BY COLUMN_NAME;

SELECT 'field_mappings exists' AS check_result
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'field_mappings';
