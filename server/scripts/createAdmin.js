const db     = require('../config/db');
const bcrypt = require('bcryptjs');

const users = [
  { full_name: 'Super Admin',    email: 'superadmin@test.com',   password: 'password', role: 'super_admin'  },
  { full_name: 'System Admin',   email: 'sysadmin@test.com',     password: 'password', role: 'system_admin' },
  { full_name: 'Sara Ahmed',     email: 'generator@test.com',    password: 'password', role: 'generator'    },
  { full_name: 'John Mekonen',   email: 'approver@test.com',     password: 'password', role: 'approver'     },
  { full_name: 'Liya Tesfaye',   email: 'recipient@test.com',    password: 'password', role: 'recipient'    },
];

async function clearExistingUserData(emails) {
  if (emails.length === 0) return;

  const placeholders = emails.map(() => '?').join(',');
  const ids = await db.query(
    `SELECT id FROM users WHERE email IN (${placeholders})`,
    emails
  );

  const userIds = ids[0].map((row) => row.id);
  if (userIds.length === 0) return;

  const idPlaceholders = userIds.map(() => '?').join(',');

  await db.query(`DELETE FROM audit_logs WHERE user_id IN (${idPlaceholders})`, userIds);
  await db.query(`DELETE FROM signature_requests WHERE approver_id IN (${idPlaceholders})`, userIds);
  await db.query(`DELETE FROM digital_signatures WHERE signer_id IN (${idPlaceholders})`, userIds);
  await db.query(`DELETE FROM bulk_jobs WHERE created_by IN (${idPlaceholders})`, userIds);
  await db.query(`DELETE FROM generated_docs WHERE generated_by IN (${idPlaceholders})`, userIds);
  await db.query(`DELETE FROM system_settings WHERE updated_by IN (${idPlaceholders})`, userIds);
  await db.query(`DELETE FROM users WHERE email IN (${placeholders})`, emails);
}

async function seed() {
  const emails = users.map((u) => u.email);
  await clearExistingUserData(emails);

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.query(
      'INSERT INTO users (full_name, email, password_hash, role, is_active, password_set, language, theme) VALUES (?, ?, ?, ?, 1, 1, "en", "system")',
      [u.full_name, u.email, hash, u.role]
    );
    console.log(`✓ ${u.role.padEnd(12)} → ${u.email}`);
  }

  console.log('\nAll 5 users created. Password for all: password');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
