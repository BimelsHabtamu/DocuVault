const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const LOGO_STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'logos');
if (!fs.existsSync(LOGO_STORAGE_DIR)) fs.mkdirSync(LOGO_STORAGE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGO_STORAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});

const logoUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — logos should be small
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are accepted.'));
    }
    cb(null, true);
  },
});

/** POST /api/templates/upload-logo — FR-008: upload custom logos/signature images. */
function handleLogoUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded (field name must be "logo").' });
  }

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const publicUrl = `${backendUrl}/uploads/logos/${req.file.filename}`;

  return res.status(201).json({
    success: true,
    message: 'Logo uploaded successfully.',
    data: { url: publicUrl, filename: req.file.filename },
  });
}

// ---------------------------------------------------------------------------
// User profile photos (sidebar user-menu "Change photo") — same disk-storage
// pattern as logos above, but in its own directory since these are personal
// account assets, not template branding assets.
// ---------------------------------------------------------------------------
const AVATAR_STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'avatars');
if (!fs.existsSync(AVATAR_STORAGE_DIR)) fs.mkdirSync(AVATAR_STORAGE_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_STORAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — profile photos should be small
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are accepted.'));
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Company seal & authorized-signatory signature images (document footer stamping)
// — stored in their own sub-directories inside storage/ so they are clearly
// separated from template branding logos (storage/logos/) and user profile photos
// (storage/avatars/). Both directories are served statically via /uploads/seal
// and /uploads/authsig (see app.js) so Puppeteer / the browser can resolve them
// as plain <img src> URLs at PDF-render time.
// ---------------------------------------------------------------------------

const SEAL_STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'seal');
if (!fs.existsSync(SEAL_STORAGE_DIR)) fs.mkdirSync(SEAL_STORAGE_DIR, { recursive: true });

const sealStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SEAL_STORAGE_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});

const sealUpload = multer({
  storage: sealStorage,
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are accepted.'));
    cb(null, true);
  },
});

/** POST /api/settings/upload-seal */
function handleSealUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded (field name must be "seal").' });
  }
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const publicUrl  = `${backendUrl}/uploads/seal/${req.file.filename}`;
  return res.status(201).json({ success: true, message: 'Seal uploaded successfully.', data: { url: publicUrl, filename: req.file.filename } });
}

// ---------------------------------------------------------------------------

const AUTHSIG_STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'authsig');
if (!fs.existsSync(AUTHSIG_STORAGE_DIR)) fs.mkdirSync(AUTHSIG_STORAGE_DIR, { recursive: true });

const authSigStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUTHSIG_STORAGE_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});

const authSigUpload = multer({
  storage: authSigStorage,
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are accepted.'));
    cb(null, true);
  },
});

/** POST /api/settings/upload-authsig */
function handleAuthSigUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded (field name must be "authsig").' });
  }
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const publicUrl  = `${backendUrl}/uploads/authsig/${req.file.filename}`;
  return res.status(201).json({ success: true, message: 'Authorized signature uploaded successfully.', data: { url: publicUrl, filename: req.file.filename } });
}

module.exports = {
  logoUpload,
  handleLogoUpload,
  LOGO_STORAGE_DIR,
  avatarUpload,
  AVATAR_STORAGE_DIR,
  sealUpload,
  handleSealUpload,
  SEAL_STORAGE_DIR,
  authSigUpload,
  handleAuthSigUpload,
  AUTHSIG_STORAGE_DIR,
};
