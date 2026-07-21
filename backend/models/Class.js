const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      required: [true, 'Please add a grade (e.g. Grade 5, Class 10)'],
      trim: true,
    },
    section: {
      type: String,
      required: [true, 'Please add a section (e.g. A, B)'],
      trim: true,
    },
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please assign a class teacher'],
    },
    maxStudents: {
      type: Number,
      default: 40,
    },
    status: {
      type: String,
      enum: ['Active', 'Archived'],
      default: 'Active',
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    roomNo: {
      type: String,
      trim: true,
    },
    academicYear: {
      type: String,
      default: () => {
        const year = new Date().getFullYear();
        return `${year}-${year + 1}`;
      },
    },
  },
  {
    timestamps: true,
  }
);

// Ensure grade + section combination is unique
ClassSchema.index({ grade: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('Class', ClassSchema);
