const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const auth    = require('../middlewares/authMiddleware');
const role    = require('../middlewares/roleMiddleware');
const ctrl    = require('../controllers/userController');

const admins = role('super_admin', 'system_admin');

// Shared image upload config
const imageUpload = (prefix) => multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../storage/uploads'),
    filename: (req, file, cb) =>
      cb(null, `${prefix}_${req.user.id}_${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits:     { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

// Public — called when user clicks the verification link in their email
// Must be registered BEFORE /:id routes to avoid param collision
router.get('/verify-email',   ctrl.verifyEmailChange);

router.get('/me/settings',    auth, ctrl.getMySettings);
router.put('/me/settings',    auth, ctrl.updateMySettings);
router.post('/me/avatar',     auth, imageUpload('avatar').single('avatar'),        ctrl.updateMyAvatar);
router.post('/me/signature',  auth, imageUpload('signature').single('signature'),  ctrl.uploadSignature);

// Public to all authenticated roles — needed by generators to pick an approver
router.get('/approvers',  auth, ctrl.getApprovers);
router.get('/',           auth, admins, ctrl.getUsers);
router.post('/',          auth, admins, ctrl.createUser);
router.put('/:id',        auth, admins, ctrl.updateUser);
router.delete('/:id',     auth, admins, ctrl.deleteUser);
router.patch('/:id/role', auth, admins, ctrl.changeRole);
router.post('/change-password', auth, ctrl.changePassword);

module.exports = router;
