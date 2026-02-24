const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { createOrder, getOrders, confirmOrder, advanceOrderStatus } = require('../controllers/orderController');

router.post('/', authenticateToken, createOrder);
router.get('/', authenticateToken, getOrders);
router.put('/:id/confirm', authenticateToken, confirmOrder);
router.put('/:id/advance', authenticateToken, advanceOrderStatus);

module.exports = router;
