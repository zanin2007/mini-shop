const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { createOrder, getOrders, getMypageSummary, confirmOrder, advanceOrderStatus } = require('../controllers/orderController');

router.post('/', authenticateToken, createOrder);
router.get('/', authenticateToken, getOrders);
router.get('/summary', authenticateToken, getMypageSummary);
router.put('/:id/confirm', authenticateToken, confirmOrder);
router.put('/:id/advance', authenticateToken, isAdmin, advanceOrderStatus);

module.exports = router;
