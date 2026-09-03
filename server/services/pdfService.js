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

// ── Unicode font paths ────────────────────────────────────────────────────────
// Noto fonts (SIL OFL 1.1 license — safe to embed in PDFs).
// See server/fonts/LICENSE.txt for attribution and source information.
const FONTS_DIR = path.join(__dirname, '../fonts');

function loadFont(filename) {
  const fullPath = path.join(FONTS_DIR, filename);
  if (fs.existsSync(fullPath)) return fs.readFileSync(fullPath);
  return null;
}

// ── Font registry ─────────────────────────────────────────────────────────────
// Roboto — default Latin/Cyrillic/Greek font (from pdfmake's bundled VFS)
// NotoSansEthiopic — Ethiopic/Amharic script (FR-014)
// NotoNaskhArabic  — Arabic script (FR-014)
// NotoSansSC       — Simplified Chinese CJK (FR-014)
const fonts = {
  Roboto: {
    normal:      Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Regular.ttf'],      'base64'),
    bold:        Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Medium.ttf'],       'base64'),
    italics:     Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Italic.ttf'],       'base64'),
    bolditalics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

// Conditionally register Unicode fonts — if any font file is missing, the
// system logs a warning and falls back to Roboto. Existing Latin documents
// are never affected.
const _ethiopic = loadFont('NotoSansEthiopic-Regular.ttf');
const _ethiopicB = loadFont('NotoSansEthiopic-Bold.ttf');
if (_ethiopic) {
  fonts.NotoSansEthiopic = {
    normal:      _ethiopic,
    bold:        _ethiopicB || _ethiopic,
    italics:     _ethiopic,
    bolditalics: _ethiopicB || _ethiopic,
  };
  console.log('  ✓  NotoSansEthiopic font loaded (Amharic/Ethiopic support)');
} else {
  console.warn('  ⚠  NotoSansEthiopic font missing — Amharic text will not render');
}

const _arabic  = loadFont('NotoNaskhArabic-Regular.ttf');
const _arabicB = loadFont('NotoNaskhArabic-Bold.ttf');
if (_arabic) {
  fonts.NotoNaskhArabic = {
    normal:      _arabic,
    bold:        _arabicB || _arabic,
    italics:     _arabic,
    bolditalics: _arabicB || _arabic,
  };
  console.log('  ✓  NotoNaskhArabic font loaded (Arabic support)');
} else {
  console.warn('  ⚠  NotoNaskhArabic font missing — Arabic text will not render');
}

const _cjk = loadFont('NotoSansSC-Regular.ttf');
if (_cjk) {
  fonts.NotoSansSC = {
    normal:      _cjk,
    bold:        _cjk,
    italics:     _cjk,
    bolditalics: _cjk,
  };
  console.log('  ✓  NotoSansSC font loaded (Simplified Chinese support)');
} else {
  console.warn('  ⚠  NotoSansSC font missing — Chinese text will not render');
}

// ── Unicode range detection ───────────────────────────────────────────────────
// Returns the appropriate pdfmake font name for a given text string.
// Used by the HTML→pdfmake converter to tag nodes with the correct font.
function detectFont(text) {
  if (!text || typeof text !== 'string') return 'Roboto';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    // Ethiopic block: U+1200–U+137F and extended U+1380–U+139F, U+2D80–U+2DDF
    if ((cp >= 0x1200 && cp <= 0x139F) || (cp >= 0x2D80 && cp <= 0x2DDF)) {
      return fonts.NotoSansEthiopic ? 'NotoSansEthiopic' : 'Roboto';
    }
    // Arabic block: U+0600–U+06FF, Supplement U+0750–U+077F, Extended U+FB50–U+FDFF, Presentation U+FE70–U+FEFF
    if ((cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0x0750 && cp <= 0x077F) ||
        (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF)) {
      return fonts.NotoNaskhArabic ? 'NotoNaskhArabic' : 'Roboto';
    }
    // CJK Unified Ideographs: U+4E00–U+9FFF (core), U+3000–U+303F (CJK Symbols), U+3400–U+4DBF (Ext A)
    if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3000 && cp <= 0x303F) ||
        (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x20000 && cp <= 0x2A6DF)) {
      return fonts.NotoSansSC ? 'NotoSansSC' : 'Roboto';
    }
  }
  return 'Roboto';
}

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
        // Primary: try path relative to server root (handles absolute paths like /uploads/...)
        const serverRoot = path.join(__dirname, '..');
        // The static /uploads/ route is served from storage/uploads/ — try that first
        const storageMap = url.replace(/^\/uploads\//, 'storage/uploads/');
        const storagePath = path.join(serverRoot, storageMap.replace(/^\//, ''));
        if (fs.existsSync(storagePath)) {
          const buffer   = fs.readFileSync(storagePath);
          const ext      = path.extname(storagePath).toLowerCase().slice(1) || 'png';
          const mimeMap  = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' };
          const mime     = mimeMap[ext] || 'image/png';
          return resolve(`data:${mime};base64,${buffer.toString('base64')}`);
        }
        // Fallback: try path relative to server root as-is
        const fullPath = path.join(serverRoot, url.replace(/^\//, ''));
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
//
// Priority order:
//   1. template.watermark_config  — full element config saved by the editor
//      (text, typography.color/fontSize/bold/italic, opacity, layer, scope)
//   2. template.watermark_text    — legacy plain-text field (backward compat)
//   3. per-docStatus auto-watermark (DRAFT / PENDING / SIGNED / FINAL)
//
// Returns { wmNode, layer } where:
//   wmNode  — pdfmake watermark descriptor OR null
//   layer   — 'behind' | 'infront'
//
// NOTE: pdfmake's native `watermark` key is always behind content.
//       "infront" watermarks are returned as wmNode and must be injected
//       into the content array by the caller as an absolute-positioned overlay.
function buildWatermark(template, docStatus) {
  // ── Per-status auto watermark (used when no custom watermark is set) ────────
  const STATUS_MAP = {
    draft:          { text: 'DRAFT',     color: '#cc0000', opacity: 0.15 },
    pending:        { text: 'PENDING',   color: '#e67e00', opacity: 0.15 },
    signed:         { text: 'SIGNED',    color: '#006600', opacity: 0.10 },
    delivered:      { text: 'FINAL',     color: '#003399', opacity: 0.10 },
    hand_delivered: { text: 'DELIVERED', color: '#003399', opacity: 0.10 },
  };

  // ── 1. Full watermark_config from the editor element ────────────────────────
  let wmConfig = null;
  if (template.watermark_config) {
    try {
      wmConfig = typeof template.watermark_config === 'string'
        ? JSON.parse(template.watermark_config)
        : template.watermark_config;
    } catch { wmConfig = null; }
  }

  if (wmConfig) {
    const layer    = wmConfig.layer || 'behind';
    const opacity  = wmConfig.opacity ?? 0.15;
    const typo     = wmConfig.typography || {};
    const isImage  = wmConfig.watermarkMode === 'image';

    if (isImage) {
      // Image watermarks are handled separately in generatePDF via the
      // background callback — return a sentinel so the caller knows.
      return { wmNode: null, layer, isImage: true, wmConfig };
    }

    // Text watermark — build a pdfmake watermark descriptor from full typography
    const wmNode = {
      text:    wmConfig.text || '',
      color:   typo.color   || '#aaaaaa',
      opacity,
      bold:    typo.bold    ?? true,
      italics: typo.italic  ?? true,
      fontSize: typo.fontSize || 72,
      angle:   -(wmConfig.rotation ?? 35),  // pdfmake uses positive = CCW
    };
    return { wmNode, layer, isImage: false, wmConfig };
  }

  // ── 2. Legacy plain-text watermark_text (backward compat) ───────────────────
  if (template.watermark_text) {
    return {
      wmNode: { text: template.watermark_text, color: '#aaaaaa', opacity: 0.25, bold: true, italics: true },
      layer:  'behind',
      isImage: false,
    };
  }

  // ── 3. Auto status watermark ─────────────────────────────────────────────────
  const sw = STATUS_MAP[docStatus];
  if (!sw) return { wmNode: undefined, layer: 'behind', isImage: false };
  return {
    wmNode: { text: sw.text, color: sw.color, opacity: sw.opacity, bold: true, italics: true },
    layer:  'behind',
    isImage: false,
  };
}

// ── Sanitize HTML for pdfmake compatibility ───────────────────────────────────
// pdfmake only knows the fonts declared in its `fonts` config.
// Strip unknown font-family CSS — but preserve our registered Unicode font names
// so NotoSansEthiopic / NotoNaskhArabic / NotoSansSC class names survive.
// Also strip unsupported layout models (flex, grid).
function sanitizeHtmlForPdfmake(html) {
  if (!html) return html;
  const UNICODE_FONTS = ['NotoSansEthiopic', 'NotoNaskhArabic', 'NotoSansSC'];
  return html
    .replace(/font-family\s*:[^;}"']+[;]?/gi, (match) => {
      // Keep the declaration if it names one of our registered Unicode fonts
      if (UNICODE_FONTS.some(f => match.includes(f))) return match;
      return '';
    })
    .replace(/display\s*:\s*(flex|grid|inline-flex|inline-grid)\s*[;]?/gi, '')
    .replace(/(?:justify-content|align-items|align-self|flex(?:-\w+)?)\s*:[^;}"']+[;]?/gi, '');
}

// ── HTML → pdfmake content array (FR-002 / FR-014) ───────────────────────────
function htmlToPdfmakeContent(html, defaultFontSize = 11) {
  if (!html || !html.trim()) return [];

  html = sanitizeHtmlForPdfmake(html);

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

  // Walk the pdfmake node tree and:
  //   1. Apply base font size to unstyled text nodes
  //   2. Auto-detect Unicode script and assign the correct font (FR-014)
  const applyFontAndSize = (node) => {
    if (!node) return node;
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(applyFontAndSize);

    if (node.text) {
      // Apply size if not already styled
      if (!node.fontSize && !node.style) {
        node.fontSize = defaultFontSize;
        node.color = node.color || '#333333';
      }
      // Auto-assign Unicode font if text contains non-Latin scripts
      // and no explicit font has been set by the HTML
      if (!node.font) {
        const textStr = typeof node.text === 'string'
          ? node.text
          : Array.isArray(node.text)
            ? node.text.map(n => (typeof n === 'string' ? n : n.text || '')).join('')
            : '';
        const detected = detectFont(textStr);
        if (detected !== 'Roboto') node.font = detected;
      }
    }

    return node;
  };

  const content = Array.isArray(parsed) ? parsed : [parsed];
  return content.map(applyFontAndSize);
}

// ── Resolve layout_config into pdfmake-ready page settings ───────────────────
//
// Consumes templates.layout_config (saved by the visual editor) and returns:
//   { pdfPageSize, pageMargins, headerTopReserve, footerBottomReserve }
//
// pageMargins     = [left, top, right, bottom]  (pdfmake format, pts)
// headerTopReserve  — extra pts at the top to accommodate the page header bar
// footerBottomReserve — extra pts at the bottom for the auto-footer bar
//
// The editor margin settings control the body content margins.  We add a
// fixed reserve on top of that for the DocuVault header/footer bars.
function resolveLayoutConfig(layoutConfig) {
  const cfg = layoutConfig || {};

  // ── Page size ─────────────────────────────────────────────────────────────
  const SIZE_MAP = {
    A4:     { width: 595.28, height: 841.89, pdfmake: 'A4'     },
    LETTER: { width: 612,    height: 792,    pdfmake: 'LETTER'  },
  };
  const sizeKey = (cfg.pageSize || 'A4').toUpperCase();
  const sizeInfo = SIZE_MAP[sizeKey] || SIZE_MAP.A4;

  let pdfPageSize = sizeInfo.pdfmake;
  // Landscape swaps width/height
  if (cfg.orientation === 'landscape') {
    pdfPageSize = { width: sizeInfo.height, height: sizeInfo.width };
  }

  // ── Margins ───────────────────────────────────────────────────────────────
  // Editor margins (in pts) come from layout_config.margins.
  // pdfmake pageMargins = [left, top, right, bottom].
  // The top margin must also include space for the page header bar (≈30pt).
  // The bottom margin must also include space for the auto-footer bar (≈55pt).
  const m = cfg.margins || {};
  const mLeft   = typeof m.left   === 'number' ? m.left   : 40;
  const mRight  = typeof m.right  === 'number' ? m.right  : 40;
  const mTop    = typeof m.top    === 'number' ? m.top    : 40;
  const mBottom = typeof m.bottom === 'number' ? m.bottom : 40;

  // Reserve 35pt at the top for the DocuVault page header bar.
  // Reserve 55pt at the bottom for the auto-footer (Doc ID + QR + page#).
  const HEADER_RESERVE = 35;
  const FOOTER_RESERVE = 55;

  const pageMargins = [
    mLeft,
    mTop + HEADER_RESERVE,   // content starts below the header bar
    mRight,
    mBottom + FOOTER_RESERVE, // content ends above the footer bar
  ];

  return { pdfPageSize, pageMargins, mLeft, mRight, mTop, mBottom, HEADER_RESERVE, FOOTER_RESERVE };
}

// ── Build page header pdfmake node ────────────────────────────────────────────
//
// When the template has a rich header_html (from the visual editor), we render
// it as actual pdfmake content.  When it is empty we fall back to the legacy
// one-line text bar showing the template name + generation date.
//
// pdfmake's `header` callback must return synchronously, so all async work
// (image resolution) is done before this is called, and the resolved content
// array is passed in via closure.
function buildPageHeaderFn(resolvedHeaderContent, templateName, generationDate, mLeft, mRight, HEADER_RESERVE) {
  return () => {
    if (resolvedHeaderContent && resolvedHeaderContent.length > 0) {
      // Rich header: wrap in a margin block that fits within the reserved area.
      // max height = HEADER_RESERVE; overflow is clipped by pdfmake naturally.
      return {
        margin: [mLeft, 8, mRight, 0],
        stack: resolvedHeaderContent,
      };
    }

    // Legacy fallback — one-line template name + date bar
    return {
      margin: [mLeft, 10, mRight, 0],
      columns: [
        { text: templateName, fontSize: 10, color: '#1e3a5f', bold: true, width: '*' },
        { text: generationDate, fontSize: 9, color: '#888888', alignment: 'right', width: 'auto' },
      ],
    };
  };
}

// ── Build page footer pdfmake callback ────────────────────────────────────────
//
// The auto-footer (Doc ID + verify URL + QR code + page numbers) is ALWAYS
// present — this is required for DocuVault's tamper-evidence and verification
// system (FR-016 / FR-034).
//
// When the template has a footer_html (from the visual editor), it is rendered
// above the auto-footer bar, separated by a thin rule.  This lets admins add
// custom footer content (date, doc info, page numbers, etc.) while still
// preserving all the DocuVault security footer information.
//
// {{page_number}} and {{total_pages}} inside footer_html are resolved HERE,
// inside the pdfmake callback, where the real page counts are available.
function buildPageFooterFn(rawFooterHtml, enrichedData, docUuid, verifyUrl, qrBase64,
                           mLeft, mRight, FOOTER_RESERVE) {
  return (currentPage, pageCount) => {
    // Resolve {{page_number}} / {{total_pages}} with real values from pdfmake
    const footerHtmlWithPages = (rawFooterHtml || '')
      .replace(/\{\{page_number\}\}/g, String(currentPage))
      .replace(/\{\{total_pages\}\}/g, String(pageCount));

    // Convert the (already placeholder-substituted) footer HTML to pdfmake nodes
    const customFooterNodes = footerHtmlWithPages.trim()
      ? htmlToPdfmakeContent(footerHtmlWithPages, 9)
      : [];

    // ── Auto footer bar (always present) ─────────────────────────────────────
    const autoFooterBar = {
      margin: [mLeft, 0, mRight, 8],
      columns: [
        {
          stack: [
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 340, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }],
              margin: [0, 0, 0, 3],
            },
            { text: `Doc ID: ${docUuid}`,      fontSize: 7, color: '#555555' },
            { text: `Verify: ${verifyUrl}`,    fontSize: 7, color: '#3b5bdb' },
            { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#888888', margin: [0, 1, 0, 0] },
          ],
          width: '*',
        },
        {
          image: `data:image/png;base64,${qrBase64}`,
          width: 48,
          alignment: 'right',
        },
      ],
    };

    if (customFooterNodes.length === 0) {
      return autoFooterBar;
    }

    // Custom footer content above the auto-footer bar
    return {
      margin: [mLeft, 4, mRight, 0],
      stack: [
        // Custom footer section from the editor
        {
          stack: customFooterNodes,
          margin: [0, 0, 0, 4],
        },
        // Always-present DocuVault security footer
        {
          margin: [0, 0, 0, 0],
          columns: [
            {
              stack: [
                {
                  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 340, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }],
                  margin: [0, 0, 0, 3],
                },
                { text: `Doc ID: ${docUuid}`,   fontSize: 7, color: '#555555' },
                { text: `Verify: ${verifyUrl}`, fontSize: 7, color: '#3b5bdb' },
                { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#888888', margin: [0, 1, 0, 0] },
              ],
              width: '*',
            },
            {
              image: `data:image/png;base64,${qrBase64}`,
              width: 48,
              alignment: 'right',
            },
          ],
        },
      ],
    };
  };
}

// ── Main PDF generation ───────────────────────────────────────────────────────
async function generatePDF(template, data, docUuid, verifyBaseUrl, outputDir, docStatus = 'draft', options = {}) {
  const printer = new PdfPrinter(fonts);

  // ── 1. Build the full placeholder data set ────────────────────────────────
  // Priority: auto dates < system config < approver info < caller data
  const systemPlaceholders   = options.db       ? await getSystemPlaceholders(options.db) : {};
  const approverPlaceholders = options.approver ? getApproverPlaceholders(options.approver) : {};

  const enrichedData = injectAutoPlaceholders({
    ...systemPlaceholders,
    ...approverPlaceholders,
    ...data,
  });

  // ── 2. Render HTML sections with all placeholders substituted ─────────────
  // NOTE: {{page_number}} and {{total_pages}} are intentionally NOT substituted
  // here — they are resolved inside the pdfmake footer callback where the real
  // page count is known.
  const renderedBody   = renderTemplate(template.body_html   || '', enrichedData);
  const renderedHeader = renderTemplate(template.header_html || '', enrichedData);
  // Footer HTML: substitute everything EXCEPT page_number / total_pages.
  // Those are handled in buildPageFooterFn below.
  const renderedFooter = renderTemplate(template.footer_html || '', enrichedData);

  // ── 3. Resolve image placeholders → base64 data URIs ─────────────────────
  const serverBase = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.replace(':5174', ':5000').replace(':3000', ':5000')
    : `http://localhost:${process.env.PORT || 5000}`;

  const [resolvedBody, resolvedHeader, resolvedFooter] = await Promise.all([
    resolveImagePlaceholders(renderedBody,   enrichedData, serverBase),
    resolveImagePlaceholders(renderedHeader, enrichedData, serverBase),
    resolveImagePlaceholders(renderedFooter, enrichedData, serverBase),
  ]);

  // ── 4. Convert HTML sections → pdfmake node trees ────────────────────────
  const bodyContent = htmlToPdfmakeContent(resolvedBody, 11);

  // Header: render as rich pdfmake content (Task 3).
  // The header callback must be synchronous; we pre-convert here so the
  // callback can close over the already-converted nodes.
  const headerContent = resolvedHeader ? htmlToPdfmakeContent(resolvedHeader, 10) : [];

  // ── 5. Resolve layout_config (Task 2) ────────────────────────────────────
  let layoutConfig = null;
  if (template.layout_config) {
    try {
      layoutConfig = typeof template.layout_config === 'string'
        ? JSON.parse(template.layout_config)
        : template.layout_config;
    } catch { layoutConfig = null; }
  }
  const { pdfPageSize, pageMargins, mLeft, mRight, mTop, mBottom, HEADER_RESERVE, FOOTER_RESERVE }
    = resolveLayoutConfig(layoutConfig);

  // ── 6. QR code ─────────────────────────────────────────────────────────────
  const verifyUrl = `${verifyBaseUrl}/verify/${docUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 1 });
  const qrBase64  = qrDataUrl.split(',')[1];

  // ── 7. Watermark (FR-017) ──────────────────────────────────────────────────
  const { wmNode, layer: wmLayer, isImage: wmIsImage, wmConfig } = buildWatermark(template, docStatus);

  let wmImageBase64 = null;
  if (wmIsImage && wmConfig?.imageUrl) {
    const rawUrl = wmConfig.imageUrl;
    const fullUrl = rawUrl.startsWith('http') || rawUrl.startsWith('data:')
      ? rawUrl
      : `${serverBase}/${rawUrl.replace(/^\//, '')}`;
    wmImageBase64 = await fetchImageAsBase64(fullUrl).catch(() => null);
  }

  const wmScope = wmConfig?.scope || 'all_pages';
  const shouldRenderOnPage = (currentPage) => {
    if (wmScope === 'first_page')       return currentPage === 1;
    if (wmScope === 'all_except_first') return currentPage > 1;
    return true;
  };

  const nativeWatermark = (!wmIsImage && wmLayer !== 'infront' && wmNode && wmScope === 'all_pages')
    ? wmNode
    : undefined;
  const useBgForBehindScoped = (!wmIsImage && wmLayer !== 'infront' && wmNode && wmScope !== 'all_pages');

  // ── 8. Build the pdfmake document definition ──────────────────────────────
  const docDefinition = {
    // Task 2: use layout_config page size and orientation
    pageSize:    pdfPageSize,
    // Task 2: use layout_config margins (plus reserved space for header/footer bars)
    pageMargins,
    watermark:   nativeWatermark,

    // Watermark background callback (image wm, infront-text, scoped behind-text)
    background: (wmIsImage || wmLayer === 'infront' || useBgForBehindScoped)
      ? (currentPage, pageSize) => {
          if (!shouldRenderOnPage(currentPage)) return null;

          if (wmIsImage && wmImageBase64) {
            return {
              image:   wmImageBase64,
              width:   pageSize.width * 0.55,
              opacity: wmConfig.opacity ?? 0.15,
              absolutePosition: {
                x: (pageSize.width  - pageSize.width  * 0.55) / 2,
                y: (pageSize.height - pageSize.height * 0.55) / 2,
              },
            };
          }
          if (wmNode) {
            return {
              text:     wmNode.text,
              fontSize: wmNode.fontSize || 72,
              bold:     wmNode.bold    ?? true,
              italics:  wmNode.italics ?? true,
              color:    wmNode.color   || '#aaaaaa',
              opacity:  wmNode.opacity ?? 0.15,
              alignment: 'center',
              absolutePosition: {
                x: 0,
                y: (pageSize.height / 2) - ((wmNode.fontSize || 72) / 2),
              },
              angle: wmNode.angle || -35,
            };
          }
          return null;
        }
      : undefined,

    // Task 3: rich page header using the editor's header_html (falls back to
    // the legacy one-line text bar when header_html is empty).
    header: buildPageHeaderFn(
      headerContent,
      template.name,
      enrichedData.generation_date,
      mLeft,
      mRight,
      HEADER_RESERVE
    ),

    // Task 4 + 5: footer_html rendered above the always-present DocuVault
    // security bar; {{page_number}} / {{total_pages}} resolved here with real
    // pdfmake page counts.
    footer: buildPageFooterFn(
      resolvedFooter,    // already has all non-page placeholders resolved
      enrichedData,
      docUuid,
      verifyUrl,
      qrBase64,
      mLeft,
      mRight,
      FOOTER_RESERVE
    ),

    content: [
      // Body content from the editor (preserves tables, lists, formatting, etc.)
      ...bodyContent,
    ],

    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.5, color: '#333333' },
  };

  // ── 9. Stream PDF to disk ──────────────────────────────────────────────────
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

module.exports = { generatePDF, computeSHA256, computeHMAC, renderTemplate, injectAutoPlaceholders, getSystemPlaceholders, getApproverPlaceholders, detectFont };

// BR-002: Maximum allowed PDF file size (5 MB).
module.exports.MAX_PDF_BYTES = 5 * 1024 * 1024;
