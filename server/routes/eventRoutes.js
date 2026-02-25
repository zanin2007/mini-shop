const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getActiveEvents, participateEvent } = require('../controllers/eventController');

router.get('/', authenticateToken, getActiveEvents);
router.post('/:id/participate', authenticateToken, participateEvent);

module.exports = router;
