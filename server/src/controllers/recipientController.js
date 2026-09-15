/**
 * M-2: Authenticated Recipient area (SRS §5 RBAC — Recipient role).
 *
 * Recipients are real users (role = 'recipient') who can log in and:
 *   - list documents delivered to their email address
 *   - download documents that were confirmed as theirs (ownership CONFIRMED)
 *   - verify document integrity (public verify endpoint is always available too)
 *
 * They CANNOT: generate PDFs, create templates, approve/reject signatures,
 * access any admin functionality, or see documents belonging to other users.
 */

const fs = require('fs');
const { pool } = require('../config/db');
const { recordAudit } = require('../utils/auditLog');

function getIp(req) {
  return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
}

/**
 * GET /api/recipient/documents
 * Returns all document_deliveries rows for the current recipient's email,
 * joined with the relevant generated_docs and template name — gives the
 * recipient the same information the secure-delivery OTP landing page shows,
 * but accessible from their authenticated account at any time.
 */
async function listMyDeliveries(req, res) {
  const { email } = req.user;

  try {
    const [rows] = await pool.query(
      `SELECT
         dd.id                    AS delivery_id,
         dd.doc_id,
         dd.delivery_method,
         dd.sent_at,
         dd.otp_verified_at,
         dd.ownership_status,
         dd.ownership_confirmed_at,
         dd.downloaded_at,
         dd.created_at            AS delivered_at,
         gd.doc_uuid,
         gd.status                AS doc_status,
         gd.generated_at,
         gd.deleted_at,
         gd.revoked_at,
         t.name                   AS template_name,
         t.category               AS template_category
       FROM document_deliveries dd
       JOIN generated_docs gd ON gd.id = dd.doc_id
       JOIN templates       t  ON t.id  = gd.template_id
       WHERE dd.recipient_email = ?
         AND gd.deleted_at IS NULL
       ORDER BY dd.created_at DESC`,
      [email]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[recipient] listMyDeliveries error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load your documents.' });
  }
}

/**
 * GET /api/recipient/documents/:deliveryId/download
 * Allows a recipient to re-download a document they have already confirmed
 * ownership of.  The one-time secure-delivery link is for first-time delivery
 * only; this authenticated endpoint is the durable download path for recipients
 * who are logged in and wish to retrieve their document later.
 *
 * Conditions:
 *   - delivery.recipient_email must equal req.user.email  (ownership scoping)
 *   - ownership_status must be CONFIRMED
 *   - document must not be deleted or revoked
 */
async function downloadMyDocument(req, res) {
  const { deliveryId } = req.params;
  const { email } = req.user;

  try {
    const [[delivery]] = await pool.query(
      `SELECT dd.*, gd.file_path, gd.file_hash, gd.deleted_at, gd.revoked_at, gd.metadata, gd.id AS doc_row_id
       FROM document_deliveries dd
       JOIN generated_docs gd ON gd.id = dd.doc_id
       WHERE dd.id = ?`,
      [deliveryId]
    );

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery record not found.' });
    }

    // Scope: the delivery must belong to this recipient's email.
    if (delivery.recipient_email !== email) {
      return res.status(403).json({ success: false, message: 'This document was not delivered to your account.' });
    }

    if (delivery.ownership_status !== 'CONFIRMED') {
      return res.status(403).json({ success: false, message: 'You can only download documents you have confirmed ownership of.' });
    }

    if (delivery.deleted_at) {
      return res.status(410).json({ success: false, message: 'This document has been deleted by the issuing organisation.' });
    }
    if (delivery.revoked_at) {
      return res.status(410).json({ success: false, message: 'This document has been revoked by the issuing organisation.' });
    }
    if (!fs.existsSync(delivery.file_path)) {
      return res.status(410).json({ success: false, message: 'The file is no longer available on the server.' });
    }

    const meta = delivery.metadata ? JSON.parse(delivery.metadata) : {};
    await recordAudit({
      userId: req.user.id,
      docId: delivery.doc_row_id,
      action: 'DOWNLOAD',
      details: { deliveryId, via: 'recipient_authenticated' },
      req,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${meta.fileName || 'document.pdf'}"`);
    fs.createReadStream(delivery.file_path).pipe(res);
  } catch (err) {
    console.error('[recipient] downloadMyDocument error:', err);
    return res.status(500).json({ success: false, message: 'Failed to download the document.' });
  }
}

/**
 * GET /api/recipient/documents/:deliveryId/verify
 * Returns the integrity-verification result for a specific delivery, scoped to
 * the current recipient.  Reads the live file hash and compares to the stored one
 * — the same logic the public /api/verify endpoint uses, but here it is gated
 * so only the document's recipient can call it from their authenticated area.
 */
async function verifyMyDocument(req, res) {
  const { deliveryId } = req.params;
  const { email } = req.user;
  const crypto = require('crypto');

  try {
    const [[delivery]] = await pool.query(
      `SELECT dd.recipient_email, gd.id AS doc_row_id, gd.doc_uuid, gd.file_path,
              gd.file_hash, gd.status AS doc_status, gd.generated_at
       FROM document_deliveries dd
       JOIN generated_docs gd ON gd.id = dd.doc_id
       WHERE dd.id = ?`,
      [deliveryId]
    );

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery record not found.' });
    }
    if (delivery.recipient_email !== email) {
      return res.status(403).json({ success: false, message: 'This document was not delivered to your account.' });
    }

    let verified = false;
    let recomputedHash = null;
    let message = 'File is no longer available on the server.';

    if (fs.existsSync(delivery.file_path)) {
      const buf = fs.readFileSync(delivery.file_path);
      recomputedHash = crypto.createHash('sha256').update(buf).digest('hex');
      verified = recomputedHash === delivery.file_hash;
      message = verified
        ? 'Document is authentic and untampered.'
        : 'Document hash mismatch — file may have been tampered with.';
    }

    await recordAudit({ userId: req.user.id, docId: delivery.doc_row_id, action: 'VERIFY', details: { via: 'recipient_authenticated', result: verified ? 'authentic' : 'tampered' }, req });

    return res.status(200).json({
      success: true,
      data: {
        verified,
        message,
        docId: delivery.doc_uuid,
        docStatus: delivery.doc_status,
        generatedAt: delivery.generated_at,
        storedHash: delivery.file_hash,
        recomputedHash,
      },
    });
  } catch (err) {
    console.error('[recipient] verifyMyDocument error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
}

module.exports = { listMyDeliveries, downloadMyDocument, verifyMyDocument };
