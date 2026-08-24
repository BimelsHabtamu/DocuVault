const db = require('../config/db');

const VALID_CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];

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
  const [rows] = await db.query('SELECT * FROM templates ORDER BY created_at DESC');
  res.json(rows);
};

exports.getTemplateById = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Template not found' });
  const [placeholders] = await db.query(
    'SELECT * FROM template_placeholders WHERE template_id = ?', [req.params.id]
  );
  res.json({ ...rows[0], placeholders });
};

exports.createTemplate = async (req, res) => {
  const { name, description, category, header_html, body_html, footer_html, watermark_text, data_source } = req.body;
  if (!name || !category || !body_html) {
    return res.status(400).json({ message: 'name, category, and body_html are required' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: 'Invalid category' });
  }
  const [result] = await db.query(
    `INSERT INTO templates (name, description, category, version, header_html, body_html, footer_html, watermark_text, data_source)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    [name, description || null, category, header_html || null, body_html, footer_html || null, watermark_text || null, data_source || null]
  );
  res.status(201).json({ message: 'Template created', id: result.insertId });
};

exports.updateTemplate = async (req, res) => {
  const { name, description, category, header_html, body_html, footer_html, watermark_text, data_source } = req.body;
  const [existing] = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
  if (existing.length === 0) return res.status(404).json({ message: 'Template not found' });
  const newVersion = existing[0].version + 1;
  await db.query(
    `UPDATE templates SET name=?, description=?, category=?, version=?,
     header_html=?, body_html=?, footer_html=?, watermark_text=?, data_source=? WHERE id=?`,
    [name, description || null, category, newVersion,
     header_html || null, body_html, footer_html || null, watermark_text || null,
     data_source || null, req.params.id]
  );
  res.json({ message: 'Template updated', version: newVersion });
};

exports.setTemplateStatus = async (req, res) => {
  const { is_active } = req.body;
  await db.query('UPDATE templates SET is_active = ? WHERE id = ?', [is_active, req.params.id]);
  res.json({ message: `Template ${is_active ? 'activated' : 'archived'}` });
};

exports.deleteTemplate = async (req, res) => {
  const [existing] = await db.query('SELECT id FROM templates WHERE id = ?', [req.params.id]);
  if (existing.length === 0) return res.status(404).json({ message: 'Template not found' });
  await db.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
  res.json({ message: 'Template deleted' });
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
