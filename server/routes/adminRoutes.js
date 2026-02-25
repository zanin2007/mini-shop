const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const {
  getAllOrders, updateOrderStatus,
  getAllProducts, deleteProduct,
  createCoupon, getAllCoupons, deleteCoupon, distributeCoupon,
  createAnnouncement, getAllAnnouncements, deleteAnnouncement,
  createEvent, getAllEvents, deleteEvent, drawEventWinners
} = require('../controllers/adminController');

// 모든 관리자 라우트에 인증 + 관리자 권한 필요
router.use(authenticateToken, isAdmin);

router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.get('/products', getAllProducts);
router.delete('/products/:id', deleteProduct);
router.get('/coupons', getAllCoupons);
router.post('/coupons', createCoupon);
router.delete('/coupons/:id', deleteCoupon);
router.post('/coupons/distribute', distributeCoupon);
router.post('/announcements', createAnnouncement);
router.get('/announcements', getAllAnnouncements);
router.delete('/announcements/:id', deleteAnnouncement);
router.post('/events', createEvent);
router.get('/events', getAllEvents);
router.delete('/events/:id', deleteEvent);
router.post('/events/:id/draw', drawEventWinners);

module.exports = router;
