const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a student name'],
      trim: true,
    },
    rollNo: {
      type: String,
      required: [true, 'Please add a roll number'],
      trim: true,
    },
    admissionNo: {
      type: String,
      required: [true, 'Please add an admission number'],
      unique: true,
      trim: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Please assign a class'],
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please link a parent user'],
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: [true, 'Please select gender'],
    },
    dob: {
      type: Date,
    },
    photoUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure roll number is unique within a single class
StudentSchema.index({ classId: 1, rollNo: 1 }, { unique: true });

module.exports = mongoose.model('Student', StudentSchema);
