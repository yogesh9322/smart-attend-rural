const express = require('express');
const {
  markAttendance,
  getAttendance,
  getDashboardStats,
  getStudentTodayStatus,
  getStudentReport,
  exportAttendanceHistory,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // Secure all attendance routes

router.get('/export-history', authorize('admin', 'teacher'), exportAttendanceHistory);
router.get('/student-today/:studentId', getStudentTodayStatus);
router.get('/student-report', getStudentReport);

router.route('/')
  .get(getAttendance)
  .post(authorize('admin', 'teacher'), markAttendance);

router.get('/stats', getDashboardStats);

module.exports = router;
