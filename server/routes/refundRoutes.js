const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requestRefund, getMyRefunds } = require('../controllers/refundController');

router.post('/:orderId', authenticateToken, requestRefund);
router.get('/', authenticateToken, getMyRefunds);

module.exports = router;
