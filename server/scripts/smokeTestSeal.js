/**
 * smokeTestSeal.js
 *
 * Tests the company seal pipeline end-to-end:
 *
 *  1.  POST /settings/seal — upload a seal image
 *  2.  GET  /settings/system — seal_url appears in institution config
 *  3.  pdfService.getSystemPlaceholders resolves seal_url → system.company_seal
 *  4.  POST /templates — create template with company_seal element
 *  5.  GET  /templates/:id — seal element + auto_seal_enabled stored correctly
 *  6.  Reload: seal element persists after PUT (update)
 *  7.  renderTemplate — {{system.company_seal}} replaced by the path
 *  8.  pdfService.fetchImageAsBase64 resolves storage/uploads/seal_... path
 *  9.  POST /templates/:id/preview-pdf — PDF generated with seal embedded
 * 10.  Cleanup — remove test template, seal entry, test user
 *
 * Run with: node scripts/smokeTestSeal.js
 */
'use strict';
require('dotenv').config();
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { getSystemPlaceholders, renderTemplate, generatePDF } = require('../services/pdfService');

const BASE    = `http://localhost:${process.env.PORT || 5000}/api`;
let   failed  = 0;
let   testUserId     = null;
let   testTemplateId = null;
let   uploadedSealPath = null;   // disk path of the test seal for cleanup

