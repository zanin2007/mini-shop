const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getSentGifts, getReceivedGifts, acceptGift, rejectGift } = require('../controllers/giftController');

router.get('/sent', authenticateToken, getSentGifts);
router.get('/received', authenticateToken, getReceivedGifts);
router.put('/:id/accept', authenticateToken, acceptGift);
router.put('/:id/reject', authenticateToken, rejectGift);

module.exports = router;
