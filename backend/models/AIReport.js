const mongoose = require('mongoose');

const AIReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    trend: {
      type: String,
      required: true,
    },
    topClasses: [String],
    lowAttendance: [String],
    recommendations: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AIReport', AIReportSchema);
