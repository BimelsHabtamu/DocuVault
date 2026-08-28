const db   = require('../config/db');
const path = require('path');
const fs   = require('fs');

// ── GET /api/recipient/documents ─────────────────────────────────────────────
// Returns all documents delivered to the logged-in recipient.
// Joined with templates and generated_docs for full card data.
exports.getMyDocuments = async (req, res) => {
  const userId = req.user.id;

  const [rows] = await db.query(
    `SELECT
       dl.id             AS delivery_id,
       dl.sent_at        AS delivered_at,
       dl.downloaded_at,
       dl.email_status,
       dl.doc_uuid,
       gd.id             AS doc_id,
       gd.status         AS doc_status,
       gd.generated_at,
       gd.record_identifier,
       t.name            AS template_name,
       t.category        AS template_category,
       u.full_name       AS generated_by_name
     FROM delivery_logs dl
     JOIN generated_docs gd ON gd.id = dl.doc_id
     JOIN templates t       ON t.id  = gd.template_id
     JOIN users u           ON u.id  = gd.generated_by
     WHERE dl.recipient_user_id = ?
     ORDER BY dl.sent_at DESC`,
    [userId]
  );

  res.json(rows);
};

// ── GET /api/recipient/documents/:doc_uuid ────────────────────────────────────
// Returns a single document for the recipient's document detail / QR page.
// Validates that the requester is actually a recipient of this document.
exports.getMyDocumentByUuid = async (req, res) => {
  const userId   = req.user.id;
  const { doc_uuid } = req.params;

  const [rows] = await db.query(
    `SELECT
       dl.id             AS delivery_id,
       dl.sent_at        AS delivered_at,
       dl.downloaded_at,
       dl.email_status,
       dl.doc_uuid,
       gd.id             AS doc_id,
       gd.status         AS doc_status,
       gd.generated_at,
       gd.record_identifier,
       gd.file_path,
       t.name            AS template_name,
       t.category        AS template_category,
       u.full_name       AS generated_by_name
     FROM delivery_logs dl
     JOIN generated_docs gd ON gd.id = dl.doc_id
     JOIN templates t       ON t.id  = gd.template_id
     JOIN users u           ON u.id  = gd.generated_by
     WHERE dl.recipient_user_id = ?
       AND dl.doc_uuid = ?
     LIMIT 1`,
    [userId, doc_uuid]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Document not found or not delivered to you' });
  }

  const doc = rows[0];

  // Build the verify URL (same URL embedded in the QR code in the PDF footer)
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verifyUrl = `${clientUrl}/verify/${doc.doc_uuid}`;

  res.json({
    ...doc,
    verify_url: verifyUrl,
    // Admins also see this endpoint in supervised contexts — file_path is server-internal only
    file_path:  undefined,
  });
};

// ── GET /api/recipient/stats ──────────────────────────────────────────────────
// Lightweight stats for the recipient dashboard KPI cards.
exports.getMyStats = async (req, res) => {
  const userId = req.user.id;

  const [[totals]] = await db.query(
    `SELECT
       COUNT(*)                                            AS total_delivered,
       SUM(dl.downloaded_at IS NOT NULL)                  AS total_downloaded,
       SUM(dl.sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS delivered_this_week
     FROM delivery_logs dl
     WHERE dl.recipient_user_id = ?`,
    [userId]
  );

  // Last 3 documents for the dashboard recent list
  const [recent] = await db.query(
    `SELECT
       dl.doc_uuid,
       dl.sent_at      AS delivered_at,
       dl.downloaded_at,
       t.name          AS template_name,
       gd.status       AS doc_status
     FROM delivery_logs dl
     JOIN generated_docs gd ON gd.id = dl.doc_id
     JOIN templates t       ON t.id  = gd.template_id
     WHERE dl.recipient_user_id = ?
     ORDER BY dl.sent_at DESC
     LIMIT 3`,
    [userId]
  );

  res.json({
    total_delivered:      Number(totals.total_delivered)      || 0,
    total_downloaded:     Number(totals.total_downloaded)     || 0,
    delivered_this_week:  Number(totals.delivered_this_week)  || 0,
    recent_documents:     recent,
  });
};
