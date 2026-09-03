/**
 * recipientAccessRoutes.js
 *
 * All routes use the raw token from the URL as the credential.
 * No JWT / session cookie required — the token IS the auth.
 *
 * GET  /api/access/:token           — load session metadata
 * GET  /api/access/:token/qr-poll   — PC polls every 2s waiting for phone scan
 * POST /api/access/:token/verify    — phone marks QR as verified
 * POST /api/access/:token/grant     — recipient clicks ON button
 * GET  /api/access/:token/pdf       — stream PDF inline (View)
 * POST /api/access/:token/download  — serve PDF as attachment (Download)
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/recipientAccessController');

router.get('/:token',              ctrl.getSession);
router.get('/:token/qr-poll',      ctrl.pollQrStatus);
router.post('/:token/verify',      ctrl.markQrVerified);
router.post('/:token/grant',       ctrl.grantAccess);
router.get('/:token/pdf',          ctrl.streamPdf);
router.post('/:token/download',    ctrl.recordDownload);

module.exports = router;
