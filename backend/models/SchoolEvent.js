const mongoose = require('mongoose');

const SchoolEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    enum: ['Holiday', 'Exam', 'Meeting', 'Event'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

SchoolEventSchema.post('save', function (doc) {
  broadcastEvent('event_created', doc);
});

// Since findOneAndUpdate/Delete don't pass doc easily to post-hooks in Mongoose 5/6 without extra query,
// we can also listen to save / remove or just emit generally.
SchoolEventSchema.post('remove', function (doc) {
  broadcastEvent('event_deleted', doc);
});

function broadcastEvent(eventName, doc) {
  try {
    const { getIo } = require('../services/socketService');
    const io = getIo();
    if (io) {
      io.emit(eventName, doc);
      console.log(`[Socket] Broadcasted event ${eventName} for: ${doc?.title}`);
    }
  } catch (err) {
    // Socket.io might not be running in tests or some environments
  }
}

module.exports = mongoose.model('SchoolEvent', SchoolEventSchema);
