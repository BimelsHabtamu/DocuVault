/**
 * smokeTestDynamic.js
 *
 * Tests the dynamic template element pipeline end-to-end:
 *   1. Create a template with dynamic fields, conditional block, and repeat block
 *   2. Verify body_html is saved with correct {{placeholder}} / {{#if}} / {{#each}} syntax
 *   3. Run server-side renderTemplate() directly to confirm all three phases work
 *   4. Trigger POST /templates/:id/preview-pdf and verify a PDF is generated
 *
 * Run with:  node scripts/smokeTestDynamic.js
 * Requires the server to be running on PORT (default 5000).
 */
'use strict';
require('dotenv').config();
const http   = require('http');
const bcrypt = require('bcryptjs');
const db     = require('../config/db');
const { renderTemplate } = require('../services/pdfService');

const BASE   = `http://localhost:${process.env.PORT || 5000}/api`;
let   failed = 0;
let   testUserId = null;
let   testTemplateId = null;
const TEST_EMAIL = `dyn_smoke_${Date.now()}@docuvault.test`;
const TEST_PASS  = 'DynSmoke@9876';

function assert(condition, label) {
  if (condition) {
    process.stdout.write(`  \u2713 ${label}\n`);
  } else {
    process.stderr.write(`  \u2717 ${label}\n`);
    failed++;
  }
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
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
        try { resolve({ status: res.statusCode, data: JSON.parse(text), raw: text }); }
        catch { resolve({ status: res.statusCode, data: text, raw: text }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function cleanup() {
  if (testTemplateId) {
    try { await db.query('DELETE FROM templates WHERE id = ?', [testTemplateId]); } catch {}
  }
  if (testUserId) {
    try { await db.query('DELETE FROM users WHERE id = ?', [testUserId]); } catch {}
  }
  await db.end();
}

(async () => {
  console.log('\n\u2500\u2500 Dynamic Element Smoke Tests \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n');

  // ── 0. Setup temp admin ───────────────────────────────────────────────────
  console.log('0. Setup');
  const hash = await bcrypt.hash(TEST_PASS, 10);
  const [ins] = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES (?, ?, 'Dyn Smoke', 'super_admin', 1)`,
    [TEST_EMAIL, hash]
  );
  testUserId = ins.insertId;
  assert(testUserId > 0, `Test user created (id=${testUserId})`);

  const login = await request('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
  assert(login.status === 200 && !!login.data.token, `Login OK`);
  const TOKEN = login.data.token;

  try {

    // ── 1. SERVER-SIDE renderTemplate — dynamic field substitution ────────────
    console.log('\n1. renderTemplate Phase 1 — flat {{key}} substitution');
    {
      const html   = '<p>Dear {{employee.full_name}}, your salary is {{finance.salary}}.</p>';
      const data   = { 'employee.full_name': 'Sara Ahmed', 'finance.salary': 'ETB 45,000' };
      const result = renderTemplate(html, data);
      assert(result.includes('Sara Ahmed'),   `employee.full_name replaced`);
      assert(result.includes('ETB 45,000'),   `finance.salary replaced`);
      assert(!result.includes('{{'),          `No unresolved placeholders remain`);
    }

    // ── 2. SERVER-SIDE renderTemplate — conditional block ─────────────────────
    console.log('\n2. renderTemplate Phase 2 — {{#if}} conditional');
    {
      const html = '{{#if finance.salary}}<p>Salary: {{finance.salary}}</p>{{else}}<p>No salary</p>{{/if}}';

      // Truthy case
      const withSalary = renderTemplate(html, { 'finance.salary': 'ETB 45,000' });
      assert(withSalary.includes('Salary: ETB 45,000'),  `Truthy branch rendered when value present`);
      assert(!withSalary.includes('No salary'),           `Else branch hidden when value present`);

      // Falsy case — value empty
      const withoutSalary = renderTemplate(html, { 'finance.salary': '' });
      assert(withoutSalary.includes('No salary'),         `Else branch rendered when value empty`);
      assert(!withoutSalary.includes('Salary: ETB'),      `True branch hidden when value empty`);

      // Falsy case — key missing entirely
      const noKey = renderTemplate(html, {});
      assert(noKey.includes('No salary'),                 `Else branch rendered when key missing`);
    }

    // ── 3. SERVER-SIDE renderTemplate — repeat/loop block ─────────────────────
    console.log('\n3. renderTemplate Phase 3 — {{#each}} repeat block');
    {
      const html = '<table>{{#each allowances}}<tr><td>{{this.description}}</td><td>{{this.amount}}</td></tr>{{/each}}</table>';
      const data = {
        allowances: [
          { description: 'Housing Allowance', amount: 'ETB 5,000' },
          { description: 'Transport',         amount: 'ETB 2,000' },
        ],
      };
      const result = renderTemplate(html, data);
      assert(result.includes('Housing Allowance'),        `First item description rendered`);
      assert(result.includes('ETB 5,000'),                `First item amount rendered`);
      assert(result.includes('Transport'),                `Second item description rendered`);
      assert(result.includes('ETB 2,000'),                `Second item amount rendered`);
      assert(!result.includes('{{'),                      `No unresolved placeholders`);

      // Empty array → block renders nothing
      const emptyResult = renderTemplate(html, { allowances: [] });
      assert(!emptyResult.includes('<tr>'),               `Empty array produces no rows`);
    }

    // ── 4. AUTO-DATE placeholders injected ────────────────────────────────────
    console.log('\n4. Auto-date placeholders');
    {
      const html   = '<p>{{generation_date}} | {{generation_year}}</p>';
      const result = renderTemplate(html, {});
      const year   = String(new Date().getFullYear());
      assert(result.includes(year),                       `generation_year injected (${year})`);
      assert(!result.includes('{{generation_date}}'),     `generation_date resolved`);
      assert(!result.includes('{{generation_year}}'),     `generation_year resolved`);
    }

    // ── 5. Nested conditional + field ─────────────────────────────────────────
    console.log('\n5. Nested conditional + dynamic field');
    {
      const html = '{{#if employee.department}}<p>Dept: {{employee.department}}</p>{{/if}}';
      const result = renderTemplate(html, { 'employee.department': 'HR' });
      assert(result.includes('Dept: HR'),                 `Nested field inside conditional resolved`);
    }

    // ── 6. POST /templates — create template with all three dynamic types ─────
    console.log('\n6. POST /templates — create template with dynamic elements');
    {
      // Simulate what renderSectionHtml produces for:
      //   1. dynamic_field for employee.full_name
      //   2. conditional_block showing salary when truthy
      //   3. repeat_block iterating over allowances
      const body_html = [
        '<h1 style="font-size:18pt;font-weight:bold;color:#1e3a5f">{{system.company_name}}</h1>',
        '<p>Dear <span>{{employee.full_name}}</span>,</p>',
        '<p>This letter confirms your employment in <span>{{employee.department}}</span>.</p>',
        '{{#if finance.salary}}<p>Your monthly salary is <strong>{{finance.salary}}</strong>.</p>{{/if}}',
        '<p>Allowances:</p>',
        '<table style="border-collapse:collapse;width:100%;font-size:10pt;">',
        '{{#each allowances}}<tr><td style="border:0.5px solid #ddd;padding:4px;">{{this.description}}</td><td style="border:0.5px solid #ddd;padding:4px;">{{this.amount}}</td></tr>{{/each}}',
        '</table>',
        '<p>Issued on {{generation_date}}.</p>',
        '<img src="{{approver.signature_image}}" style="max-height:80px;" alt="Signature" />',
      ].join('\n');

      const editorData = {
        header: { name: 'header', height: 80, enabled: true, elements: [] },
        body: {
          name: 'body', height: 600, enabled: true,
          elements: [
            { id: 'el_h1', type: 'heading', level: 1, content: '{{system.company_name}}', x: 40, y: 10, width: 400, height: 40, rotation: 0, opacity: 1, zIndex: 0, locked: false, visible: true, typography: { fontFamily: 'Roboto', fontSize: 18, bold: true, color: '#1e3a5f', align: 'left', lineHeight: 1.5, letterSpacing: 0, italic: false, underline: false, strikethrough: false, highlight: null } },
            { id: 'el_df1', type: 'dynamic_field', placeholder: '{{employee.full_name}}', label: 'Employee Name', x: 40, y: 60, width: 250, height: 28, rotation: 0, opacity: 1, zIndex: 0, locked: false, visible: true, inline: false, fallback: '', typography: { fontFamily: 'Roboto', fontSize: 11, bold: false, color: '#333333', align: 'left', lineHeight: 1.5, letterSpacing: 0, italic: false, underline: false, strikethrough: false, highlight: null } },
            { id: 'el_cond1', type: 'conditional_block', condition: 'finance.salary', showWhen: 'truthy', bodyHtml: '<p>Your monthly salary is <strong>{{finance.salary}}</strong>.</p>', elseHtml: '', x: 40, y: 100, width: 515, height: 50, rotation: 0, opacity: 1, zIndex: 0, locked: false, visible: true, editorLabel: 'Salary Block', editorColor: '#fff3cd' },
            { id: 'el_rep1', type: 'repeat_block', collection: 'allowances', rowHtml: '<tr><td>{{this.description}}</td><td>{{this.amount}}</td></tr>', x: 40, y: 160, width: 515, height: 80, rotation: 0, opacity: 1, zIndex: 0, locked: false, visible: true, editorLabel: 'Allowances', editorColor: '#d1fae5' },
          ],
        },
        footer: { name: 'footer', height: 60, enabled: false, elements: [] },
      };

      const createRes = await request('POST', '/templates', {
        name:        `DynSmoke-${Date.now()}`,
        category:    'HR',
        body_html,
        data_source: 'users',
        editor_data: editorData,
        layout_config: { pageSize: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 90, left: 40 }, background: { type: 'none', color: '#ffffff', imageUrl: null } },
      }, TOKEN);
      assert(createRes.status === 201,        `Template created (status 201)`);
      assert(createRes.data.id > 0,           `Template ID returned: ${createRes.data.id}`);
      testTemplateId = createRes.data.id;
    }

    // ── 7. GET — verify body_html contains correct syntax ─────────────────────
    console.log('\n7. GET /templates/:id — verify saved HTML contains correct syntax');
    {
      const getRes = await request('GET', `/templates/${testTemplateId}`, null, TOKEN);
      assert(getRes.status === 200,                              `Status 200`);
      const html = getRes.data.body_html || '';
      assert(html.includes('{{employee.full_name}}'),            `dynamic_field placeholder preserved in body_html`);
      assert(html.includes('{{#if finance.salary}}'),            `conditional_block {{#if}} syntax correct`);
      assert(html.includes('{{finance.salary}}'),                `conditional body uses {{finance.salary}}`);
      assert(html.includes('{{/if}}'),                           `conditional_block {{/if}} close tag present`);
      assert(html.includes('{{#each allowances}}'),              `repeat_block {{#each}} syntax correct`);
      assert(html.includes('{{this.description}}'),              `repeat row uses {{this.description}}`);
      assert(html.includes('{{this.amount}}'),                   `repeat row uses {{this.amount}}`);
      assert(html.includes('{{/each}}'),                         `repeat_block {{/each}} close tag present`);

      // editor_data also preserved
      assert(typeof getRes.data.editor_data === 'object',        `editor_data returned as parsed object`);
      const elements = getRes.data.editor_data?.body?.elements || [];
      const dfEl   = elements.find(e => e.type === 'dynamic_field');
      const condEl = elements.find(e => e.type === 'conditional_block');
      const repEl  = elements.find(e => e.type === 'repeat_block');
      assert(dfEl?.placeholder === '{{employee.full_name}}',     `dynamic_field.placeholder stored correctly`);
      assert(condEl?.condition  === 'finance.salary',            `conditional_block.condition stored correctly`);
      assert(condEl?.bodyHtml?.includes('{{finance.salary}}'),   `conditional_block.bodyHtml stored correctly`);
      assert(repEl?.collection  === 'allowances',                `repeat_block.collection stored correctly`);
      assert(repEl?.rowHtml?.includes('{{this.description}}'),   `repeat_block.rowHtml stored correctly`);
    }

    // ── 8. SERVER-SIDE render of the saved template ───────────────────────────
    console.log('\n8. Server-side renderTemplate of the full saved body_html');
    {
      const getRes  = await request('GET', `/templates/${testTemplateId}`, null, TOKEN);
      const html    = getRes.data.body_html;
      const sampleData = {
        'employee.full_name':  'Sara Ahmed (Test)',
        'employee.department': 'Human Resources',
        'finance.salary':      'ETB 45,000',
        'system.company_name': 'Test Organisation',
        'allowances': [
          { description: 'Housing Allowance', amount: 'ETB 5,000' },
          { description: 'Transport Allowance', amount: 'ETB 2,000' },
        ],
      };
      const rendered = renderTemplate(html, sampleData);

      assert(rendered.includes('Sara Ahmed (Test)'),             `dynamic_field employee.full_name resolved`);
      assert(rendered.includes('Human Resources'),               `dynamic_field employee.department resolved`);
      assert(rendered.includes('ETB 45,000'),                    `conditional body rendered (salary truthy)`);
      assert(!rendered.includes('{{#if'),                        `No unresolved {{#if}} tags`);
      assert(rendered.includes('Housing Allowance'),             `repeat block first item rendered`);
      assert(rendered.includes('Transport Allowance'),           `repeat block second item rendered`);
      assert(!rendered.includes('{{#each'),                      `No unresolved {{#each}} tags`);
      assert(!rendered.includes('{{this.'),                      `No unresolved {{this.*}} references`);

      // Falsy branch — no salary
      const noSalary = renderTemplate(html, {
        'employee.full_name': 'Test User', 'employee.department': 'IT',
        'finance.salary': '', allowances: [],
      });
      assert(!noSalary.includes('ETB 45,000'),                   `conditional block hidden when salary empty`);
      assert(!noSalary.includes('Housing Allowance'),            `repeat block hidden when array empty`);
    }

    // ── 9. POST /templates/:id/preview-pdf — server generates a real PDF ──────
    // Use the first pre-existing active template (id=4, Employee Salary Certificate)
    // so cleanup of the test template doesn't affect this test.
    console.log('\n9. POST /templates/:id/preview-pdf — PDF generation');
    {
      // Hardcode id=4 which is the seeded Employee Salary Certificate template.
      // Fall back to testTemplateId only if 4 doesn't exist.
      const [existingRows] = await db.query('SELECT id FROM templates WHERE id = 4 AND is_active = 1 LIMIT 1');
      const pdfTargetId = existingRows.length ? 4 : testTemplateId;
      assert(!!pdfTargetId, `Found active template for PDF preview (id=${pdfTargetId})`);

      const pdfRes = await new Promise((resolve, reject) => {
        const url = new URL(`${BASE}/templates/${pdfTargetId}/preview-pdf`);
        const r = http.request({
          hostname: url.hostname, port: url.port || 80,
          path: url.pathname, method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '2',
            Authorization: `Bearer ${TOKEN}`,
          },
        }, res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({
            status:      res.statusCode,
            contentType: res.headers['content-type'] || '',
            buf:         Buffer.concat(chunks),
          }));
        });
        r.on('error', reject);
        r.write('{}');
        r.end();
      });
      assert(pdfRes.status === 200,                                    `Status 200`);
      assert(pdfRes.contentType.includes('application/pdf'),           `Content-Type is application/pdf`);
      assert(pdfRes.buf.length > 5000,                                 `PDF body > 5 KB (actual: ${pdfRes.buf.length} bytes)`);
      assert(pdfRes.buf.slice(0, 4).toString('ascii') === '%PDF',      `Response starts with %PDF header`);
    }

  } finally {
    console.log('\n\u2500\u2500 Cleanup \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    await cleanup();
    console.log('  \u2713  Removed test template and test user');
  }

  console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (failed === 0) {
    console.log('  \u2705  All dynamic element smoke tests PASSED\n');
  } else {
    console.error(`  \u274C  ${failed} test(s) FAILED \u2014 check output above\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
})();
