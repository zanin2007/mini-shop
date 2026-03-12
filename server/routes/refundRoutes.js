const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validateId');
const { requestRefund, getMyRefunds } = require('../controllers/refundController');

router.post('/:orderId', authenticateToken, validateId('orderId'), requestRefund);
router.get('/', authenticateToken, getMyRefunds);

module.exports = router;
