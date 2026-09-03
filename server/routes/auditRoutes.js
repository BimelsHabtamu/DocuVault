const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/authMiddleware');
const role    = require('../middlewares/roleMiddleware');
const ctrl    = require('../controllers/auditController');

const admins      = role('super_admin', 'system_admin');
// Dashboard data is consumed by all non-recipient roles for their own dashboards
const dashboardRoles = role('super_admin', 'system_admin', 'generator', 'approver');

router.get('/dashboard',          auth, dashboardRoles, ctrl.getDashboard);
router.get('/activity-chart',     auth, admins,         ctrl.getActivityChart);
router.get('/my-activity-chart',  auth, dashboardRoles, ctrl.getMyActivityChart);
router.get('/reports',            auth, admins,         ctrl.getReportData);
router.get('/logs',               auth, admins,         ctrl.getAllAuditLogs);
router.get('/search',             auth, admins,         ctrl.searchDocuments);
router.get('/export/csv',         auth, admins,         ctrl.exportDocumentsCsv);   // FR-038
router.get('/:doc_id',            auth, admins,         ctrl.getAuditTrail);

module.exports = router;
