const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { recordAudit } = require('../utils/auditLog');
const { sendMail, templates } = require('../utils/emailService');
const { getAppSettings } = require('../utils/appSettings');
const { ROLES } = require('../utils/roles');
const { AVATAR_STORAGE_DIR } = require('./uploadController');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const WELCOME_TOKEN_EXPIRY_HOURS = 72; // new users have 72 h to set their password

const ASSIGNABLE_ROLES = [ROLES.SYSTEM_ADMIN, ROLES.GENERATOR, ROLES.APPROVER, ROLES.RECIPIENT];

/** GET /api/users?role=&is_active= */
async function listUsers(req, res) {
  const { role, is_active } = req.query;
  const conditions = [];
  const params = [];
  if (role) { conditions.push('role = ?'); params.push(role); }
  if (is_active !== undefined) { conditions.push('is_active = ?'); params.push(is_active === 'true' ? 1 : 0); }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [rows] = await pool.query(
      `SELECT id, email, full_name, role, phone, organization, is_active, avatar_url, created_at FROM users ${whereClause} ORDER BY created_at DESC`,
      params
    );
    return res.status(200).json({ success: true, message: 'Users fetched.', data: rows });
  } catch (err) {
    console.error('[users] list error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
}


async function createUser(req, res) {
  const { email, full_name, role, phone, organization } = req.body;

  if (!email || !full_name || !role) {
    return res.status(400).json({ success: false, message: 'email, full_name, and role are required.' });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` });
  }

  try {
    const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const placeholderPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(placeholderPassword, 10);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + WELCOME_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    const org = (organization || '').trim();

    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, phone, organization, is_active, reset_token, reset_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [email.trim().toLowerCase(), passwordHash, full_name, role, phone || null, org || null, tokenHash, expires]
    );


    const setPasswordUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

    // has been uploaded, and is simply omitted from the email when there isn't one.
    const appBranding = getAppSettings();
    const orgName = org || appBranding.orgName || '';
    const orgLogoUrl = appBranding.orgLogoUrl || '';

    let emailNote = '';
    try {
      const { subject, html } = templates.welcome({
        fullName: full_name,
        orgName,
        role,
        email: email.trim().toLowerCase(),
        setPasswordUrl,
        orgLogoUrl,
        expiryHours: WELCOME_TOKEN_EXPIRY_HOURS,
      });
      const mailResult = await sendMail({ to: email.trim().toLowerCase(), subject, html });
      if (!mailResult.success && !mailResult.dryRun) {
        emailNote = ' (welcome email could not be delivered — check SMTP settings)';
        console.warn('[users] welcome email send returned failure for', email.trim().toLowerCase());
      }
    } catch (mailErr) {
      emailNote = ' (welcome email could not be delivered — check SMTP settings)';
      console.error('[users] welcome email threw (non-fatal):', mailErr.code || mailErr.message);
    }

    await recordAudit({ userId: req.user.id, action: 'CREATE_USER', details: { newUserId: result.insertId, role, organization: org }, req });

    return res.status(201).json({
      success: true,
      message: `Account created for ${full_name}. A welcome email with a set-password link has been sent to ${email}.${emailNote}`,
      data: { id: result.insertId, email, full_name, role, organization: org },
    });
  } catch (err) {
    console.error('[users] create error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
}

/** PUT /api/users/:id   body: { full_name?, role?, phone? } */
async function updateUser(req, res) {
  const { id } = req.params;
  const { full_name, role, phone } = req.body;

  if (role && !ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` });
  }

  try {
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Super admin accounts cannot be modified through this endpoint.' });
    }

    await pool.query(
      'UPDATE users SET full_name = ?, role = ?, phone = ? WHERE id = ?',
      [full_name ?? user.full_name, role ?? user.role, phone ?? user.phone, id]
    );

    return res.status(200).json({ success: true, message: 'User updated.' });
  } catch (err) {
    console.error('[users] update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
}

/** PATCH /api/users/:id/status   body: { is_active: boolean } */
async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    const [[user]] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Super admin accounts cannot be deactivated.' });
    }

    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    return res.status(200).json({ success: true, message: `User ${is_active ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    console.error('[users] status update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
}

/** PATCH /api/users/:id/reset-password   body: { new_password } */
async function resetPassword(req, res) {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ success: false, message: 'new_password must be at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(new_password, 10);
    const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('[users] reset password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
}


async function deleteUser(req, res) {
  const { id } = req.params;

  try {
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Super admin accounts cannot be deleted.' });
    }
    if (Number(id) === req.user.id) {
      return res.status(403).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const [[{ docCount }]] = await pool.query(
      'SELECT COUNT(*) AS docCount FROM generated_docs WHERE generated_by = ?',
      [id]
    );
    const [[{ approverCount }]] = await pool.query(
      'SELECT COUNT(*) AS approverCount FROM signature_requests WHERE approver_id = ?',
      [id]
    );
    const [[{ signerCount }]] = await pool.query(
      'SELECT COUNT(*) AS signerCount FROM digital_signatures WHERE signer_id = ?',
      [id]
    );

    if (docCount > 0 || approverCount > 0 || signerCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete "${user.full_name}": this account has ${docCount} document(s) and/or ${approverCount + signerCount} signature record(s) linked to it. Deactivate the account instead so that history is preserved.`,
      });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await recordAudit({
      userId: req.user.id,
      action: 'DELETE_USER',
      details: { deletedUserId: Number(id), deletedUserEmail: user.email, deletedUserRole: user.role },
      req,
    });

    return res.status(200).json({ success: true, message: `User "${user.full_name}" deleted successfully.` });
  } catch (err) {
    // Fallback safety net in case a future table adds a users FK without a check above.
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({ success: false, message: 'Cannot delete: this user is still referenced by other records. Deactivate the account instead.' });
    }
    console.error('[users] delete error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
}

