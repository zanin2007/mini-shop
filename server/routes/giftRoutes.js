const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validateId');
const { getSentGifts, getReceivedGifts, acceptGift, rejectGift, confirmGift } = require('../controllers/giftController');

router.get('/sent', authenticateToken, getSentGifts);
router.get('/received', authenticateToken, getReceivedGifts);
router.put('/:id/accept', authenticateToken, validateId(), acceptGift);
router.put('/:id/reject', authenticateToken, validateId(), rejectGift);
router.put('/:id/confirm', authenticateToken, validateId(), confirmGift);

module.exports = router;
