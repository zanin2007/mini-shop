const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validateId');
const mailboxController = require('../controllers/mailboxController');

router.use(authenticateToken);

router.get('/', mailboxController.getMailbox);
router.get('/unread-count', mailboxController.getUnreadCount);
router.put('/:id/read', validateId(), mailboxController.markAsRead);
router.post('/:id/claim', validateId(), mailboxController.claimReward);
router.delete('/all', mailboxController.deleteAll);
router.delete('/:id', validateId(), mailboxController.deleteMail);

module.exports = router;
