const db      = require('../config/db');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const {
  sendSetPasswordEmail,
  sendDocumentAccessEmail,
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
// Option C Hybrid:
//   - If recipient_email already in users → send login + doc link
//   - If not → auto-create recipient account (is_active=0, password_set=0),
//              generate 48h set-password token, send set-password email
exports.deliverDocument = async (req, res) => {
  const { doc_id, recipient_email, recipient_name } = req.body;

  if (!doc_id || !recipient_email) {
    return res.status(400).json({ message: 'doc_id and recipient_email are required' });
  }

  // ── 1. Validate document ──────────────────────────────────────────────────
  const [docs] = await db.query('SELECT * FROM generated_docs WHERE id = ?', [doc_id]);
  if (docs.length === 0) return res.status(404).json({ message: 'Document not found' });

  const doc = docs[0];
  if (doc.status !== 'signed') {
    return res.status(400).json({ message: 'Only signed documents can be delivered' });
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // ── 2. Option C: Check if recipient email exists ──────────────────────────
  const [existingUsers] = await db.query(
    'SELECT * FROM users WHERE email = ?',
    [recipient_email]
  );

  let recipientUserId = null;
  let finalRecipientName = recipient_name || recipient_email;
  let emailLink;
  let isNewUser = false;

  if (existingUsers.length > 0) {
    // ── Existing user: send login + document link ─────────────────────────
    const existingUser    = existingUsers[0];
    recipientUserId       = existingUser.id;
    finalRecipientName    = existingUser.full_name || recipient_name || recipient_email;
    // Redirect to /my-documents with the specific doc highlighted
    emailLink = `${clientUrl}/login?redirect=/my-documents/${doc.doc_uuid}`;

  } else {
    // ── New user: auto-create recipient account ───────────────────────────
    isNewUser = true;
    const dummyHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const [newUser] = await db.query(
      `INSERT INTO users
         (email, password_hash, full_name, role, is_active, password_set)
       VALUES (?, ?, ?, 'recipient', 0, 0)`,
      [recipient_email, dummyHash, finalRecipientName]
    );
    recipientUserId = newUser.insertId;

    // Generate 48-hour set-password token
    const rawToken  = generateSecureToken();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await db.query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, doc_uuid, expires_at)
       VALUES (?, ?, ?, ?)`,
      [recipientUserId, tokenHash, doc.doc_uuid, expiresAt]
    );

    // Link goes to set-password page; after setting password → auto-redirect to doc
    emailLink = `${clientUrl}/set-password?token=${rawToken}`;
  }

  // ── 3. Insert delivery log ────────────────────────────────────────────────
  await db.query(
    `INSERT INTO delivery_logs
       (doc_id, recipient_email, recipient_name, recipient_user_id,
        doc_uuid, sent_at, download_token, token_expiry, email_status)
     VALUES (?, ?, ?, ?, ?, NOW(), '', DATE_ADD(NOW(), INTERVAL 30 DAY), 'queued')`,
    [doc_id, recipient_email, finalRecipientName, recipientUserId, doc.doc_uuid]
  );

  const [logRows] = await db.query(
    'SELECT id FROM delivery_logs WHERE doc_id = ? AND recipient_email = ? ORDER BY id DESC LIMIT 1',
    [doc_id, recipient_email]
  );
  const logId = logRows[0].id;

  // ── 4. Send the correct email & update log ────────────────────────────────
  try {
    if (isNewUser) {
      await sendSetPasswordEmail(recipient_email, finalRecipientName, emailLink, doc.doc_uuid);
    } else {
      await sendDocumentAccessEmail(recipient_email, finalRecipientName, emailLink, doc.doc_uuid);
    }

    await db.query('UPDATE delivery_logs SET email_status = ? WHERE id = ?', ['sent', logId]);
    await db.query('UPDATE generated_docs SET status = ? WHERE id = ?', ['delivered', doc_id]);

    // Audit log
    await db.query(
      `INSERT INTO audit_logs
         (user_id, doc_id, action, action_details, ip_address, user_agent)
       VALUES (?, ?, 'DELIVER', ?, ?, ?)`,
      [
        req.user.id, doc_id,
        JSON.stringify({
          recipient_email,
          recipient_user_id: recipientUserId,
          is_new_user: isNewUser,
          email_type: isNewUser ? 'set_password' : 'login_link',
        }),
        req.ip, req.headers['user-agent'],
      ]
    );

    res.json({
      message:      'Document delivered successfully',
      is_new_user:  isNewUser,
      recipient_user_id: recipientUserId,
    });

  } catch (err) {
    await db.query('UPDATE delivery_logs SET email_status = ? WHERE id = ?', ['failed', logId]);
    res.status(500).json({ message: 'Email delivery failed', error: err.message });
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
