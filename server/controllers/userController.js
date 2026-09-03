const db      = require('../config/db');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const dns     = require('dns').promises;
const fs      = require('fs');
const path    = require('path');
const {
  sendEmailVerificationEmail,
  sendPasswordChangedEmail,
} = require('../services/emailService');

// ── Helper: verify the domain of an email has real MX records ────────────────
// This catches fake domains (e.g. test@fakecompany.xyz) before we send anything.
async function hasMxRecord(email) {
  try {
    const domain  = email.split('@')[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false; // NXDOMAIN or timeout → treat as invalid
  }
}

// ── Helper: generate a secure random token ───────────────────────────────────
function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex
}

// ── GET /api/users/me/settings ────────────────────────────────────────────────
exports.getMySettings = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, full_name, email, phone, avatar_url, signature_url, role, department,
              language, theme, notification_email, session_timeout_minutes
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    // Also check if there is a pending email change for this user
    const [pending] = await db.query(
      `SELECT new_email FROM email_verifications
       WHERE user_id = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      ...rows[0],
      pending_email: pending.length > 0 ? pending[0].new_email : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load account settings', error: err.message });
  }
};

// ── PUT /api/users/me/settings ────────────────────────────────────────────────
// Saves only non-email profile fields: name, phone, language, theme, prefs.
// Email is intentionally excluded — use POST /me/change-email separately.
exports.updateMySettings = async (req, res) => {
  const {
    full_name, phone, language,
    theme, notification_email, session_timeout_minutes,
  } = req.body;

  if (!full_name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  const timeout = Number(session_timeout_minutes);
  if (!Number.isInteger(timeout) || timeout < 5 || timeout > 1440) {
    return res.status(400).json({ message: 'Session timeout must be between 5 and 1440 minutes' });
  }
  if (!['en', 'am'].includes(language) || !['system', 'light', 'dark'].includes(theme)) {
    return res.status(400).json({ message: 'Invalid language or theme preference' });
  }

  try {
    await db.query(
      `UPDATE users
       SET full_name = ?, phone = ?, language = ?, theme = ?,
           notification_email = ?, session_timeout_minutes = ?
       WHERE id = ?`,
      [
        full_name, phone || null, language, theme,
        notification_email ? 1 : 0, timeout, req.user.id,
      ]
    );

    const [updated] = await db.query(
      `SELECT id, full_name, email, phone, avatar_url, role, department,
              language, theme, notification_email, session_timeout_minutes
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    // Also return any currently pending email verification
    const [pending] = await db.query(
      `SELECT new_email FROM email_verifications
       WHERE user_id = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      ...updated[0],
      pending_email: pending.length > 0 ? pending[0].new_email : null,
    });

  } catch (err) {
    console.error('updateMySettings error:', err.message);
    res.status(500).json({ message: 'Failed to save account settings', error: err.message });
  }
};

// ── POST /api/users/me/change-email ──────────────────────────────────────────
// Dedicated endpoint for email change — completely separate from profile save.
// Steps:
//   1. Validate format
//   2. MX record check (real domain)
//   3. Uniqueness check
//   4. Idempotency guard (60-second window prevents double-fire)
//   5. Invalidate older pending tokens
//   6. Generate + store new token (SHA-256 hash only)
//   7. Send verification email to new address
//   8. Write EMAIL_CHANGE_REQUESTED audit log
exports.changeEmail = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required' });
  }

  const trimmed = email.trim().toLowerCase();

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  try {
    // Load current user
    const [userRows] = await db.query(
      'SELECT id, email, full_name FROM users WHERE id = ?',
      [req.user.id]
    );
    if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });
    const currentUser = userRows[0];

    // No change at all
    if (trimmed === currentUser.email.toLowerCase()) {
      return res.status(400).json({ message: 'That is already your current email address' });
    }

    // Uniqueness check — no other account may use this email
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id <> ?',
      [trimmed, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This email address is already registered to another account.' });
    }

    // MX record check — confirms the domain is a real mail server
    console.log(`[EMAIL-CHANGE] MX check for domain: ${trimmed.split('@')[1]}`);
    const mxValid = await hasMxRecord(trimmed);
    if (!mxValid) {
      return res.status(422).json({
        message: `The domain "${trimmed.split('@')[1]}" does not appear to be a real email domain. Please use a valid email address.`,
      });
    }

    // ── Rate-limit: max 3 verification emails per user per hour ──────────────
    const [recentCount] = await db.query(
      `SELECT COUNT(*) AS cnt FROM email_verifications
       WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [req.user.id]
    );
    if (recentCount[0].cnt >= 3) {
      return res.status(429).json({
        message: 'Too many email change requests. Please wait before trying again (max 3 per hour).',
      });
    }

    // ── Idempotency guard: same target email, created < 60 seconds ago ───────
    const [recentRows] = await db.query(
      `SELECT id FROM email_verifications
       WHERE user_id = ? AND new_email = ? AND status = 'pending'
         AND expires_at > NOW()
         AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, trimmed]
    );
    if (recentRows.length > 0) {
      console.log(`[EMAIL-CHANGE] Idempotency hit — returning existing token for ${trimmed}`);
      return res.json({
        email:             currentUser.email,
        pending_email:     trimmed,
        email_verify_sent: true,
        message:           `A verification email was already sent to ${trimmed}. Please check your inbox.`,
      });
    }

    // Invalidate all previous pending verifications for this user
    await db.query(
      `UPDATE email_verifications
       SET used = 1, status = 'cancelled', cancelled_at = NOW()
       WHERE user_id = ? AND status = 'pending'`,
      [req.user.id]
    );

    // Generate secure random token — store ONLY the SHA-256 hash in DB
    const rawToken  = generateToken();  // 64-char hex
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.query(
      `INSERT INTO email_verifications
         (user_id, current_email, new_email, token_hash, expires_at, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, currentUser.email, trimmed, tokenHash, expiresAt]
    );

    const clientUrl  = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyLink = `${clientUrl}/verify-email?token=${rawToken}`;

    console.log(`[EMAIL-CHANGE] Sending verification to: ${trimmed}`);
    console.log(`[EMAIL-CHANGE] User: ${currentUser.full_name} (id=${req.user.id})`);

    try {
      await sendEmailVerificationEmail(trimmed, currentUser.full_name, verifyLink, currentUser.email);
      console.log(`[EMAIL-CHANGE] Sent OK to: ${trimmed}`);
    } catch (emailErr) {
      // Email failed — clean up the token so the user can try again cleanly
      await db.query(
        `UPDATE email_verifications SET used = 1, status = 'cancelled', cancelled_at = NOW()
         WHERE token_hash = ?`,
        [tokenHash]
      );
      console.error(`[EMAIL-CHANGE] Delivery failed for ${trimmed}:`, emailErr.message);
      return res.status(502).json({
        message: `Unable to send verification email to "${trimmed}". Your current email remains unchanged. Please check the address and try again.`,
      });
    }

    // Audit log — EMAIL_CHANGE_REQUESTED
    await db.query(
      `INSERT INTO audit_logs (user_id, action, action_details, ip_address, user_agent)
       VALUES (?, 'EMAIL_CHANGE_REQUESTED', ?, ?, ?)`,
      [
        req.user.id,
        JSON.stringify({ from: currentUser.email, to: trimmed }),
        req.ip,
        req.headers['user-agent'],
      ]
    ).catch(() => {}); // non-fatal

    res.json({
      email:             currentUser.email,
      pending_email:     trimmed,
      email_verify_sent: true,
      message:           `A verification email has been sent to ${trimmed}. Click the link in that email to confirm your new address. Your current email remains active until verified.`,
    });

  } catch (err) {
    console.error('changeEmail error:', err.message);
    res.status(500).json({ message: 'Failed to request email change', error: err.message });
  }
};

