/**
 * templateEditorModel.js
 *
 * Frontend mirror of server/models/templateEditorSchema.js
 *
 * Provides:
 *   - ELEMENT_TYPES          — string constants for all element types
 *   - SECTION_ALLOWED_TYPES  — which element types are allowed per section
 *   - PAGE_SIZES             — page dimension constants
 *   - createElement(type)    — factory that returns a fully-initialised element
 *   - defaultLayoutConfig()  — fresh page settings object
 *   - defaultSection(name)   — fresh section with per-section config
 *   - defaultEditorData()    — fresh { header, body, footer } structure
 *   - validateElement(el)    — lightweight client-side guard before API save
 *
 * NOTE: Keep in sync with server/models/templateEditorSchema.js
 *       Any new element type must be added to BOTH files.
 */

// ── Unique ID generator ───────────────────────────────────────────────────────
export function generateId() {
  return 'el_' + Math.random().toString(36).slice(2, 10);
}

// ── Element type constants ────────────────────────────────────────────────────

export const ELEMENT_TYPES = Object.freeze({
  TEXT:               'text',
  HEADING:            'heading',
  IMAGE:              'image',
  LOGO:               'logo',               // company logo — header-first-class
  TABLE:              'table',
  DIVIDER:            'divider',
  SHAPE:              'shape',
  DYNAMIC_FIELD:      'dynamic_field',
  CONDITIONAL_BLOCK:  'conditional_block',
  REPEAT_BLOCK:       'repeat_block',
  SIGNATURE_UPLOADED: 'signature_uploaded',
  SIGNATURE_DRAWN:    'signature_drawn',
  ESIGN_PLACEHOLDER:  'esign_placeholder',
  COMPANY_SEAL:       'company_seal',
  STAMP:              'stamp',              // decorative stamp / approval mark
  QR_CODE:            'qr_code',
  WATERMARK:          'watermark',
  PAGE_NUMBER:        'page_number',         // footer special: "Page X of Y"
  DOC_DATE:           'doc_date',            // footer special: document date
  DOC_INFO:           'doc_info',            // footer special: doc ID / ref
});

export const ELEMENT_TYPE_VALUES = new Set(Object.values(ELEMENT_TYPES));

// ── Section-specific allowed element types ────────────────────────────────────
//
// HEADER can contain:
//   logo, company name (text/dynamic_field), title (heading/text), text,
//   dynamic fields, images, shapes, seal, watermark
//
// BODY can contain:
//   text, headings, dynamic fields, tables, conditional blocks, repeat blocks,
//   images, signatures, seal, e-signature, watermark, divider, shape
//
// FOOTER can contain:
//   text, dynamic fields, page_number, doc_date, doc_info (QR, images)
//
// Any section may contain IMAGE, TEXT, DYNAMIC_FIELD, DIVIDER, SHAPE, COMPANY_SEAL, WATERMARK.

export const SECTION_ALLOWED_TYPES = Object.freeze({
  header: new Set([
    ELEMENT_TYPES.LOGO,
    ELEMENT_TYPES.TEXT,
    ELEMENT_TYPES.HEADING,
    ELEMENT_TYPES.IMAGE,
    ELEMENT_TYPES.DYNAMIC_FIELD,
    ELEMENT_TYPES.SHAPE,
    ELEMENT_TYPES.DIVIDER,
    ELEMENT_TYPES.COMPANY_SEAL,
    ELEMENT_TYPES.STAMP,
    ELEMENT_TYPES.WATERMARK,
  ]),
  body: new Set([
    ELEMENT_TYPES.TEXT,
    ELEMENT_TYPES.HEADING,
    ELEMENT_TYPES.IMAGE,
    ELEMENT_TYPES.TABLE,
    ELEMENT_TYPES.DIVIDER,
    ELEMENT_TYPES.SHAPE,
    ELEMENT_TYPES.DYNAMIC_FIELD,
    ELEMENT_TYPES.CONDITIONAL_BLOCK,
    ELEMENT_TYPES.REPEAT_BLOCK,
    ELEMENT_TYPES.SIGNATURE_UPLOADED,
    ELEMENT_TYPES.SIGNATURE_DRAWN,
    ELEMENT_TYPES.ESIGN_PLACEHOLDER,
    ELEMENT_TYPES.COMPANY_SEAL,
    ELEMENT_TYPES.STAMP,
    ELEMENT_TYPES.WATERMARK,
    ELEMENT_TYPES.QR_CODE,
  ]),
  footer: new Set([
    ELEMENT_TYPES.TEXT,
    ELEMENT_TYPES.DYNAMIC_FIELD,
    ELEMENT_TYPES.PAGE_NUMBER,
    ELEMENT_TYPES.DOC_DATE,
    ELEMENT_TYPES.DOC_INFO,
    ELEMENT_TYPES.QR_CODE,
    ELEMENT_TYPES.IMAGE,
    ELEMENT_TYPES.DIVIDER,
    ELEMENT_TYPES.SHAPE,
    ELEMENT_TYPES.COMPANY_SEAL,
    ELEMENT_TYPES.STAMP,
  ]),
});

