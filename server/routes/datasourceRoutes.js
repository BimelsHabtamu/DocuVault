/**
 * datasourceRoutes.js — FR-009
 *
 * All routes require authentication.
 * Generators and admins can fetch/search datasource records.
 * Recipients cannot access these endpoints.
 */
const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/authMiddleware');
const role    = require('../middlewares/roleMiddleware');
const ctrl    = require('../controllers/datasourceController');

// Generators, approvers, and admins can use data-source features
const canGenerate = role('super_admin', 'system_admin', 'generator', 'approver');

// GET /api/datasource/:templateId/mappings   — which fields are auto-populated
router.get('/:templateId/mappings',         auth, canGenerate, ctrl.getMappings);

// GET /api/datasource/:templateId/search?q= — search users by name/email
router.get('/:templateId/search',           auth, canGenerate, ctrl.searchRecords);

// GET /api/datasource/:templateId/fetch/:userId — fetch mapped fields for a user
router.get('/:templateId/fetch/:userId',    auth, canGenerate, ctrl.fetchRecord);

module.exports = router;
