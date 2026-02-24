const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const mailboxController = require('../controllers/mailboxController');

router.use(authenticateToken);

router.get('/', mailboxController.getMailbox);
router.get('/unread-count', mailboxController.getUnreadCount);
router.put('/:id/read', mailboxController.markAsRead);
router.post('/:id/claim', mailboxController.claimReward);
router.delete('/:id', mailboxController.deleteMail);

module.exports = router;
