/**
 * templateEditorSchema.js
 *
 * Single source of truth for the structured template editor data model.
 * Used by:
 *   - templateController.js  — validation on save
 *   - pdfService.js          — can read editor_data to rebuild HTML
 *   - client/src/data/templateEditorModel.js  — mirrors this on the frontend
 *
 * ─── STORAGE STRATEGY ────────────────────────────────────────────────────────
 * templates.layout_config  JSON  — page-level settings (pageSize, margins …)
 * templates.editor_data    JSON  — { header: Element[], body: Element[], footer: Element[] }
 *
 * The legacy  header_html / body_html / footer_html  columns remain.
 * When the new editor saves a template it writes BOTH the structured data AND
 * the rendered HTML so the existing pdfService pipeline keeps working without
 * any modification.
 *
 * ─── VERSIONING ──────────────────────────────────────────────────────────────
 * template_versions now also has layout_config + editor_data columns.
 * updateTemplate() already snapshots the whole templates row before overwriting,
 * so both JSON columns are automatically versioned alongside the HTML columns.
 */

'use strict';

// ── Element type registry ────────────────────────────────────────────────────

const ELEMENT_TYPES = Object.freeze({
  TEXT:              'text',
  HEADING:           'heading',
  IMAGE:             'image',
  LOGO:              'logo',               // company logo (header-first-class)
  TABLE:             'table',
  DIVIDER:           'divider',
  SHAPE:             'shape',
  DYNAMIC_FIELD:     'dynamic_field',
  CONDITIONAL_BLOCK: 'conditional_block',
  REPEAT_BLOCK:      'repeat_block',
  SIGNATURE_UPLOADED:'signature_uploaded',
  SIGNATURE_DRAWN:   'signature_drawn',
  ESIGN_PLACEHOLDER: 'esign_placeholder',
  COMPANY_SEAL:      'company_seal',
  QR_CODE:           'qr_code',
  WATERMARK:         'watermark',
  PAGE_NUMBER:       'page_number',        // footer: "Page X of Y"
  DOC_DATE:          'doc_date',           // footer: document date
  DOC_INFO:          'doc_info',           // footer: doc ID / reference
});

const ELEMENT_TYPE_VALUES = new Set(Object.values(ELEMENT_TYPES));

// ── Page size constants ───────────────────────────────────────────────────────

const PAGE_SIZES = Object.freeze({
  A4:     { width: 595.28, height: 841.89, label: 'A4' },       // pts
  LETTER: { width: 612,    height: 792,    label: 'Letter' },    // pts
});

const PAGE_SIZE_VALUES = new Set(Object.keys(PAGE_SIZES));

const ORIENTATIONS = Object.freeze({ PORTRAIT: 'portrait', LANDSCAPE: 'landscape' });
const ORIENTATION_VALUES = new Set(Object.values(ORIENTATIONS));

// ── Default layout config ─────────────────────────────────────────────────────

/**
 * Returns a fresh default layout_config object.
 * All values are overridable per-template.
 */
function defaultLayoutConfig() {
  return {
    pageSize:    'A4',
    orientation: 'portrait',
    margins: {
      top:    40,   // pts
      right:  40,
      bottom: 90,   // tall bottom to accommodate the fixed PDF footer bar
      left:   40,
    },
    background: {
      type:  'none',   // 'none' | 'color' | 'image'
      color: '#ffffff',
      imageUrl: null,
    },
  };
}

// ── Base element properties (shared by every element type) ───────────────────

/**
 * Properties every element carries regardless of type.
 *
 * Positions are in points (pt) relative to the section's top-left corner.
 * The section height is calculated from the page height minus margins.
 */
function baseElementDefaults(overrides = {}) {
  return {
    id:       overrides.id       ?? generateId(),
    type:     overrides.type     ?? 'text',
    x:        overrides.x        ?? 0,
    y:        overrides.y        ?? 0,
    width:    overrides.width    ?? 200,
    height:   overrides.height   ?? 40,
    rotation: overrides.rotation ?? 0,       // degrees
    opacity:  overrides.opacity  ?? 1,       // 0–1
    zIndex:   overrides.zIndex   ?? 0,
    locked:   overrides.locked   ?? false,
    visible:  overrides.visible  ?? true,
  };
}

