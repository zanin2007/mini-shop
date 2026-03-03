const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getActiveEvents, getMyParticipations, participateEvent } = require('../controllers/eventController');

router.get('/', authenticateToken, getActiveEvents);
router.get('/my-participations', authenticateToken, getMyParticipations);
router.post('/:id/participate', authenticateToken, participateEvent);

module.exports = router;
