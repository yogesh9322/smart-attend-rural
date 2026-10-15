const express = require('express');
const {
  registerUser, loginUser, getMe, getParents, getTeachers,
  updateTeacher, resetTeacherPassword, toggleTeacherStatus, deleteTeacher,
  forgotPassword, resetPassword, updateProfile, changePassword, googleLogin
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { forgotPasswordLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginUser);
router.post('/google', googleLogin);
router.post('/register', protect, authorize('admin'), registerUser);
router.post('/forgotpassword', forgotPasswordLimiter, forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.get('/profile', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/changepassword', protect, changePassword);
router.put('/password', protect, changePassword);
router.get('/parents', protect, authorize('admin'), getParents);
router.get('/teachers', protect, authorize('admin'), getTeachers);
router.put('/teachers/:id', protect, authorize('admin'), updateTeacher);
router.put('/teachers/:id/reset-password', protect, authorize('admin'), resetTeacherPassword);
router.put('/teachers/:id/toggle-status', protect, authorize('admin'), toggleTeacherStatus);
router.delete('/teachers/:id', protect, authorize('admin'), deleteTeacher);

module.exports = router;
