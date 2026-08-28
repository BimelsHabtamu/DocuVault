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
// Email change is two-step:
//   1. Validate format + MX record
//   2. Insert into email_verifications, send verification email to NEW address
//   3. Current email in users table stays unchanged
//   4. Only after clicking the link (verifyEmailChange) does the DB update happen
exports.updateMySettings = async (req, res) => {
  const {
    full_name, email, phone, language,
    theme, notification_email, session_timeout_minutes,
  } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  const timeout = Number(session_timeout_minutes);
  if (!Number.isInteger(timeout) || timeout < 5 || timeout > 1440) {
    return res.status(400).json({ message: 'Session timeout must be between 5 and 1440 minutes' });
  }
  if (!['en', 'am'].includes(language) || !['system', 'light', 'dark'].includes(theme)) {
    return res.status(400).json({ message: 'Invalid language or theme preference' });
  }

  try {
    // Load current user
    const [userRows] = await db.query(
      'SELECT id, email, full_name FROM users WHERE id = ?',
      [req.user.id]
    );
    if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });
    const currentUser = userRows[0];
    const emailChanged = email.toLowerCase().trim() !== currentUser.email.toLowerCase().trim();

    // ── Non-email fields: save immediately ───────────────────────────────────
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

    // ── Email change: verify first ────────────────────────────────────────────
    if (emailChanged) {
      // Check no other account already uses this email
      const [existing] = await db.query(
        'SELECT id FROM users WHERE email = ? AND id <> ?',
        [email, req.user.id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: 'That email address is already used by another account' });
      }

      // MX record check — confirms domain is a real mail server
      const mxValid = await hasMxRecord(email);
      if (!mxValid) {
        return res.status(422).json({
          message: `The domain "${email.split('@')[1]}" does not appear to be a real email domain. Please use a valid email address.`,
        });
      }

      // Invalidate any previous pending verifications for this user
      await db.query(
        'UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0',
        [req.user.id]
      );

      // Generate token and store hash
      const rawToken  = generateToken();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query(
        `INSERT INTO email_verifications (user_id, new_email, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, email, tokenHash, expiresAt]
      );

      // Send verification email to the NEW address
      const clientUrl  = process.env.CLIENT_URL || 'http://localhost:5173';
      const verifyLink = `${clientUrl}/verify-email?token=${rawToken}`;

      await sendEmailVerificationEmail(email, full_name, verifyLink, currentUser.email);

      // Return the updated profile — email still shows old value, pending_email shows new
      const [updated] = await db.query(
        `SELECT id, full_name, email, phone, avatar_url, role, department,
                language, theme, notification_email, session_timeout_minutes
         FROM users WHERE id = ?`,
        [req.user.id]
      );

      return res.json({
        ...updated[0],
        pending_email:       email,
        email_verify_sent:   true,
        message: `A verification email has been sent to ${email}. Your email will be updated after you click the link.`,
      });
    }

    // ── No email change: return updated profile as normal ────────────────────
    const [updated] = await db.query(
      `SELECT id, full_name, email, phone, avatar_url, role, department,
              language, theme, notification_email, session_timeout_minutes
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({ ...updated[0], pending_email: null });

  } catch (err) {
    console.error('updateMySettings error:', err.message);
    res.status(500).json({ message: 'Failed to save account settings', error: err.message });
  }
};

// ── GET /api/users/verify-email?token=... ─────────────────────────────────────
// Public endpoint — called when user clicks the verification link in their email.
// Validates token → updates users.email → marks token used → returns success.
exports.verifyEmailChange = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token is required' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await db.query(
      `SELECT ev.*, u.full_name, u.email AS current_email
       FROM email_verifications ev
       JOIN users u ON u.id = ev.user_id
       WHERE ev.token_hash = ? AND ev.used = 0`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'This verification link is invalid or has already been used.' });
    }

    const record = rows[0];
    if (new Date() > new Date(record.expires_at)) {
      return res.status(410).json({ message: 'This verification link has expired. Please request an email change again from your settings.' });
    }

    // Check the new email isn't already taken (race condition guard)
    const [conflict] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id <> ?',
      [record.new_email, record.user_id]
    );
    if (conflict.length > 0) {
      await db.query(
        'UPDATE email_verifications SET used = 1 WHERE token_hash = ?',
        [tokenHash]
      );
      return res.status(409).json({ message: 'That email address was claimed by another account before you could verify it. Please request a new email change.' });
    }

    // Update the email in users table
    await db.query(
      'UPDATE users SET email = ? WHERE id = ?',
      [record.new_email, record.user_id]
    );

    // Mark token as used
    await db.query(
      'UPDATE email_verifications SET used = 1 WHERE token_hash = ?',
      [tokenHash]
    );

    return res.json({
      message: 'Email address updated successfully.',
      new_email: record.new_email,
    });

  } catch (err) {
    console.error('verifyEmailChange error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
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