// ── GET /api/users/verify-email?token=... ─────────────────────────────────────
// Public endpoint — called when Approver/any user clicks the verification link.
// Validates token → updates users.email → marks token used → audit logs.
exports.verifyEmailChange = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token is required' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await db.query(
      `SELECT ev.*, u.full_name, u.email AS current_email
       FROM email_verifications ev
       JOIN users u ON u.id = ev.user_id
       WHERE ev.token_hash = ? AND ev.status = 'pending' AND ev.used = 0`,
      [tokenHash]
    );

    if (rows.length === 0) {
      // Distinguish between used and never-existed
      const [usedRows] = await db.query(
        'SELECT status FROM email_verifications WHERE token_hash = ?',
        [tokenHash]
      );
      if (usedRows.length > 0 && usedRows[0].status === 'verified') {
        return res.status(410).json({ message: 'This verification link has already been used.' });
      }
      if (usedRows.length > 0 && usedRows[0].status === 'cancelled') {
        return res.status(410).json({ message: 'This verification link was cancelled.' });
      }
      return res.status(404).json({ message: 'This verification link is invalid or has already been used.' });
    }

    const record = rows[0];

    // Expiry check
    if (new Date() > new Date(record.expires_at)) {
      await db.query(
        `UPDATE email_verifications SET status = 'expired', used = 1
         WHERE token_hash = ?`,
        [tokenHash]
      );
      return res.status(410).json({
        message: 'This verification link has expired (24-hour limit). Please request a new email change from your settings.',
      });
    }

    // Race condition: new email claimed by another account between request and verify
    const [conflict] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id <> ?',
      [record.new_email, record.user_id]
    );
    if (conflict.length > 0) {
      await db.query(
        `UPDATE email_verifications SET status = 'cancelled', used = 1, cancelled_at = NOW()
         WHERE token_hash = ?`,
        [tokenHash]
      );
      return res.status(409).json({
        message: 'That email address was claimed by another account before you verified it. Please request a new email change.',
      });
    }

    const oldEmail = record.current_email || record.current_email_fallback || rows[0].current_email;

    // ── Apply the email change ────────────────────────────────────────────────
    await db.query(
      'UPDATE users SET email = ?, email_verified_at = NOW() WHERE id = ?',
      [record.new_email, record.user_id]
    );

    // Mark token as verified (used=1 + status=verified + verified_at)
    await db.query(
      `UPDATE email_verifications
       SET used = 1, status = 'verified', verified_at = NOW()
       WHERE token_hash = ?`,
      [tokenHash]
    );

    // Invalidate any other pending tokens for this user (cleanup)
    await db.query(
      `UPDATE email_verifications
       SET used = 1, status = 'cancelled', cancelled_at = NOW()
       WHERE user_id = ? AND status = 'pending' AND token_hash <> ?`,
      [record.user_id, tokenHash]
    );

    // Audit logs — EMAIL_CHANGE_VERIFIED + EMAIL_CHANGED
    const auditDetails = JSON.stringify({ from: oldEmail, to: record.new_email });
    await db.query(
      `INSERT INTO audit_logs (user_id, action, action_details)
       VALUES (?, 'EMAIL_CHANGE_VERIFIED', ?), (?, 'EMAIL_CHANGED', ?)`,
      [record.user_id, auditDetails, record.user_id, auditDetails]
    ).catch(() => {});

    console.log(`[EMAIL-VERIFY] Email changed: ${oldEmail} → ${record.new_email} (user ${record.user_id})`);

    return res.json({
      message:   'Email address updated successfully.',
      new_email: record.new_email,
    });

  } catch (err) {
    console.error('verifyEmailChange error:', err.message);
    res.status(500).json({ message: 'Server error during verification', error: err.message });
  }
};

