const express = require('express');
const {
  getNotices,
  getNotice,
  markNoticeAsRead,
  getAdminNotices,
  createAdminNotice,
  updateAdminNotice,
  deleteAdminNotice,
  getTeacherNotices,
  createTeacherNotice,
  updateTeacherNotice,
  deleteTeacherNotice,
  getParentNotices,
} = require('../controllers/noticeController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// General / Base listing
router.get('/', protect, getNotices);
router.put('/:id/read', protect, markNoticeAsRead);

// Admin Notice Routes
router.get(['/admin', '/admin/all'], protect, authorize('admin'), getAdminNotices);
router.post(['/admin', '/admin/create'], protect, authorize('admin'), createAdminNotice);
router.put(['/admin/:id'], protect, authorize('admin'), updateAdminNotice);
router.delete(['/admin/:id'], protect, authorize('admin'), deleteAdminNotice);

// Teacher Notice Routes
router.get(['/teacher', '/teacher/all'], protect, authorize('teacher', 'admin'), getTeacherNotices);
router.post(['/teacher', '/teacher/create'], protect, authorize('teacher', 'admin'), createTeacherNotice);
router.put(['/teacher/:id'], protect, authorize('teacher', 'admin'), updateTeacherNotice);
router.delete(['/teacher/:id'], protect, authorize('teacher', 'admin'), deleteTeacherNotice);

// Parent Notice Routes
router.get(['/parent', '/parent/all'], protect, authorize('parent', 'admin'), getParentNotices);

router.get('/:id', protect, getNotice);

module.exports = router;
