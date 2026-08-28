-- ============================================================
-- DocuVault — Test Seed Data
-- Purpose: Provides all accounts, template, and settings
--          needed to walk through the full 11-step workflow.
--
-- Run ORDER (run each file once, in order):
--   1. pdf_engine_db.sql
--   2. settings_migration.sql
--   3. fr_compliance_migration.sql
--   4. seal_signature_migration.sql
--   5. recipient_flow_migration.sql
--   6. notifications_migration.sql
--   7. THIS FILE  ← seed_test_data.sql
--
-- All passwords are:  Test@1234
-- ============================================================

USE pdf_engine_db;

-- ────────────────────────────────────────────────────────────
-- 1. TEST USERS
--    Password for ALL accounts: Test@1234
--    bcrypt hash (cost 10) verified correct for "Test@1234"
-- ────────────────────────────────────────────────────────────

SET @pw = '$2b$10$VGkBuMOChBAOJRoIVGm8L.WErnql7Nm6msnAzRjBpIzFLf01n1Y3.';

INSERT INTO users
  (email, password_hash, full_name, role, department, phone, is_active, password_set, language, theme)
VALUES

-- Super Admin — full system access
(
  'superadmin@docuvault.test',
  @pw,
  'Abebe Kebede',
  'super_admin',
  'IT Administration',
  '+251911000001',
  1, 1, 'en', 'system'
),

-- System Admin — manages users and templates
(
  'sysadmin@docuvault.test',
  @pw,
  'Tigist Alemu',
  'system_admin',
  'IT Administration',
  '+251911000002',
  1, 1, 'en', 'system'
),

-- Generator — creates and submits documents
(
  'generator@docuvault.test',
  @pw,
  'Dawit Tadesse',
  'generator',
  'Human Resources',
  '+251911000003',
  1, 1, 'en', 'system'
),

-- Approver — reviews and e-signs documents via OTP
(
  'approver@docuvault.test',
  @pw,
  'Meron Haile',
  'approver',
  'Finance',
  '+251911000004',
  1, 1, 'en', 'system'
),

-- Recipient — receives delivered documents
(
  'recipient@docuvault.test',
  @pw,
  'Yonas Bekele',
  'recipient',
  NULL,
  '+251911000005',
  1, 1, 'en', 'system'
)

ON DUPLICATE KEY UPDATE
  full_name    = VALUES(full_name),
  password_set = 1,
  is_active    = 1;

-- ────────────────────────────────────────────────────────────
-- 2. SYSTEM SETTINGS
--    Used for system.company_name, system.logo_url, etc.
--    in PDF generation.
-- ────────────────────────────────────────────────────────────

INSERT INTO system_settings (config_key, config_json)
VALUES (
  'platform',
  JSON_OBJECT(
    'institution', JSON_OBJECT(
      'university_name',     'Addis Ababa University',
      'institute_department','College of Business and Economics',
      'address',             'Sidist Kilo Campus, Addis Ababa, Ethiopia',
      'contact_email',       'info@aau.edu.et',
      'contact_phone',       '+251111239765',
      'logo_url',            '',
      'seal_url',            ''
    )
  )
)
ON DUPLICATE KEY UPDATE
  config_json = VALUES(config_json);

-- ────────────────────────────────────────────────────────────
-- 3. PAYSLIP TEMPLATE  (HR category)
--    Placeholders used:
--      {{employee_name}}     — full name of employee
--      {{employee_id}}       — employee number
--      {{department}}        — employee department
--      {{position}}          — job title
--      {{basic_salary}}      — basic salary in ETB
--      {{allowances}}        — total allowances
--      {{deductions}}        — total deductions
--      {{net_pay}}           — net pay
--      {{pay_period}}        — e.g. "July 2026"
--      {{payment_date}}      — e.g. "31 July 2026"
--    Auto-injected by system (no input needed):
--      {{generation_date}}, {{system.company_name}}, etc.
-- ────────────────────────────────────────────────────────────

INSERT INTO templates
  (name, category, version, watermark_text, is_active, header_html, body_html, footer_html)
