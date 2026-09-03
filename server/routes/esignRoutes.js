const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/authMiddleware');
const role    = require('../middlewares/roleMiddleware');
const ctrl    = require('../controllers/esignController');

const canRequest = role('super_admin', 'system_admin', 'generator', 'approver');
const canApprove = role('super_admin', 'system_admin', 'approver');

// ── FR-022: Secure review link — authenticated, approver only ────────────────
// Must be BEFORE /:anything routes to avoid param collision.
// The token is validated server-side; the approver must be logged in.
router.get('/review/:token',  auth, canApprove, ctrl.getReviewByToken);

router.post('/request',    auth, canRequest, ctrl.requestSignature);
router.post('/otp/send',   auth, canApprove, ctrl.sendOtp);
router.post('/otp/verify', auth, canApprove, ctrl.verifyOtp);
router.post('/approve',    auth, canApprove, ctrl.approveDocument);
router.post('/reject',     auth, canApprove, ctrl.rejectDocument);
router.get('/pending',     auth, canApprove, ctrl.getPendingRequests);

module.exports = router;