async function listApprovers(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name FROM users
       WHERE role = 'approver' AND is_active = 1 AND id != ?
       ORDER BY full_name ASC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, message: 'Approvers fetched.', data: rows });
  } catch (err) {
    console.error('[users] listApprovers error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch approvers.' });
  }
}

async function listRecipients(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, email FROM users
       WHERE role = 'recipient' AND is_active = 1
       ORDER BY full_name ASC`
    );
    return res.status(200).json({ success: true, message: 'Recipients fetched.', data: rows });
  } catch (err) {
    console.error('[users] listRecipients error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch recipients.' });
  }
}


async function updateOwnProfile(req, res) {
  const { full_name, phone, email } = req.body;

  try {
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Email change: validate format + uniqueness (case-insensitive)
    let newEmail = user.email;
    if (email !== undefined && email !== null) {
      const trimmed = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ success: false, message: 'Invalid email address.' });
      }
      if (trimmed !== user.email.toLowerCase()) {
        const [[clash]] = await pool.query(
          'SELECT id FROM users WHERE LOWER(email) = ? AND id != ? LIMIT 1',
          [trimmed, req.user.id]
        );
        if (clash) {
          return res.status(409).json({ success: false, message: 'That email address is already in use.' });
        }
        newEmail = trimmed;
      }
    }

    await pool.query(
      'UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?',
      [full_name ?? user.full_name, phone ?? user.phone, newEmail, req.user.id]
    );

    const [[updated]] = await pool.query(
      'SELECT id, email, full_name, role, phone, avatar_url FROM users WHERE id = ?',
      [req.user.id]
    );

    await recordAudit({ userId: req.user.id, action: 'UPDATE_USER', details: { self: true, emailChanged: newEmail !== user.email }, req });

    return res.status(200).json({ success: true, message: 'Profile updated.', data: updated });
  } catch (err) {
    console.error('[users] update own profile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
}

async function changeOwnPassword(req, res) {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'current_password and new_password are required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ success: false, message: 'new_password must be at least 8 characters.' });
  }

  try {
    const [[user]] = await pool.query('SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const matches = await bcrypt.compare(current_password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (current_password === new_password) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);

    await recordAudit({ userId: req.user.id, action: 'PASSWORD_RESET_COMPLETE', details: { self: true }, req });

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[users] change own password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
}
 // Uploads the file AND persists it as the user's avatar_url in one step (unlike

async function uploadOwnAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded (field name must be "avatar").' });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const publicUrl = `${backendUrl}/uploads/avatars/${req.file.filename}`;

    await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [publicUrl, req.user.id]);
    await recordAudit({ userId: req.user.id, action: 'UPDATE_USER', details: { self: true, avatarUpdated: true }, req });

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated.',
      data: { avatar_url: publicUrl },
    });
  } catch (err) {
    console.error('[users] avatar upload error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload profile photo.' });
  }
}

// Self-service photo removal — clears avatar_url back to NULL (the sidebar then
async function removeOwnAvatar(req, res) {
  try {
    const [[user]] = await pool.query('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.avatar_url) {
      const filename = user.avatar_url.split('/').pop();
      const filePath = path.join(AVATAR_STORAGE_DIR, filename);
      fs.unlink(filePath, () => {
      });
    }

    await pool.query('UPDATE users SET avatar_url = NULL WHERE id = ?', [req.user.id]);
    await recordAudit({ userId: req.user.id, action: 'UPDATE_USER', details: { self: true, avatarRemoved: true }, req });

    return res.status(200).json({ success: true, message: 'Profile photo removed.', data: { avatar_url: null } });
  } catch (err) {
    console.error('[users] avatar remove error:', err);
    return res.status(500).json({ success: false, message: 'Failed to remove profile photo.' });
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  resetPassword,
  listApprovers,
  listRecipients,
  updateOwnProfile,
  changeOwnPassword,
  uploadOwnAvatar,
  removeOwnAvatar,
  ASSIGNABLE_ROLES,
};