/**
 * Returns true if the element type is allowed in the given section.
 * @param {string} section  'header' | 'body' | 'footer'
 * @param {string} type     ELEMENT_TYPES value
 */
export function isTypeAllowedInSection(section, type) {
  const allowed = SECTION_ALLOWED_TYPES[section];
  return !allowed || allowed.has(type);
}

// ── Human-readable labels for the element palette ────────────────────────────

export const ELEMENT_LABELS = {
  [ELEMENT_TYPES.TEXT]:               'Text',
  [ELEMENT_TYPES.HEADING]:            'Heading',
  [ELEMENT_TYPES.IMAGE]:              'Image',
  [ELEMENT_TYPES.LOGO]:               'Company Logo',
  [ELEMENT_TYPES.TABLE]:              'Table',
  [ELEMENT_TYPES.DIVIDER]:            'Divider',
  [ELEMENT_TYPES.SHAPE]:              'Shape',
  [ELEMENT_TYPES.DYNAMIC_FIELD]:      'Dynamic Field',
  [ELEMENT_TYPES.CONDITIONAL_BLOCK]:  'Conditional Block',
  [ELEMENT_TYPES.REPEAT_BLOCK]:       'Repeat Block',
  [ELEMENT_TYPES.SIGNATURE_UPLOADED]: 'Uploaded Signature',
  [ELEMENT_TYPES.SIGNATURE_DRAWN]:    'Drawn Signature',
  [ELEMENT_TYPES.ESIGN_PLACEHOLDER]:  'E-Signature Slot',
  [ELEMENT_TYPES.COMPANY_SEAL]:       'Company Seal',
  [ELEMENT_TYPES.STAMP]:              'Stamp',
  [ELEMENT_TYPES.QR_CODE]:            'QR Code',
  [ELEMENT_TYPES.WATERMARK]:          'Watermark',
  [ELEMENT_TYPES.PAGE_NUMBER]:        'Page Number',
  [ELEMENT_TYPES.DOC_DATE]:           'Document Date',
  [ELEMENT_TYPES.DOC_INFO]:           'Document Info',
};

// ── Page size constants (values in points, 1pt = 1/72 inch) ──────────────────

export const PAGE_SIZES = Object.freeze({
  A4:     { width: 595.28, height: 841.89, label: 'A4' },
  LETTER: { width: 612,    height: 792,    label: 'Letter' },
});

export const ORIENTATIONS = Object.freeze({
  PORTRAIT:  'portrait',
  LANDSCAPE: 'landscape',
});

// ── Typography defaults ───────────────────────────────────────────────────────

export function defaultTypography(overrides = {}) {
  return {
    fontFamily:    overrides.fontFamily    ?? 'Roboto',
    fontSize:      overrides.fontSize      ?? 11,
    bold:          overrides.bold          ?? false,
    italic:        overrides.italic        ?? false,
    underline:     overrides.underline     ?? false,
    strikethrough: overrides.strikethrough ?? false,
    color:         overrides.color         ?? '#333333',
    highlight:     overrides.highlight     ?? null,
    align:         overrides.align         ?? 'left',
    lineHeight:    overrides.lineHeight    ?? 1.5,
    letterSpacing: overrides.letterSpacing ?? 0,
  };
}

