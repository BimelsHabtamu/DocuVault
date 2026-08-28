const express  = require('express');
const router   = express.Router();
const auth     = require('../middlewares/authMiddleware');
const {
  login,
  getMe,
  validateSetPasswordToken,
  setPassword,
} = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', login);

// GET  /api/auth/me  (protected)
router.get('/me', auth, getMe);

// GET  /api/auth/validate-token?token=...  (public — check before showing set-password form)
router.get('/validate-token', validateSetPasswordToken);

// POST /api/auth/set-password  (public — recipient sets their own password)
router.post('/set-password', setPassword);

module.exports = router;
