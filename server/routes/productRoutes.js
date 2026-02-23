const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById, createProduct, getCategories, deleteProduct } = require('../controllers/productController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.post('/', authenticateToken, createProduct);
router.get('/:id', getProductById);
router.delete('/:id', authenticateToken, deleteProduct);

module.exports = router;
