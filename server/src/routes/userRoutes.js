const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  resetPassword,
  listApprovers,
  listRecipients,
  updateOwnProfile,
  changeOwnPassword,
  uploadOwnAvatar,
  removeOwnAvatar,
} = require('../controllers/userController');
const { avatarUpload } = require('../controllers/uploadController');

const superAdminOnly = requireRole(ROLES.SUPER_ADMIN);
// Same "4 generate-capable roles" RBAC matrix used for document generation/signing.
const canGenerate = requireRole(ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.GENERATOR, ROLES.APPROVER);

// NOTE: '/approvers', '/recipients', and every '/me...' route must be registered

router.get('/approvers', requireAuth, canGenerate, listApprovers);
router.get('/recipients', requireAuth, canGenerate, listRecipients);

// Self-service — sidebar user-menu (any authenticated role, no admin requirement).
router.put('/me', requireAuth, updateOwnProfile);
router.patch('/me/password', requireAuth, changeOwnPassword);
router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), uploadOwnAvatar);
router.delete('/me/avatar', requireAuth, removeOwnAvatar);

router.get('/', requireAuth, superAdminOnly, listUsers);
router.post('/', requireAuth, superAdminOnly, createUser);
router.put('/:id', requireAuth, superAdminOnly, updateUser);
router.patch('/:id/status', requireAuth, superAdminOnly, updateUserStatus);
router.patch('/:id/reset-password', requireAuth, superAdminOnly, resetPassword);
router.delete('/:id', requireAuth, superAdminOnly, deleteUser);

module.exports = router;