// ── Typography defaults (text + heading) ─────────────────────────────────────

function typographyDefaults(overrides = {}) {
  return {
    fontFamily:    overrides.fontFamily    ?? 'Roboto',
    fontSize:      overrides.fontSize      ?? 11,        // pt
    bold:          overrides.bold          ?? false,
    italic:        overrides.italic        ?? false,
    underline:     overrides.underline     ?? false,
    strikethrough: overrides.strikethrough ?? false,
    color:         overrides.color         ?? '#333333',
    highlight:     overrides.highlight     ?? null,      // null | hex color
    align:         overrides.align         ?? 'left',    // left|center|right|justify
    lineHeight:    overrides.lineHeight    ?? 1.5,
    letterSpacing: overrides.letterSpacing ?? 0,         // pt
  };
}

// ── Per-type element default factories ───────────────────────────────────────

const ELEMENT_DEFAULTS = {

  // ── Text ──────────────────────────────────────────────────────────────────
  text(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'text', width: 300, height: 30, ...overrides }),
      content:    overrides.content    ?? 'Text block',
      typography: typographyDefaults(overrides.typography ?? {}),
    };
  },

  // ── Heading ───────────────────────────────────────────────────────────────
  heading(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'heading', width: 400, height: 45, ...overrides }),
      level:   overrides.level   ?? 1,   // 1 | 2 | 3
      content: overrides.content ?? 'Document Title',
      typography: typographyDefaults({
        fontSize:  overrides.level === 2 ? 15 : overrides.level === 3 ? 13 : 18,
        bold:      true,
        color:     '#1e3a5f',
        ...overrides.typography,
      }),
    };
  },

  // ── Image ─────────────────────────────────────────────────────────────────
  image(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'image', width: 150, height: 100, ...overrides }),
      src:         overrides.src         ?? null,   // base64 data URI or server URL
      alt:         overrides.alt         ?? '',
      objectFit:   overrides.objectFit   ?? 'contain',  // contain | cover | fill
      borderRadius:overrides.borderRadius?? 0,
    };
  },

  // ── Table ─────────────────────────────────────────────────────────────────
  table(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'table', width: 515, height: 120, ...overrides }),
      columns: overrides.columns ?? 3,
      rows:    overrides.rows    ?? 3,
      // Each cell is { content: string, colspan: 1, rowspan: 1, style: {...} }
      cells:   overrides.cells   ?? [],
      style: {
        headerBackground: '#f0f4ff',
        borderColor:      '#dddddd',
        borderWidth:      0.5,
        cellPadding:      [4, 4, 4, 4],
        fontSize:         10,
        headerBold:       true,
        alternateRow:     false,
        alternateColor:   '#f9f9f9',
        ...overrides.style,
      },
    };
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'divider', width: 515, height: 2, ...overrides }),
      lineStyle:  overrides.lineStyle  ?? 'solid',    // solid | dashed | dotted
      lineWidth:  overrides.lineWidth  ?? 1,
      color:      overrides.color      ?? '#dddddd',
      marginTop:  overrides.marginTop  ?? 8,
      marginBottom: overrides.marginBottom ?? 8,
    };
  },

  // ── Shape ─────────────────────────────────────────────────────────────────
  shape(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'shape', width: 100, height: 100, ...overrides }),
      shapeType:   overrides.shapeType   ?? 'rectangle', // rectangle | circle | line
      fill:        overrides.fill        ?? '#e0e7ff',
      stroke:      overrides.stroke      ?? '#3b5bdb',
      strokeWidth: overrides.strokeWidth ?? 1,
      borderRadius:overrides.borderRadius?? 0,
    };
  },

  // ── Dynamic field ─────────────────────────────────────────────────────────
  // Renders its placeholder at generation time.
  dynamic_field(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'dynamic_field', width: 250, height: 28, ...overrides }),
      // The actual placeholder string, e.g. '{{employee.full_name}}'
      placeholder: overrides.placeholder ?? '{{placeholder}}',
      // Human-readable label shown in the editor only (not in the PDF)
      label:       overrides.label       ?? 'Dynamic Field',
      typography:  typographyDefaults(overrides.typography ?? {}),
      // If true, the field is shown inline with surrounding text; if false, it is a block
      inline:      overrides.inline      ?? false,
      // Optional fallback text when the placeholder resolves to empty
      fallback:    overrides.fallback    ?? '',
    };
  },

  // ── Conditional block ─────────────────────────────────────────────────────
  // Wraps child elements; entire block is hidden/shown based on a condition.
  conditional_block(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'conditional_block', width: 515, height: 80, ...overrides }),
      // Condition expression string, e.g. 'finance.salary' or 'employee.is_manager'
      condition:    overrides.condition    ?? '',
      // 'truthy' = show when condition is truthy, 'falsy' = show when falsy
      showWhen:     overrides.showWhen     ?? 'truthy',
      // Child elements rendered inside this block
      children:     overrides.children     ?? [],
      // What the block looks like in the editor (not in PDF)
      editorLabel:  overrides.editorLabel  ?? 'Conditional Block',
      editorColor:  overrides.editorColor  ?? '#fff3cd',
    };
  },

  // ── Repeat block ──────────────────────────────────────────────────────────
  // Loops over an array placeholder and renders child template for each item.
  repeat_block(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'repeat_block', width: 515, height: 120, ...overrides }),
      // Array key in the data object, e.g. 'items' for {{#each items}}
      collection:  overrides.collection  ?? '',
      // Template elements rendered once per item
      children:    overrides.children    ?? [],
      editorLabel: overrides.editorLabel ?? 'Repeat Block',
      editorColor: overrides.editorColor ?? '#d1fae5',
    };
  },

  // ── Uploaded signature ────────────────────────────────────────────────────
  signature_uploaded(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'signature_uploaded', width: 160, height: 60, ...overrides }),
      // Server URL of the uploaded signature image
      src:         overrides.src         ?? null,
      // Placeholder key to use instead of a static URL (resolved at generation)
      placeholder: overrides.placeholder ?? '{{approver.signature_image}}',
      label:       overrides.label       ?? 'Signature',
      showLabel:   overrides.showLabel   ?? true,
      labelText:   overrides.labelText   ?? 'Authorised Signature',
      objectFit:   overrides.objectFit   ?? 'contain',
    };
  },

  // ── Drawn signature ───────────────────────────────────────────────────────
  signature_drawn(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'signature_drawn', width: 160, height: 60, ...overrides }),
      // base64 PNG of the drawn signature canvas
      src:         overrides.src         ?? null,
      label:       overrides.label       ?? 'Drawn Signature',
      showLabel:   overrides.showLabel   ?? true,
      labelText:   overrides.labelText   ?? 'Signature',
    };
  },

  // ── E-signature placeholder ────────────────────────────────────────────────
  // A reserved zone where an approver's e-signature will be placed.
  esign_placeholder(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'esign_placeholder', width: 200, height: 80, ...overrides }),
      // Identifies which approval role fills this slot
      signerRole:  overrides.signerRole  ?? 'approver',
      signerLabel: overrides.signerLabel ?? 'Approver Signature',
      showBorder:  overrides.showBorder  ?? true,
      showLabel:   overrides.showLabel   ?? true,
    };
  },

  // ── Company seal ──────────────────────────────────────────────────────────
  company_seal(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'company_seal', width: 80, height: 80, ...overrides }),
      // Resolved from system.company_seal at generation time
      placeholder: overrides.placeholder ?? '{{system.company_seal}}',
      objectFit:   overrides.objectFit   ?? 'contain',
      label:       overrides.label       ?? 'Company Seal',
    };
  },

  // ── QR code ───────────────────────────────────────────────────────────────
  // Auto-generated at PDF creation time pointing to the verify URL.
  qr_code(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'qr_code', width: 60, height: 60, ...overrides }),
      // 'verify_url' = use the document verify URL (default pdfService behaviour)
      // 'custom'     = use a custom URL / placeholder
      sourceType: overrides.sourceType ?? 'verify_url',
      customUrl:  overrides.customUrl  ?? '',
      label:      overrides.label      ?? 'QR Code',
      showLabel:  overrides.showLabel  ?? false,
    };
  },

  // ── Watermark ─────────────────────────────────────────────────────────────
  // A fully editable element — not just a string flag on the template.
  // The administrator can click it and change all properties freely.
  watermark(overrides = {}) {
    return {
      ...baseElementDefaults({
        type:     'watermark',
        x:        0,
        y:        0,
        width:    515,
        height:   200,
        rotation: -35,
        opacity:  0.15,
        zIndex:   999,
        ...overrides,
      }),
      text:        overrides.text        ?? 'CONFIDENTIAL',
      typography: typographyDefaults({
        fontFamily: 'Roboto', fontSize: 72, bold: true, italic: true,
        color: '#aaaaaa', ...overrides.typography,
      }),
      imageUrl:    overrides.imageUrl    ?? null,
      objectFit:   overrides.objectFit   ?? 'contain',
      layer:       overrides.layer       ?? 'behind',
      scope:       overrides.scope       ?? 'all_pages',
    };
  },

  // ── Company logo ──────────────────────────────────────────────────────────
  // First-class header element. Resolves {{system.logo_url}} at generation time.
  logo(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'logo', width: 120, height: 50, ...overrides }),
      sourceType:   overrides.sourceType   ?? 'system',  // 'system' | 'custom'
      src:          overrides.src          ?? null,       // custom uploaded src
      placeholder:  overrides.placeholder  ?? '{{system.logo_url}}',
      alt:          overrides.alt          ?? 'Company Logo',
      objectFit:    overrides.objectFit    ?? 'contain',
      borderRadius: overrides.borderRadius ?? 0,
    };
  },

  // ── Page Number ───────────────────────────────────────────────────────────
  // Serialises to {{page_number}} of {{total_pages}} — resolved by pdfmake callback.
  page_number(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'page_number', width: 120, height: 24, ...overrides }),
      format:     overrides.format     ?? 'page_of_total',  // 'page_of_total' | 'page_only' | 'custom'
      customText: overrides.customText ?? 'Page {{page_number}} of {{total_pages}}',
      typography: typographyDefaults({
        fontSize: 9, color: '#6b7280', align: 'center', ...overrides.typography,
      }),
    };
  },

  // ── Document Date ─────────────────────────────────────────────────────────
  doc_date(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'doc_date', width: 160, height: 24, ...overrides }),
      dateField:   overrides.dateField   ?? 'generation_date',
      customField: overrides.customField ?? '',
      prefix:      overrides.prefix      ?? '',
      typography:  typographyDefaults({
        fontSize: 9, color: '#6b7280', ...overrides.typography,
      }),
    };
  },

  // ── Document Info ─────────────────────────────────────────────────────────
  doc_info(overrides = {}) {
    return {
      ...baseElementDefaults({ type: 'doc_info', width: 200, height: 24, ...overrides }),
      infoType:    overrides.infoType    ?? 'doc_id',
      customField: overrides.customField ?? '',
      prefix:      overrides.prefix      ?? 'Ref: ',
      typography:  typographyDefaults({
        fontSize: 9, color: '#6b7280', ...overrides.typography,
      }),
    };
  },
};

