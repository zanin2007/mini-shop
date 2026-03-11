const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById, getCategories } = require('../controllers/productController');

// 상품 조회는 인증 불필요 (공개 API)
// 상품 생성/삭제/옵션 관리는 /api/admin/products 에서 처리
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

module.exports = router;
