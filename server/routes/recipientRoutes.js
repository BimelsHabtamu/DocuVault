const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/authMiddleware');
const role    = require('../middlewares/roleMiddleware');
const ctrl    = require('../controllers/recipientController');

// All recipient routes require authentication.
// Admins can also view (for debugging), but primary use is 'recipient' role.
const canView = role('recipient', 'super_admin', 'system_admin');

// GET /api/recipient/documents        — full inbox list
router.get('/documents',              auth, canView, ctrl.getMyDocuments);

// GET /api/recipient/documents/:doc_uuid — single document detail + verify URL
router.get('/documents/:doc_uuid',    auth, canView, ctrl.getMyDocumentByUuid);

// GET /api/recipient/stats            — dashboard KPI counts + recent docs
router.get('/stats',                  auth, canView, ctrl.getMyStats);

module.exports = router;
