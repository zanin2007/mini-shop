const express = require('express');
const router = express.Router();
const { getWishlist, addToWishlist, removeFromWishlist, checkWishlist, getWishlistIds } = require('../controllers/wishlistController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, getWishlist);
router.get('/ids', authenticateToken, getWishlistIds);
router.get('/check/:productId', authenticateToken, checkWishlist);
router.post('/', authenticateToken, addToWishlist);
router.delete('/:productId', authenticateToken, removeFromWishlist);

module.exports = router;
