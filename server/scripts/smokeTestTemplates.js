/**
 * smokeTestTemplates.js
 *
 * Smoke-tests all template endpoints against the live server to verify:
 *   1. All existing endpoints still work after the migration
 *   2. New layout_config / editor_data fields are accepted and returned
 *   3. Existing templates are unaffected (no data corruption)
 *   4. Backward-compatible: legacy POST without editor_data still works
 *
 * Run with:  node scripts/smokeTestTemplates.js
 * Requires the server to be running on PORT (default 5000).
 *
 * The script creates a temporary test admin user, runs all tests, then
 * deletes the test user — no manual credential setup required.
 */

'use strict';
require('dotenv').config();
const https    = require('https');
const http     = require('http');
const bcrypt   = require('bcryptjs');
const db       = require('../config/db');

const BASE     = `http://localhost:${process.env.PORT || 5000}/api`;
const PASS     = '  ✓ ';
const FAIL     = '  ✗ ';
let   failed   = 0;
let   testUserId = null;
const TEST_EMAIL = `smoke_test_${Date.now()}@docuvault.test`;
const TEST_PASS  = 'SmokeTest@9876';

// ── Minimal HTTP client ───────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url     = new URL(BASE + path);
    const opts    = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const client = url.protocol === 'https:' ? https : http;
    const req    = client.request(opts, res => {
      const chunks = [];
      res.on('data',  c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, label) {
  if (condition) {
    console.log(PASS + label);
  } else {
    console.error(FAIL + label);
    failed++;
  }
}

async function cleanup(ids) {
  for (const id of ids) {
    try { await db.query('DELETE FROM templates WHERE id = ?', [id]); } catch {}
  }
  if (testUserId) {
    try { await db.query('DELETE FROM users WHERE id = ?', [testUserId]); } catch {}
  }
  await db.end();
}

// ── Test runner ───────────────────────────────────────────────────────────────
(async () => {
  console.log('\n── DocuVault Template API Smoke Tests ──────────────────────\n');

  // ── 0. Create a temporary super_admin test user directly in DB ────────────
  console.log('0. Setup — creating temporary test admin user');
  const hash = await bcrypt.hash(TEST_PASS, 10);
  const [ins] = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_active)
     VALUES (?, ?, 'Smoke Test Admin', 'super_admin', 1)`,
    [TEST_EMAIL, hash]
  );
  testUserId = ins.insertId;
  assert(testUserId > 0, `Test admin user created (id=${testUserId})`);

  const createdTemplates = [];

  try {
    // ── 1. Login ─────────────────────────────────────────────────────────────
    console.log('\n1. Authentication');
    const loginRes = await request('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
    assert(loginRes.status === 200 && !!loginRes.data.token, `Login OK (status ${loginRes.status})`);
    const TOKEN = loginRes.data.token;

    // ── 2. GET /templates ─────────────────────────────────────────────────────
    console.log('\n2. GET /templates');
    const listRes = await request('GET', '/templates', null, TOKEN);
    assert(listRes.status === 200,      `Status 200`);
    assert(Array.isArray(listRes.data), `Returns array`);
    const existingCount = listRes.data.length;
    console.log(`     Found ${existingCount} existing template(s)`);

    const allNullNew = listRes.data.every(t => t.layout_config === null && t.editor_data === null);
    assert(allNullNew, `All pre-migration templates: layout_config=null, editor_data=null`);

    // ── 3. GET /templates/schema ──────────────────────────────────────────────
    console.log('\n3. GET /templates/schema');
    const schemaRes = await request('GET', '/templates/schema', null, TOKEN);
    assert(schemaRes.status === 200,           `Status 200`);
    assert(typeof schemaRes.data === 'object', `Returns object`);
    assert('templates' in schemaRes.data,      `templates table present in schema`);

    // ── 4. POST /templates — LEGACY (no editor_data) ─────────────────────────
    console.log('\n4. POST /templates — legacy save (body_html only)');
    const legacyCreate = await request('POST', '/templates', {
      name:        `Smoke-Legacy-${Date.now()}`,
      category:    'HR',
      body_html:   '<p>Legacy {{employee.full_name}}</p>',
      description: 'Smoke test — legacy path',
      data_source: 'users',
    }, TOKEN);
    assert(legacyCreate.status === 201, `Status 201`);
    assert(legacyCreate.data.id > 0,    `Returns new id: ${legacyCreate.data.id}`);
    const legacyId = legacyCreate.data.id;
    createdTemplates.push(legacyId);

    // ── 5. GET legacy template ────────────────────────────────────────────────
    console.log('\n5. GET /templates/:id — legacy template');
    const legacyGet = await request('GET', `/templates/${legacyId}`, null, TOKEN);
    assert(legacyGet.status === 200,                   `Status 200`);
    assert(legacyGet.data.layout_config === null,      `layout_config=null (legacy)`);
    assert(legacyGet.data.editor_data   === null,      `editor_data=null (legacy)`);
    assert(Array.isArray(legacyGet.data.placeholders), `placeholders array present`);
    assert(legacyGet.data.body_html.includes('{{employee.full_name}}'), `body_html preserved`);

    // ── 6. POST /templates — NEW editor save ──────────────────────────────────
    console.log('\n6. POST /templates — new editor save (layout_config + editor_data)');
    const schema = require('../models/templateEditorSchema');
    const lc = schema.defaultLayoutConfig();
    const ed = schema.defaultEditorData();

    const textEl = schema.ELEMENT_DEFAULTS.text({ content: 'Hello {{employee.full_name}}', x: 40, y: 60 });
    const wm     = schema.ELEMENT_DEFAULTS.watermark({ text: 'SMOKE TEST', opacity: 0.1 });
    const df     = schema.ELEMENT_DEFAULTS.dynamic_field({ placeholder: '{{employee.full_name}}', x: 40, y: 100 });
    ed.body.elements.push(textEl, wm, df);

    const newCreate = await request('POST', '/templates', {
      name:          `Smoke-EditorData-${Date.now()}`,
      category:      'Finance',
      body_html:     '<p>Hello {{employee.full_name}}</p>',
      data_source:   'users',
      layout_config: lc,
      editor_data:   ed,
    }, TOKEN);
    assert(newCreate.status === 201, `Status 201`);
    assert(newCreate.data.id > 0,    `Returns new id: ${newCreate.data.id}`);
    const newId = newCreate.data.id;
    createdTemplates.push(newId);

    // ── 7. GET new editor template ────────────────────────────────────────────
    console.log('\n7. GET /templates/:id — new editor template');
    const newGet = await request('GET', `/templates/${newId}`, null, TOKEN);
    assert(newGet.status === 200,                              `Status 200`);
    assert(newGet.data.layout_config !== null && typeof newGet.data.layout_config === 'object', `layout_config is non-null parsed object`);
    assert(newGet.data.editor_data   !== null && typeof newGet.data.editor_data   === 'object', `editor_data is non-null parsed object`);
    assert(newGet.data.layout_config?.pageSize === 'A4',       `layout_config.pageSize = A4`);
    const elements = newGet.data.editor_data?.body?.elements ?? [];
    assert(elements.length === 3,                              `3 elements stored`);

    const storedText = elements.find(e => e.type === 'text');
    assert(storedText?.content === 'Hello {{employee.full_name}}', `text element content correct`);

    const storedWm = elements.find(e => e.type === 'watermark');
    assert(storedWm?.text === 'SMOKE TEST',       `watermark.text = 'SMOKE TEST'`);
    assert(storedWm?.opacity === 0.1,             `watermark.opacity = 0.1`);
    assert(storedWm?.locked === false,            `watermark.locked = false (editable)`);

    const storedDf = elements.find(e => e.type === 'dynamic_field');
    assert(storedDf?.placeholder === '{{employee.full_name}}', `dynamic_field.placeholder correct`);

    // Guard: if editor_data didn't round-trip, skip dependent steps gracefully
    if (!newGet.data.editor_data) {
      console.error('  SKIP steps 8-9: editor_data was null — check DB JSON column');
      failed++;
    } else {

    // ── 8. PUT — update watermark text ───────────────────────────────────────
    console.log('\n8. PUT /templates/:id — update watermark text');
    const updatedElements = elements.map(e =>
      e.type === 'watermark' ? { ...e, text: 'TEMPORARY CERTIFICATE' } : e
    );
    const updatedEd = {
      ...newGet.data.editor_data,
      body: { ...newGet.data.editor_data.body, elements: updatedElements },
    };
    const updateRes = await request('PUT', `/templates/${newId}`, {
      name:          newGet.data.name,
      category:      newGet.data.category,
      body_html:     '<p>Updated</p>',
      data_source:   newGet.data.data_source,
      layout_config: newGet.data.layout_config,
      editor_data:   updatedEd,
    }, TOKEN);
    assert(updateRes.status === 200,     `Status 200`);
    assert(updateRes.data.version === 2, `Version incremented to 2`);

    // ── 9. GET after update ───────────────────────────────────────────────────
    console.log('\n9. GET /templates/:id after update');
    const afterUpdate = await request('GET', `/templates/${newId}`, null, TOKEN);
    const updatedWmStored = afterUpdate.data.editor_data?.body?.elements?.find(e => e.type === 'watermark');
    assert(updatedWmStored?.text === 'TEMPORARY CERTIFICATE', `Watermark updated to "TEMPORARY CERTIFICATE"`);
    assert(afterUpdate.data.version === 2,                    `Version = 2`);

    // ── 10. GET /templates/:id/versions ──────────────────────────────────────
    console.log('\n10. GET /templates/:id/versions');
    const versionsRes = await request('GET', `/templates/${newId}/versions`, null, TOKEN);
    assert(versionsRes.status === 200,       `Status 200`);
    assert(Array.isArray(versionsRes.data),  `Returns array`);
    assert(versionsRes.data.length >= 1,     `At least 1 snapshot in history`);

    // ── 11. PATCH /templates/:id/status ──────────────────────────────────────
    console.log('\n11. PATCH /templates/:id/status');
    const archRes = await request('PATCH', `/templates/${newId}/status`, { is_active: false }, TOKEN);
    assert(archRes.status === 200, `Archived: status 200`);
    const reactRes = await request('PATCH', `/templates/${newId}/status`, { is_active: true }, TOKEN);
    assert(reactRes.status === 200, `Re-activated: status 200`);

    // ── 12. Invalid layout_config rejected ────────────────────────────────────
    console.log('\n12. POST — invalid layout_config rejected');
    const badLRes = await request('POST', '/templates', {
      name: `Smoke-BadLayout-${Date.now()}`, category: 'HR', body_html: '<p>x</p>',
      layout_config: { pageSize: 'A3' },
    }, TOKEN);
    assert(badLRes.status === 400,           `Status 400 for invalid pageSize`);
    assert(badLRes.data.errors?.length > 0,  `errors array returned`);

    // ── 13. Invalid element type rejected ─────────────────────────────────────
    console.log('\n13. POST — invalid editor_data element type rejected');
    const badERes = await request('POST', '/templates', {
      name: `Smoke-BadEl-${Date.now()}`, category: 'HR', body_html: '<p>x</p>',
      editor_data: { body: { elements: [{ id: 'el_x', type: 'flying_unicorn' }] } },
    }, TOKEN);
    assert(badERes.status === 400,           `Status 400 for unknown element type`);
    assert(badERes.data.errors?.length > 0,  `errors array returned`);

    // ── 14. All 15 element types accepted ─────────────────────────────────────
    console.log('\n14. POST — all 15 element types accepted');
    const allElements = Object.values(schema.ELEMENT_TYPES).map(type =>
      schema.ELEMENT_DEFAULTS[type]?.() ?? null
    ).filter(Boolean);
    const allTypesCreate = await request('POST', '/templates', {
      name:        `Smoke-AllTypes-${Date.now()}`,
      category:    'Academic',
      body_html:   '<p>All types test</p>',
      editor_data: {
        header: { name: 'header', height: 80, enabled: true, elements: [] },
        body:   { name: 'body',   height: 600, enabled: true, elements: allElements },
        footer: { name: 'footer', height: 60,  enabled: false, elements: [] },
      },
    }, TOKEN);
    assert(allTypesCreate.status === 201,  `Status 201 with all 15 element types`);
    if (allTypesCreate.data.id) createdTemplates.push(allTypesCreate.data.id);

    // Verify all 15 round-trip correctly
    if (allTypesCreate.status === 201) {
      const allTypesGet = await request('GET', `/templates/${allTypesCreate.data.id}`, null, TOKEN);
      const storedElements = allTypesGet.data.editor_data?.body?.elements ?? [];
      assert(storedElements.length === 15, `All 15 elements stored and returned`);
      const returnedTypes = new Set(storedElements.map(e => e.type));
      assert(returnedTypes.size === 15, `All 15 distinct types round-tripped`);
    }

    // ── 15. Pre-migration templates still intact ──────────────────────────────
    console.log('\n15. Pre-migration templates intact');
    const listFinal = await request('GET', '/templates', null, TOKEN);
    const preMigration = listFinal.data.filter(t => !createdTemplates.includes(t.id) && t.id !== undefined);
    const originals = preMigration.filter(t => t.id < legacyId);
    assert(originals.length === existingCount, `Pre-migration count unchanged: ${existingCount}`);
    const allOrigNull = originals.every(t => t.layout_config === null && t.editor_data === null);
    assert(allOrigNull, `All pre-migration templates: layout_config=null, editor_data=null`);

    } // end if(editor_data) else guard

  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────
    console.log('\n── Cleanup ──────────────────────────────────────────────────');
    await cleanup(createdTemplates);
    console.log(`  ✓  Removed ${createdTemplates.length} test template(s) and test user`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  if (failed === 0) {
    console.log('  ✅  All template smoke tests PASSED\n');
  } else {
    console.error(`  ❌  ${failed} test(s) FAILED — check output above\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
})();
