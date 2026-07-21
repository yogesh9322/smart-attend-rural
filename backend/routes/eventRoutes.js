const express = require('express');
const { getSchoolEvents, createSchoolEvent, updateSchoolEvent, deleteSchoolEvent } = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getSchoolEvents);
router.post('/', createSchoolEvent);
router.put('/:id', updateSchoolEvent);
router.delete('/:id', deleteSchoolEvent);

module.exports = router;