// ── Section defaults ─────────────────────────────────────────────────────────

/**
 * Returns a fresh empty section object.
 * @param {'header'|'body'|'footer'} name
 */
function defaultSection(name) {
  const heights = { header: 80, body: 600, footer: 60 };
  return {
    name,
    height:   heights[name] ?? 100,   // pts — editable by the user
    enabled:  name !== 'footer',      // footer is optional; header and body are on by default
    elements: [],
  };
}

/**
 * Returns a complete empty editor_data object ready to store in the DB.
 */
function defaultEditorData() {
  return {
    header: defaultSection('header'),
    body:   defaultSection('body'),
    footer: defaultSection('footer'),
  };
}

// ── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validates a layout_config object.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
function validateLayoutConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['layout_config must be an object'] };
  }
  const errors = [];

  if (config.pageSize && !PAGE_SIZE_VALUES.has(config.pageSize)) {
    errors.push(`pageSize must be one of: ${[...PAGE_SIZE_VALUES].join(', ')}`);
  }
  if (config.orientation && !ORIENTATION_VALUES.has(config.orientation)) {
    errors.push(`orientation must be one of: ${[...ORIENTATION_VALUES].join(', ')}`);
  }
  if (config.margins) {
    const m = config.margins;
    for (const side of ['top', 'right', 'bottom', 'left']) {
      if (m[side] !== undefined && (typeof m[side] !== 'number' || m[side] < 0)) {
        errors.push(`margins.${side} must be a non-negative number`);
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validates a single element object.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * Intentionally lenient — unknown extra properties are ignored so that future
 * element types added on the frontend do not break existing saves.
 */
function validateElement(el) {
  if (!el || typeof el !== 'object') {
    return { valid: false, errors: ['element must be an object'] };
  }
  const errors = [];

  if (!el.id || typeof el.id !== 'string') {
    errors.push('element.id must be a non-empty string');
  }
  if (!ELEMENT_TYPE_VALUES.has(el.type)) {
    errors.push(`element.type "${el.type}" is not a recognised element type`);
  }
  for (const numProp of ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'zIndex']) {
    if (el[numProp] !== undefined && typeof el[numProp] !== 'number') {
      errors.push(`element.${numProp} must be a number`);
    }
  }
  if (el.opacity !== undefined && (el.opacity < 0 || el.opacity > 1)) {
    errors.push('element.opacity must be between 0 and 1');
  }

  // Type-specific validation
  if (el.type === 'dynamic_field' && el.placeholder) {
    if (typeof el.placeholder !== 'string') {
      errors.push('dynamic_field.placeholder must be a string');
    }
  }
  if (el.type === 'conditional_block' && el.condition !== undefined) {
    if (typeof el.condition !== 'string') {
      errors.push('conditional_block.condition must be a string');
    }
  }
  if (el.type === 'repeat_block' && el.collection !== undefined) {
    if (typeof el.collection !== 'string') {
      errors.push('repeat_block.collection must be a string');
    }
  }
  if (el.type === 'watermark') {
    if (el.text !== undefined && typeof el.text !== 'string') {
      errors.push('watermark.text must be a string');
    }
    if (el.layer && !['behind', 'infront'].includes(el.layer)) {
      errors.push('watermark.layer must be "behind" or "infront"');
    }
    if (el.scope && !['all_pages', 'first_page', 'all_except_first'].includes(el.scope)) {
      errors.push('watermark.scope must be "all_pages", "first_page", or "all_except_first"');
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validates a complete editor_data object.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
function validateEditorData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['editor_data must be an object'] };
  }
  const errors = [];

  for (const section of ['header', 'body', 'footer']) {
    const sec = data[section];
    if (!sec) continue; // sections are optional at the top level
    if (typeof sec !== 'object') {
      errors.push(`editor_data.${section} must be an object`);
      continue;
    }
    if (sec.elements && !Array.isArray(sec.elements)) {
      errors.push(`editor_data.${section}.elements must be an array`);
      continue;
    }
    for (const el of (sec.elements || [])) {
      const res = validateElement(el);
      if (!res.valid) {
        errors.push(...res.errors.map(e => `${section}.${el?.id ?? '?'}: ${e}`));
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ── Utility: simple unique ID ─────────────────────────────────────────────────
// Produces IDs like 'el_1a2b3c4d'. Short and collision-resistant for template use.
function generateId() {
  return 'el_' + Math.random().toString(36).slice(2, 10);
}

// ── Public API ────────────────────────────────────────────────────────────────

module.exports = {
  ELEMENT_TYPES,
  ELEMENT_TYPE_VALUES,
  PAGE_SIZES,
  PAGE_SIZE_VALUES,
  ORIENTATIONS,
  ORIENTATION_VALUES,

  defaultLayoutConfig,
  defaultEditorData,
  defaultSection,
  baseElementDefaults,
  typographyDefaults,
  ELEMENT_DEFAULTS,

  validateLayoutConfig,
  validateEditorData,
  validateElement,

  generateId,
};
