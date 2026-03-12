const express = require('express');
const router = express.Router();
const { getWishlist, addToWishlist, removeFromWishlist, checkWishlist, getWishlistIds } = require('../controllers/wishlistController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validateId');

router.get('/', authenticateToken, getWishlist);
router.get('/ids', authenticateToken, getWishlistIds);
router.get('/check/:productId', authenticateToken, validateId('productId'), checkWishlist);
router.post('/', authenticateToken, addToWishlist);
router.delete('/:productId', authenticateToken, validateId('productId'), removeFromWishlist);

module.exports = router;
