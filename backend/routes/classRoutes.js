const express = require('express');
const {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  archiveClass,
  transferStudents,
  assignTeacher,
} = require('../controllers/classController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // Secure all class routes

router.route('/')
  .get(getClasses)
  .post(authorize('admin'), createClass);

router.route('/:id')
  .get(getClass)
  .put(authorize('admin'), updateClass)
  .delete(authorize('admin'), deleteClass);

router.put('/:id/archive', authorize('admin'), archiveClass);
router.put('/:id/transfer-students', authorize('admin'), transferStudents);
router.put('/:id/assign-teacher', authorize('admin'), assignTeacher);

module.exports = router;
