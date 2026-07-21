const mongoose = require('mongoose');

const AIRecommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    items: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AIRecommendation', AIRecommendationSchema);
