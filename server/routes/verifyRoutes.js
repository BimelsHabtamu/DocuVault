const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const auth    = require('../middlewares/authMiddleware');
const ctrl    = require('../controllers/verifyController');

// BR-002: 5 MB hard limit.
// busboy (used by multer) fires LIMIT_FILE_SIZE when bytesRead === limit.
// To allow files of exactly 5 MB, set the limit to MAX + 1.
// Files strictly over 5 MB (≥ 5 MB + 1 byte) trigger LIMIT_FILE_SIZE → HTTP 413.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_UPLOAD_BYTES + 1 }, // +1 so exactly 5 MB is accepted
});

// ── Optional auth middleware ──────────────────────────────────────────────────
// Populates req.user from the JWT when present, but does NOT reject the
// request if no token is provided. Used on the public verify endpoint so
// that authenticated recipients can be traced in audit logs while phone
// QR scans (no token) still work.
const jwt = require('jsonwebtoken');
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Invalid token — treat as unauthenticated, don't block the request
      req.user = null;
    }
  }
  next();
}

// IMPORTANT: /status/:doc_uuid MUST be registered before /:doc_uuid
// otherwise Express matches "status" as a doc_uuid param.

// GET  /api/verify/status/:doc_uuid — PC polling for cross-device QR sync
// Requires authentication + recipient ownership check (see verifyController).
router.get('/status/:doc_uuid', auth, ctrl.getVerifyStatus);

// POST /api/verify/upload — verify by PDF file upload (public)
router.post('/upload', upload.single('pdf'), ctrl.verifyByUpload);

// GET  /api/verify/:doc_uuid — verify by doc ID (public; also triggered by QR scan on phone)
// optionalAuth populates req.user when a logged-in recipient calls it directly,
// making the audit log entry traceable to them.
router.get('/:doc_uuid', optionalAuth, ctrl.verifyByDocUuid);

module.exports = router;
