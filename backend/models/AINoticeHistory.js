const mongoose = require('mongoose');

const AINoticeHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalText: {
      type: String,
      required: true,
    },
    englishNotice: {
      type: String,
      required: true,
    },
    hindiNotice: {
      type: String,
      required: true,
    },
    marathiNotice: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AINoticeHistory', AINoticeHistorySchema);
