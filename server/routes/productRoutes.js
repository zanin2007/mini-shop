const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById, createProduct } = require('../controllers/productController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', getAllProducts);
router.post('/', authenticateToken, createProduct);
router.get('/:id', getProductById);

module.exports = router;
