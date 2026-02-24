const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById, createProduct, getCategories, deleteProduct, addProductOption, deleteProductOption } = require('../controllers/productController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.post('/', authenticateToken, createProduct);
router.delete('/options/:optionId', authenticateToken, deleteProductOption);
router.get('/:id', getProductById);
router.post('/:id/options', authenticateToken, addProductOption);
router.delete('/:id', authenticateToken, deleteProduct);

module.exports = router;
