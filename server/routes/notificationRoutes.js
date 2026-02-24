const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);

module.exports = router;
