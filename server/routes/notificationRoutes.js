const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validateId');
const notificationController = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/read', validateId(), notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/all', notificationController.deleteAll);

module.exports = router;
