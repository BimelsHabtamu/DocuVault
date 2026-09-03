-- ============================================================
-- Field Mappings Seed — FR-009 (Option A: users table only)
--
-- Maps template placeholders → real users table columns.
-- Only columns that actually exist in the users table are mapped.
-- Sensitive columns (password_hash, session_timeout_minutes,
-- notification_email, avatar_url, signature_url, etc.) are
-- deliberately excluded.
--
-- Placeholders that have NO matching users column (salary, position,
-- join_date, designation, etc.) are left unmapped — they remain
-- as manual-entry fields in the generator UI.
--
-- Templates mapped:
--   4  Employee Salary Certificate  → data_source = 'users'
--   5  Experience Letter            → data_source = 'users'
--   6  Payment Receipt              → data_source = NULL (no mappable fields)
-- ============================================================

USE pdf_engine_db;

-- ── 1. Assign data_source to the two employee-related templates ──────────────
UPDATE templates SET data_source = 'users' WHERE id IN (4, 5);

-- ── 2. Seed field_mappings for Employee Salary Certificate (template_id=4) ───
INSERT IGNORE INTO field_mappings
  (template_id, static_field_key, db_table, db_column, mapping_type)
VALUES
  -- employee_name → users.full_name
  (4, 'employee_name', 'users', 'full_name',  'direct'),
  -- employee_id   → users.id  (stored as string in the placeholder)
  (4, 'employee_id',   'users', 'id',         'direct'),
  -- department    → users.department
  (4, 'department',    'users', 'department', 'direct');

-- NOT mapped (no matching users column):
--   position, monthly_salary, join_date, reference_number

-- ── 3. Seed field_mappings for Experience Letter (template_id=5) ─────────────
INSERT IGNORE INTO field_mappings
  (template_id, static_field_key, db_table, db_column, mapping_type)
VALUES
  -- employee_name → users.full_name
  (5, 'employee_name', 'users', 'full_name',  'direct'),
  -- employee_id   → users.id
  (5, 'employee_id',   'users', 'id',         'direct'),
  -- department    → users.department
  (5, 'department',    'users', 'department', 'direct');

-- NOT mapped (no matching users column):
--   designation, start_date, end_date, performance_note, ref_number

SELECT 'Field mappings seed complete' AS result;
