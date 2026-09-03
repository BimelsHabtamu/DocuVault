-- ============================================================
-- Seal Template Migration
-- Adds auto-seal fields to templates and template_versions.
--
-- auto_seal_enabled  — when true, a company_seal element is
--                     automatically managed in the template.
-- seal_section       — which section: 'header' | 'body' | 'footer'
-- seal_element_id    — the editor_data element id of the auto-
--                     managed seal element (allows targeted update)
--
-- All columns DEFAULT NULL/0 — existing rows are unaffected.
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

USE pdf_engine_db;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS auto_seal_enabled TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'When 1, a company seal element is automatically present in this template',
  ADD COLUMN IF NOT EXISTS seal_section VARCHAR(10) DEFAULT 'header'
    COMMENT 'Section for the auto-seal: header | body | footer',
  ADD COLUMN IF NOT EXISTS seal_element_id VARCHAR(32) DEFAULT NULL
    COMMENT 'editor_data element id of the auto-managed seal element';

ALTER TABLE template_versions
  ADD COLUMN IF NOT EXISTS auto_seal_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seal_section VARCHAR(10) DEFAULT 'header',
  ADD COLUMN IF NOT EXISTS seal_element_id VARCHAR(32) DEFAULT NULL;

SELECT 'Seal template migration complete' AS result;