// ── Base element defaults (shared by all types) ───────────────────────────────

function baseDefaults(type, overrides = {}) {
  return {
    id:       overrides.id       ?? generateId(),
    type,
    x:        overrides.x        ?? 0,
    y:        overrides.y        ?? 0,
    width:    overrides.width    ?? 200,
    height:   overrides.height   ?? 40,
    rotation: overrides.rotation ?? 0,
    opacity:  overrides.opacity  ?? 1,
    zIndex:   overrides.zIndex   ?? 0,
    locked:   overrides.locked   ?? false,
    visible:  overrides.visible  ?? true,
  };
}

// ── Per-type factories ────────────────────────────────────────────────────────

const ELEMENT_FACTORIES = {

  // ── Text ────────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.TEXT](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.TEXT, { width: 300, height: 30, ...overrides }),
      content:    overrides.content    ?? 'Text block',
      typography: defaultTypography(overrides.typography ?? {}),
    };
  },

  // ── Heading ─────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.HEADING](overrides = {}) {
    const level = overrides.level ?? 1;
    const defaultSizes = { 1: 18, 2: 15, 3: 13 };
    return {
      ...baseDefaults(ELEMENT_TYPES.HEADING, { width: 400, height: 45, ...overrides }),
      level,
      content:    overrides.content ?? 'Document Title',
      typography: defaultTypography({
        fontSize:  defaultSizes[level] ?? 18,
        bold:      true,
        color:     '#1e3a5f',
        ...overrides.typography,
      }),
    };
  },

  // ── Image ────────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.IMAGE](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.IMAGE, { width: 150, height: 100, ...overrides }),
      src:          overrides.src          ?? null,
      alt:          overrides.alt          ?? '',
      objectFit:    overrides.objectFit    ?? 'contain',
      borderRadius: overrides.borderRadius ?? 0,
    };
  },

  // ── Logo ─────────────────────────────────────────────────────────────────────
  // First-class logo element. Resolves {{system.logo_url}} at generation time.
  // Admin can override with a custom uploaded image.
  [ELEMENT_TYPES.LOGO](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.LOGO, { width: 120, height: 50, x: 0, y: 0, ...overrides }),
      // 'system' = use {{system.logo_url}} (default), 'custom' = use uploaded src
      sourceType:   overrides.sourceType   ?? 'system',
      src:          overrides.src          ?? null,        // custom uploaded src
      placeholder:  overrides.placeholder  ?? '{{system.logo_url}}',
      alt:          overrides.alt          ?? 'Company Logo',
      objectFit:    overrides.objectFit    ?? 'contain',
      borderRadius: overrides.borderRadius ?? 0,
    };
  },

  // ── Table ────────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.TABLE](overrides = {}) {
    const cols = overrides.columns ?? 3;
    const rows = overrides.rows    ?? 3;
    const cells = overrides.cells ?? Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        content:  r === 0 ? `Header ${c + 1}` : '',
        colspan:  1,
        rowspan:  1,
        isHeader: r === 0,
        style: {},
      }))
    );
    return {
      ...baseDefaults(ELEMENT_TYPES.TABLE, { width: 515, height: rows * 30 + 10, ...overrides }),
      columns: cols,
      rows,
      cells,
      style: {
        headerBackground: '#f0f4ff',
        borderColor:      '#dddddd',
        borderWidth:      0.5,
        cellPadding:      [4, 4, 4, 4],
        fontSize:         10,
        headerBold:       true,
        alternateRow:     false,
        alternateColor:   '#f9f9f9',
        ...(overrides.style ?? {}),
      },
    };
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.DIVIDER](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.DIVIDER, { width: 515, height: 2, ...overrides }),
      lineStyle:    overrides.lineStyle    ?? 'solid',
      lineWidth:    overrides.lineWidth    ?? 1,
      color:        overrides.color        ?? '#dddddd',
      marginTop:    overrides.marginTop    ?? 8,
      marginBottom: overrides.marginBottom ?? 8,
    };
  },

  // ── Shape ────────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.SHAPE](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.SHAPE, { width: 100, height: 100, ...overrides }),
      shapeType:    overrides.shapeType    ?? 'rectangle',
      fill:         overrides.fill         ?? '#e0e7ff',
      stroke:       overrides.stroke       ?? '#3b5bdb',
      strokeWidth:  overrides.strokeWidth  ?? 1,
      borderRadius: overrides.borderRadius ?? 0,
    };
  },

  // ── Dynamic field ────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.DYNAMIC_FIELD](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.DYNAMIC_FIELD, { width: 250, height: 28, ...overrides }),
      placeholder: overrides.placeholder ?? '{{placeholder}}',
      label:       overrides.label       ?? 'Dynamic Field',
      typography:  defaultTypography(overrides.typography ?? {}),
      inline:      overrides.inline      ?? false,
      fallback:    overrides.fallback    ?? '',
    };
  },

  // ── Conditional block ────────────────────────────────────────────────────────
  [ELEMENT_TYPES.CONDITIONAL_BLOCK](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.CONDITIONAL_BLOCK, { width: 515, height: 80, ...overrides }),
      condition:   overrides.condition   ?? '',
      showWhen:    overrides.showWhen    ?? 'truthy',
      children:    overrides.children    ?? [],
      editorLabel: overrides.editorLabel ?? 'Conditional Block',
      editorColor: overrides.editorColor ?? '#fff3cd',
    };
  },

  // ── Repeat block ─────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.REPEAT_BLOCK](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.REPEAT_BLOCK, { width: 515, height: 120, ...overrides }),
      collection:  overrides.collection  ?? '',
      children:    overrides.children    ?? [],
      editorLabel: overrides.editorLabel ?? 'Repeat Block',
      editorColor: overrides.editorColor ?? '#d1fae5',
    };
  },

  // ── Uploaded signature ───────────────────────────────────────────────────────
  [ELEMENT_TYPES.SIGNATURE_UPLOADED](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.SIGNATURE_UPLOADED, { width: 160, height: 60, ...overrides }),
      src:         overrides.src         ?? null,
      placeholder: overrides.placeholder ?? '{{approver.signature_image}}',
      label:       overrides.label       ?? 'Signature',
      showLabel:   overrides.showLabel   ?? true,
      labelText:   overrides.labelText   ?? 'Authorised Signature',
      objectFit:   overrides.objectFit   ?? 'contain',
    };
  },

  // ── Drawn signature ──────────────────────────────────────────────────────────
  [ELEMENT_TYPES.SIGNATURE_DRAWN](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.SIGNATURE_DRAWN, { width: 160, height: 60, ...overrides }),
      src:       overrides.src       ?? null,
      label:     overrides.label     ?? 'Drawn Signature',
      showLabel: overrides.showLabel ?? true,
      labelText: overrides.labelText ?? 'Signature',
    };
  },

  // ── E-signature placeholder ──────────────────────────────────────────────────
  [ELEMENT_TYPES.ESIGN_PLACEHOLDER](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.ESIGN_PLACEHOLDER, { width: 200, height: 80, ...overrides }),
      signerRole:  overrides.signerRole  ?? 'approver',
      signerLabel: overrides.signerLabel ?? 'Approver Signature',
      showBorder:  overrides.showBorder  ?? true,
      showLabel:   overrides.showLabel   ?? true,
    };
  },

  // ── Company seal ─────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.COMPANY_SEAL](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.COMPANY_SEAL, { width: 80, height: 80, ...overrides }),
      placeholder: overrides.placeholder ?? '{{system.company_seal}}',
      objectFit:   overrides.objectFit   ?? 'contain',
      label:       overrides.label       ?? 'Company Seal',
    };
  },

  // ── Stamp ─────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.STAMP](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.STAMP, { width: 100, height: 100, rotation: -15, opacity: 0.85, ...overrides }),
      stampText:    overrides.stampText   ?? 'APPROVED',
      stampShape:   overrides.stampShape  ?? 'circle',  // 'circle' | 'rectangle' | 'diamond'
      fill:         overrides.fill        ?? 'none',
      stroke:       overrides.stroke      ?? '#dc2626',
      strokeWidth:  overrides.strokeWidth ?? 3,
      typography: defaultTypography({
        fontFamily: 'Roboto', fontSize: 14, bold: true, color: '#dc2626',
        align: 'center', lineHeight: 1,
        ...(overrides.typography ?? {}),
      }),
    };
  },

  // ── QR code ──────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.QR_CODE](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.QR_CODE, { width: 60, height: 60, ...overrides }),
      sourceType: overrides.sourceType ?? 'verify_url',
      customUrl:  overrides.customUrl  ?? '',
      label:      overrides.label      ?? 'QR Code',
      showLabel:  overrides.showLabel  ?? false,
    };
  },

  // ── Watermark ────────────────────────────────────────────────────────────────
  [ELEMENT_TYPES.WATERMARK](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.WATERMARK, {
        x: 0, y: 0, width: 515, height: 200,
        rotation: -35, opacity: 0.15, zIndex: 999,
        ...overrides,
      }),
      watermarkMode: overrides.watermarkMode ?? 'text',
      text:          overrides.text          ?? 'CONFIDENTIAL',
      typography: defaultTypography({
        fontFamily: 'Roboto', fontSize: 72, bold: true, italic: true,
        color: '#aaaaaa', align: 'center', lineHeight: 1,
        ...(overrides.typography ?? {}),
      }),
      imageUrl:  overrides.imageUrl  ?? null,
      objectFit: overrides.objectFit ?? 'contain',
      layer:     overrides.layer     ?? 'behind',
      scope:     overrides.scope     ?? 'all_pages',
    };
  },

  // ── Page Number ──────────────────────────────────────────────────────────────
  // Renders "Page {{page_number}} of {{total_pages}}" in the footer.
  // pdfService resolves the actual values at generation time.
  [ELEMENT_TYPES.PAGE_NUMBER](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.PAGE_NUMBER, { width: 120, height: 24, ...overrides }),
      // 'page_of_total' | 'page_only' | 'custom'
      format:     overrides.format     ?? 'page_of_total',
      customText: overrides.customText ?? 'Page {{page_number}} of {{total_pages}}',
      typography: defaultTypography({
        fontSize: 9, color: '#6b7280', align: 'center',
        ...(overrides.typography ?? {}),
      }),
    };
  },

  // ── Document Date ────────────────────────────────────────────────────────────
  // Shows the document generation or issue date in the footer.
  [ELEMENT_TYPES.DOC_DATE](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.DOC_DATE, { width: 160, height: 24, ...overrides }),
      // 'generation_date' | 'issue_date' | 'effective_date' | 'custom'
      dateField:    overrides.dateField    ?? 'generation_date',
      customField:  overrides.customField  ?? '',
      prefix:       overrides.prefix       ?? '',
      typography:   defaultTypography({
        fontSize: 9, color: '#6b7280', align: 'left',
        ...(overrides.typography ?? {}),
      }),
    };
  },

  // ── Document Info ────────────────────────────────────────────────────────────
  // Shows document reference / ID info in the footer.
  [ELEMENT_TYPES.DOC_INFO](overrides = {}) {
    return {
      ...baseDefaults(ELEMENT_TYPES.DOC_INFO, { width: 200, height: 24, ...overrides }),
      // What to show: 'doc_id' | 'ref_number' | 'template_name' | 'custom'
      infoType:    overrides.infoType    ?? 'doc_id',
      customField: overrides.customField ?? '',
      prefix:      overrides.prefix      ?? 'Ref: ',
      typography:  defaultTypography({
        fontSize: 9, color: '#6b7280', align: 'left',
        ...(overrides.typography ?? {}),
      }),
    };
  },
};

