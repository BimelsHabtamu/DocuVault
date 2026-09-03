const db = require('../config/db');
const {
  validateLayoutConfig,
  validateEditorData,
  defaultLayoutConfig,
  defaultEditorData,
} = require('../models/templateEditorSchema');

const VALID_CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];

// ── Safely parse a JSON string; return fallback on failure ────────────────────
function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value; // already parsed (mysql2 >= 3.x may auto-parse)
  try { return JSON.parse(value); } catch { return fallback; }
}

exports.getSchemaFields = async (req, res) => {
  try {
    const [tables] = await db.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [process.env.DB_NAME]
    );
    const result = {};
    for (const { TABLE_NAME } of tables) {
      const [cols] = await db.query(
        `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [process.env.DB_NAME, TABLE_NAME]
      );
      result[TABLE_NAME] = cols.map(c => ({
        field:       c.COLUMN_NAME,
        type:        c.DATA_TYPE,
        placeholder: `{{${TABLE_NAME}.${c.COLUMN_NAME}}}`,
      }));
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Schema fetch failed', error: err.message });
  }
};

exports.getTemplates = async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.*,
            COUNT(tv.id) AS version_count
     FROM templates t
     LEFT JOIN template_versions tv ON tv.template_id = t.id
     GROUP BY t.id
     ORDER BY t.created_at DESC`
  );
  // Parse JSON columns returned as strings by MySQL
  res.json(rows.map(t => ({
    ...t,
    layout_config: parseJson(t.layout_config, null),
    editor_data:   parseJson(t.editor_data,   null),
  })));
};

exports.getTemplateById = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Template not found' });
  const [placeholders] = await db.query(
    'SELECT * FROM template_placeholders WHERE template_id = ?', [req.params.id]
  );
  const t = rows[0];
  // MySQL returns JSON columns as strings — parse them for the client
  res.json({
    ...t,
    layout_config: parseJson(t.layout_config, null),
    editor_data:   parseJson(t.editor_data,   null),
    placeholders,
  });
};

exports.createTemplate = async (req, res) => {
  const {
    name, description, category,
    header_html, body_html, footer_html,
    watermark_text, watermark_config, data_source,
    layout_config, editor_data,
    // Auto-seal fields
    auto_seal_enabled, seal_section, seal_element_id,
  } = req.body;

  if (!name || !category) {
    return res.status(400).json({ message: 'name and category are required' });
  }
  if (!body_html && !editor_data) {
    return res.status(400).json({ message: 'body_html or editor_data is required' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: 'Invalid category' });
  }

  if (layout_config) {
    const lv = validateLayoutConfig(layout_config);
    if (!lv.valid) return res.status(400).json({ message: 'Invalid layout_config', errors: lv.errors });
  }
  if (editor_data) {
    const ev = validateEditorData(editor_data);
    if (!ev.valid) return res.status(400).json({ message: 'Invalid editor_data', errors: ev.errors });
  }

  const layoutJson    = layout_config    ? JSON.stringify(layout_config) : null;
  const editorJson    = editor_data      ? JSON.stringify(editor_data)   : null;
  // watermark_config may arrive as a pre-stringified JSON string or an object
  const wmConfigJson  = watermark_config
    ? (typeof watermark_config === 'string' ? watermark_config : JSON.stringify(watermark_config))
    : null;
  const sealEnabled  = auto_seal_enabled ? 1 : 0;
  const sealSection  = seal_section  || 'header';
  const sealElId     = seal_element_id || null;

  const [result] = await db.query(
    `INSERT INTO templates
       (name, description, category, version,
        header_html, body_html, footer_html, watermark_text, watermark_config, data_source,
        layout_config, editor_data,
        auto_seal_enabled, seal_section, seal_element_id)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, description || null, category,
      header_html || null, body_html || '', footer_html || null,
      watermark_text || null, wmConfigJson,
      data_source || null,
      layoutJson, editorJson,
      sealEnabled, sealSection, sealElId,
    ]
  );

  // FR-006: Insert the v1 baseline snapshot immediately so new templates always
  // have a complete version history from the moment they are created.
  // This fills the gap that the migration backfill only covers pre-existing templates.
  await db.query(
    `INSERT IGNORE INTO template_versions
       (template_id, version, name, category, description,
        header_html, body_html, footer_html, watermark_text, watermark_config, data_source,
        layout_config, editor_data,
        auto_seal_enabled, seal_section, seal_element_id,
        created_by, created_at)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      result.insertId,
      name, category, description || null,
      header_html || null, body_html || '', footer_html || null,
      watermark_text || null, wmConfigJson,
      data_source || null,
      layoutJson, editorJson,
      sealEnabled, sealSection, sealElId,
      req.user?.id || null,
    ]
  );

  res.status(201).json({ message: 'Template created', id: result.insertId });
};

