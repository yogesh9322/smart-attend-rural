const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['attendance', 'user', 'notice', 'sync', 'leave', 'risk', 'alert', 'calendar'],
      default: 'alert',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.post('save', function (doc) {
  broadcastDoc(doc);
});

NotificationSchema.post('insertMany', function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach((doc) => broadcastDoc(doc));
  }
});

function broadcastDoc(doc) {
  try {
    const { getIo } = require('../services/socketService');
    const io = getIo();
    if (io) {
      io.emit('notification_received', doc);
      console.log(`[Socket] Broadcasted new notification: ${doc.title}`);
    }
  } catch (err) {
    // Socket.io might not be running in tests or some environments
  }
}

module.exports = mongoose.model('Notification', NotificationSchema);
