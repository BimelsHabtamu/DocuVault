const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('../controllers/verifyController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// IMPORTANT: /status/:doc_uuid MUST be registered before /:doc_uuid
// otherwise Express matches "status" as a doc_uuid param.

// GET  /api/verify/status/:doc_uuid — PC polling for cross-device QR sync
router.get('/status/:doc_uuid', ctrl.getVerifyStatus);

// POST /api/verify/upload — verify by PDF file upload
router.post('/upload', upload.single('pdf'), ctrl.verifyByUpload);

// GET  /api/verify/:doc_uuid — verify by doc ID (also triggered by QR scan on phone)
router.get('/:doc_uuid', ctrl.verifyByDocUuid);

module.exports = router;
