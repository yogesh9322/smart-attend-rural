const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get school settings
// @route   GET /api/settings
// @access  Private
const getSchoolSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create defaults
      settings = await Settings.create({
        schoolName: 'Smart Rural Model School',
        startTime: '09:00',
        endTime: '15:30',
        weeklyOffs: [0], // Sunday
        holidays: [],
        allowMultipleAttendance: true,
      });
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update school settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSchoolSettings = async (req, res, next) => {
  try {
    const {
      schoolName,
      schoolLogo,
      startTime,
      endTime,
      weeklyOffs,
      holidays,
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      settings = await Settings.findByIdAndUpdate(
        settings._id,
        req.body,
        { new: true, runValidators: true }
      );
    }

    await logActivity(req.user.id, 'UPDATE_SETTINGS', 'Updated school configurations', req);

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system audit activity logs
// @route   GET /api/settings/logs
// @access  Private/Admin
const getActivityLogs = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.userId = req.user.id;
    }
    const logs = await ActivityLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSchoolSettings,
  updateSchoolSettings,
  getActivityLogs,
};
