-- Migration 023: Fix broken bcrypt hash for all seed users.
-- The original hash in schema.sql did not match "Passw0rd!" — this corrects all 5
-- seed accounts so login works.  Password for all seed accounts: Passw0rd!
--
-- IMPORTANT: Run this against your doc_automation database in phpMyAdmin (or MySQL CLI).
-- Only affects the five seed accounts by email — production users are untouched.

USE doc_automation;

UPDATE users
SET password_hash = '$2b$10$nBCzFr9MEBGEYWzxlZ0YKeNaaQacC6CmOP7ANTApVWQG470QFoFCG'
WHERE email IN (
  'superadmin@example.com',
  'sysadmin@example.com',
  'hr@example.com',
  'director@example.com',
  'recipient@example.com'
);
