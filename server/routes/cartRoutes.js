const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validateId');
const { getCart, addToCart, updateQuantity, removeFromCart, toggleSelect, toggleSelectAll } = require('../controllers/cartController');

router.get('/', authenticateToken, getCart);
router.post('/', authenticateToken, addToCart);
router.put('/select-all', authenticateToken, toggleSelectAll);
router.put('/:id', authenticateToken, validateId(), updateQuantity);
router.put('/:id/select', authenticateToken, validateId(), toggleSelect);
router.delete('/:id', authenticateToken, validateId(), removeFromCart);

module.exports = router;
