/**
 * recipientAccessController.js
 *
 * Handles the no-login token-based recipient document access workflow:
 *
 *   GET  /api/access/:token          → getSession       (load page data)
 *   GET  /api/access/:token/qr-poll  → pollQrStatus     (PC polls every 2s waiting for phone scan)
 *   POST /api/access/:token/verify   → markQrVerified   (phone calls this after scanning)
 *   POST /api/access/:token/grant    → grantAccess      (ON button)
 *   GET  /api/access/:token/pdf      → streamPdf        (View PDF — inline)
 *   POST /api/access/:token/download → recordDownload   (Download PDF — attachment)
 *
 * Security model:
 *   - All endpoints derive identity from the SHA-256 hash of the raw token in the URL.
 *     No JWT / session cookie is required — the token IS the credential.
 *   - Raw token is NEVER stored in DB (only SHA-256 hash).
 *   - Each step enforces the previous step: pdf/download require access_granted=1,
 *     access_granted requires qr_verified=1. No frontend state can bypass these.
 *   - Token expires 7 days after delivery (FR-028). Expired tokens return 410.
 */

const db   = require('../config/db');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Helper ────────────────────────────────────────────────────────────────────
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function findSession(tokenHash) {
  const [rows] = await db.query(
    `SELECT ras.*,
            gd.file_path, gd.file_hash, gd.status AS doc_status,
            t.name AS template_name
     FROM recipient_access_sessions ras
     JOIN generated_docs gd ON gd.id = ras.doc_id
     JOIN templates t        ON t.id  = gd.template_id
     WHERE ras.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

// ── GET /api/access/:token ────────────────────────────────────────────────────
// Returns session metadata for the RecipientAccessPage to render.
// Called once on page load.
exports.getSession = async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ message: 'Token is required' });

  const session = await findSession(hashToken(token));

  if (!session) {
    return res.status(404).json({ message: 'This document link is invalid or has already been used.' });
  }

  if (new Date() > new Date(session.expires_at)) {
    return res.status(410).json({ message: 'This document link has expired (7-day limit). Please contact the sender.' });
  }

  // Build the QR verification URL — phone visits this to complete verification
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const qrUrl     = `${clientUrl}/doc/${token}/verify`;

  res.json({
    doc_uuid:       session.doc_uuid,
    template_name:  session.template_name,
    recipient_name: session.recipient_name,
    recipient_email:session.recipient_email,
    qr_verified:    !!session.qr_verified,
    access_granted: !!session.access_granted,
    qr_url:         qrUrl,          // embedded in the QR code
    expires_at:     session.expires_at,
  });
};

// ── GET /api/access/:token/qr-poll ───────────────────────────────────────────
// Polled every 2 s by the PC browser.
// Returns { qr_verified: true } as soon as the phone has scanned and verified.
exports.pollQrStatus = async (req, res) => {
  const { token } = req.params;

  const session = await findSession(hashToken(token));
  if (!session) return res.status(404).json({ message: 'Invalid token' });

  if (new Date() > new Date(session.expires_at)) {
    return res.status(410).json({ message: 'Link expired' });
  }

  res.json({
    qr_verified:    !!session.qr_verified,
    access_granted: !!session.access_granted,
  });
};

// ── POST /api/access/:token/verify ────────────────────────────────────────────
// Called by the PHONE after scanning the QR code.
// The phone opens  /doc/:token/verify  which is a public page that calls this.
// Marks qr_verified = 1 so the PC poll picks it up within 2 seconds.
exports.markQrVerified = async (req, res) => {
  const { token } = req.params;
  const tokenHash = hashToken(token);

  const session = await findSession(tokenHash);
  if (!session) {
    return res.status(404).json({ message: 'This verification link is invalid.' });
  }

  if (new Date() > new Date(session.expires_at)) {
    return res.status(410).json({ message: 'This document link has expired.' });
  }

  if (session.qr_verified) {
    // Already verified — idempotent, just return success
    return res.json({ verified: true, already_verified: true });
  }

  await db.query(
    `UPDATE recipient_access_sessions
     SET qr_verified = 1, qr_verified_at = NOW(), qr_verified_ip = ?
     WHERE token_hash = ?`,
    [req.ip, tokenHash]
  );

  // Audit log
  await db.query(
    `INSERT INTO audit_logs (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (NULL, ?, 'VERIFY', ?, ?, ?)`,
    [
      session.doc_id,
      JSON.stringify({
        method:         'recipient_qr_scan',
        recipient_email: session.recipient_email,
        doc_uuid:       session.doc_uuid,
      }),
      req.ip,
      req.headers['user-agent'],
    ]
  ).catch(() => {});

  res.json({ verified: true });
};

// ── POST /api/access/:token/grant ─────────────────────────────────────────────
// Called when the recipient clicks the ON button.
// Requires qr_verified = 1. Sets access_granted = 1.
exports.grantAccess = async (req, res) => {
  const { token } = req.params;
  const tokenHash = hashToken(token);

  const session = await findSession(tokenHash);
  if (!session) return res.status(404).json({ message: 'Invalid token' });

  if (new Date() > new Date(session.expires_at)) {
    return res.status(410).json({ message: 'Link expired' });
  }

  if (!session.qr_verified) {
    return res.status(403).json({ message: 'QR verification is required before accessing the document.' });
  }

  if (!session.access_granted) {
    await db.query(
      `UPDATE recipient_access_sessions
       SET access_granted = 1, access_granted_at = NOW()
       WHERE token_hash = ?`,
      [tokenHash]
    );
  }

  res.json({ access_granted: true });
};

// ── GET /api/access/:token/pdf ────────────────────────────────────────────────
// Streams the PDF inline (for View PDF in browser).
// Security: requires qr_verified AND access_granted in DB.
exports.streamPdf = async (req, res) => {
  const { token } = req.params;
  const tokenHash = hashToken(token);

  const session = await findSession(tokenHash);
  if (!session) return res.status(404).json({ message: 'Invalid token' });

  if (new Date() > new Date(session.expires_at)) {
    return res.status(410).json({ message: 'Link expired' });
  }

  if (!session.qr_verified) {
    return res.status(403).json({ message: 'QR verification required.' });
  }

  if (!session.access_granted) {
    return res.status(403).json({ message: 'Access not yet granted. Click the ON button first.' });
  }

  const fullPath = path.join(__dirname, '..', session.file_path);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'Document file not found on server.' });
  }

  // Track view
  await db.query(
    `UPDATE recipient_access_sessions
     SET view_count = view_count + 1,
         first_viewed_at = COALESCE(first_viewed_at, NOW()),
         last_viewed_at  = NOW()
     WHERE token_hash = ?`,
    [tokenHash]
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${session.doc_uuid}.pdf"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent the browser from caching the PDF stream
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(fullPath).pipe(res);
};

// ── POST /api/access/:token/download ──────────────────────────────────────────
// Serves the PDF as a download attachment and records the event.
// Security: requires qr_verified AND access_granted in DB.
exports.recordDownload = async (req, res) => {
  const { token } = req.params;
  const tokenHash = hashToken(token);

  const session = await findSession(tokenHash);
  if (!session) return res.status(404).json({ message: 'Invalid token' });

  if (new Date() > new Date(session.expires_at)) {
    return res.status(410).json({ message: 'Link expired' });
  }

  if (!session.qr_verified) {
    return res.status(403).json({ message: 'QR verification required.' });
  }

  if (!session.access_granted) {
    return res.status(403).json({ message: 'Access not yet granted.' });
  }

  const fullPath = path.join(__dirname, '..', session.file_path);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'Document file not found on server.' });
  }

  // Record download in session row
  await db.query(
    `UPDATE recipient_access_sessions
     SET download_count = download_count + 1,
         first_downloaded_at = COALESCE(first_downloaded_at, NOW())
     WHERE token_hash = ?`,
    [tokenHash]
  );

  // Also stamp delivery_logs.downloaded_at (first download wins)
  await db.query(
    `UPDATE delivery_logs
     SET downloaded_at = COALESCE(downloaded_at, NOW()), downloaded_ip = ?
     WHERE id = ?`,
    [req.ip, session.delivery_log_id]
  );

  // Audit log — DOWNLOAD action
  await db.query(
    `INSERT INTO audit_logs (user_id, doc_id, action, action_details, ip_address, user_agent)
     VALUES (NULL, ?, 'DOWNLOAD', ?, ?, ?)`,
    [
      session.doc_id,
      JSON.stringify({
        recipient_name:  session.recipient_name,
        recipient_email: session.recipient_email,
        doc_uuid:        session.doc_uuid,
        download_count:  session.download_count + 1,
      }),
      req.ip,
      req.headers['user-agent'],
    ]
  ).catch(() => {});

  // Notify super_admins (reuse existing pattern)
  try {
    const { sendAdminDownloadNotificationEmail } = require('../services/emailService');
    const [admins] = await db.query(
      `SELECT email, full_name FROM users WHERE role = 'super_admin' AND is_active = 1`
    );
    for (const admin of admins) {
      await sendAdminDownloadNotificationEmail(
        admin.email, admin.full_name,
        session.recipient_name, session.recipient_email,
        session.doc_uuid, new Date().toISOString()
      ).catch(() => {});
    }
  } catch { /* non-fatal */ }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${session.doc_uuid}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(fullPath).pipe(res);
};