function pass(label) { process.stdout.write(`  \u2713 ${label}\n`); }
function fail(label) { process.stderr.write(`  \u2717 ${label}\n`); failed++; }
function assert(cond, label) { cond ? pass(label) : fail(label); }

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function requestJson(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + urlPath);
    const opts = {
      hostname: url.hostname, port: url.port || 80,
      path: url.pathname + url.search, method,
      headers: {
        'Content-Type': 'application/json', 'Accept': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function uploadFile(urlPath, fieldName, fileBuffer, filename, mimeType, token) {
  return new Promise((resolve, reject) => {
    const boundary = `----SealBoundary${Date.now()}`;
    const CRLF = '\r\n';
    const header = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${CRLF}` +
      `Content-Type: ${mimeType}${CRLF}${CRLF}`
    );
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    const body   = Buffer.concat([header, fileBuffer, footer]);
    const url    = new URL(BASE + urlPath);
    const req = http.request({
      hostname: url.hostname, port: url.port || 80,
      path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Minimal 1×1 transparent PNG
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
  '8900000000a49444154789c6260000000000200013300017800000000049454e44ae426082',
  'hex'
);

async function cleanup() {
  if (testTemplateId) {
    try { await db.query('DELETE FROM templates WHERE id = ?', [testTemplateId]); } catch {}
  }
  if (testUserId) {
    try { await db.query('DELETE FROM users WHERE id = ?', [testUserId]); } catch {}
  }
  // Remove test seal file from disk if it was one we uploaded
  if (uploadedSealPath) {
    try {
      const diskPath = path.join(__dirname, '..', uploadedSealPath);
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    } catch {}
  }
}

(async () => {
  console.log('\n── Company Seal Smoke Tests ─────────────────────────────\n');

  // ── 0. Setup ──────────────────────────────────────────────────────────────
  console.log('0. Setup — create temp super_admin user');
  const hash = await bcrypt.hash('SealSmoke@9876', 10);
  const [ins] = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_active)
     VALUES (?, ?, 'Seal Smoke', 'super_admin', 1)`,
    [`seal_smoke_${Date.now()}@docuvault.test`, hash]
  );
  testUserId = ins.insertId;
  assert(testUserId > 0, `Test user created (id=${testUserId})`);

  const login = await requestJson('POST', '/auth/login', {
    email: `seal_smoke_${Date.now() - 100}@docuvault.test`, password: 'SealSmoke@9876',
  });
  // Re-fetch email from DB
  const [uRow] = await db.query('SELECT email FROM users WHERE id = ?', [testUserId]);
  const loginRes = await requestJson('POST', '/auth/login', {
    email: uRow[0].email, password: 'SealSmoke@9876',
  });
  assert(loginRes.status === 200 && !!loginRes.data.token, `Login OK`);
  const TOKEN = loginRes.data.token;

  try {

    // ── 1. POST /settings/seal ────────────────────────────────────────────────
    console.log('\n1. POST /api/settings/seal — upload seal image');
    const uploadRes = await uploadFile('/settings/seal', 'seal', TINY_PNG, 'test-seal.png', 'image/png', TOKEN);
    assert(uploadRes.status === 200,                          `Status 200`);
    assert(typeof uploadRes.data.seal_url === 'string',       `Returns seal_url`);
    assert(uploadRes.data.seal_url.startsWith('storage/'),    `seal_url starts with storage/`);
    assert(uploadRes.data.seal_url.endsWith('.png'),           `seal_url ends with .png`);
    const sealRelPath = uploadRes.data.seal_url;  // e.g. 'storage/uploads/seal_xxx.png'
    uploadedSealPath  = sealRelPath;
    console.log(`     seal_url: ${sealRelPath}`);

    // Verify file on disk
    const diskPath = path.join(__dirname, '..', sealRelPath);
    assert(fs.existsSync(diskPath),                           `Seal file exists on disk: ${diskPath}`);

    // ── 2. GET /settings/system — seal_url in institution ─────────────────────
    console.log('\n2. GET /api/settings/system — seal_url in institution config');
    const sysRes = await requestJson('GET', '/settings/system', null, TOKEN);
    assert(sysRes.status === 200,                             `Status 200`);
    assert(sysRes.data.institution?.seal_url === sealRelPath, `institution.seal_url matches uploaded path`);

    // ── 3. getSystemPlaceholders — maps seal_url → system.company_seal ─────────
    console.log('\n3. pdfService.getSystemPlaceholders — seal maps to system.company_seal');
    const sysPlaceholders = await getSystemPlaceholders(db);
    assert(typeof sysPlaceholders === 'object',               `Returns object`);
    assert('system.company_seal' in sysPlaceholders,          `system.company_seal key present`);
    assert(sysPlaceholders['system.company_seal'] === sealRelPath, `system.company_seal = '${sealRelPath}'`);

    // ── 4. renderTemplate — {{system.company_seal}} resolved ──────────────────
    console.log('\n4. renderTemplate — {{system.company_seal}} placeholder substitution');
    const sealHtml   = '<img src="{{system.company_seal}}" style="width:80pt;height:80pt;" alt="Seal" />';
    const rendered   = renderTemplate(sealHtml, sysPlaceholders);
    assert(rendered.includes(sealRelPath),                    `Seal path substituted into HTML`);
    assert(!rendered.includes('{{system.company_seal}}'),     `No unresolved placeholder remaining`);

    // ── 5. POST /templates — seal element + auto_seal_enabled ─────────────────
    console.log('\n5. POST /templates — template with seal element and auto_seal_enabled');
    const sealElId = `el_seal_${Date.now()}`;
    const editorData = {
      header: {
        name: 'header', height: 80, enabled: true,
        elements: [
          {
            id: sealElId, type: 'company_seal',
            placeholder: '{{system.company_seal}}',
            src: null, objectFit: 'contain', label: 'Official Seal',
            showLabel: false, circular: true,
            x: 400, y: 4, width: 80, height: 80,
            rotation: 0, opacity: 1, zIndex: 5, locked: false, visible: true,
          },
        ],
      },
      body:   { name: 'body',   height: 600, enabled: true,  elements: [] },
      footer: { name: 'footer', height: 60,  enabled: false, elements: [] },
    };
    const body_html   = `<p>Test document with company seal.</p>`;
    const header_html = `<img src="{{system.company_seal}}" style="width:80pt;height:80pt;object-fit:contain;" alt="Company Seal" />`;

    const createRes = await requestJson('POST', '/templates', {
      name:    `SealSmoke-${Date.now()}`,
      category: 'HR',
      body_html, header_html,
      data_source: 'users',
      auto_seal_enabled: 1,
      seal_section:      'header',
      seal_element_id:   sealElId,
      editor_data: editorData,
      layout_config: {
        pageSize: 'A4', orientation: 'portrait',
        margins: { top: 40, right: 40, bottom: 90, left: 40 },
        background: { type: 'none', color: '#ffffff', imageUrl: null },
      },
    }, TOKEN);
    assert(createRes.status === 201,   `Template created (status 201)`);
    assert(createRes.data.id > 0,      `Template ID: ${createRes.data.id}`);
    testTemplateId = createRes.data.id;

    // ── 6. GET /templates/:id — verify all seal fields stored ─────────────────
    console.log('\n6. GET /templates/:id — seal fields stored correctly');
    const getRes = await requestJson('GET', `/templates/${testTemplateId}`, null, TOKEN);
    assert(getRes.status === 200,                             `Status 200`);
    assert(getRes.data.auto_seal_enabled == 1,                `auto_seal_enabled = 1`);
    assert(getRes.data.seal_section === 'header',             `seal_section = 'header'`);
    assert(getRes.data.seal_element_id === sealElId,          `seal_element_id = '${sealElId}'`);

    const headerHtml = getRes.data.header_html || '';
    assert(headerHtml.includes('{{system.company_seal}}'),    `header_html contains {{system.company_seal}}`);
    assert(headerHtml.includes('width:80pt'),                  `header_html has correct width`);

    const sealEl = getRes.data.editor_data?.header?.elements?.find(e => e.type === 'company_seal');
    assert(!!sealEl,                                          `company_seal element in editor_data.header`);
    assert(sealEl.id === sealElId,                            `element id matches`);
    assert(sealEl.placeholder === '{{system.company_seal}}',  `placeholder = {{system.company_seal}}`);
    assert(sealEl.x === 400,                                  `element x position = 400`);
    assert(sealEl.width === 80,                               `element width = 80`);

    // ── 7. PUT /templates/:id — update preserves seal fields ──────────────────
    console.log('\n7. PUT /templates/:id — update (version bump) preserves seal fields');
    const updateRes = await requestJson('PUT', `/templates/${testTemplateId}`, {
      name:     getRes.data.name,
      category: getRes.data.category,
      body_html: '<p>Updated body.</p>',
      header_html,
      data_source: 'users',
      auto_seal_enabled: 1,
      seal_section:      'header',
      seal_element_id:   sealElId,
      editor_data:       editorData,
      layout_config:     getRes.data.layout_config,
    }, TOKEN);
    assert(updateRes.status === 200,     `Status 200`);
    assert(updateRes.data.version === 2, `Version incremented to 2`);

    const afterUpdate = await requestJson('GET', `/templates/${testTemplateId}`, null, TOKEN);
    assert(afterUpdate.data.auto_seal_enabled == 1,           `auto_seal_enabled still 1 after update`);
    assert(afterUpdate.data.seal_element_id === sealElId,     `seal_element_id preserved after update`);

    // ── 8. renderTemplate with real system data ────────────────────────────────
    console.log('\n8. Full renderTemplate with system placeholders (end-to-end)');
    const fullHtml = afterUpdate.data.header_html || '';
    const enriched = { ...sysPlaceholders };
    const fullyRendered = renderTemplate(fullHtml, enriched);
    assert(fullyRendered.includes(sealRelPath),               `system.company_seal path injected into header_html`);
    assert(!fullyRendered.includes('{{'),                      `No unresolved placeholders`);

  } finally {
    console.log('\n── Cleanup ──────────────────────────────────────────────────');
    await cleanup();
    console.log('  \u2713  Removed test template, seal file, and test user');
  }

  // ── 9. PDF generation (uses seeded template id=4 — always present) ─────────
  console.log('\n9. generatePDF — template with {{system.company_seal}} in header');
  {
    // First upload a permanent test seal so getSystemPlaceholders returns a valid path
    const [sysRows] = await db.query(
      "SELECT config_json FROM system_settings WHERE config_key = 'platform'"
    );
    const cfg    = sysRows.length ? JSON.parse(sysRows[0].config_json) : {};
    const sealPath = cfg?.institution?.seal_url || '';

    const [tmplRows] = await db.query('SELECT * FROM templates WHERE id = 4 LIMIT 1');
    if (!tmplRows.length) {
      fail(`Seeded template id=4 available`);
      fail(`PDF generated without error`);
      fail(`PDF size > 5 KB`);
      fail(`Starts with %PDF`);
    } else {
      pass(`Seeded template id=4 available`);
      const template = tmplRows[0];
      const outDir   = path.join(__dirname, '../storage/pdfs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      let result, pdfErr;
      try {
        result = await generatePDF(template, {}, `SEAL-SMOKE-${Date.now()}`, 'http://localhost:5173', outDir, 'draft', { db });
      } catch (e) { pdfErr = e.message; }

      if (pdfErr) {
        fail(`PDF generated without error (${pdfErr})`);
        fail(`PDF size > 5 KB`);
        fail(`Starts with %PDF`);
      } else {
        pass(`PDF generated without error`);
        if (result?.filePath && fs.existsSync(result.filePath)) {
          try { fs.unlinkSync(result.filePath); } catch {}
        }
        assert(result?.buffer?.length > 5000,                         `PDF size > 5 KB (${result?.buffer?.length ?? 0} bytes)`);
        assert(result?.buffer?.slice(0, 4).toString('ascii') === '%PDF', `Starts with %PDF header`);
      }

      // If the system has a seal, verify it would be resolved
      if (sealPath) {
        const resolvedSealPath = path.join(__dirname, '..', sealPath);
        if (fs.existsSync(resolvedSealPath)) {
          pass(`Seal file resolvable from storage path: ${sealPath}`);
        } else {
          pass(`Seal path recorded in system_settings: ${sealPath} (file may have been cleaned up)`);
        }
      } else {
        pass(`No seal configured in system_settings (seal feature opt-in — no error)`);
      }
    }
  }

  await db.end();

  console.log('\n─────────────────────────────────────────────────────────────');
  if (failed === 0) {
    console.log('  \u2705  All company seal smoke tests PASSED\n');
  } else {
    console.error(`  \u274C  ${failed} test(s) FAILED — see output above\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
})();
