const Notification = require('../models/Notification');

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const filter = {
      $or: [
        { userId: req.user.id },
        { userId: { $exists: false } },
        { userId: null }
      ]
    };

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .populate('senderId', 'name role')
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      ...filter,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      {
        $or: [
          { userId: req.user.id },
          { userId: { $exists: false } },
          { userId: null }
        ],
        isRead: false
      },
      { isRead: true }
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
