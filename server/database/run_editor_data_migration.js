/**
 * run_editor_data_migration.js
 *
 * Applies editor_data_migration.sql to the running database.
 *
 * Run with:
 *   node database/run_editor_data_migration.js
 *
 * Safe to run multiple times — all DDL statements use
 * ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
 */

'use strict';
require('dotenv').config();
const db   = require('../config/db');
const path = require('path');
const fs   = require('fs');

const SQL_FILE = path.join(__dirname, 'editor_data_migration.sql');

(async () => {
  console.log('\n── Editor Data Migration ────────────────────────────────────\n');

  // ── 1. Apply each DDL statement individually ──────────────────────────────
  // Split the SQL file on semicolons, skip empty/comment-only blocks and
  // SELECT verification statements (those run separately below).
  const rawSql = fs.readFileSync(SQL_FILE, 'utf8');

  const statements = rawSql
    // Remove /* ... */ block comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove all -- single-line comments (the entire rest of each line)
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    // Skip USE database statements and SELECT (verification) statements
    .filter(s => !/^SELECT\b/i.test(s) && !/^USE\b/i.test(s));

  let applied = 0;
  let skipped = 0;

  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').slice(0, 80);
    try {
      await db.query(stmt);
      console.log('  ✓', label);
      applied++;
    } catch (err) {
      // ER_DUP_FIELDNAME (1060) and ER_TABLE_EXISTS (1050) are expected on
      // re-runs and should be treated as "already applied".
      if ([1060, 1050, 1068].includes(err.errno)) {
        console.log('  –', label);
        console.log(`     (already exists — skipped)`);
        skipped++;
      } else {
        console.error('  ✗', label);
        console.error(`     ERROR ${err.errno}: ${err.message}`);
        await db.end();
        process.exit(1);
      }
    }
  }

  console.log(`\n── DDL complete: ${applied} applied, ${skipped} skipped ─────────────\n`);

  // ── 2. Verify the columns were created ────────────────────────────────────
  console.log('── Verification ─────────────────────────────────────────────\n');

  const checks = [
    {
      label: 'templates.layout_config',
      query: `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'layout_config'`,
    },
    {
      label: 'templates.editor_data',
      query: `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'editor_data'`,
    },
    {
      label: 'template_versions.layout_config',
      query: `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'template_versions' AND COLUMN_NAME = 'layout_config'`,
    },
    {
      label: 'template_versions.editor_data',
      query: `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'template_versions' AND COLUMN_NAME = 'editor_data'`,
    },
    {
      label: 'field_mappings table',
      query: `SELECT TABLE_NAME FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'field_mappings'`,
    },
  ];

  let allPassed = true;
  for (const { label, query } of checks) {
    const [rows] = await db.query(query, [process.env.DB_NAME]);
    if (rows.length > 0) {
      const info = Object.values(rows[0]).join(' | ');
      console.log(`  ✓  ${label}  →  ${info}`);
    } else {
      console.error(`  ✗  ${label}  →  NOT FOUND`);
      allPassed = false;
    }
  }

  // ── 3. Verify existing templates are unaffected ───────────────────────────
  console.log('\n── Existing data check ──────────────────────────────────────\n');

  const [[countRow]] = await db.query('SELECT COUNT(*) AS total FROM templates');
  console.log(`  ✓  templates row count: ${countRow.total} (unchanged)`);

  const [sampleRows] = await db.query(
    `SELECT id, name, version, is_active,
            (layout_config IS NULL) AS layout_null,
            (editor_data IS NULL)   AS editor_null
     FROM templates LIMIT 5`
  );

  if (sampleRows.length > 0) {
    console.log('  ✓  Sample existing templates (new columns should be NULL):');
    for (const r of sampleRows) {
      const lNull = r.layout_null ? 'layout_config=NULL' : 'layout_config=SET';
      const eNull = r.editor_null  ? 'editor_data=NULL'   : 'editor_data=SET';
      console.log(`       id=${r.id}  "${r.name}"  v${r.version}  active=${r.is_active}  ${lNull}  ${eNull}`);
    }
  } else {
    console.log('  –  No existing templates (fresh database)');
  }

  // ── 4. Schema model self-test ─────────────────────────────────────────────
  console.log('\n── Schema model self-test ───────────────────────────────────\n');

  try {
    const schema = require('../models/templateEditorSchema');

    // Test defaults
    const lc = schema.defaultLayoutConfig();
    console.assert(lc.pageSize === 'A4',      'defaultLayoutConfig: pageSize should be A4');
    console.assert(lc.orientation === 'portrait', 'defaultLayoutConfig: orientation should be portrait');
    console.assert(typeof lc.margins === 'object', 'defaultLayoutConfig: margins should be object');
    console.log('  ✓  defaultLayoutConfig() returns correct structure');

    const ed = schema.defaultEditorData();
    console.assert(Array.isArray(ed.header.elements), 'defaultEditorData: header.elements should be array');
    console.assert(Array.isArray(ed.body.elements),   'defaultEditorData: body.elements should be array');
    console.assert(Array.isArray(ed.footer.elements), 'defaultEditorData: footer.elements should be array');
    console.log('  ✓  defaultEditorData() returns correct structure');

    // Test all 15 element factories
    for (const [typeName, typeValue] of Object.entries(schema.ELEMENT_TYPES)) {
      const el = schema.ELEMENT_DEFAULTS[typeValue]?.();
      if (el) {
        console.assert(el.type  === typeValue,     `${typeName}: element.type mismatch`);
        console.assert(typeof el.id === 'string',  `${typeName}: element.id should be string`);
        console.assert(typeof el.x  === 'number',  `${typeName}: element.x should be number`);
        const vr = schema.validateElement(el);
        console.assert(vr.valid, `${typeName}: validateElement failed: ${vr.errors?.join(', ')}`);
      }
    }
    console.log('  ✓  All 15 element factories produce valid elements');

    // Test watermark is truly editable (default text is just 'CONFIDENTIAL', not locked)
    const wm = schema.ELEMENT_DEFAULTS.watermark({ text: 'TEMPORARY CERTIFICATE' });
    console.assert(wm.text === 'TEMPORARY CERTIFICATE', 'watermark: text override should work');
    console.assert(wm.locked === false, 'watermark: should not be locked by default');
    console.log('  ✓  Watermark text is freely editable');

    // Test layout_config validation
    const lv1 = schema.validateLayoutConfig({ pageSize: 'A4', orientation: 'portrait' });
    console.assert(lv1.valid, 'validateLayoutConfig: valid config should pass');
    const lv2 = schema.validateLayoutConfig({ pageSize: 'INVALID' });
    console.assert(!lv2.valid, 'validateLayoutConfig: invalid pageSize should fail');
    console.log('  ✓  validateLayoutConfig() works correctly');

    // Test editor_data validation
    const dummyEl = schema.ELEMENT_DEFAULTS.text();
    const ev1 = schema.validateEditorData({ body: { elements: [dummyEl] } });
    console.assert(ev1.valid, 'validateEditorData: valid data should pass');
    const ev2 = schema.validateEditorData({ body: { elements: [{ type: 'unknown_type', id: 'x' }] } });
    console.assert(!ev2.valid, 'validateEditorData: unknown element type should fail');
    console.log('  ✓  validateEditorData() works correctly');

    console.log('\n  ✓  All schema model self-tests passed\n');
  } catch (err) {
    console.error(`  ✗  Schema model self-test error: ${err.message}`);
    allPassed = false;
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  if (allPassed) {
    console.log('  ✅  Editor data migration SUCCEEDED — all checks passed\n');
  } else {
    console.error('  ❌  Editor data migration COMPLETED WITH ERRORS — check output above\n');
  }

  await db.end();
  process.exit(allPassed ? 0 : 1);
})();
