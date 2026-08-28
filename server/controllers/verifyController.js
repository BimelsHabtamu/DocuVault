const db                = require('../config/db');
const fs                = require('fs');
const path              = require('path');
const { computeSHA256 } = require('../services/pdfService');

// ── GET /api/verify/:doc_uuid ─────────────────────────────────────────────────
// Public. Verifies a document by re-computing its SHA-256 hash.
// Also called when a phone scans the QR code — audit log entry is the signal
// that the PC polling endpoint picks up.
exports.verifyByDocUuid = async (req, res) => {
  const { doc_uuid } = req.params;

  const [rows] = await db.query('SELECT * FROM generated_docs WHERE doc_uuid = ?', [doc_uuid]);
  if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });

  const doc      = rows[0];
  const fullPath = path.join(__dirname, '..', doc.file_path);

  if (!fs.existsSync(fullPath)) {
    return res.status(200).json({
      authentic:   false,
      message:     'File not found on server. Hash preserved in DB.',
      stored_hash: doc.file_hash,
      doc_uuid,
    });
  }

  const fileBuffer     = fs.readFileSync(fullPath);
  const recomputedHash = computeSHA256(fileBuffer);
  const authentic      = recomputedHash === doc.file_hash;

  // Insert audit log — this row is what the PC polling query detects
  await db.query(
    `INSERT INTO audit_logs
       (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (?, ?, 'VERIFY', ?, ?, ?)`,
    [
      null, doc.id,
      JSON.stringify({
        result:           authentic ? 'authentic' : 'tampered',
        recomputed_hash:  recomputedHash,
        method:           'qr_or_id',
      }),
      req.ip,
      req.headers['user-agent'],
    ]
  );

  res.json({
    authentic,
    message:         authentic ? 'Document is Authentic & Untampered' : 'Document is Corrupt or Forged',
    doc_uuid,
    status:          doc.status,
    generated_at:    doc.generated_at,
    template_name:   doc.template_name || null,
    stored_hash:     doc.file_hash,
    recomputed_hash: recomputedHash,
  });
};

// ── POST /api/verify/upload ───────────────────────────────────────────────────
// Public. Verifies a document by SHA-256 of the uploaded PDF buffer.
exports.verifyByUpload = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const uploadedBuffer = req.file.buffer;
  const uploadedHash   = computeSHA256(uploadedBuffer);

  const [rows] = await db.query(
    'SELECT gd.*, t.name AS template_name FROM generated_docs gd LEFT JOIN templates t ON t.id = gd.template_id WHERE gd.file_hash = ?',
    [uploadedHash]
  );

  await db.query(
    `INSERT INTO audit_logs
       (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (?, ?, 'VERIFY', ?, ?, ?)`,
    [
      null,
      rows.length > 0 ? rows[0].id : null,
      JSON.stringify({ method: 'upload', hash: uploadedHash, found: rows.length > 0 }),
      req.ip,
      req.headers['user-agent'],
    ]
  );

  if (rows.length === 0) {
    return res.json({
      authentic:     false,
      message:       'Document is Corrupt or Forged — hash not found in database',
      uploaded_hash: uploadedHash,
    });
  }

  const doc = rows[0];
  res.json({
    authentic:     true,
    message:       'Document is Authentic & Untampered',
    doc_uuid:      doc.doc_uuid,
    status:        doc.status,
    generated_at:  doc.generated_at,
    template_name: doc.template_name || null,
    uploaded_hash: uploadedHash,
  });
};

// ── GET /api/verify/status/:doc_uuid ─────────────────────────────────────────
// Public. Polled every 2 seconds by the PC RecipientDocPage.
// Returns whether the document has been verified (QR scanned on phone).
// Looks for any VERIFY audit_log entry for this doc made in the last 30 seconds.
// That entry is created when the phone hits GET /api/verify/:doc_uuid.
exports.getVerifyStatus = async (req, res) => {
  const { doc_uuid } = req.params;

  const [docRows] = await db.query(
    'SELECT id FROM generated_docs WHERE doc_uuid = ?',
    [doc_uuid]
  );
  if (docRows.length === 0) return res.status(404).json({ message: 'Document not found' });

  const docId = docRows[0].id;

  // Look for a VERIFY event in the last 60 seconds (generous window for cross-device sync)
  const [verifyRows] = await db.query(
    `SELECT id, timestamp, ip_address, action_details
     FROM audit_logs
     WHERE doc_id = ?
       AND action = 'VERIFY'
       AND timestamp >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
     ORDER BY timestamp DESC
     LIMIT 1`,
    [docId]
  );

  if (verifyRows.length === 0) {
    return res.json({ verified: false });
  }

  const row     = verifyRows[0];
  const details = row.action_details ? JSON.parse(row.action_details) : {};

  res.json({
    verified:     true,
    authentic:    details.result === 'authentic',
    verified_at:  row.timestamp,
    verified_ip:  row.ip_address,
  });
};
