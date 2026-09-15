/**
 * M-2: Authenticated Recipient routes (SRS §5 RBAC).
 * All routes require login + role=recipient. No generator/admin/approver
 * permissions are granted here — any attempt by another role to call these
 * endpoints returns 403 from requireRole before the controller runs.
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const { listMyDeliveries, downloadMyDocument, verifyMyDocument } = require('../controllers/recipientController');

const recipientOnly = requireRole(ROLES.RECIPIENT);

// GET  /api/recipient/documents              — list all deliveries for this recipient
router.get('/documents', requireAuth, recipientOnly, listMyDeliveries);

// GET  /api/recipient/documents/:deliveryId/download — authenticated re-download
router.get('/documents/:deliveryId/download', requireAuth, recipientOnly, downloadMyDocument);

// GET  /api/recipient/documents/:deliveryId/verify   — integrity check for own doc
router.get('/documents/:deliveryId/verify', requireAuth, recipientOnly, verifyMyDocument);

module.exports = router;
