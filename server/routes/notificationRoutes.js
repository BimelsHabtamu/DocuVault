const express = require('express');
const router  = express.Router();
const auth    = require('../middlewares/authMiddleware');
const ctrl    = require('../controllers/notificationController');

// GET  /api/notifications               — full list (all sources merged)
router.get('/',              auth, ctrl.getNotifications);

// GET  /api/notifications/unread-count  — badge number for bell icon
router.get('/unread-count',  auth, ctrl.getUnreadCount);

// POST /api/notifications/read-all      — mark all as read
router.post('/read-all',     auth, ctrl.markAllRead);

// POST /api/notifications/read/:id      — mark one as read
router.post('/read/:id',     auth, ctrl.markRead);

module.exports = router;
