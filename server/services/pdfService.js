const PdfPrinter    = require('pdfmake');
const htmlToPdfmake = require('html-to-pdfmake');
const { JSDOM }     = require('jsdom');
const crypto        = require('crypto');
const QRCode        = require('qrcode');
const fs            = require('fs');
const path          = require('path');
const https         = require('https');
const http          = require('http');

const vfsFonts = require('pdfmake/build/vfs_fonts');

// ── Fonts ─────────────────────────────────────────────────────────────────────
const fonts = {
  Roboto: {
    normal:      Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Regular.ttf'],      'base64'),
    bold:        Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Medium.ttf'],       'base64'),
    italics:     Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Italic.ttf'],       'base64'),
    bolditalics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

// ── Crypto helpers ────────────────────────────────────────────────────────────
function computeSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function computeHMAC(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// ── Fetch a URL and return it as a base64 data URI ────────────────────────────
// pdfmake requires images to be base64 data URIs — external http URLs won't work
function fetchImageAsBase64(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);

    // Already a data URI — return as-is
    if (url.startsWith('data:')) return resolve(url);

    // Local file path (relative to server root)
    if (!url.startsWith('http')) {
      try {
        const fullPath = path.join(__dirname, '..', url.replace(/^\//, ''));
        if (fs.existsSync(fullPath)) {
          const buffer   = fs.readFileSync(fullPath);
          const ext      = path.extname(fullPath).toLowerCase().slice(1) || 'png';
          const mimeMap  = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' };
          const mime     = mimeMap[ext] || 'image/png';
          return resolve(`data:${mime};base64,${buffer.toString('base64')}`);
        }
      } catch { /* fall through */ }
      return resolve(null);
    }

    // HTTP/HTTPS fetch
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf      = Buffer.concat(chunks);
        const mime     = res.headers['content-type'] || 'image/png';
        resolve(`data:${mime};base64,${buf.toString('base64')}`);
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

// ── Convert image-placeholder values to <img> tags before HTML rendering ──────
// Handles: {{system.company_seal}}, {{system.logo_url}}, {{approver.signature_image}}
// These keys map to URL strings — we convert them to proper <img> tags in the HTML
// so html-to-pdfmake can render them as real images in the PDF.
async function resolveImagePlaceholders(html, data, serverBase) {
  if (!html) return html;

  // Keys that should be treated as image URLs
  const IMAGE_KEYS = [
    'system.company_seal',
    'system.logo_url',
    'approver.signature_image',
  ];

  let result = html;
  for (const key of IMAGE_KEYS) {
    const value = data[key];
    if (!value) continue;

    // Build the full URL
    const fullUrl = value.startsWith('http') || value.startsWith('data:')
      ? value
      : `${serverBase}/${value.replace(/^\//, '')}`;

    // Fetch and convert to base64
    const base64 = await fetchImageAsBase64(fullUrl);
    if (!base64) continue;

    // Size defaults per key type
    const sizeMap = {
      'system.logo_url':           'width="160" height="60"',
      'system.company_seal':       'width="80"  height="80"',
      'approver.signature_image':  'width="160" height="60"',
    };
    const sizeAttr = sizeMap[key] || 'width="100"';

    // Replace any bare {{key}} text occurrences with a proper <img> tag
    const escapedKey = key.replace(/\./g, '\\.');
    result = result.replace(
      new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'),
      `<img src="${base64}" ${sizeAttr} style="object-fit:contain;display:inline-block;"/>`
    );

    // Also fix any <img src="{{key}}"> pattern the template editor might have written
    result = result.replace(
      new RegExp(`src="\\{\\{${escapedKey}\\}\\}"`, 'g'),
      `src="${base64}"`
    );
  }

  return result;
}

// ── Auto date/time placeholders (FR-013) ──────────────────────────────────────
function injectAutoPlaceholders(data) {
  const now = new Date();
  const locale = 'en-US';
  return {
    // System-injected dates — cannot be overridden by caller data
    generation_date:     now.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    generation_time:     now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    generation_datetime: now.toLocaleString(locale),
    generation_year:     String(now.getFullYear()),
    generation_month:    now.toLocaleDateString(locale, { month: 'long' }),
    generation_day:      String(now.getDate()),
    // Caller data comes after so it can override effective_date etc.
    ...data,
  };
}

// ── Fetch system config from DB and build system.* placeholders ───────────────
async function getSystemPlaceholders(db) {
  try {
    const [rows] = await db.query(
      'SELECT config_json FROM system_settings WHERE config_key = ?',
      ['platform']
    );
    if (!rows.length) return {};
    const config = JSON.parse(rows[0].config_json || '{}');
    const inst   = config.institution || {};
    return {
      'system.company_name':   inst.university_name      || '',
      'system.department':     inst.institute_department || '',
      'system.address':        inst.address              || '',
      'system.contact_email':  inst.contact_email        || '',
      'system.contact_phone':  inst.contact_phone        || '',
      'system.logo_url':       inst.logo_url             || '',
      'system.company_seal':   inst.seal_url             || '',
    };
  } catch { return {}; }
}

// ── Build approver.* placeholders from user row ───────────────────────────────
function getApproverPlaceholders(approver) {
  if (!approver) return {};
  return {
    'approver.full_name':       approver.full_name      || '',
    'approver.email':           approver.email          || '',
    'approver.role':            (approver.role || '').replace(/_/g, ' '),
    'approver.department':      approver.department     || '',
    'approver.signature_image': approver.signature_url  || '',
  };
}

// ── Template rendering (FR-002 / FR-004 / FR-005) ────────────────────────────
/**
 * Phase 1 — simple {{key}} substitution (flat values, FR-002)
 * Phase 2 — {{#if condition}} ... {{/if}} blocks (FR-004)
 * Phase 3 — {{#each array}} ... {{/each}} loops (FR-005)
 */
function renderTemplate(html, rawData) {
  if (!html) return '';
  const data = injectAutoPlaceholders(rawData || {});
  let result = html;

  // ── Phase 3: loops  {{#each items}} ... {{/each}} ────────────────────────
  result = result.replace(
    /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, arrayKey, innerTemplate) => {
      const arr = data[arrayKey];
      if (!Array.isArray(arr) || arr.length === 0) return '';
      return arr.map(item => {
        let row = innerTemplate;
        // Replace {{this.field}} or {{field}} inside the loop
        if (typeof item === 'object') {
          for (const [k, v] of Object.entries(item)) {
            row = row.replace(new RegExp(`\\{\\{this\\.${k}\\}\\}`, 'g'), v ?? '');
            row = row.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '');
          }
        } else {
          row = row.replace(/\{\{this\}\}/g, item ?? '');
        }
        return row;
      }).join('');
    }
  );

  // ── Phase 2: conditionals  {{#if key}} ... {{/if}} ───────────────────────
  result = result.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, key, trueBranch, falseBranch = '') => {
      const val = data[key];
      const truthy = val !== undefined && val !== null && val !== '' && val !== false && val !== '0';
      return truthy ? trueBranch : falseBranch;
    }
  );

  // ── Phase 1: flat placeholders  {{key}} ──────────────────────────────────
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
  }

  // Remove any remaining unresolved placeholders cleanly
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

// ── Watermark builder (FR-017) ────────────────────────────────────────────────
function buildWatermark(template, docStatus) {
  // Per-status automatic watermark
  const statusMap = {
    draft:   { text: 'DRAFT',        color: '#cc0000', opacity: 0.15 },
    pending: { text: 'PENDING',       color: '#e67e00', opacity: 0.15 },
    signed:  { text: 'SIGNED',        color: '#006600', opacity: 0.10 },
    delivered: { text: 'FINAL',       color: '#003399', opacity: 0.10 },
    hand_delivered: { text: 'DELIVERED', color: '#003399', opacity: 0.10 },
  };

  // If template has a custom watermark, use that instead
  if (template.watermark_text) {
    return { text: template.watermark_text, color: '#aaaaaa', opacity: 0.25, bold: true, italics: true };
  }

  const sw = statusMap[docStatus];
  if (!sw) return undefined;
  return { text: sw.text, color: sw.color, opacity: sw.opacity, bold: true, italics: true };
}

// ── HTML → pdfmake content array (FR-002 / FR-014) ───────────────────────────
function htmlToPdfmakeContent(html, defaultFontSize = 11) {
  if (!html || !html.trim()) return [];

  // html-to-pdfmake needs a DOM window
  const { window } = new JSDOM('');
  const parsed = htmlToPdfmake(html, {
    window,
    defaultStyles: {
      b:      { bold: true },
      strong: { bold: true },
      i:      { italics: true },
      em:     { italics: true },
      u:      { decoration: 'underline' },
      h1:     { fontSize: 18, bold: true, marginBottom: 8 },
      h2:     { fontSize: 15, bold: true, marginBottom: 6 },
      h3:     { fontSize: 13, bold: true, marginBottom: 4 },
      p:      { marginBottom: 6 },
      li:     { marginBottom: 2 },
      td:     { margin: [4, 4, 4, 4] },
      th:     { margin: [4, 4, 4, 4], bold: true, fillColor: '#f0f4ff' },
    },
  });

  // Apply base font size to top-level text nodes
  const applySize = (node) => {
    if (!node) return node;
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(applySize);
    if (node.text && !node.fontSize && !node.style) {
      node.fontSize = defaultFontSize;
      node.color = node.color || '#333333';
    }
    return node;
  };

  const content = Array.isArray(parsed) ? parsed : [parsed];
  return content.map(applySize);
}

// ── Main PDF generation ───────────────────────────────────────────────────────
async function generatePDF(template, data, docUuid, verifyBaseUrl, outputDir, docStatus = 'draft', options = {}) {
  const printer = new PdfPrinter(fonts);

  // Build the full placeholder data set:
  // 1. Auto dates
  // 2. System config (company name, seal, etc.)
  // 3. Approver info (if provided)
  // 4. User-supplied data (highest priority)
  const systemPlaceholders   = options.db       ? await getSystemPlaceholders(options.db) : {};
  const approverPlaceholders = options.approver ? getApproverPlaceholders(options.approver) : {};

  const enrichedData = injectAutoPlaceholders({
    ...systemPlaceholders,
    ...approverPlaceholders,
    ...data,
  });

  // Render HTML with placeholders resolved
  const renderedBody   = renderTemplate(template.body_html   || '', enrichedData);
  const renderedHeader = renderTemplate(template.header_html || '', enrichedData);
  const renderedFooter = renderTemplate(template.footer_html || '', enrichedData);

  // Resolve image placeholders (seal, logo, signature) → base64 data URIs
  // so html-to-pdfmake can embed them as real images in the PDF
  const serverBase = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.replace(':5174', ':5000').replace(':3000', ':5000')
    : `http://localhost:${process.env.PORT || 5000}`;

  const [resolvedBody, resolvedHeader, resolvedFooter] = await Promise.all([
    resolveImagePlaceholders(renderedBody,   enrichedData, serverBase),
    resolveImagePlaceholders(renderedHeader, enrichedData, serverBase),
    resolveImagePlaceholders(renderedFooter, enrichedData, serverBase),
  ]);

  // Convert HTML → pdfmake node tree (preserves rich formatting)
  const bodyContent   = htmlToPdfmakeContent(resolvedBody,   11);
  const footerContent = resolvedFooter ? htmlToPdfmakeContent(resolvedFooter, 9) : [];

  // Plain-text header for the page header bar (keep it concise)
  const headerLabel = resolvedHeader
    ? resolvedHeader.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 120)
    : template.name;

  // QR code pointing to public verify URL (FR-016)
  // Uses path segment format /verify/:doc_uuid so PublicVerifyPage useParams() works correctly
  const verifyUrl = `${verifyBaseUrl}/verify/${docUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 1 });
  const qrBase64  = qrDataUrl.split(',')[1];

  // Auto watermark based on doc status (FR-017)
  const watermark = buildWatermark(template, docStatus);

  const docDefinition = {
    pageSize:    'A4',
    pageMargins: [40, 70, 40, 90],
    watermark,

    // Page header (FR-016 partial — header bar)
    header: () => ({
      margin: [40, 15, 40, 0],
      columns: [
        { text: headerLabel, fontSize: 10, color: '#1e3a5f', bold: true, width: '*' },
        {
          text: enrichedData.generation_date,
          fontSize: 9, color: '#888888', alignment: 'right', width: 'auto',
        },
      ],
    }),

    // Page footer: Doc ID + verify URL + QR code (FR-016 / FR-034)
    footer: (currentPage, pageCount) => ({
      margin: [40, 10, 40, 10],
      columns: [
        {
          stack: [
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 340, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }],
              margin: [0, 0, 0, 4],
            },
            { text: `Doc ID: ${docUuid}`, fontSize: 7, color: '#555555' },
            { text: `Verify at: ${verifyUrl}`, fontSize: 7, color: '#3b5bdb' },
            { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#888888', margin: [0, 2, 0, 0] },
          ],
          width: '*',
        },
        {
          image: `data:image/png;base64,${qrBase64}`,
          width: 55,
          alignment: 'right',
        },
      ],
    }),

    content: [
      // Document title
      { text: template.name, fontSize: 18, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4] },
      // Blue rule
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#3b5bdb' }], margin: [0, 0, 0, 16] },
      // Rich body content (preserves tables, lists, bold, italic etc.)
      ...bodyContent,
      // Optional footer section
      ...(footerContent.length > 0
        ? [{ text: '', margin: [0, 16, 0, 0] }, ...footerContent]
        : []),
    ],

    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.5, color: '#333333' },
  };

  const pdfDoc   = printer.createPdfKitDocument(docDefinition);
  const filePath = path.join(outputDir, `${docUuid}.pdf`);

  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on('data',  c => chunks.push(c));
    pdfDoc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(filePath, buffer);
      resolve({ filePath, hash: computeSHA256(buffer), buffer });
    });
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

module.exports = { generatePDF, computeSHA256, computeHMAC, renderTemplate, injectAutoPlaceholders, getSystemPlaceholders, getApproverPlaceholders };
