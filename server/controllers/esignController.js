const db                = require('../config/db');
const bcrypt            = require('bcryptjs');
const crypto            = require('crypto');
const path              = require('path');
const fs                = require('fs');
const { sendOtpEmail, sendSignatureRequestWithOtpEmail, sendDocSignedEmail, sendDocRejectedEmail } = require('../services/emailService');
const { computeHMAC, generatePDF, MAX_PDF_BYTES } = require('../services/pdfService');

// ── FR-021: Generator requests signature from Approver ──────────────────────
exports.requestSignature = async (req, res) => {
  const { doc_id, approver_id } = req.body;

  const [docs] = await db.query('SELECT * FROM generated_docs WHERE id = ?', [doc_id]);
  if (docs.length === 0) return res.status(404).json({ message: 'Document not found' });
  if (docs[0].status !== 'draft') return res.status(400).json({ message: 'Document must be in draft status' });

  // BR-002: Block signing if the document file exceeds 5 MB
  if (docs[0].file_path) {
    try {
      const absolutePath = path.join(__dirname, '..', docs[0].file_path);
      const stats        = fs.statSync(absolutePath);
      if (stats.size > MAX_PDF_BYTES) {
        return res.status(413).json({
          message: `This document is ${(stats.size / 1024 / 1024).toFixed(2)} MB, which exceeds the 5 MB signing limit (BR-002). Please regenerate the document with reduced content.`,
        });
      }
    } catch {
      // File missing or unreadable — let the existing flow handle it downstream
    }
  }

  // BR-003: Self-approval not allowed
  if (docs[0].generated_by === approver_id) {
    return res.status(403).json({ message: 'Self-approval is not allowed (BR-003)' });
  }

  const [approvers] = await db.query('SELECT * FROM users WHERE id = ? AND role = ?', [approver_id, 'approver']);
  if (approvers.length === 0) return res.status(404).json({ message: 'Approver not found' });

  // ── FR-022: Generate a secure one-time review token ──────────────────────
  // Raw token goes in the email link. Only the SHA-256 hash is stored in DB.
  const rawReviewToken  = crypto.randomBytes(32).toString('hex'); // 64-char hex
  const reviewTokenHash = crypto.createHash('sha256').update(rawReviewToken).digest('hex');

  const [insertResult] = await db.query(
    `INSERT INTO signature_requests
       (doc_id, approver_id, status, review_token_hash, review_token_used)
     VALUES (?, ?, 'pending', ?, 0)`,
    [doc_id, approver_id, reviewTokenHash]
  );
  const requestId = insertResult.insertId;

  await db.query('UPDATE generated_docs SET status = ? WHERE id = ?', ['pending', doc_id]);

  await db.query(
    'INSERT INTO audit_logs (user_id, doc_id, action, action_details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, doc_id, 'SIGN', JSON.stringify({ step: 'requested', approver_id }), req.ip, req.headers['user-agent']]
  );

  const [generatorRows] = await db.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  const generatorName   = generatorRows[0]?.full_name || 'A team member';

  // ── FR-022/FR-023: Generate OTP immediately alongside the review token.
  // Both are sent in one email: the link opens the PDF review page,
  // the OTP is used to confirm identity before approving.
  // BR-004: initial OTP validity = 5 minutes (same as resend).
  const otp     = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);

  // FR-026: Use MySQL DATE_ADD(NOW(),...) so OTP expiry is computed by the
  // same clock as approved_at and audit timestamps, eliminating Node↔DB drift.
  await db.query(
    `UPDATE signature_requests
     SET otp_code = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 5 MINUTE),
         otp_attempts = 0, otp_verified = 0, otp_locked_until = NULL
     WHERE id = ?`,
    [otpHash, requestId]
  );

  // Bell notification — link goes to the dedicated review page
  const clientUrl   = process.env.CLIENT_URL || 'http://localhost:5173';
  const reviewLink  = `${clientUrl}/review/${rawReviewToken}`;

  await db.query(
    `INSERT INTO notifications (user_id, type, title, body, link, doc_uuid)
    VALUES (?, 'approval', ?, ?, ?, ?)`,
    [
      approver_id,
      'Signature Request',
      `${generatorName} has requested your e-signature on document ${docs[0].doc_uuid}`,
      `/review/${rawReviewToken}`,
      docs[0].doc_uuid,
    ]
  ).catch(() => {});

  // Single email: review link + OTP (FR-022 + FR-023 combined)
  await sendSignatureRequestWithOtpEmail(
    approvers[0].email,
    approvers[0].full_name,
    docs[0].doc_uuid,
    generatorName,
    otp,
    reviewLink
  ).catch(() => {});

  res.json({ message: 'Signature request sent' });
};