// ── POST /api/users/me/cancel-email-change ────────────────────────────────────
// Cancels the current pending email change — user keeps their existing email.
exports.cancelEmailChange = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, new_email FROM email_verifications
       WHERE user_id = ? AND status = 'pending' AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No pending email change found.' });
    }

    await db.query(
      `UPDATE email_verifications
       SET used = 1, status = 'cancelled', cancelled_at = NOW()
       WHERE user_id = ? AND status = 'pending'`,
      [req.user.id]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, action_details, ip_address, user_agent)
       VALUES (?, 'EMAIL_CHANGE_CANCELLED', ?, ?, ?)`,
      [
        req.user.id,
        JSON.stringify({ cancelled_pending_email: rows[0].new_email }),
        req.ip,
        req.headers['user-agent'],
      ]
    ).catch(() => {});

    console.log(`[EMAIL-CHANGE] Cancelled pending change to ${rows[0].new_email} for user ${req.user.id}`);

    res.json({ message: 'Email change cancelled. Your current email remains active.' });

  } catch (err) {
    console.error('cancelEmailChange error:', err.message);
    res.status(500).json({ message: 'Failed to cancel email change', error: err.message });
  }
};

// ── POST /api/users/me/resend-email-verification ──────────────────────────────
// Resends the verification email for the current pending email change.
// Rate-limited: max 3 total requests per hour across all endpoints.
// Invalidates the previous token and generates a fresh one.
exports.resendEmailVerification = async (req, res) => {
  try {
    const [userRows] = await db.query(
      'SELECT id, email, full_name FROM users WHERE id = ?',
      [req.user.id]
    );
    if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });
    const currentUser = userRows[0];

    // Find current pending change
    const [pending] = await db.query(
      `SELECT id, new_email, current_email FROM email_verifications
       WHERE user_id = ? AND status = 'pending' AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (pending.length === 0) {
      return res.status(404).json({ message: 'No active pending email change found. Please request a new email change from settings.' });
    }

    // Rate-limit check: max 3 per hour total
    const [recentCount] = await db.query(
      `SELECT COUNT(*) AS cnt FROM email_verifications
       WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [req.user.id]
    );
    if (recentCount[0].cnt >= 3) {
      return res.status(429).json({
        message: 'Too many verification emails sent. Please wait before resending (max 3 per hour).',
      });
    }

    const targetEmail = pending[0].new_email;

    // Invalidate old token
    await db.query(
      `UPDATE email_verifications
       SET used = 1, status = 'cancelled', cancelled_at = NOW()
       WHERE user_id = ? AND status = 'pending'`,
      [req.user.id]
    );

    // Generate fresh token
    const rawToken  = generateToken();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO email_verifications
         (user_id, current_email, new_email, token_hash, expires_at, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, currentUser.email, targetEmail, tokenHash, expiresAt]
    );

    const clientUrl  = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyLink = `${clientUrl}/verify-email?token=${rawToken}`;

    console.log(`[EMAIL-RESEND] Resending verification to: ${targetEmail} for user ${req.user.id}`);

    try {
      await sendEmailVerificationEmail(targetEmail, currentUser.full_name, verifyLink, currentUser.email);
      console.log(`[EMAIL-RESEND] Sent OK to: ${targetEmail}`);
    } catch (emailErr) {
      await db.query(
        `UPDATE email_verifications SET used = 1, status = 'cancelled', cancelled_at = NOW()
         WHERE token_hash = ?`,
        [tokenHash]
      );
      console.error(`[EMAIL-RESEND] Delivery failed for ${targetEmail}:`, emailErr.message);
      return res.status(502).json({
        message: `Unable to send verification email to "${targetEmail}". Please try again shortly.`,
      });
    }

    res.json({
      pending_email:     targetEmail,
      email_verify_sent: true,
      message:           `A new verification email has been sent to ${targetEmail}.`,
    });

  } catch (err) {
    console.error('resendEmailVerification error:', err.message);
    res.status(500).json({ message: 'Failed to resend verification', error: err.message });
  }
};

// ── POST /api/users/me/avatar ─────────────────────────────────────────────────
exports.updateMyAvatar = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Profile photo is required' });
  try {
    const avatarUrl = `/uploads/${req.file.filename}`;
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.id]);
    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save profile photo', error: err.message });
  }
};

// ── POST /users/me/signature ──────────────────────────────────────────────────
exports.uploadSignature = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Signature image is required' });
  try {
    const [rows] = await db.query('SELECT signature_url FROM users WHERE id = ?', [req.user.id]);
    const old = rows[0]?.signature_url;
    if (old) {
      const oldPath = path.join(__dirname, '..', 'storage', 'uploads', path.basename(old));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const signatureUrl = `/uploads/${req.file.filename}`;
    await db.query('UPDATE users SET signature_url = ? WHERE id = ?', [signatureUrl, req.user.id]);
    res.json({ signature_url: signatureUrl });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save signature image', error: err.message });
  }
};

// ── GET /api/users ────────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, full_name, email, phone, role, department, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/users/approvers ──────────────────────────────────────────────────
exports.getApprovers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, full_name, email, role
       FROM users
       WHERE role IN ('approver', 'super_admin', 'system_admin') AND is_active = 1
       ORDER BY full_name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/users ───────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  const { full_name, email, password, role, department } = req.body;
  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ message: 'full_name, email, password, role are required' });
  }

  // Format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  // MX record check for new user emails
  const mxValid = await hasMxRecord(email);
  if (!mxValid) {
    return res.status(422).json({
      message: `The domain "${email.split('@')[1]}" does not appear to be a real email domain.`,
    });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, hash, role, department || null]
    );
    res.status(201).json({ message: 'User created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  const { full_name, phone, department, is_active } = req.body;
  try {
    await db.query(
      'UPDATE users SET full_name = ?, phone = ?, department = ?, is_active = ? WHERE id = ?',
      [full_name, phone || null, department || null, is_active, req.params.id]
    );
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PATCH /api/users/:id/role ─────────────────────────────────────────────────
exports.changeRole = async (req, res) => {
  const { role } = req.body;
  const validRoles = ['super_admin', 'system_admin', 'generator', 'approver', 'recipient'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  try {
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/users/change-password ──────────────────────────────────────────
// After successful password change, sends a security notification email.
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Both current and new password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    // Fire-and-forget security notification — don't block the response
    setImmediate(async () => {
      try {
        await sendPasswordChangedEmail(rows[0].email, rows[0].full_name);
      } catch (e) {
        console.error('[PasswordChanged Email] Failed:', e.message);
      }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
