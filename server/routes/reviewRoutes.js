const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validateId');
const { getProductReviews, createReview, deleteReview, checkPurchased } = require('../controllers/reviewController');

router.get('/product/:productId', validateId('productId'), getProductReviews);
router.get('/check/:productId', authenticateToken, validateId('productId'), checkPurchased);
router.post('/', authenticateToken, createReview);
router.delete('/:id', authenticateToken, validateId(), deleteReview);

module.exports = router;