// ── FR-022: GET /api/esign/review/:token ─────────────────────────────────────
// Called by DocumentReviewPage when it loads.
// Validates the review token → returns request metadata so the page can render.
// The token is NOT marked used here — only after the approver actually approves
// or rejects. This lets the approver reload the page if needed.
exports.getReviewByToken = async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ message: 'Token is required' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const [rows] = await db.query(
    `SELECT sr.id, sr.doc_id, sr.status, sr.otp_verified,
            sr.rejection_reason, sr.created_at, sr.review_token_used,
            gd.doc_uuid, gd.file_hash, gd.record_identifier,
            t.name AS template_name, t.category AS template_category,
            gen.full_name AS generator_name,
            app.full_name AS approver_name, app.id AS approver_id
     FROM signature_requests sr
     JOIN generated_docs gd ON gd.id = sr.doc_id
     JOIN templates t       ON t.id  = gd.template_id
     JOIN users gen         ON gen.id = gd.generated_by
     JOIN users app         ON app.id = sr.approver_id
     WHERE sr.review_token_hash = ?`,
    [tokenHash]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: 'This review link is invalid or has expired.' });
  }

  const request = rows[0];

  if (request.status !== 'pending') {
    return res.status(410).json({
      message: request.status === 'approved'
        ? 'This document has already been approved.'
        : 'This document has already been rejected.',
      status: request.status,
    });
  }

  res.json({
    request_id:         request.id,
    doc_id:             request.doc_id,
    doc_uuid:           request.doc_uuid,
    file_hash:          request.file_hash,
    record_identifier:  request.record_identifier,
    template_name:      request.template_name,
    template_category:  request.template_category,
    generator_name:     request.generator_name,
    approver_name:      request.approver_name,
    approver_id:        request.approver_id,
    requested_at:       request.created_at,
    otp_verified:       !!request.otp_verified,
    // PDF download URL — authenticated endpoint
    pdf_url:            `/api/documents/${request.doc_id}/download`,
  });
};

