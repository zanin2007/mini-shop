const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getProductReviews, createReview, deleteReview, checkPurchased } = require('../controllers/reviewController');

router.get('/product/:productId', getProductReviews);
router.get('/check/:productId', authenticateToken, checkPurchased);
router.post('/', authenticateToken, createReview);
router.delete('/:id', authenticateToken, deleteReview);

module.exports = router;
