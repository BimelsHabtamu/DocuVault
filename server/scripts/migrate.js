#!/usr/bin/env node
/**
 * migrate.js — applies the base schema to a fresh MySQL database.
 *
 * Run this ONCE against a new production database before starting the server.
 * It is idempotent, so re-running it on an already-migrated database is a no-op.
 *
 *   node scripts/migrate.js                 # schema only (safe for production)
 *   node scripts/migrate.js --create-admin  # schema + one super_admin account
 *   node scripts/migrate.js --seed-demo     # ALSO inserts the demo users/employees
 *                                           # (dev/staging only — known passwords!)
 *
 * ── Why this script exists instead of "just import schema.sql" ───────────────
 * 1. schema.sql starts with `CREATE DATABASE doc_automation; USE doc_automation;`.
 *    Managed MySQL (Aiven, PlanetScale, Railway, DigitalOcean…) hands you ONE
 *    pre-created database and revokes CREATE DATABASE, so those two statements
 *    abort the import outright. This script strips them — the connection pool
 *    already selects DB_NAME, so the statements are redundant as well as fatal.
 * 2. schema.sql uses bare `CREATE TABLE x (…)`, so importing it twice dies with
 *    "Table already exists". Rewritten here to CREATE TABLE IF NOT EXISTS.
 * 3. The five demo users in schema.sql all share the bcrypt hash of the password
 *    "Passw0rd!" and the addresses are in git history. Seeding them into a
 *    production database would hand five working logins to anyone who has read
 *    the repo. They are therefore OFF by default; use --create-admin instead,
 *    which takes the credentials from environment variables you control.
 *
 * The remaining schema drift (columns added by later features) is handled by
 * ensureSchema() in src/config/db.js, which runs on every server boot — this
 * script calls it too so a single run leaves the database fully current.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool, ensureSchema } = require('../src/config/db');
const { ROLES } = require('../src/utils/roles');

const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'schema.sql');

const args = new Set(process.argv.slice(2));
const wantDemo = args.has('--seed-demo');
const wantAdmin = args.has('--create-admin');

/**
 * Splits a SQL script into individual statements.
 *
 * The script contains no stored procedures or DELIMITER blocks, so a semicolon
 * split is sufficient — but string literals and comments must be respected
 * first or a semicolon inside a comment or a quoted default value would cut a
 * statement in half. The scanner tracks single-quote, double-quote and
 * backtick state and drops `--` / `#` / block comments before splitting.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // block comment
    if (!quote && ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    // line comment
    if (!quote && (ch === '-' && next === '-') || (!quote && ch === '#')) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }
    // quoted / identifier section — copy verbatim, semicolons are not delimiters here
    if (quote) {
      current += ch;
      if (ch === '\\' && quote !== '`') {
        // escape sequence inside a string literal
        if (i + 1 < sql.length) current += sql[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === ';') {
      statements.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim()) statements.push(current);
  return statements.map((s) => s.trim()).filter(Boolean);
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].cnt > 0;
}

/** Rewrites schema.sql into a form that is safe to run against a managed MySQL. */
function buildStatements(sql) {
  const withoutDatabaseSelects = sql
    // `CREATE DATABASE IF NOT EXISTS …;` then `USE doc_automation;` — both
    // unsupported on managed providers and redundant given DB_NAME.
    .replace(/CREATE\s+DATABASE[^;]*;/gi, '')
    .replace(/^\s*USE\s+[^;]+;\s*$/gim, '');

  return splitStatements(withoutDatabaseSelects)
    .map((s) => s.replace(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS '))
    .map((s) => s.replace(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z_]+)/i, 'CREATE TABLE IF NOT EXISTS `$1`'));
}

async function applySchema() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = buildStatements(sql);
  let created = 0;
  let skipped = 0;

  for (const statement of statements) {
    const nameMatch = statement.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-z_]+)`?/i);

    // The demo-user seed is a security liability in production, so it is only
    // ever applied when explicitly requested with --seed-demo.
    const isUserSeed = /INSERT\s+INTO\s+`?users`?/i.test(statement);
    if (isUserSeed && !wantDemo) {
      skipped += 1;
      continue;
    }

    try {
      await pool.query(statement);
      if (nameMatch) {
        console.log(`  [ok]   table ${nameMatch[1]}`);
        created += 1;
      }
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || err.code === 'ER_TABLE_EXISTS_ERROR') {
        skipped += 1;
        continue;
      }
      console.error(`  [FAIL] ${statement.slice(0, 90).replace(/\s+/g, ' ')}…`);
      throw err;
    }
  }

  console.log(`\n[schema] ${created} statement(s) applied, ${skipped} skipped.`);
  if (!wantDemo) {
    console.log('[schema] Demo users were NOT seeded (that is correct for production).');
  }
}

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME || 'Super Admin';

  if (!email || !password) {
    console.error('\n[admin] --create-admin needs ADMIN_EMAIL and ADMIN_PASSWORD in the environment.');
    process.exitCode = 1;
    return;
  }
  if (String(password).length < 12) {
    console.error('\n[admin] Refusing to create an admin with a password under 12 characters.');
    process.exitCode = 1;
    return;
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    console.log(`[admin] ${email} already exists — left untouched.`);
    return;
  }

  const hash = await bcrypt.hash(String(password), 12);
  await pool.query(
    'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
    [email, hash, fullName, ROLES.SUPER_ADMIN]
  );
  console.log(`[admin] Created super_admin ${email}. Store that password safely — it is not recoverable.`);
}

async function main() {
  console.log('[migrate] Target:', `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'doc_automation'}`);

  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
  console.log('[migrate] Connected.\n');

  await applySchema();

  // The per-boot self-healing pass, so one migrate run leaves the DB fully
  // current without waiting for the first server start.
  console.log('\n[migrate] Running ensureSchema() for any columns added after schema.sql…');
  await ensureSchema();
  console.log('[migrate] ensureSchema() complete.');

  if (wantAdmin) {
    console.log('');
    await createAdmin();
  }

  const tables = ['users', 'templates', 'generated_docs', 'document_deliveries', 'audit_logs'];
  console.log('\n[migrate] Table check:');
  for (const t of tables) {
    console.log(`  ${(await tableExists(t)) ? '[ok]  ' : '[MISS]'} ${t}`);
  }

  await pool.end();
  console.log('\n✅ [migrate] Done.\n');
}

main().catch(async (err) => {
  console.error('\n❌ [migrate] Failed:', err.message);
  if (err.code) console.error('   MySQL code:', err.code);
  if (err.sql) console.error('   Statement :', err.sql.replace(/\s+/g, ' ').slice(0, 200));
  console.error('   Check DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME and, for managed');
  console.error('   providers, DB_SSL=true plus DB_SSL_CA.\n');
  try { await pool.end(); } catch { /* already closing */ }
  process.exit(1);
});
