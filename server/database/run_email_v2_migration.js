// Run email verification v2 migration
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

(async () => {
  const db = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'pdf_engine_db',
  });

  const sqlFile = path.join(__dirname, 'email_verification_v2_migration.sql');
  const sql     = fs.readFileSync(sqlFile, 'utf8');

  // Split on ; and filter blanks / comments / SELECT result lines
  const stmts = sql
    .split(';')
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(s => s.length > 0 && !s.toLowerCase().startsWith('select'));

  for (const stmt of stmts) {
    try {
      await db.query(stmt);
      console.log('OK:', stmt.slice(0, 80).replace(/\s+/g, ' '));
    } catch (e) {
      // 1060 = column already exists — safe to ignore
      if (e.errno === 1060 || e.message.includes('Duplicate column')) {
        console.log('SKIP (already exists):', stmt.slice(0, 60));
      } else {
        console.error('ERR:', e.message, '\n  ->', stmt.slice(0, 80));
      }
    }
  }

  // Verify results
  const [evCols] = await db.query('SHOW COLUMNS FROM email_verifications');
  console.log('\nFinal email_verifications cols:', evCols.map(r => r.Field).join(', '));

  const [uCols] = await db.query('SHOW FULL COLUMNS FROM users');
  const evAt = uCols.find(r => r.Field === 'email_verified_at');
  console.log('users.email_verified_at:', evAt ? 'OK' : 'MISSING');

  const [auditCols] = await db.query('SHOW FULL COLUMNS FROM audit_logs');
  const actionCol = auditCols.find(r => r.Field === 'action');
  console.log('audit_logs.action type:', actionCol ? actionCol.Type : 'NOT FOUND');

  await db.end();
  console.log('\nMigration complete.');
})().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
