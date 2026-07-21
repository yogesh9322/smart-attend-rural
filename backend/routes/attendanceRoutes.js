const express = require('express');
const {
  markAttendance,
  getAttendance,
  getDashboardStats,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // Secure all attendance routes

router.route('/')
  .get(getAttendance)
  .post(authorize('admin', 'teacher'), markAttendance);

router.get('/stats', getDashboardStats);

module.exports = router;
