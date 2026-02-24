const express = require('express');
const router = express.Router();
const { signup, login, logout, checkAuth, searchUser } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/check', authenticateToken, checkAuth);
router.get('/search', authenticateToken, searchUser);

module.exports = router;
