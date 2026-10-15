const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: [true, 'School name is required'],
      default: 'Smart Rural Model School',
    },
    schoolLogo: {
      type: String,
      default: '',
    },
    timezone: {
      type: String,
      default: process.env.TIMEZONE || 'Asia/Kolkata',
    },
    startTime: {
      type: String,
      default: '09:00', // HH:MM
    },
    endTime: {
      type: String,
      default: '15:30', // HH:MM
    },
    weeklyOffs: {
      type: [Number],
      default: [0], // 0 for Sunday
    },
    allowMultipleAttendance: {
      type: Boolean,
      default: true,
    },
    holidays: [
      {
        date: {
          type: Date,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Settings', SettingsSchema);
