const Notification = require('../models/Notification');

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const currentUserRole = req.user.role;

    // Filter criteria:
    // 1. Never show notifications where senderId === currentUserId (publishers don't notify themselves)
    // 2. Either explicitly addressed to this user (userId: currentUserId)
    // 3. Or broadcast (userId is null/undefined) where targetRole is 'all', matches currentUserRole, or is general
    const filter = {
      $and: [
        {
          $or: [
            { senderId: { $ne: currentUserId } },
            { senderId: { $exists: false } },
            { senderId: null }
          ]
        },
        {
          $or: [
            { userId: currentUserId },
            {
              userId: { $in: [null, undefined] },
              $or: [
                { targetRole: { $in: ['all', currentUserRole] } },
                { targetRole: { $exists: false } },
                { targetRole: null }
              ]
            }
          ]
        }
      ]
    };

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .populate('senderId', 'name role')
      .limit(50);

    // Compute user-specific read status for each notification
    let unreadCount = 0;
    const userNotifications = notifications.map((notif) => {
      const nObj = notif.toObject();
      let isReadForUser = false;

      if (nObj.userId && String(nObj.userId) === String(currentUserId)) {
        // Direct personal notification
        isReadForUser = Boolean(nObj.isRead);
      } else {
        // Shared/broadcast notification - check readBy array
        const readList = Array.isArray(nObj.readBy) ? nObj.readBy : [];
        isReadForUser = readList.some(
          (uId) => String(uId) === String(currentUserId) || String(uId?._id) === String(currentUserId)
        );
      }

      if (!isReadForUser) {
        unreadCount++;
      }

      return {
        ...nObj,
        isRead: isReadForUser,
      };
    });

    res.status(200).json({
      success: true,
      unreadCount,
      data: userNotifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read for current user
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const notif = await Notification.findById(req.params.id);

    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const updates = {
      $addToSet: { readBy: currentUserId }
    };

    // If this is a user-specific notification for this user, mark isRead = true
    if (notif.userId && String(notif.userId) === String(currentUserId)) {
      updates.$set = { isRead: true };
    }

    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: {
        ...updated.toObject(),
        isRead: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read for current user
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const currentUserRole = req.user.role;

    // 1. Mark all personal notifications as isRead = true
    await Notification.updateMany(
      { userId: currentUserId, isRead: false },
      { $set: { isRead: true }, $addToSet: { readBy: currentUserId } }
    );

    // 2. Add current user to readBy for all eligible broadcast notifications
    await Notification.updateMany(
      {
        userId: { $in: [null, undefined] },
        $or: [
          { senderId: { $ne: currentUserId } },
          { senderId: { $exists: false } },
          { senderId: null }
        ],
        $or: [
          { targetRole: { $in: ['all', currentUserRole] } },
          { targetRole: { $exists: false } },
          { targetRole: null }
        ]
      },
      { $addToSet: { readBy: currentUserId } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create notification
// @route   POST /api/notifications
// @access  Private
const createNotification = async (req, res, next) => {
  try {
    const { title, message, category, userId, senderId } = req.body;
    const notification = await Notification.create({
      userId,
      senderId: senderId || req.user._id || req.user.id,
      title,
      message,
      category: category || 'alert',
    });
    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation history logs between parents and teachers
// @route   GET /api/notifications/conversations
// @access  Private
const getConversations = async (req, res, next) => {
  try {
    const conversations = await Notification.find({
      $or: [
        { senderId: req.user._id },
        { senderId: req.user.id },
        { userId: req.user._id },
        { userId: req.user.id }
      ],
      category: 'user'
    })
    .sort({ createdAt: -1 })
    .populate('userId', 'name role')
    .populate('senderId', 'name role');

    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getConversations,
};
