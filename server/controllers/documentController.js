const db         = require('../config/db');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generatePDF, MAX_PDF_BYTES } = require('../services/pdfService');
const { sendAdminDownloadNotificationEmail } = require('../services/emailService');

const PDF_DIR = path.join(__dirname, '../storage/pdfs');

exports.previewDocument = async (req, res) => {
  const { template_id, data } = req.body;
  const [rows] = await db.query('SELECT * FROM templates WHERE id = ? AND is_active = 1', [template_id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Template not found or archived' });
  const template = rows[0];
  let preview = template.body_html;
  for (const [key, value] of Object.entries(data || {})) {
    preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  res.json({ html: preview });
};

exports.generateDocument = async (req, res) => {
  const { template_id, record_identifier, data } = req.body;
  const [rows] = await db.query('SELECT * FROM templates WHERE id = ? AND is_active = 1', [template_id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Template not found or archived' });

  const template   = rows[0];
  const dateStr    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeName   = template.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const docUuid    = `DOC-${dateStr}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const fileName   = `${safeName}_${record_identifier || 'NOREF'}_${dateStr}.pdf`;
  const verifyBase = process.env.CLIENT_URL || 'http://localhost:5174';

  try {
    const { filePath, hash, buffer } = await generatePDF(template, data || {}, docUuid, verifyBase, PDF_DIR, 'draft', { db });

    // BR-002: Reject PDFs that exceed 5 MB — clean up the file before returning.
    if (buffer.length > MAX_PDF_BYTES) {
      try { fs.unlinkSync(filePath); } catch { /* best-effort cleanup */ }
      return res.status(413).json({
        message: `Generated PDF is ${(buffer.length / 1024 / 1024).toFixed(2)} MB, which exceeds the 5 MB limit (BR-002). Reduce the template content or data and try again.`,
      });
    }

    const namedPath     = path.join(PDF_DIR, fileName);
    fs.renameSync(filePath, namedPath);
    const relativeNamed = path.relative(path.join(__dirname, '..'), namedPath);

    const [result] = await db.query(
      `INSERT INTO generated_docs
         (doc_uuid, template_id, template_version, generated_by, record_identifier, file_path, file_hash, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [docUuid, template_id, template.version, req.user.id, record_identifier || null, relativeNamed, hash, JSON.stringify(data || {})]
    );

    await db.query(
      `INSERT INTO audit_logs
         (user_id, doc_id, action, action_details, ip_address, user_agent)
       VALUES (?, ?, 'GENERATE', ?, ?, ?)`,
      [req.user.id, result.insertId, JSON.stringify({ template_id, record_identifier }), req.ip, req.headers['user-agent']]
    );

    res.status(201).json({
      message:          'Document generated',
      id:               result.insertId,
      doc_uuid:         docUuid,
      template_id:      template.id,
      template_name:    template.name,
      template_category: template.category,
      record_identifier: record_identifier || null,
      status:           'draft',
      file_hash:        hash,
      generated_at:     new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ message: 'PDF generation failed', error: err.message });
  }
};

exports.getDocuments = async (req, res) => {
  const { role, id: userId } = req.user;
  const isAdmin    = role === 'super_admin' || role === 'system_admin';
  const whereClause = isAdmin ? '' : 'WHERE gd.generated_by = ?';
  const params      = isAdmin ? [] : [userId];

  const [rows] = await db.query(
    `SELECT gd.*, t.name AS template_name, u.full_name AS generated_by_name
     FROM generated_docs gd
     JOIN templates t ON t.id = gd.template_id
     JOIN users u ON u.id = gd.generated_by
     ${whereClause}
     ORDER BY gd.generated_at DESC`,
    params
  );
  res.json(rows);
};

exports.getDocumentById = async (req, res) => {
  const [rows] = await db.query(
    `SELECT gd.*, t.name AS template_name, u.full_name AS generated_by_name
     FROM generated_docs gd
     JOIN templates t ON t.id = gd.template_id
     JOIN users u ON u.id = gd.generated_by
     WHERE gd.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });
  res.json(rows[0]);
};

// ── GET /api/documents/:id/download ──────────────────────────────────────────
// When the downloader is a recipient, notify all super_admins + system_admins:
//   - Bell notification inserted into `notifications` table
//   - Email sent to each admin
//   - Audit log with action DOWNLOAD
//   - delivery_logs.downloaded_at updated
exports.downloadDocument = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM generated_docs WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });

  const doc        = rows[0];
  const downloader = req.user;
  const isRecipient = downloader.role === 'recipient';
  const isAdmin     = downloader.role === 'super_admin' || downloader.role === 'system_admin';

  // ── Ownership gate for non-admin, non-recipient users (generators, approvers) ─
  // Generators may only download documents they generated themselves.
  // Approvers may download documents they generated OR documents assigned to them
  // for review (i.e. there is a signature_request where approver_id = their id).
  if (!isAdmin && !isRecipient) {
    const isApprover = downloader.role === 'approver';
    let allowed = doc.generated_by === downloader.id;

    if (!allowed && isApprover) {
      // Check whether this document has been assigned to this approver
      const [assignedRows] = await db.query(
        'SELECT id FROM signature_requests WHERE doc_id = ? AND approver_id = ? LIMIT 1',
        [doc.id, downloader.id]
      );
      allowed = assignedRows.length > 0;
    }

    if (!allowed) {
      return res.status(403).json({
        message: 'Access denied. You can only download documents you generated or are assigned to review.',
      });
    }
  }

  // ── Ownership gate for recipients ─────────────────────────────────────────
  // A recipient may only download a document that was explicitly delivered to
  // their account. We verify this against delivery_logs before touching the FS.
  if (isRecipient) {
    const [deliveryCheck] = await db.query(
      `SELECT id FROM delivery_logs
       WHERE doc_id = ? AND recipient_user_id = ?
       LIMIT 1`,
      [doc.id, downloader.id]
    );
    if (deliveryCheck.length === 0) {
      return res.status(403).json({
        message: 'Access denied. This document was not delivered to your account.',
      });
    }
  }

  const fullPath = path.join(__dirname, '..', doc.file_path);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'PDF file not found on server' });
  }

  const downloadedAt = new Date();

  // Audit log — use DOWNLOAD action for recipients, DELIVER for others (backward compat)
  const auditAction = isRecipient ? 'DOWNLOAD' : 'DELIVER';
  await db.query(
    `INSERT INTO audit_logs
       (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      downloader.id, doc.id, auditAction,
      JSON.stringify({ event: 'manual_download', role: downloader.role }),
      req.ip, req.headers['user-agent'],
    ]
  );

  // Update delivery_logs.downloaded_at for this recipient + doc
  if (isRecipient) {
    await db.query(
      `UPDATE delivery_logs
       SET downloaded_at = NOW(), downloaded_ip = ?
       WHERE doc_id = ? AND recipient_user_id = ?
         AND downloaded_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [req.ip, doc.id, downloader.id]
    );

    // Fetch full downloader info for notification content
    const [downloaderRows] = await db.query(
      'SELECT full_name, email FROM users WHERE id = ?',
      [downloader.id]
    );
    const recipientName  = downloaderRows[0]?.full_name || downloader.email;
    const recipientEmail = downloaderRows[0]?.email     || '';

    const notifTitle = 'Recipient Downloaded a Document';
    const notifBody  = `${recipientName} downloaded document ${doc.doc_uuid} at ${downloadedAt.toLocaleString()}`;
    const notifLink  = '/delivery-logs';

    // Notify all super_admins and system_admins
    const [admins] = await db.query(
      `SELECT id, full_name, email
       FROM users
       WHERE role IN ('super_admin', 'system_admin') AND is_active = 1`
    );

    // Fire-and-forget — don't block the download response
    setImmediate(async () => {
      for (const admin of admins) {
        try {
          // Bell notification
          await db.query(
            `INSERT INTO notifications
               (user_id, type, title, body, link, doc_uuid)
             VALUES (?, 'download', ?, ?, ?, ?)`,
            [admin.id, notifTitle, notifBody, notifLink, doc.doc_uuid]
          );
          // Email notification
          await sendAdminDownloadNotificationEmail(
            admin.email, admin.full_name,
            recipientName, recipientEmail,
            doc.doc_uuid, downloadedAt
          );
        } catch (e) {
          console.error(`[Download Notify] Failed for admin ${admin.id}:`, e.message);
        }
      }
    });
  }

  // Stream the PDF file
  res.download(fullPath, `${doc.doc_uuid}.pdf`);
};

// ── PATCH /api/documents/:id/hand-delivered ───────────────────────────────────
// FR-031: Admin marks a signed/delivered doc as hand-delivered
exports.markHandDelivered = async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query('SELECT * FROM generated_docs WHERE id = ?', [id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });

  const doc = rows[0];
  if (doc.status !== 'signed' && doc.status !== 'delivered') {
    return res.status(400).json({ message: 'Document must be signed before marking as hand-delivered' });
  }

  await db.query('UPDATE generated_docs SET status = ? WHERE id = ?', ['hand_delivered', id]);
  await db.query(
    `INSERT INTO audit_logs
       (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (?, ?, 'DELIVER', ?, ?, ?)`,
    [req.user.id, id, JSON.stringify({ event: 'hand_delivered' }), req.ip, req.headers['user-agent']]
  );

  res.json({ message: 'Document marked as hand-delivered' });
};
