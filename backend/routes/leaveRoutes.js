const express = require('express');
const { createLeaveRequest, getLeaveRequests, updateLeaveStatus } = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', createLeaveRequest);
router.get('/', getLeaveRequests);
router.put('/:id', updateLeaveStatus);

module.exports = router;