// ── Public factory ────────────────────────────────────────────────────────────

/**
 * Creates a new element of the given type with all properties initialised.
 */
export function createElement(type, overrides = {}) {
  const factory = ELEMENT_FACTORIES[type];
  if (!factory) {
    throw new Error(`Unknown element type: "${type}". Check ELEMENT_TYPES.`);
  }
  return factory(overrides);
}

// ── Page-level defaults ───────────────────────────────────────────────────────

export function defaultLayoutConfig() {
  return {
    pageSize:    'A4',
    orientation: 'portrait',
    margins: {
      top:    40,
      right:  40,
      bottom: 60,
      left:   40,
    },
    background: {
      type:     'none',
      color:    '#ffffff',
      imageUrl: null,
    },
  };
}

// ── Section defaults ──────────────────────────────────────────────────────────

/**
 * Returns a fresh section object with per-section configuration.
 *
 * Section config fields:
 *   enabled         — whether the section is rendered (footer default off)
 *   height          — section canvas height in pt
 *   repeatOnEveryPage — header/footer repeat on every PDF page
 *   background      — section background: { type, color }
 *   borderBottom    — border line between header and body
 *   borderTop       — border line between body and footer
 *
 * @param {'header'|'body'|'footer'} name
 */
export function defaultSection(name) {
  const heights = { header: 80, body: 500, footer: 60 };

  const base = {
    name,
    height:            heights[name] ?? 100,
    enabled:           name !== 'footer',
    repeatOnEveryPage: name === 'header' || name === 'footer', // semantic default
    background: {
      type:  'none',    // 'none' | 'color'
      color: '#ffffff',
    },
    elements: [],
  };

  if (name === 'header') {
    return {
      ...base,
      // Bottom border between header and body
      borderBottom: { show: true, style: 'solid', width: 1, color: '#3b5bdb' },
    };
  }

  if (name === 'footer') {
    return {
      ...base,
      // Top border between body and footer
      borderTop: { show: true, style: 'dashed', width: 1, color: '#d1d5db' },
    };
  }

  return base;
}

