const mongoose = require('mongoose');

const AIPredictionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
    },
    probability: {
      type: Number,
      required: true,
    },
    trend: {
      type: String,
      enum: ['Improving', 'Stable', 'Declining'],
      required: true,
    },
    predictionText: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AIPrediction', AIPredictionSchema);
