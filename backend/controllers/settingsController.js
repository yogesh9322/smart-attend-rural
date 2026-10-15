const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
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
        timezone: process.env.TIMEZONE || 'Asia/Kolkata',
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
// @access  Private (Admins see all; teachers/parents see own)
const getActivityLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      action = '',
      startDate = '',
      endDate = '',
      all = false,
    } = req.query;

    let query = {};
    if (req.user.role !== 'admin') {
      query.userId = req.user.id;
    }

    if (action) {
      if (action.startsWith('CATEGORY:')) {
        const cat = action.replace('CATEGORY:', '');
        if (cat === 'LOGIN') {
          query.action = { $in: ['LOGIN', 'FAILED_LOGIN', 'GOOGLE_LOGIN'] };
        } else if (cat === 'USER') {
          query.action = {
            $in: [
              'CREATE_USER',
              'CREATE_PARENT',
              'CREATE_STUDENT',
              'UPDATE_USER',
              'UPDATE_TEACHER',
              'UPDATE_PARENT',
              'UPDATE_STUDENT',
              'DELETE_USER',
              'DELETE_TEACHER',
              'DELETE_PARENT',
              'DELETE_STUDENT',
            ],
          };
        } else if (cat === 'SECURITY') {
          query.action = {
            $in: [
              'PASSWORD_RESET_ADMIN',
              'RESET_PASSWORD',
              'CHANGE_PASSWORD',
              'STATUS_CHANGE',
            ],
          };
        } else if (cat === 'NOTIFICATION') {
          query.action = { $regex: 'NOTIFICATION|NOTICE', $options: 'i' };
        } else if (cat === 'SETTINGS') {
          query.action = { $regex: 'SETTINGS', $options: 'i' };
        }
      } else {
        query.action = action;
      }
    }

    if (role && req.user.role === 'admin') {
      const usersWithRole = await User.find({ role }).select('_id');
      const userIds = usersWithRole.map((u) => u._id);
      query.userId = { $in: userIds };
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const sParts = String(startDate).split('-').map(Number);
        if (sParts.length === 3 && !isNaN(sParts[0]) && !isNaN(sParts[1]) && !isNaN(sParts[2])) {
          // India Standard Time (UTC+05:30) starts at 18:30:00 UTC of previous day
          const istStart = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0) - (5.5 * 3600 * 1000));
          const utcStart = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0));
          query.createdAt.$gte = new Date(Math.min(istStart.getTime(), utcStart.getTime()));
        } else {
          query.createdAt.$gte = new Date(startDate);
        }
      }
      if (endDate) {
        const eParts = String(endDate).split('-').map(Number);
        if (eParts.length === 3 && !isNaN(eParts[0]) && !isNaN(eParts[1]) && !isNaN(eParts[2])) {
          // End of day: full coverage for IST (through 23:59:59.999 IST) and UTC (through 23:59:59.999 UTC)
          const istEnd = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - (5.5 * 3600 * 1000));
          const utcEnd = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999));
          // Plus buffer to ensure every record marked on this date is captured regardless of server timezone
          query.createdAt.$lte = new Date(Math.max(istEnd.getTime(), utcEnd.getTime()) + (5.5 * 3600 * 1000));
        } else {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      }).select('_id');
      const matchingUserIds = matchingUsers.map((u) => u._id);

      const searchConditions = [
        { action: searchRegex },
        { details: searchRegex },
        { ipAddress: searchRegex },
      ];
      if (matchingUserIds.length > 0) {
        searchConditions.push({ userId: { $in: matchingUserIds } });
      }

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const isAll = all === 'true' || all === true;
    const limitNum = isAll ? 0 : Math.max(1, parseInt(limit, 10) || 20);

    const totalLogs = await ActivityLog.countDocuments(query);

    let queryBuilder = ActivityLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });

    if (limitNum > 0) {
      queryBuilder = queryBuilder.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const logs = await queryBuilder;

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total: totalLogs,
        page: pageNum,
        limit: limitNum > 0 ? limitNum : totalLogs,
        pages: limitNum > 0 ? Math.ceil(totalLogs / limitNum) : 1,
      },
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
