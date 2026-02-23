const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getUserCoupons, claimCoupon, getAvailableCoupons } = require('../controllers/couponController');

router.get('/', authenticateToken, getUserCoupons);
router.get('/available', authenticateToken, getAvailableCoupons);
router.post('/claim', authenticateToken, claimCoupon);

module.exports = router;