exports.updateTemplate = async (req, res) => {
  const {
    name, description, category,
    header_html, body_html, footer_html,
    watermark_text, watermark_config, data_source,
    layout_config, editor_data,
    // Auto-seal fields
    auto_seal_enabled, seal_section, seal_element_id,
  } = req.body;

  const [existing] = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
  if (existing.length === 0) return res.status(404).json({ message: 'Template not found' });

  if (layout_config) {
    const lv = validateLayoutConfig(layout_config);
    if (!lv.valid) return res.status(400).json({ message: 'Invalid layout_config', errors: lv.errors });
  }
  if (editor_data) {
    const ev = validateEditorData(editor_data);
    if (!ev.valid) return res.status(400).json({ message: 'Invalid editor_data', errors: ev.errors });
  }

  const current    = existing[0];
  const newVersion = current.version + 1;

  // FR-006: Snapshot the CURRENT version before overwriting (includes new seal columns).
  await db.query(
    `INSERT IGNORE INTO template_versions
       (template_id, version, name, category, description,
        header_html, body_html, footer_html, watermark_text, watermark_config, data_source,
        layout_config, editor_data,
        auto_seal_enabled, seal_section, seal_element_id,
        created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      current.id, current.version, current.name, current.category,
      current.description || null,
      current.header_html || null, current.body_html || '', current.footer_html || null,
      current.watermark_text || null, current.watermark_config || null,
      current.data_source || null,
      current.layout_config || null, current.editor_data || null,
      current.auto_seal_enabled || 0, current.seal_section || 'header', current.seal_element_id || null,
      req.user?.id || null, current.updated_at || current.created_at,
    ]
  );

  const layoutJson   = layout_config     !== undefined ? JSON.stringify(layout_config) : current.layout_config;
  const editorJson   = editor_data       !== undefined ? JSON.stringify(editor_data)   : current.editor_data;
  const wmConfigJson = watermark_config  !== undefined
    ? (watermark_config ? (typeof watermark_config === 'string' ? watermark_config : JSON.stringify(watermark_config)) : null)
    : (current.watermark_config || null);
  const sealEnabled  = auto_seal_enabled !== undefined ? (auto_seal_enabled ? 1 : 0)   : (current.auto_seal_enabled || 0);
  const sealSection  = seal_section      !== undefined ? seal_section                   : (current.seal_section || 'header');
  const sealElId     = seal_element_id   !== undefined ? seal_element_id                : (current.seal_element_id || null);

  await db.query(
    `UPDATE templates SET
       name=?, description=?, category=?, version=?,
       header_html=?, body_html=?, footer_html=?, watermark_text=?, watermark_config=?, data_source=?,
       layout_config=?, editor_data=?,
       auto_seal_enabled=?, seal_section=?, seal_element_id=?
     WHERE id=?`,
    [
      name, description || null, category, newVersion,
      header_html || null, body_html || '', footer_html || null,
      watermark_text || null, wmConfigJson,
      data_source || null,
      layoutJson, editorJson,
      sealEnabled, sealSection, sealElId || null,
      req.params.id,
    ]
  );

  res.json({ message: 'Template updated', version: newVersion, id: Number(req.params.id) });
};

// ── GET /templates/:id/versions ───────────────────────────────────────────────
// Returns the version history for a template (newest first).
// Includes a synthetic "current" entry for the live templates row so the UI
// can always show the full picture including the version currently in the editor.
exports.getTemplateVersions = async (req, res) => {
  const templateId = req.params.id;

  // Fetch the live template (for a synthetic "current" row)
  const [liveRows] = await db.query(
    `SELECT t.id, t.version, t.name, t.category, t.description,
            t.watermark_text, t.data_source, t.updated_at AS created_at,
            u.full_name AS created_by_name
     FROM templates t
     LEFT JOIN users u ON u.id = ?
     WHERE t.id = ?`,
    [req.user?.id || null, templateId]
  );
  if (liveRows.length === 0) return res.status(404).json({ message: 'Template not found' });

  // Fetch snapshots from template_versions
  const [snapshots] = await db.query(
    `SELECT tv.id, tv.version, tv.name, tv.category, tv.description,
            tv.watermark_text, tv.data_source, tv.created_at,
            u.full_name AS created_by_name
     FROM template_versions tv
     LEFT JOIN users u ON u.id = tv.created_by
     WHERE tv.template_id = ?
     ORDER BY tv.version DESC`,
    [templateId]
  );

  const live = liveRows[0];

  // Build the full list: current live version first, then snapshots (excluding
  // any snapshot that has the same version number as the live row to avoid
  // duplication on templates that were only ever created and never edited).
  const snapshotVersions = new Set(snapshots.map(s => s.version));
  const result = [
    {
      ...live,
      is_current: true,
      label: `v${live.version} (current)`,
    },
    ...snapshots
      .filter(s => s.version !== live.version) // de-dup: don't show same version twice
      .map(s => ({
        ...s,
        is_current: false,
        label: `v${s.version}`,
      })),
  ];

  res.json(result);
};

// ── GET /templates/:id/versions/:version ──────────────────────────────────────
// Returns the FULL content of a specific version snapshot (for preview/diff).
// For the current live version, returns the templates row itself.
exports.getVersionContent = async (req, res) => {
  const templateId    = Number(req.params.id);
  const versionNumber = Number(req.params.version);

  // First try to get the snapshot from template_versions
  const [snapRows] = await db.query(
    `SELECT * FROM template_versions
     WHERE template_id = ? AND version = ?`,
    [templateId, versionNumber]
  );

  if (snapRows.length > 0) {
    const snap = snapRows[0];
    return res.json({
      ...snap,
      layout_config: parseJson(snap.layout_config, null),
      editor_data:   parseJson(snap.editor_data,   null),
      is_snapshot:   true,
    });
  }

  // Fall back to the live templates row if it matches the requested version
  const [liveRows] = await db.query(
    'SELECT * FROM templates WHERE id = ? AND version = ?',
    [templateId, versionNumber]
  );
  if (liveRows.length > 0) {
    const live = liveRows[0];
    return res.json({
      ...live,
      layout_config: parseJson(live.layout_config, null),
      editor_data:   parseJson(live.editor_data,   null),
      is_snapshot:   false,
      is_current:    true,
    });
  }

  res.status(404).json({ message: `Version ${versionNumber} not found for template ${templateId}` });
};

// ── POST /templates/:id/restore/:version ─────────────────────────────────────
// Restores a past version snapshot to become the new current version.
// Strategy:
//   1. Load the snapshot from template_versions (or reject if not found).
//   2. Snapshot the CURRENT live row into template_versions (same as updateTemplate).
//   3. Overwrite the templates row with the snapshot content, bumping version.
//
// This preserves the full audit trail:
//   - The version being restored does NOT lose its snapshot in template_versions.
//   - The current live content is snapshotted first so it can be recovered.
//   - All generated_docs.template_version integers remain accurate — they still
//     point to the snapshot that existed when each doc was created.
//
// Security: only admins can restore (same role guard as updateTemplate).
exports.restoreTemplateVersion = async (req, res) => {
  const templateId      = Number(req.params.id);
  const versionToRestore = Number(req.params.version);

  if (!versionToRestore || isNaN(versionToRestore)) {
    return res.status(400).json({ message: 'Invalid version number' });
  }

  // 1. Load the snapshot to restore
  const [snapRows] = await db.query(
    'SELECT * FROM template_versions WHERE template_id = ? AND version = ?',
    [templateId, versionToRestore]
  );
  if (snapRows.length === 0) {
    return res.status(404).json({
      message: `Version ${versionToRestore} snapshot not found. Cannot restore.`,
    });
  }
  const snap = snapRows[0];

  // 2. Load the current live template
  const [liveRows] = await db.query('SELECT * FROM templates WHERE id = ?', [templateId]);
  if (liveRows.length === 0) return res.status(404).json({ message: 'Template not found' });
  const current    = liveRows[0];
  const newVersion = current.version + 1;

  // 3. Snapshot the current live content before overwriting (same as updateTemplate)
  await db.query(
    `INSERT IGNORE INTO template_versions
       (template_id, version, name, category, description,
        header_html, body_html, footer_html, watermark_text, watermark_config, data_source,
        layout_config, editor_data,
        auto_seal_enabled, seal_section, seal_element_id,
        created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      current.id, current.version, current.name, current.category,
      current.description || null,
      current.header_html || null, current.body_html || '', current.footer_html || null,
      current.watermark_text || null, current.watermark_config || null,
      current.data_source || null,
      current.layout_config || null, current.editor_data || null,
      current.auto_seal_enabled || 0, current.seal_section || 'header', current.seal_element_id || null,
      req.user?.id || null, current.updated_at || current.created_at,
    ]
  );

  // 4. Overwrite the live templates row with the snapshot content at newVersion
  await db.query(
    `UPDATE templates SET
       name=?, description=?, category=?, version=?,
       header_html=?, body_html=?, footer_html=?,
       watermark_text=?, watermark_config=?, data_source=?,
       layout_config=?, editor_data=?,
       auto_seal_enabled=?, seal_section=?, seal_element_id=?
     WHERE id=?`,
    [
      snap.name,
      snap.description    || null,
      snap.category,
      newVersion,
      snap.header_html    || null,
      snap.body_html      || '',
      snap.footer_html    || null,
      snap.watermark_text || null,
      snap.watermark_config || null,
      snap.data_source    || null,
      snap.layout_config  || null,
      snap.editor_data    || null,
      snap.auto_seal_enabled || 0,
      snap.seal_section   || 'header',
      snap.seal_element_id || null,
      templateId,
    ]
  );

  // 5. Also snapshot the restored content at newVersion so history is complete
  await db.query(
    `INSERT IGNORE INTO template_versions
       (template_id, version, name, category, description,
        header_html, body_html, footer_html, watermark_text, watermark_config, data_source,
        layout_config, editor_data,
        auto_seal_enabled, seal_section, seal_element_id,
        created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      templateId,
      newVersion,
      snap.name,
      snap.category,
      snap.description    || null,
      snap.header_html    || null,
      snap.body_html      || '',
      snap.footer_html    || null,
      snap.watermark_text || null,
      snap.watermark_config || null,
      snap.data_source    || null,
      snap.layout_config  || null,
      snap.editor_data    || null,
      snap.auto_seal_enabled || 0,
      snap.seal_section   || 'header',
      snap.seal_element_id || null,
      req.user?.id || null,
    ]
  );

  res.json({
    message:          `Version ${versionToRestore} restored as version ${newVersion}`,
    restoredFrom:     versionToRestore,
    newVersion,
    templateId,
  });
};

exports.setTemplateStatus = async (req, res) => {
  const { is_active } = req.body;
  await db.query('UPDATE templates SET is_active = ? WHERE id = ?', [is_active, req.params.id]);
  res.json({ message: `Template ${is_active ? 'activated' : 'archived'}` });
};

exports.deleteTemplate = async (req, res) => {
  const [existing] = await db.query('SELECT id FROM templates WHERE id = ?', [req.params.id]);
  if (existing.length === 0) return res.status(404).json({ message: 'Template not found' });

  try {
    await db.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    // Keep templates referenced by generated documents or bulk-job history.
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        message: 'Template is in use and cannot be deleted. Archive it instead.',
      });
    }
    throw err;
  }
};

exports.uploadLogo = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const relativePath = `uploads/${req.file.filename}`;
  await db.query('UPDATE templates SET logo_path = ? WHERE id = ?', [relativePath, req.params.id]);
  res.json({ message: 'Logo uploaded', path: relativePath, url: `/uploads/${req.file.filename}` });
};

exports.uploadTemplateImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const relativePath = `/uploads/${req.file.filename}`;
  res.json({
    message: 'Image uploaded',
    path: relativePath,
    url: relativePath,
    fullUrl: `http://localhost:${process.env.PORT || 5000}${relativePath}`,
  });
};

