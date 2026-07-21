const express = require('express');
const {
  getSchoolSettings,
  updateSchoolSettings,
  getActivityLogs,
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/logs', getActivityLogs);

router.route('/')
  .get(getSchoolSettings)
  .put(authorize('admin'), updateSchoolSettings);

module.exports = router;
