const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const {
  getAllOrders, updateOrderStatus,
  getAllProducts, deleteProduct,
  createCoupon, getAllCoupons, deleteCoupon, distributeCoupon,
  createAnnouncement, getAllAnnouncements, deleteAnnouncement,
  createEvent, getAllEvents, deleteEvent, drawEventWinners,
  getAllRefunds, processRefund,
  getUsersWithActivity, getUserPenalties, issuePenalty, revokePenalty
} = require('../controllers/adminController');
const { createProduct, addProductOption, deleteProductOption } = require('../controllers/productController');
const { validateId } = require('../middleware/validateId');

// 모든 관리자 라우트에 인증 + 관리자 권한 필요
router.use(authenticateToken, isAdmin);

router.get('/orders', getAllOrders);
router.put('/orders/:id/status', validateId(), updateOrderStatus);
router.get('/products', getAllProducts);
router.post('/products', createProduct);
router.delete('/products/options/:optionId', validateId('optionId'), deleteProductOption);
router.post('/products/:id/options', validateId(), addProductOption);
router.delete('/products/:id', validateId(), deleteProduct);
router.get('/coupons', getAllCoupons);
router.post('/coupons', createCoupon);
router.delete('/coupons/:id', validateId(), deleteCoupon);
router.post('/coupons/distribute', distributeCoupon);
router.post('/announcements', createAnnouncement);
router.get('/announcements', getAllAnnouncements);
router.delete('/announcements/:id', validateId(), deleteAnnouncement);
router.post('/events', createEvent);
router.get('/events', getAllEvents);
router.delete('/events/:id', validateId(), deleteEvent);
router.post('/events/:id/draw', validateId(), drawEventWinners);
router.get('/refunds', getAllRefunds);
router.put('/refunds/:id', validateId(), processRefund);
router.get('/users-activity', getUsersWithActivity);
router.get('/users/:userId/penalties', validateId('userId'), getUserPenalties);
router.post('/users/:userId/penalties', validateId('userId'), issuePenalty);
router.put('/penalties/:penaltyId/revoke', validateId('penaltyId'), revokePenalty);

module.exports = router;
