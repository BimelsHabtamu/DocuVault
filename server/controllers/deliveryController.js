const db      = require('../config/db');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const {
  sendSetPasswordEmail,
  sendDocumentAccessEmail,
  sendRecipientDeliveryEmail,
} = require('../services/emailService');

// ── Helper: generate a cryptographically random token ────────────────────────
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex string
}

// ── Helper: insert a persistent bell notification ─────────────────────────────
async function insertNotification(userId, type, title, body, link, docUuid) {
  await db.query(
    `INSERT INTO notifications (user_id, type, title, body, link, doc_uuid)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, body, link, docUuid || null]
  );
}

// ── GET /api/delivery/logs ────────────────────────────────────────────────────
exports.getDeliveryLogs = async (req, res) => {
  const { recipient_email, email_status, from, to } = req.query;

  let query = `
    SELECT dl.*, gd.doc_uuid, gd.status AS doc_status, t.name AS template_name
    FROM delivery_logs dl
    JOIN generated_docs gd ON gd.id = dl.doc_id
    JOIN templates t ON t.id = gd.template_id
    WHERE 1=1
  `;
  const params = [];

  if (recipient_email) { query += ' AND dl.recipient_email LIKE ?'; params.push(`%${recipient_email}%`); }
  if (email_status)    { query += ' AND dl.email_status = ?';       params.push(email_status); }
  if (from)            { query += ' AND dl.sent_at >= ?';           params.push(from); }
  if (to)              { query += ' AND dl.sent_at <= ?';           params.push(to); }

  query += ' ORDER BY dl.sent_at DESC LIMIT 200';

  const [rows] = await db.query(query, params);
  res.json(rows);
};

// ── POST /api/delivery/deliver ────────────────────────────────────────────────
// Delivers a signed document to a recipient.
// Creates:
//   1. delivery_logs row (existing system — keeps recipient inbox working)
//   2. recipient_access_sessions row (new no-login token-based access flow)
// Sends the new branded delivery email with a secure one-time access link.
// Does NOT require the recipient to have a DocuVault account.
exports.deliverDocument = async (req, res) => {
  const { doc_id, recipient_email, recipient_name } = req.body;

  if (!doc_id || !recipient_email) {
    return res.status(400).json({ message: 'doc_id and recipient_email are required' });
  }

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient_email.trim())) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  const trimmedEmail = recipient_email.trim().toLowerCase();
  const finalName    = (recipient_name || '').trim() || trimmedEmail;

  // ── 1. Validate document ──────────────────────────────────────────────────
  const [docs] = await db.query(
    `SELECT gd.*, t.name AS template_name
     FROM generated_docs gd
     JOIN templates t ON t.id = gd.template_id
     WHERE gd.id = ?`,
    [doc_id]
  );
  if (docs.length === 0) return res.status(404).json({ message: 'Document not found' });

  const doc = docs[0];
  if (doc.status !== 'signed') {
    return res.status(400).json({ message: 'Only signed documents can be delivered' });
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // ── 2. Insert delivery_logs row ───────────────────────────────────────────
  // Keep the legacy delivery_logs row so the existing recipient inbox and
  // admin delivery-logs page continue to work unchanged.
  const downloadToken = generateSecureToken(); // kept for legacy column (NOT NULL)

  // Option C: also try to link to existing user account if the email matches
  const [existingUsers] = await db.query(
    'SELECT id, full_name FROM users WHERE email = ?',
    [trimmedEmail]
  );
  const recipientUserId  = existingUsers.length > 0 ? existingUsers[0].id : null;
  const resolvedName     = existingUsers.length > 0
    ? (existingUsers[0].full_name || finalName)
    : finalName;

  await db.query(
    `INSERT INTO delivery_logs
       (doc_id, recipient_email, recipient_name, recipient_user_id,
        doc_uuid, sent_at, download_token, token_expiry, email_status)
     VALUES (?, ?, ?, ?, ?, NOW(), ?, DATE_ADD(NOW(), INTERVAL 7 DAY), 'queued')`,
    [doc_id, trimmedEmail, resolvedName, recipientUserId, doc.doc_uuid, downloadToken]
  );

  const [logRows] = await db.query(
    'SELECT id FROM delivery_logs WHERE doc_id = ? AND recipient_email = ? ORDER BY id DESC LIMIT 1',
    [doc_id, trimmedEmail]
  );
  const logId = logRows[0].id;

  // ── 3. Generate secure access token for the new no-login flow ─────────────
  // Raw token goes in the email link.  Only the SHA-256 hash is stored.
  const rawAccessToken  = generateSecureToken(); // 64-char hex
  const accessTokenHash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
  const expiresAt       = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days (FR-028)

  await db.query(
    `INSERT INTO recipient_access_sessions
       (delivery_log_id, doc_id, doc_uuid,
        recipient_name, recipient_email,
        token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [logId, doc_id, doc.doc_uuid, resolvedName, trimmedEmail, accessTokenHash, expiresAt]
  );

  // ── 4. Send delivery email ─────────────────────────────────────────────────
  const accessLink = `${clientUrl}/doc/${rawAccessToken}`;

  try {
    await sendRecipientDeliveryEmail(
      trimmedEmail,
      resolvedName,
      doc.template_name,
      doc.doc_uuid,
      accessLink
    );

    await db.query(
      'UPDATE delivery_logs SET email_status = ? WHERE id = ?',
      ['sent', logId]
    );
    await db.query(
      'UPDATE generated_docs SET status = ? WHERE id = ?',
      ['delivered', doc_id]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs
         (user_id, doc_id, action, action_details, ip_address, user_agent)
       VALUES (?, ?, 'DELIVER', ?, ?, ?)`,
      [
        req.user.id, doc_id,
        JSON.stringify({
          recipient_email:  trimmedEmail,
          recipient_name:   resolvedName,
          recipient_user_id: recipientUserId,
          access_link_sent: true,
        }),
        req.ip, req.headers['user-agent'],
      ]
    );

    res.json({
      message:      `Document delivered. Verification email sent to ${trimmedEmail}.`,
      doc_uuid:     doc.doc_uuid,
      recipient:    resolvedName,
    });

  } catch (err) {
    // Email failed — mark log as failed but don't leave a dangling access session
    await db.query(
      'UPDATE delivery_logs SET email_status = ? WHERE id = ?',
      ['failed', logId]
    );
    await db.query(
      'DELETE FROM recipient_access_sessions WHERE delivery_log_id = ?',
      [logId]
    );
    console.error('[DELIVERY] Email failed for', trimmedEmail, ':', err.message);
    res.status(502).json({
      message: `Failed to send delivery email to "${trimmedEmail}". Document not marked as delivered. Please try again.`,
    });
  }
};

// ── GET /api/delivery/download?token=... ──────────────────────────────────────
// Legacy token-based download (kept for backward compatibility).
// New flow uses authenticated /api/documents/:id/download instead.
exports.downloadDocument = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token required' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.DOWNLOAD_TOKEN_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired download token' });
  }

  const [logs] = await db.query('SELECT * FROM delivery_logs WHERE download_token = ?', [token]);
  if (logs.length === 0) return res.status(404).json({ message: 'Token not found' });

  const log = logs[0];
  if (new Date() > new Date(log.token_expiry)) {
    return res.status(401).json({ message: 'Download link has expired' });
  }

  const [docs] = await db.query('SELECT * FROM generated_docs WHERE id = ?', [decoded.doc_id]);
  if (docs.length === 0) return res.status(404).json({ message: 'Document not found' });

  await db.query(
    'UPDATE delivery_logs SET downloaded_at = NOW(), downloaded_ip = ? WHERE id = ?',
    [req.ip, log.id]
  );
  await db.query(
    `INSERT INTO audit_logs
       (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (?, ?, 'DELIVER', ?, ?, ?)`,
    [null, decoded.doc_id, JSON.stringify({ event: 'downloaded', recipient_email: decoded.recipient_email }), req.ip, req.headers['user-agent']]
  );

  const fullPath = path.join(__dirname, '..', docs[0].file_path);
  res.download(fullPath, `${docs[0].doc_uuid}.pdf`);
};
