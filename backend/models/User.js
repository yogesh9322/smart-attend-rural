const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
      lowercase: true,
    },
    password: {
      type: String,
      required: false,
      select: false, // Don't return password by default
    },
    googleId: {
      type: String,
      default: '',
    },
    loginProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    passwordChangedAt: {
      type: Date,
    },
    role: {
      type: String,
      enum: ['admin', 'teacher', 'parent'],
      required: [true, 'Please assign a role'],
    },
    phone: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    countryCode: {
      type: String,
      default: '+91',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Deactivated'],
      default: 'Active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    whatsappEnabled: {
      type: Boolean,
      default: true,
    },
    photo: {
      type: String,
      default: '',
    },
    // Teacher-specific properties
    teacherId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    employeeId: {
      type: String,
      trim: true,
    },
    qualification: {
      type: String,
      trim: true,
    },
    experience: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      type: String,
      trim: true,
    },
    joiningDate: {
      type: Date,
    },
    // Parent-specific properties
    occupation: {
      type: String,
      trim: true,
    },
    village: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    relationship: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian'],
      default: 'Father',
    },
    language: {
      type: String,
      default: 'English',
    },
    parentIdCode: {
      type: String,
      trim: true,
    },
    // Used by teachers to list assigned classes
    assignedClasses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
      },
    ],
    // Used by parents to link to their children
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = function () {
  const crypto = require('crypto');
  
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);
