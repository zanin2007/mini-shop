const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getCart, addToCart, updateQuantity, removeFromCart, toggleSelect, toggleSelectAll } = require('../controllers/cartController');

router.get('/', authenticateToken, getCart);
router.post('/', authenticateToken, addToCart);
router.put('/select-all', authenticateToken, toggleSelectAll);
router.put('/:id', authenticateToken, updateQuantity);
router.put('/:id/select', authenticateToken, toggleSelect);
router.delete('/:id', authenticateToken, removeFromCart);

module.exports = router;
