const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class ID is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      // We will normalize the date to midnight (YYYY-MM-DDT00:00:00.000Z) in controllers
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late'],
      required: [true, 'Status is required'],
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User who marked attendance is required'],
    },
    syncMode: {
      type: String,
      enum: ['online', 'offline'],
      default: 'online',
    },
    aiVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate attendance records for the same student on the same date
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
