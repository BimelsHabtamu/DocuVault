-- ============================================================
-- DocuVault — Direct user insert (run this in MySQL Workbench)
-- Password for ALL accounts: Test@1234
-- ============================================================

USE pdf_engine_db;

-- Remove old test accounts if they exist, then re-insert cleanly
DELETE FROM users WHERE email IN (
  'superadmin@docuvault.test',
  'sysadmin@docuvault.test',
  'generator@docuvault.test',
  'approver@docuvault.test',
  'recipient@docuvault.test'
);

INSERT INTO users
  (email, password_hash, full_name, role, department, phone, is_active, password_set, language, theme)
VALUES
  ('superadmin@docuvault.test', '$2b$10$0n3g1t5F8OUetYAUuXW2YODbXwMPcg1f2rxcEIVIIF/u2H.pBIqOu', 'Abebe Kebede',  'super_admin',   'IT Administration', '+251911000001', 1, 1, 'en', 'system'),
  ('sysadmin@docuvault.test',   '$2b$10$0n3g1t5F8OUetYAUuXW2YODbXwMPcg1f2rxcEIVIIF/u2H.pBIqOu', 'Tigist Alemu',  'system_admin',  'IT Administration', '+251911000002', 1, 1, 'en', 'system'),
  ('generator@docuvault.test',  '$2b$10$0n3g1t5F8OUetYAUuXW2YODbXwMPcg1f2rxcEIVIIF/u2H.pBIqOu', 'Dawit Tadesse', 'generator',     'Human Resources',   '+251911000003', 1, 1, 'en', 'system'),
  ('approver@docuvault.test',   '$2b$10$0n3g1t5F8OUetYAUuXW2YODbXwMPcg1f2rxcEIVIIF/u2H.pBIqOu', 'Meron Haile',   'approver',      'Finance',           '+251911000004', 1, 1, 'en', 'system'),
  ('recipient@docuvault.test',  '$2b$10$0n3g1t5F8OUetYAUuXW2YODbXwMPcg1f2rxcEIVIIF/u2H.pBIqOu', 'Yonas Bekele',  'recipient',     NULL,                '+251911000005', 1, 1, 'en', 'system');

-- Confirm
SELECT id, email, role, is_active FROM users
WHERE email LIKE '%@docuvault.test';
