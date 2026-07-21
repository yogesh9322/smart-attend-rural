const User = require('../models/User');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/activityLogger');
const sendEmail = require('../utils/sendEmail');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_smart_attend_rural_key_998877', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Private/Admin
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, assignedClasses, children } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      assignedClasses,
      children,
    });

    if (req.user) {
      await logActivity(req.user.id, 'CREATE_USER', `Created ${role} user: ${name} (${email})`, req);
      
      const Notification = require('../models/Notification');
      await Notification.create({
        title: `New ${role === 'teacher' ? 'Teacher' : 'Parent'} Added`,
        message: `${role === 'teacher' ? 'Teacher' : 'Parent'} account registered for ${name} (${email}).`,
        category: 'user',
      });
    }

    // Send registration email notification
    try {
      const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5174'}/login`; // dynamic frontend URL
      await sendEmail({
        email: user.email,
        subject: `Welcome to SmartAttend - Added as ${role === 'teacher' ? 'Faculty' : 'Parent'}`,
        message: `Dear ${user.name},\n\nWelcome to SmartAttend Rural!\n\nYou have been registered as a ${role === 'teacher' ? 'Faculty member (Teacher)' : 'Parent'} by the school administration.\n\nHere are your login credentials to access your dashboard:\nEmail: ${user.email}\nPassword: ${password}\n\nPlease log in at: ${loginUrl}\n\nThank you,\nSmartAttend Administration`,
      });
      if (req.user) {
        await logActivity(req.user.id, 'EMAIL_NOTIFICATION_SENT', `Welcome email sent successfully to ${role} ${user.name} (${user.email})`);
      }
    } catch (mailErr) {
      console.error('Failed to send registration welcome email:', mailErr.message);
      if (req.user) {
        await logActivity(req.user.id, 'EMAIL_NOTIFICATION_FAILED', `Failed to send welcome email to ${role} ${user.name} (${user.email}). Error: ${mailErr.message}`);
      }
    }

    // Send registration welcome SMS notification
    if (user.phone) {
      try {
        const sendSMS = require('../utils/sendSMS');
        const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5174'}/login`;
        await sendSMS({
          phone: user.phone,
          countryCode: user.countryCode || '+91',
          message: `SmartAttend Rural\n\nDear ${user.name},\n\nWelcome to SmartAttend! Your Faculty account has been created by the school administration.\n\nHere are your login credentials:\nEmail: ${user.email}\nPassword: ${password}\n\nPlease log in at: ${loginUrl}\n\nThank you,\nABC Rural School`,
        });
        if (req.user) {
          await logActivity(req.user.id, 'SMS_NOTIFICATION_SENT', `Welcome SMS sent successfully to ${role} ${user.name} (${user.phone})`);
        }
      } catch (smsErr) {
        console.error('Failed to send registration welcome SMS:', smsErr.message);
        if (req.user) {
          await logActivity(req.user.id, 'SMS_NOTIFICATION_FAILED', `Failed to send welcome SMS to ${role} ${user.name} (${user.phone}). Error: ${smsErr.message}`);
        }
      }
    }

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update lastLogin timestamp in database
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Log login activity
    await logActivity(user._id, 'LOGIN', `${user.name} logged in successfully`, req);

    // Fetch child relationships if parent
    let childrenDetails = [];
    if (user.role === 'parent') {
      childrenDetails = await Student.find({ parentId: user._id }).populate('classId');
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || user.phoneNumber,
        alternatePhone: user.alternatePhone || user.emergencyContact,
        photo: user.photo,
        lastLogin: user.lastLogin,
        passwordChangedAt: user.passwordChangedAt,
        qualification: user.qualification,
        subject: user.subject,
        experience: user.experience,
        emergencyContact: user.emergencyContact || user.alternatePhone,
        address: user.address,
        village: user.village,
        city: user.city || user.village,
        state: user.state || 'Gujarat',
        pincode: user.pincode,
        relationship: user.relationship || 'Father',
        language: user.language || 'English',
        parentIdCode: user.parentIdCode,
        occupation: user.occupation,
        employeeId: user.employeeId || user.teacherId,
        joiningDate: user.joiningDate,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        assignedClasses: user.assignedClasses,
        children: childrenDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    let childrenDetails = [];
    if (user.role === 'parent') {
      childrenDetails = await Student.find({ parentId: user._id }).populate('classId');
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || user.phoneNumber,
        alternatePhone: user.alternatePhone || user.emergencyContact,
        photo: user.photo,
        lastLogin: user.lastLogin,
        passwordChangedAt: user.passwordChangedAt,
        qualification: user.qualification,
        subject: user.subject,
        experience: user.experience,
        emergencyContact: user.emergencyContact || user.alternatePhone,
        address: user.address,
        village: user.village,
        city: user.city || user.village,
        state: user.state || 'Gujarat',
        pincode: user.pincode,
        relationship: user.relationship || 'Father',
        language: user.language || 'English',
        parentIdCode: user.parentIdCode,
        occupation: user.occupation,
        employeeId: user.employeeId || user.teacherId,
        joiningDate: user.joiningDate,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        assignedClasses: user.assignedClasses,
        children: childrenDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all parents
// @route   GET /api/auth/parents
// @access  Private/Admin
const getParents = async (req, res, next) => {
  try {
    const parents = await User.find({ role: 'parent' }).select('name email phone');
    res.status(200).json({
      success: true,
      data: parents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all teachers with linked record status
// @route   GET /api/auth/teachers
// @access  Private/Admin
const getTeachers = async (req, res, next) => {
  try {
    const teachers = await User.find({ role: 'teacher' })
      .select('name email phone assignedClasses status isActive photo qualification subject experience createdAt joiningDate')
      .populate('assignedClasses', 'grade section');

    const Attendance = require('../models/Attendance');
    const Notice = require('../models/Notice');
    const Class = require('../models/Class');

    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const teacherObj = teacher.toObject();
        const [attendanceCount, noticeCount, classCount] = await Promise.all([
          Attendance.countDocuments({ markedBy: teacher._id }),
          Notice.countDocuments({ createdBy: teacher._id }),
          Class.countDocuments({ $or: [{ classTeacherId: teacher._id }, { _id: { $in: teacher.assignedClasses || [] } }] })
        ]);

        const hasLinkedRecords = (attendanceCount + noticeCount + classCount) > 0;
        return {
          ...teacherObj,
          attendanceCount,
          noticeCount,
          classCount,
          hasLinkedRecords,
          isActive: teacherObj.isActive !== undefined ? teacherObj.isActive : (teacherObj.status !== 'Deactivated')
        };
      })
    );

    res.status(200).json({
      success: true,
      data: teachersWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Teacher details by Admin
// @route   PUT /api/auth/teachers/:id
// @access  Private/Admin
const updateTeacher = async (req, res, next) => {
  try {
    const { name, email, phone, qualification, subject, experience, assignedClasses } = req.body;
    let teacher = await User.findById(req.params.id);

    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher record not found' });
    }

    if (name) teacher.name = name;
    if (email) teacher.email = email.toLowerCase();
    if (phone) teacher.phone = phone;
    if (qualification !== undefined) teacher.qualification = qualification;
    if (subject !== undefined) teacher.subject = subject;
    if (experience !== undefined) teacher.experience = experience;
    if (assignedClasses !== undefined) teacher.assignedClasses = assignedClasses;

    await teacher.save();

    res.status(200).json({
      success: true,
      message: 'Teacher details updated successfully',
      data: teacher,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Teacher Password by Admin
// @route   PUT /api/auth/teachers/:id/reset-password
// @access  Private/Admin
const resetTeacherPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Please provide a valid password (minimum 6 characters)' });
    }

    let teacher = await User.findById(req.params.id).select('+password');
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher record not found' });
    }

    teacher.password = newPassword;
    await teacher.save();

    res.status(200).json({
      success: true,
      message: `Password reset successfully for ${teacher.name}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Teacher Active/Deactivated status
// @route   PUT /api/auth/teachers/:id/toggle-status
// @access  Private/Admin
const toggleTeacherStatus = async (req, res, next) => {
  try {
    let teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher record not found' });
    }

    const currentActive = teacher.isActive !== false && teacher.status !== 'Deactivated';
    const newActiveState = !currentActive;

    teacher.isActive = newActiveState;
    teacher.status = newActiveState ? 'Active' : 'Deactivated';
    await teacher.save();

    res.status(200).json({
      success: true,
      message: `Teacher account ${newActiveState ? 'activated' : 'deactivated'} successfully`,
      data: teacher,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Teacher record by Admin
// @route   DELETE /api/auth/teachers/:id
// @access  Private/Admin
const deleteTeacher = async (req, res, next) => {
  try {
    let teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher record not found' });
    }

    await teacher.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Teacher record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password Request
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No user registered with this email address' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5174';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    const htmlMessage = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="background-color: #2E7D32; padding: 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">SmartAttend Rural</h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">AI-Powered Attendance Management</p>
      </div>
      <div style="padding: 32px; background-color: #ffffff;">
        <h2 style="margin-top: 0; color: #1a202c; font-size: 20px;">Password Reset Request</h2>
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">Hello ${user.name},</p>
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">You are receiving this email because you (or someone else) requested a password reset for your account. Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: #2E7D32; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #718096; font-size: 12px; line-height: 1.6;">This link is valid for 10 minutes. If you did not request this reset, please ignore this email and your password will remain unchanged.</p>
        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 24px 0;" />
        <p style="color: #a0aec0; font-size: 11px;">If the button above does not work, copy and paste the link below into your browser:</p>
        <p style="color: #3182ce; font-size: 11px; word-break: break-all;">${resetUrl}</p>
      </div>
      <div style="background-color: #f7fafc; padding: 16px; text-align: center; color: #a0aec0; font-size: 12px; border-top: 1px solid #edf2f7;">
        © ${new Date().getFullYear()} SmartAttend Rural. All rights reserved.
      </div>
    </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'SmartAttend Password Reset Request',
        message: `You are receiving this email because you (or someone else) requested a password reset. Please use the following link to reset your password:\n\n${resetUrl}`,
        html: htmlMessage,
      });

      await logActivity(user._id, 'EMAIL_NOTIFICATION_SENT', `Password reset email successfully sent to ${user.email}`);

      res.status(200).json({ success: true, message: 'Password reset link sent to your email.' });
    } catch (err) {
      console.error(err);
      await logActivity(user._id, 'EMAIL_NOTIFICATION_FAILED', `Failed to send password reset email to ${user.email}. Error: ${err.message}`);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ success: false, message: 'Email could not be sent. Please try again later.' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const crypto = require('crypto');

    // Hash token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    await logActivity(user._id, 'RESET_PASSWORD', `Password reset successfully for ${user.name}`, req);

    res.status(200).json({ success: true, message: 'Password reset successful. You can now log in with your new password.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Update User Profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      alternatePhone,
      village,
      address,
      city,
      state,
      pincode,
      relationship,
      language,
      photo,
      qualification,
      experience,
      subject,
      emergencyContact,
      occupation
    } = req.body;

    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (email) fieldsToUpdate.email = email;
    if (phone !== undefined) {
      fieldsToUpdate.phone = phone;
      fieldsToUpdate.phoneNumber = phone;
    }
    if (alternatePhone !== undefined) fieldsToUpdate.alternatePhone = alternatePhone;
    if (photo !== undefined) fieldsToUpdate.photo = photo;
    if (qualification !== undefined) fieldsToUpdate.qualification = qualification;
    if (experience !== undefined) fieldsToUpdate.experience = experience;
    if (subject !== undefined) fieldsToUpdate.subject = subject;
    if (emergencyContact !== undefined) fieldsToUpdate.emergencyContact = emergencyContact;
    if (address !== undefined) fieldsToUpdate.address = address;
    if (village !== undefined) fieldsToUpdate.village = village;
    if (city !== undefined) fieldsToUpdate.city = city;
    if (state !== undefined) fieldsToUpdate.state = state;
    if (pincode !== undefined) fieldsToUpdate.pincode = pincode;
    if (relationship !== undefined) fieldsToUpdate.relationship = relationship;
    if (language !== undefined) fieldsToUpdate.language = language;
    if (occupation !== undefined) fieldsToUpdate.occupation = occupation;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );

    await logActivity(req.user.id, 'UPDATE_PROFILE', `Profile details updated for: ${user.name}`, req);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change Password
// @route   PUT /api/auth/changepassword
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as your current password.' });
    }

    const user = await User.findById(req.user.id).select('+password');
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    await logActivity(req.user.id, 'CHANGE_PASSWORD', `Password changed successfully for ${user.name}`, req);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      passwordChangedAt: user.passwordChangedAt,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth Login & Verification
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res, next) => {
  try {
    const { token, credential } = req.body;
    const idToken = token || credential;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google Token is required' });
    }

    let googleUser = null;
    const fetch = require('node-fetch').default || global.fetch;

    // 1. Try fetching user details via Google UserInfo API (handles access_token from Google popup)
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        if (userInfo && userInfo.email) {
          googleUser = {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            sub: userInfo.sub,
            email_verified: userInfo.email_verified
          };
        }
      }
    } catch (apiErr) {
      console.warn('Google UserInfo API fetch error:', apiErr.message);
    }

    // 2. Fallback to verifyIdToken or JWT decode if token is an ID Token
    if (!googleUser) {
      const { OAuth2Client } = require('google-auth-library');
      const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

      if (googleClientId) {
        try {
          const client = new OAuth2Client(googleClientId);
          const ticket = await client.verifyIdToken({
            idToken,
            audience: googleClientId,
          });
          const payload = ticket.getPayload();
          googleUser = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            sub: payload.sub,
            email_verified: payload.email_verified
          };
        } catch (verifyErr) {
          console.warn('Google verifyIdToken error:', verifyErr.message);
          const jwt = require('jsonwebtoken');
          const decoded = jwt.decode(idToken);
          if (decoded && decoded.email) {
            googleUser = {
              email: decoded.email,
              name: decoded.name || decoded.email.split('@')[0],
              picture: decoded.picture || '',
              sub: decoded.sub || decoded.user_id || '',
              email_verified: true
            };
          }
        }
      } else {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(idToken);
        if (decoded && decoded.email) {
          googleUser = {
            email: decoded.email,
            name: decoded.name || decoded.email.split('@')[0],
            picture: decoded.picture || '',
            sub: decoded.sub || decoded.user_id || '',
            email_verified: true
          };
        }
      }
    }

    if (!googleUser || !googleUser.email) {
      return res.status(400).json({
        success: false,
        message: 'Unable to verify your Google account.'
      });
    }

    const emailClean = googleUser.email.toLowerCase();

    // Search for existing user in MongoDB database
    let user = await User.findOne({ email: emailClean });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'This Google account is not registered with SmartAttend Rural. Please contact your School Administrator.'
      });
    }

    // Update user details with Google metadata
    user.googleId = googleUser.sub || user.googleId;
    user.loginProvider = 'google';
    user.isEmailVerified = true;
    user.lastLogin = new Date();
    if (!user.photo && googleUser.picture) {
      user.photo = googleUser.picture;
    }
    await user.save();

    await logActivity(user._id, 'GOOGLE_LOGIN', `Logged in via Google OAuth as ${user.name} (${user.role})`, req);

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        photo: user.photo,
        lastLogin: user.lastLogin,
        passwordChangedAt: user.passwordChangedAt,
        qualification: user.qualification,
        subject: user.subject,
        experience: user.experience,
        emergencyContact: user.emergencyContact,
        address: user.address,
        village: user.village,
        occupation: user.occupation,
        employeeId: user.employeeId || user.teacherId,
        joiningDate: user.joiningDate,
        assignedClasses: user.assignedClasses,
        children: user.children,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  getParents,
  getTeachers,
  updateTeacher,
  resetTeacherPassword,
  toggleTeacherStatus,
  deleteTeacher,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
  googleLogin,
};
