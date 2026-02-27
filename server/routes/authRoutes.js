const express = require('express');
const router = express.Router();
const { signup, login, logout, checkAuth, searchUser, changeNickname, changePassword, deleteAccount } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/check', authenticateToken, checkAuth);
router.get('/search', authenticateToken, searchUser);
router.put('/nickname', authenticateToken, changeNickname);
router.put('/password', authenticateToken, changePassword);
router.delete('/account', authenticateToken, deleteAccount);

module.exports = router;
