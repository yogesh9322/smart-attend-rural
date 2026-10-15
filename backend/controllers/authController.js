const User = require('../models/User');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/activityLogger');
const sendEmail = require('../utils/sendEmail');
const {
  getSchoolName,
  getAppBaseUrl,
  buildPasswordResetEmail,
  buildWelcomeCredentialsEmail,
} = require('../utils/emailBranding');

// Generate JWT token
const generateToken = (id, email, role) => {
  return jwt.sign({ id, email, role }, process.env.JWT_SECRET || 'super_secret_smart_attend_rural_key_998877', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Private/Admin
const registerUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      assignedClasses,
      children,
      qualification,
      subject,
      experience,
      teacherId,
      employeeId
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email address, password, and role.'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      const existingRoleLabel =
        userExists.role === 'parent'
          ? 'Parent'
          : userExists.role === 'teacher'
          ? 'Teacher'
          : userExists.role === 'admin'
          ? 'Administrator'
          : userExists.role;
      return res.status(400).json({
        success: false,
        message: `An account with email "${normalizedEmail}" is already registered as a ${existingRoleLabel}. Please use a unique email address.`
      });
    }

    // Create user
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      role,
      phone: phone ? String(phone).trim() : '',
      assignedClasses: assignedClasses || [],
      children: children || [],
      qualification: qualification ? String(qualification).trim() : '',
      subject: subject ? String(subject).trim() : '',
      experience: experience ? String(experience).trim() : '',
      teacherId,
      employeeId
    });

    if (req.user) {
      await logActivity(req.user.id, 'CREATE_USER', `Created ${role} user: ${name} (${email})`, req);
      
      const Notification = require('../models/Notification');
      await Notification.create({
        senderId: req.user.id,
        targetRole: 'admin',
        title: `New ${role === 'teacher' ? 'Teacher' : 'Parent'} Added`,
        message: `${role === 'teacher' ? 'Teacher' : 'Parent'} account registered for ${name} (${email}).`,
        category: 'user',
      });
    }

    // Resolve configured school name and base URL
    const schoolName = await getSchoolName();
    const appBaseUrl = getAppBaseUrl();
    const loginUrl = `${appBaseUrl}/login`;

    // Send registration email notification
    try {
      const emailContent = buildWelcomeCredentialsEmail({
        user,
        password,
        role,
        schoolName,
        appBaseUrl,
      });

      await sendEmail({
        email: user.email,
        subject: emailContent.subject,
        message: emailContent.message,
        html: emailContent.html,
        schoolName,
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
        const roleLabel = role === 'teacher' ? 'Faculty' : 'Parent';
        await sendSMS({
          phone: user.phone,
          countryCode: user.countryCode || '+91',
          message: `SmartAttend Rural\n\nDear ${user.name},\n\nWelcome to SmartAttend! Your ${roleLabel} account has been created by the school administration at ${schoolName}.\n\nHere are your login credentials:\nEmail: ${user.email}\nPassword: ${password}\n\nPlease log in at: ${loginUrl}\n\nThank you,\n${schoolName} | Powered by SmartAttend Rural`,
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
      token: generateToken(user._id, user.email, user.role),
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
      await logActivity(null, 'FAILED_LOGIN', `Failed login attempt: Unregistered email "${email}"`, req);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await logActivity(user._id, 'FAILED_LOGIN', `Failed login attempt for ${user.name} (${user.email}) - Incorrect password`, req);
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
      token: generateToken(user._id, user.email, user.role),
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

    if (req.user) {
      await logActivity(req.user.id, 'UPDATE_TEACHER', `Updated details for teacher: ${teacher.name} (${teacher.email})`, req);
    }

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

    if (req.user) {
      await logActivity(req.user.id, 'PASSWORD_RESET_ADMIN', `Administrator reset password for teacher: ${teacher.name} (${teacher.email})`, req);
    }

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

    if (req.user) {
      await logActivity(req.user.id, 'STATUS_CHANGE', `Changed account status to ${newActiveState ? 'Active' : 'Deactivated'} for teacher: ${teacher.name}`, req);
    }

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

    const teacherName = teacher.name;
    const teacherEmail = teacher.email;
    await teacher.deleteOne();

    if (req.user) {
      await logActivity(req.user.id, 'DELETE_TEACHER', `Deleted teacher account: ${teacherName} (${teacherEmail})`, req);
    }

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

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });

    if (!user) {
      // Security: avoid email enumeration by returning generic success response
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email address, a password reset link has been dispatched.',
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Resolve configured school name and base URL
    const schoolName = await getSchoolName();
    const appBaseUrl = getAppBaseUrl();

    const emailContent = buildPasswordResetEmail({
      user,
      resetToken,
      schoolName,
      appBaseUrl,
    });

    try {
      await sendEmail({
        email: user.email,
        subject: emailContent.subject,
        message: emailContent.message,
        html: emailContent.html,
        schoolName,
      });

      await logActivity(user._id, 'EMAIL_NOTIFICATION_SENT', `Password reset email successfully dispatched for ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'If an account exists with this email address, a password reset link has been dispatched.',
      });
    } catch (err) {
      console.error(`Password reset dispatch error for user:`, err.message);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${idToken}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
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
      token: generateToken(user._id, user.email, user.role),
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