// ── POST /templates/:id/preview-pdf — generate a real sample PDF ──────────────
exports.previewTemplatePdf = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Template not found' });

    const template   = rows[0];
    const { generatePDF } = require('../services/pdfService');
    const path       = require('path');
    const fs         = require('fs');

    const sampleData = {
      'employee.full_name':    'Sara Ahmed (Preview)',
      'employee.position':     'HR Manager',
      'employee.department':   'Human Resources',
      'employee.email':        'sara@company.com',
      'employee.phone':        '+251 912 345 678',
      'employee.id':           'EMP-0042',
      'employee.join_date':    '01 Jan 2022',
      'finance.salary':        'ETB 45,000',
      'finance.currency':      'ETB',
      'finance.pay_date':      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      'finance.bank_name':     'Commercial Bank of Ethiopia',
      'finance.account_number':'1000123456789',
      'student.full_name':     'Abebe Bekele (Preview)',
      'student.id':            'STU-2026-001',
      'student.program':       'Computer Science',
      'student.gpa':           '3.85',
      'student.year':          'Final Year',
      'supplier.name':         'Addis Supplies PLC (Preview)',
      'supplier.tin':          'TIN-12345678',
      'effective_date':        new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    const docUuid    = `PREVIEW-${Date.now()}`;
    // Use the server's own storage/pdfs directory — avoids os.tmpdir() path issues on Windows
    const outDir     = path.join(__dirname, '../storage/pdfs');
    const verifyBase = process.env.CLIENT_URL || 'http://localhost:5173';

    const { filePath } = await generatePDF(
      template, sampleData, docUuid, verifyBase, outDir, 'draft', { db }
    );

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ message: 'PDF was not created' });
    }

    const safeName = template.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="preview-${safeName}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');

    // Read into buffer then send — avoids "headers already sent" on stream error
    const buffer = fs.readFileSync(filePath);
    fs.unlink(filePath, () => {}); // clean up async
    res.end(buffer);

  } catch (err) {
    console.error('[previewTemplatePdf]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'PDF preview failed', error: err.message });
    }
  }
};
