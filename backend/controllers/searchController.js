const Student = require('../models/Student');
const Class = require('../models/Class');
const User = require('../models/User');
const Notice = require('../models/Notice');
const LeaveRequest = require('../models/LeaveRequest');
const SchoolEvent = require('../models/SchoolEvent');

// @desc    Perform global search across multiple collections
// @route   GET /api/search
// @access  Private
const globalSearch = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: { students: [], teachers: [], parents: [], classes: [], notices: [], leaves: [], events: [] }
      });
    }

    const regexQuery = { $regex: q, $options: 'i' };

    // 1. Query Students
    const students = await Student.find({
      $or: [
        { name: regexQuery },
        { rollNo: regexQuery },
        { admissionNo: regexQuery }
      ]
    }).populate('classId', 'grade section').limit(5);

    // 2. Query Teachers
    const teachers = await User.find({
      role: 'teacher',
      $or: [
        { name: regexQuery },
        { email: regexQuery },
        { phone: regexQuery }
      ]
    }).limit(5);

    // 3. Query Parents
    const parents = await User.find({
      role: 'parent',
      $or: [
        { name: regexQuery },
        { email: regexQuery },
        { phone: regexQuery }
      ]
    }).limit(5);

    // 4. Query Classes
    const classes = await Class.find({
      $or: [
        { grade: regexQuery },
        { section: regexQuery }
      ]
    }).limit(5);

    // 5. Query Notices
    const notices = await Notice.find({
      $or: [
        { title: regexQuery },
        { content: regexQuery }
      ]
    }).limit(5);

    // 6. Query Events
    const events = await SchoolEvent.find({
      $or: [
        { title: regexQuery },
        { description: regexQuery }
      ]
    }).limit(5);

    // 7. Query Leaves
    const leaves = await LeaveRequest.find({
      reason: regexQuery
    }).populate('studentId', 'name').limit(5);

    res.status(200).json({
      success: true,
      data: {
        students,
        teachers,
        parents,
        classes,
        notices,
        events,
        leaves
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  globalSearch,
};
