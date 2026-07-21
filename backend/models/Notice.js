const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a notice title'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Please add notice content'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'Holiday', 'Examination', 'Meeting', 'Emergency', 'Government', 'Event', 'General',
        'Homework', 'Assignment', 'Test', 'Practical', 'Reminder', 'Project', 'Classroom Activity'
      ],
      default: 'General',
    },
    noticeType: {
      type: String,
      enum: ['School', 'Class'],
      default: 'School',
    },
    scope: {
      type: String,
      enum: ['Entire School', 'Assigned Class', 'All Assigned Classes'],
      default: 'Entire School',
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByRole: {
      type: String,
      enum: ['admin', 'teacher'],
      default: 'admin',
    },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium',
    },
    attachment: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Published', 'Draft', 'Scheduled', 'Archived'],
      default: 'Published',
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    targetAudience: {
      type: String,
      enum: ['all', 'teachers', 'parents', 'class'],
      default: 'all',
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Notice', NoticeSchema);
