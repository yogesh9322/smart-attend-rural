const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect); // Secure all student routes

router.route('/')
  .get(getStudents)
  .post(authorize('admin'), upload.single('photo'), createStudent);

router.route('/:id')
  .get(getStudent)
  .put(authorize('admin'), upload.single('photo'), updateStudent)
  .delete(authorize('admin'), deleteStudent);

module.exports = router;
