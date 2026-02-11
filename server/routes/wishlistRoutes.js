const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

// 임시 빈 라우트 (5주차에 구현 예정)
router.get('/', authenticateToken, (req, res) => {
  res.json([]);
});

module.exports = router;
