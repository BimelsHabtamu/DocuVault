const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const {
  previewDocument,
  generateDocument,
  generateBulkDocuments,
  validateBulkGeneration,
  getBulkStatus,
  downloadDocument,
  downloadBulkZip,
  deleteDocument,
  resubmitDocument,
} = require('../controllers/documentController');

// RBAC matrix: "Generate a PDF (Single/Bulk)" — super_admin, system_admin, generator, approver
const canGenerate = requireRole(ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.GENERATOR, ROLES.APPROVER);

router.post('/preview', requireAuth, canGenerate, previewDocument);
router.post('/validate-bulk', requireAuth, canGenerate, validateBulkGeneration);
router.post('/generate', requireAuth, canGenerate, generateDocument);
router.post('/generate/bulk', requireAuth, canGenerate, generateBulkDocuments);
router.get('/bulk-status/:jobId', requireAuth, canGenerate, getBulkStatus);
// Streams the completed ZIP archive for a bulk job. Auth required; authz enforced
// inside the controller (owner-or-admin, same pattern as single-doc download).
router.get('/bulk/:jobId/download-zip', requireAuth, canGenerate, downloadBulkZip);
router.get('/:id/download', requireAuth, downloadDocument); // C-1/P-7: per-role check inside controller
// C-1/P-7 RBAC: super/system_admin=any doc, approver=signed docs only,
// generator=own docs only, recipient=denied (uses secure-delivery flow).
router.delete('/:id', requireAuth, canGenerate, deleteDocument);
// Edit & Resubmit for a rejected document — ownership/admin check happens inside
// the controller (owner-or-admin), same pattern as delete above.
router.post('/:id/resubmit', requireAuth, canGenerate, resubmitDocument);

module.exports = router;