// ── FR-023: Send OTP to approver ────────────────────────────────────────────
// BR-004: Resend is blocked for the full 15-minute lockout window.
//         A new OTP invalidates the previous one (otp_verified reset to 0).
exports.sendOtp = async (req, res) => {
  const { request_id } = req.body;

  const [rows] = await db.query(
    `SELECT sr.*, u.email, u.full_name, gd.doc_uuid
     FROM signature_requests sr
     JOIN users u ON u.id = sr.approver_id
     JOIN generated_docs gd ON gd.id = sr.doc_id
     WHERE sr.id = ?`,
    [request_id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Signature request not found' });

  const request = rows[0];
  if (request.status !== 'pending') return res.status(400).json({ message: 'Request is not pending' });

  // BR-004: Resend must NOT bypass the 15-minute lockout
  if (request.otp_locked_until && new Date() < new Date(request.otp_locked_until)) {
    const secsLeft = Math.ceil((new Date(request.otp_locked_until) - new Date()) / 1000);
    const minsLeft = Math.ceil(secsLeft / 60);
    return res.status(429).json({
      message: `OTP is locked after 3 failed attempts. Please wait ${minsLeft} minute${minsLeft === 1 ? '' : 's'} before requesting a new OTP.`,
      locked:          true,
      locked_until:    request.otp_locked_until,
      retry_after_sec: secsLeft,
    });
  }

  const otp     = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);

  // FR-026: MySQL clock for OTP expiry — same clock as approved_at / audit logs
  await db.query(
    `UPDATE signature_requests
     SET otp_code = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 5 MINUTE),
         otp_attempts = 0, otp_verified = 0, otp_locked_until = NULL
     WHERE id = ?`,
    [otpHash, request_id]
  );

  await sendOtpEmail(request.email, request.full_name, otp, request.doc_uuid);

  res.json({ message: 'OTP sent to approver email' });
};

// ── FR-023: Verify OTP — marks otp_verified = 1 in DB ───────────────────────
// BR-004 rules enforced here (all server-side):
//   • Max 3 attempts — 4th attempt and beyond are blocked regardless of value.
//   • 15-minute lockout set on the 3rd failure — resend is also blocked.
//   • otp_code cleared after successful verify to prevent replay.
//   • locked_until and retry_after_sec returned so frontend can show countdown.
exports.verifyOtp = async (req, res) => {
  const { request_id, otp } = req.body;

  const [rows] = await db.query('SELECT * FROM signature_requests WHERE id = ?', [request_id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Request not found' });

  const request = rows[0];

  // ── BR-004: Active lockout check (takes priority over everything else) ──
  if (request.otp_locked_until && new Date() < new Date(request.otp_locked_until)) {
    const secsLeft = Math.ceil((new Date(request.otp_locked_until) - new Date()) / 1000);
    const minsLeft = Math.ceil(secsLeft / 60);
    return res.status(429).json({
      message:         `Too many failed attempts. OTP is locked for ${minsLeft} more minute${minsLeft === 1 ? '' : 's'}.`,
      locked:          true,
      locked_until:    request.otp_locked_until,
      retry_after_sec: secsLeft,
    });
  }

  if (!request.otp_code) {
    return res.status(400).json({ message: 'No OTP has been sent for this request. Request an OTP first.' });
  }

  if (new Date() > new Date(request.otp_expiry)) {
    return res.status(400).json({ message: 'OTP has expired (5-minute limit). Request a new OTP.' });
  }

  const valid = await bcrypt.compare(otp, request.otp_code);

  if (!valid) {
    const usedAfterThis = request.otp_attempts + 1;
    const remaining     = 3 - usedAfterThis; // 2 → 1 → 0

    if (remaining <= 0) {
      // 3rd failure — set 15-minute lockout using MySQL clock (FR-026)
      await db.query(
        `UPDATE signature_requests
         SET otp_attempts = ?, otp_locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
             otp_code = NULL
         WHERE id = ?`,
        [usedAfterThis, request_id]
      );
      // Read back the DB-generated locked_until so the frontend gets the exact value
      const [[lockRow]] = await db.query(
        'SELECT otp_locked_until FROM signature_requests WHERE id = ?',
        [request_id]
      );
      const lockedUntil = lockRow.otp_locked_until;
      return res.status(429).json({
        message:         'All 3 attempts used. OTP locked for 15 minutes. You cannot resend during this time.',
        locked:          true,
        locked_until:    lockedUntil,
        retry_after_sec: 15 * 60,
      });
    }

    // Still has attempts remaining — increment counter only
    await db.query(
      'UPDATE signature_requests SET otp_attempts = ? WHERE id = ?',
      [usedAfterThis, request_id]
    );
    return res.status(401).json({
      message:           `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      attempts_remaining: remaining,
    });
  }

  // ✅ Correct OTP — mark verified, clear otp_code to prevent replay, reset attempts
  await db.query(
    `UPDATE signature_requests
     SET otp_verified = 1, otp_attempts = 0,
         otp_code = NULL, otp_locked_until = NULL
     WHERE id = ?`,
    [request_id]
  );

  res.json({ message: 'OTP verified successfully', request_id });
};

// ── FR-024: Approve document — requires prior OTP verification ───────────────
exports.approveDocument = async (req, res) => {
  const { request_id } = req.body;

  const [rows] = await db.query(
    `SELECT sr.*, gd.doc_uuid, gd.file_hash, gd.id AS doc_id_int,
            u.full_name AS approver_name
     FROM signature_requests sr
     JOIN generated_docs gd ON gd.id = sr.doc_id
     JOIN users u ON u.id = sr.approver_id
     WHERE sr.id = ?`,
    [request_id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Request not found' });

  const request = rows[0];

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'This request is no longer pending' });
  }

  // ── BR-003 server-side: Approver cannot approve a document they generated ──
  // This is enforced again here (not just at requestSignature) so that even if
  // a document was somehow routed incorrectly, the approve endpoint blocks it.
  const [docRows] = await db.query(
    'SELECT generated_by FROM generated_docs WHERE id = ?',
    [request.doc_id]
  );
  if (docRows.length > 0 && docRows[0].generated_by === req.user.id) {
    return res.status(403).json({
      message: 'You cannot approve a document you generated.',
    });
  }

  // ✅ Security gate: OTP must have been verified first
  if (!request.otp_verified) {
    return res.status(403).json({
      message: 'OTP verification is required before approving. Please verify the OTP first.'
    });
  }

  const secret    = process.env.JWT_SECRET;
  const hmac      = computeHMAC(request.file_hash, secret);

  // FR-026: Fetch server time from MySQL so the signature timestamp is on the
  // same clock as approved_at — never trust the Node process clock for this.
  const [[timeRow]] = await db.query('SELECT UTC_TIMESTAMP() AS now_utc');
  const signedAt   = new Date(timeRow.now_utc).toISOString();
  const visualText = `Digitally Approved by ${request.approver_name} on ${signedAt}`;

  await db.query(
    'INSERT INTO digital_signatures (doc_id, signer_id, crypto_hmac, visual_signature_text) VALUES (?, ?, ?, ?)',
    [request.doc_id, request.approver_id, hmac, visualText]
  );

  await db.query(
    'UPDATE signature_requests SET status = ?, approved_at = NOW() WHERE id = ?',
    ['approved', request_id]
  );
  await db.query(
    'UPDATE generated_docs SET status = ? WHERE id = ?',
    ['signed', request.doc_id]
  );

  await db.query(
    'INSERT INTO audit_logs (user_id, doc_id, action, action_details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, request.doc_id, 'SIGN', JSON.stringify({ step: 'approved', hmac }), req.ip, req.headers['user-agent']]
  );

  const [genRows] = await db.query(
    'SELECT email, full_name, id FROM users WHERE id = (SELECT generated_by FROM generated_docs WHERE id = ?)',
    [request.doc_id]
  );
  if (genRows.length > 0) {
    // Bell notification to generator
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, link, doc_uuid)
       VALUES (?, 'signed', ?, ?, '/documents', ?)`,
      [
        genRows[0].id,
        'Document Signed',
        `${request.approver_name} has approved and signed document ${request.doc_uuid}`,
        request.doc_uuid,
      ]
    ).catch(() => {}); // non-fatal

    await sendDocSignedEmail(genRows[0].email, genRows[0].full_name, request.doc_uuid, request.approver_name).catch(() => {});
  }

  res.json({ message: 'Document approved and signed', hmac });
};

// ── FR-025: Reject document ──────────────────────────────────────────────────
exports.rejectDocument = async (req, res) => {
  const { request_id, rejection_reason } = req.body;
  if (!rejection_reason) return res.status(400).json({ message: 'rejection_reason is required' });

  const [rows] = await db.query(
    `SELECT sr.*, gd.id AS doc_id, u.email AS generator_email,
            u.full_name AS generator_name, gd.doc_uuid,
            a.full_name AS approver_name
     FROM signature_requests sr
     JOIN generated_docs gd ON gd.id = sr.doc_id
     JOIN users u ON u.id = gd.generated_by
     JOIN users a ON a.id = sr.approver_id
     WHERE sr.id = ?`,
    [request_id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Request not found' });

  const request = rows[0];

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'This request is no longer pending' });
  }

  await db.query(
    'UPDATE signature_requests SET status = ?, rejection_reason = ? WHERE id = ?',
    ['rejected', rejection_reason, request_id]
  );
  await db.query('UPDATE generated_docs SET status = ? WHERE id = ?', ['draft', request.doc_id]);

  // Bell notification to generator
  await db.query(
    `INSERT INTO notifications (user_id, type, title, body, link, doc_uuid)
     VALUES (?, 'rejected', ?, ?, '/documents', ?)`,
    [
      // generated_by is on the docs table — fetch via the join result
      (await db.query('SELECT generated_by FROM generated_docs WHERE id = ?', [request.doc_id]))[0][0]?.generated_by,
      'Document Rejected',
      `${request.approver_name} rejected document ${request.doc_uuid}: ${rejection_reason}`,
      request.doc_uuid,
    ]
  ).catch(() => {}); // non-fatal

  await sendDocRejectedEmail(
    request.generator_email, request.generator_name,
    request.doc_uuid, request.approver_name, rejection_reason
  ).catch(() => {});

  await db.query(
    'INSERT INTO audit_logs (user_id, doc_id, action, action_details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, request.doc_id, 'SIGN', JSON.stringify({ step: 'rejected', rejection_reason }), req.ip, req.headers['user-agent']]
  );

  res.json({ message: 'Document rejected. Generator has been notified.' });
};

// ── Get requests for the logged-in approver/admin with optional status filter ─
// GET /api/esign/pending?status=pending   (default when omitted)
// GET /api/esign/pending?status=approved
// GET /api/esign/pending?status=rejected
// GET /api/esign/pending?status=all       (all statuses combined)
exports.getPendingRequests = async (req, res) => {
  const VALID_STATUSES = ['pending', 'approved', 'rejected'];
  const requestedStatus = req.query.status;
  const isAdmin = req.user.role === 'super_admin' || req.user.role === 'system_admin';

  // Build WHERE clause based on role and requested status
  let whereClause;
  let params;

  if (requestedStatus === 'all') {
    // 'all' → no status filter, but still scope by approver unless admin
    if (isAdmin) {
      whereClause = '';
      params = [];
    } else {
      whereClause = 'WHERE sr.approver_id = ?';
      params = [req.user.id];
    }
  } else {
    const status = VALID_STATUSES.includes(requestedStatus) ? requestedStatus : 'pending';
    if (isAdmin) {
      // Admins see ALL requests regardless of which approver was assigned
      whereClause = 'WHERE sr.status = ?';
      params = [status];
    } else {
      // Approvers only see their own assigned requests
      whereClause = 'WHERE sr.approver_id = ? AND sr.status = ?';
      params = [req.user.id, status];
    }
  }

  const [rows] = await db.query(
    `SELECT sr.*, gd.doc_uuid, gd.status AS doc_status, gd.file_hash,
            t.name AS template_name, t.category AS template_category,
            u.full_name AS generator_name,
            a.full_name AS approver_name, a.email AS approver_email
     FROM signature_requests sr
     JOIN generated_docs gd ON gd.id = sr.doc_id
     JOIN templates t ON t.id = gd.template_id
     JOIN users u ON u.id = gd.generated_by
     JOIN users a ON a.id = sr.approver_id
     ${whereClause}
     ORDER BY sr.id DESC`,
    params
  );
  res.json(rows);
};
