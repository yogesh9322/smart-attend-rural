const ActivityLog = require('../models/ActivityLog');

/**
 * Creates an activity log entry
 * @param {String} userId - User ObjectId
 * @param {String} action - Action category (e.g. 'LOGIN', 'CREATE_STUDENT')
 * @param {String} details - Description details
 * @param {Object} req - Express request object (optional, for client details)
 */
const logActivity = async (userId, action, details, req = null) => {
  try {
    let ipAddress = 'unknown';
    let userAgent = 'unknown';

    if (req) {
      ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      userAgent = req.headers['user-agent'] || 'unknown';
    }

    const logData = {
      action,
      details,
      ipAddress,
      userAgent,
    };

    if (userId) {
      logData.userId = userId;
    }

    await ActivityLog.create(logData);
  } catch (error) {
    console.error('Failed to log admin activity:', error.message);
  }
};

module.exports = { logActivity };
