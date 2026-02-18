const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getCart, addToCart, updateQuantity, removeFromCart } = require('../controllers/cartController');

router.get('/', authenticateToken, getCart);
router.post('/', authenticateToken, addToCart);
router.put('/:id', authenticateToken, updateQuantity);
router.delete('/:id', authenticateToken, removeFromCart);

module.exports = router;
