const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fromDate: {
    type: Date,
    required: true,
  },
  toDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  remarks: {
    type: String,
    default: '',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

LeaveRequestSchema.post('save', function (doc) {
  try {
    const { getIo } = require('../services/socketService');
    const io = getIo();
    if (io) {
      io.emit('leave_updated', doc);
      console.log(`[Socket] Broadcasted leave_updated for leave ID: ${doc._id}`);
    }
  } catch (err) {
    // Socket.io might not be running in tests or some environments
  }
});

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);
