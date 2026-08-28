const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is disabled. Contact admin.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id:         user.id,
        full_name:  user.full_name,
        email:      user.email,
        role:       user.role,
        department: user.department,
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, full_name, email, role, department FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/auth/validate-token?token=... ────────────────────────────────────
// Called by the SetPasswordPage on load to check if the token is still valid
// before showing the form. No DB write — read-only check.
exports.validateSetPasswordToken = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token is required' });

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await db.query(
      `SELECT prt.*, u.email, u.full_name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ? AND prt.used = 0`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Invalid or already used link.' });
    }

    const record = rows[0];
    if (new Date() > new Date(record.expires_at)) {
      return res.status(410).json({ message: 'This link has expired. Please contact the sender.' });
    }

    // Return just enough info to personalise the set-password page
    res.json({
      valid:     true,
      email:     record.email,
      full_name: record.full_name,
      doc_uuid:  record.doc_uuid || null,
    });
  } catch (err) {
    console.error('validateSetPasswordToken error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/auth/set-password ───────────────────────────────────────────────
// Recipient submits their chosen password.
// Validates token → hashes password → activates account → returns JWT.
exports.setPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Token and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await db.query(
      `SELECT prt.*, u.email, u.full_name, u.role
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ? AND prt.used = 0`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Invalid or already used link.' });
    }

    const record = rows[0];
    if (new Date() > new Date(record.expires_at)) {
      return res.status(410).json({ message: 'This link has expired. Please contact the sender.' });
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Activate account + set password + mark password_set = 1
    await db.query(
      'UPDATE users SET password_hash = ?, is_active = 1, password_set = 1 WHERE id = ?',
      [passwordHash, record.user_id]
    );

    // Mark token as used (one-time only)
    await db.query(
      'UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?',
      [tokenHash]
    );

    // Issue a JWT so the recipient is automatically logged in
    const jwtToken = jwt.sign(
      { id: record.user_id, role: record.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      message:  'Password set successfully. You are now logged in.',
      token:    jwtToken,
      doc_uuid: record.doc_uuid || null,   // frontend uses this for redirect
      user: {
        id:        record.user_id,
        full_name: record.full_name,
        email:     record.email,
        role:      record.role,
      }
    });
  } catch (err) {
    console.error('setPassword error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
