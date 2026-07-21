const express = require('express');
const {
  getParentsList,
  createParentProfile,
  updateParentProfile,
  deleteParentProfile,
  linkChildToParent,
  unlinkChildFromParent,
  toggleParentStatus,
  resetParentPassword,
  getTeacherContact,
} = require('../controllers/parentController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Endpoint accessible to parents to reach assigned teachers
router.get('/teacher-contact/:studentId', authorize('parent', 'admin'), getTeacherContact);

router.use(authorize('admin')); // Only Admin can perform parent operations

router.route('/')
  .get(getParentsList)
  .post(createParentProfile);

router.route('/:id')
  .put(updateParentProfile)
  .delete(deleteParentProfile);

router.post('/:id/link-child', linkChildToParent);
router.post('/:id/unlink-child', unlinkChildFromParent);
router.put('/:id/toggle-status', toggleParentStatus);
router.put('/:id/reset-password', resetParentPassword);

module.exports = router;
