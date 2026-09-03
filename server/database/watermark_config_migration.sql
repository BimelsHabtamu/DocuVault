-- ============================================================
-- Watermark Config Migration
-- Adds watermark_config JSON column to templates and
-- template_versions, storing the full watermark element
-- object (text, typography, opacity, layer, scope, imageUrl)
-- so pdfService can render rich watermarks from template data.
--
-- watermark_text is kept for backward compatibility.
-- watermark_config supersedes it when present.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

USE pdf_engine_db;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS watermark_config MEDIUMTEXT DEFAULT NULL
    COMMENT 'Full watermark element JSON: text, typography, opacity, layer, scope, imageUrl';

ALTER TABLE template_versions
  ADD COLUMN IF NOT EXISTS watermark_config MEDIUMTEXT DEFAULT NULL
    COMMENT 'Full watermark element JSON snapshot for this version';

SELECT 'Watermark config migration complete' AS result;