/**
 * Returns a complete empty editor_data object.
 */
export function defaultEditorData() {
  return {
    header: defaultSection('header'),
    body:   defaultSection('body'),
    footer: defaultSection('footer'),
  };
}

// ── Client-side validation ────────────────────────────────────────────────────

export function validateElement(el) {
  if (!el || typeof el !== 'object') return { valid: false, errors: ['element must be an object'] };
  const errors = [];

  if (!el.id)   errors.push('element.id is required');
  if (!el.type) errors.push('element.type is required');
  if (el.type && !ELEMENT_TYPE_VALUES.has(el.type)) {
    errors.push(`Unknown element type: "${el.type}"`);
  }
  if (el.opacity !== undefined && (el.opacity < 0 || el.opacity > 1)) {
    errors.push('opacity must be between 0 and 1');
  }
  if (el.type === ELEMENT_TYPES.DYNAMIC_FIELD && !el.placeholder) {
    errors.push('dynamic_field.placeholder is required');
  }
  if (el.type === ELEMENT_TYPES.REPEAT_BLOCK && !el.collection) {
    errors.push('repeat_block.collection is required');
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

export function validateEditorData(data) {
  if (!data || typeof data !== 'object') return { valid: false, errors: ['editor_data must be an object'] };
  const errors = [];

  for (const section of ['header', 'body', 'footer']) {
    const sec = data[section];
    if (!sec) continue;
    for (const el of (sec.elements || [])) {
      const res = validateElement(el);
      if (!res.valid) {
        errors.push(...res.errors.map(e => `${section}.${el?.id ?? '?'}: ${e}`));
      }
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

// ── Serialisation helpers ─────────────────────────────────────────────────────

export function serializeEditorData(data) {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Merges an API-returned template object with safe defaults for any missing
 * editor fields. Hydrates sections so new section config fields are present.
 */
export function hydrateTemplate(apiTemplate) {
  const rawEditorData = apiTemplate.editor_data ?? defaultEditorData();

  // Ensure all three sections exist and carry the new config fields
  const hydratedEditorData = {
    header: {
      ...defaultSection('header'),
      ...rawEditorData.header,
      elements: rawEditorData.header?.elements ?? [],
    },
    body: {
      ...defaultSection('body'),
      ...rawEditorData.body,
      elements: rawEditorData.body?.elements ?? [],
    },
    footer: {
      ...defaultSection('footer'),
      ...rawEditorData.footer,
      elements: rawEditorData.footer?.elements ?? [],
    },
  };

  return {
    ...apiTemplate,
    layout_config: apiTemplate.layout_config ?? defaultLayoutConfig(),
    editor_data:   hydratedEditorData,
  };
}