VALUES (
  'Employee Payslip',
  'HR',
  1,
  '',
  1,

  -- header_html
  '<div style="text-align:center; padding-bottom:8px;">
    <p style="font-size:15px; font-weight:700; color:#1e3a5f; margin:0;">
      {{system.company_name}}
    </p>
    <p style="font-size:11px; color:#555; margin:4px 0 0;">
      {{system.department}} &nbsp;|&nbsp; {{system.address}}
    </p>
  </div>',

  -- body_html
  '<h2 style="text-align:center; font-size:14px; font-weight:700;
    color:#1e3a5f; border-bottom:2px solid #3b5bdb;
    padding-bottom:8px; margin-bottom:16px;">
    PAYSLIP — {{pay_period}}
  </h2>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
    <tr>
      <td style="padding:6px 10px; background:#f0f4ff; font-weight:600;
        width:35%; border:1px solid #dde3f0;">Employee Name</td>
      <td style="padding:6px 10px; border:1px solid #dde3f0;">{{employee_name}}</td>
      <td style="padding:6px 10px; background:#f0f4ff; font-weight:600;
        width:25%; border:1px solid #dde3f0;">Employee ID</td>
      <td style="padding:6px 10px; border:1px solid #dde3f0;">{{employee_id}}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px; background:#f0f4ff; font-weight:600;
        border:1px solid #dde3f0;">Department</td>
      <td style="padding:6px 10px; border:1px solid #dde3f0;">{{department}}</td>
      <td style="padding:6px 10px; background:#f0f4ff; font-weight:600;
        border:1px solid #dde3f0;">Position</td>
      <td style="padding:6px 10px; border:1px solid #dde3f0;">{{position}}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px; background:#f0f4ff; font-weight:600;
        border:1px solid #dde3f0;">Pay Period</td>
      <td style="padding:6px 10px; border:1px solid #dde3f0;">{{pay_period}}</td>
      <td style="padding:6px 10px; background:#f0f4ff; font-weight:600;
        border:1px solid #dde3f0;">Payment Date</td>
      <td style="padding:6px 10px; border:1px solid #dde3f0;">{{payment_date}}</td>
    </tr>
  </table>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
    <thead>
      <tr style="background:#1e3a5f; color:#fff;">
        <th style="padding:8px 10px; text-align:left; width:50%;">Earnings</th>
        <th style="padding:8px 10px; text-align:right;">Amount (ETB)</th>
        <th style="padding:8px 10px; text-align:left; width:30%;">Deductions</th>
        <th style="padding:8px 10px; text-align:right;">Amount (ETB)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:6px 10px; border:1px solid #dde3f0;">Basic Salary</td>
        <td style="padding:6px 10px; border:1px solid #dde3f0; text-align:right;">
          {{basic_salary}}
        </td>
        <td style="padding:6px 10px; border:1px solid #dde3f0;">Total Deductions</td>
        <td style="padding:6px 10px; border:1px solid #dde3f0; text-align:right;">
          {{deductions}}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 10px; border:1px solid #dde3f0;">Allowances</td>
        <td style="padding:6px 10px; border:1px solid #dde3f0; text-align:right;">
          {{allowances}}
        </td>
        <td style="padding:6px 10px; border:1px solid #dde3f0;"></td>
        <td style="padding:6px 10px; border:1px solid #dde3f0;"></td>
      </tr>
    </tbody>
  </table>

  <div style="background:#f0f4ff; border:2px solid #3b5bdb; border-radius:8px;
    padding:12px 16px; display:flex; justify-content:space-between;
    align-items:center; margin-bottom:20px;">
    <span style="font-size:13px; font-weight:700; color:#1e3a5f;">NET PAY</span>
    <span style="font-size:18px; font-weight:900; color:#3b5bdb;">ETB {{net_pay}}</span>
  </div>

  <p style="font-size:11px; color:#888; margin-top:8px;">
    This payslip was generated electronically by {{system.company_name}} on
    {{generation_date}}. It does not require a physical signature unless
    accompanied by a digital approval stamp below.
  </p>

  {{#if approver.full_name}}
  <div style="margin-top:16px; padding:10px 14px; border:1px solid #dde3f0;
    border-radius:8px; background:#f9fafb;">
    <p style="font-size:11px; color:#555; margin:0;">
      <strong>Digitally Approved by:</strong> {{approver.full_name}}<br/>
      <strong>Title:</strong> {{approver.role}}<br/>
      <strong>Department:</strong> {{approver.department}}
    </p>
  </div>
  {{/if}}',

  -- footer_html
  '<p style="font-size:10px; color:#aaa; text-align:center; margin:0;">
    {{system.company_name}} &nbsp;·&nbsp; {{system.contact_email}}
    &nbsp;·&nbsp; {{system.contact_phone}}
  </p>'
)
ON DUPLICATE KEY UPDATE
  body_html   = VALUES(body_html),
  header_html = VALUES(header_html),
  footer_html = VALUES(footer_html),
  is_active   = 1;

-- ────────────────────────────────────────────────────────────
-- 4. TEMPLATE PLACEHOLDERS
--    These define what the generator fills in on the
--    Generate Document → Step 2 form.
-- ────────────────────────────────────────────────────────────

-- Get the template ID we just inserted
SET @tmpl_id = (SELECT id FROM templates WHERE name = 'Employee Payslip' LIMIT 1);

-- Clear old placeholders for this template to avoid duplicates
DELETE FROM template_placeholders WHERE template_id = @tmpl_id;

INSERT INTO template_placeholders
  (template_id, field_path, data_type, is_loopable, default_value)
VALUES
  (@tmpl_id, 'employee_name', 'string', 0, 'Yonas Bekele'),
  (@tmpl_id, 'employee_id',   'string', 0, 'EMP-001'),
  (@tmpl_id, 'department',    'string', 0, 'Engineering'),
  (@tmpl_id, 'position',      'string', 0, 'Senior Engineer'),
  (@tmpl_id, 'basic_salary',  'number', 0, '25,000.00'),
  (@tmpl_id, 'allowances',    'number', 0, '5,000.00'),
  (@tmpl_id, 'deductions',    'number', 0, '3,500.00'),
  (@tmpl_id, 'net_pay',       'number', 0, '26,500.00'),
  (@tmpl_id, 'pay_period',    'string', 0, 'July 2026'),
  (@tmpl_id, 'payment_date',  'string', 0, '31 July 2026');

-- Done
SELECT 'Seed data inserted successfully' AS result;
SELECT CONCAT('Template ID: ', @tmpl_id) AS info;
SELECT 'Run: SELECT id, email, role FROM users;  to confirm accounts.' AS next_step;
