/**
 * run_seal_template_migration.js
 * Run with: node database/run_seal_template_migration.js
 */
'use strict';
require('dotenv').config();
const db   = require('../config/db');
const path = require('path');
const fs   = require('fs');

const SQL = fs.readFileSync(
  path.join(__dirname, 'seal_template_migration.sql'),
  'utf8'
);

(async () => {
  console.log('\n── Seal Template Migration ─────────────────────────────\n');

  const stmts = SQL
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .filter(s => !/^USE\b/i.test(s) && !/^SELECT\b/i.test(s));

  let ok = 0, skipped = 0;
  for (const stmt of stmts) {
    const label = stmt.replace(/\s+/g, ' ').slice(0, 80);
    try {
      await db.query(stmt);
      console.log('  ✓', label);
      ok++;
    } catch (e) {
      if ([1060, 1068, 1050].includes(e.errno)) {
        console.log('  –', label, '(already applied)');
        skipped++;
      } else {
        console.error('  ✗', label);
        console.error('     ERROR:', e.message);
        await db.end(); process.exit(1);
      }
    }
  }
  console.log(`\n── Done: ${ok} applied, ${skipped} skipped ──────────────\n`);

  // Verify
  const checks = ['auto_seal_enabled', 'seal_section', 'seal_element_id'];
  for (const col of checks) {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'templates' AND COLUMN_NAME = ?`,
      [process.env.DB_NAME, col]
    );
    console.log(rows.length ? `  ✓ templates.${col}` : `  ✗ templates.${col} MISSING`);
  }

  await db.end();
  console.log('\n  ✅  Seal template migration complete\n');
})();
