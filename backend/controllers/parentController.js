const User = require('../models/User');
const Student = require('../models/Student');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get all parents
// @route   GET /api/parents
// @access  Private/Admin
const getParentsList = async (req, res, next) => {
  try {
    const parents = await User.find({ role: 'parent' })
      .populate({
        path: 'children',
        populate: { path: 'classId', select: 'grade section' },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: parents.length,
      data: parents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create parent user profile
// @route   POST /api/parents
// @access  Private/Admin
const createParentProfile = async (req, res, next) => {
  try {
    const { name, email, password, phone, occupation, village, address } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const parent = await User.create({
      name,
      email,
      password,
      role: 'parent',
      phone,
      occupation,
      village,
      address,
    });

    await logActivity(req.user.id, 'CREATE_PARENT', `Created parent user: ${name} (${email})`, req);

    // Send welcome email notification to parent
    try {
      const sendEmail = require('../utils/sendEmail');
      const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5174'}/login`;
      await sendEmail({
        email: parent.email,
        subject: 'Welcome to SmartAttend - Added as Parent',
        message: `Dear ${parent.name},\n\nWelcome to SmartAttend Rural!\n\nYou have been registered as a Parent by the school administration.\n\nHere are your login credentials to access your dashboard:\nEmail: ${parent.email}\nPassword: ${password || 'password123'}\n\nPlease log in at: ${loginUrl}\n\nThank you,\nSmartAttend Administration`,
      });
      await logActivity(req.user.id, 'EMAIL_NOTIFICATION_SENT', `Welcome email sent successfully to Parent ${parent.name} (${parent.email})`);
    } catch (mailErr) {
      console.error('Failed to send parent welcome email:', mailErr.message);
      await logActivity(req.user.id, 'EMAIL_NOTIFICATION_FAILED', `Failed to send welcome email to Parent ${parent.name} (${parent.email}). Error: ${mailErr.message}`);
    }

    // Send welcome SMS notification to parent
    if (parent.phone) {
      try {
        const sendSMS = require('../utils/sendSMS');
        const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5174'}/login`;
        await sendSMS({
          phone: parent.phone,
          countryCode: parent.countryCode || '+91',
          message: `SmartAttend Rural\n\nDear ${parent.name},\n\nWelcome to SmartAttend! Your Parent account has been created by the school administration.\n\nHere are your login credentials:\nEmail: ${parent.email}\nPassword: ${password || 'password123'}\n\nPlease log in at: ${loginUrl}\n\nThank you,\nABC Rural School`,
        });
        await logActivity(req.user.id, 'SMS_NOTIFICATION_SENT', `Welcome SMS sent successfully to Parent ${parent.name} (${parent.phone})`);
      } catch (smsErr) {
        console.error('Failed to send parent welcome SMS:', smsErr.message);
        await logActivity(req.user.id, 'SMS_NOTIFICATION_FAILED', `Failed to send welcome SMS to Parent ${parent.name} (${parent.phone}). Error: ${smsErr.message}`);
      }
    }

    res.status(201).json({
      success: true,
      data: parent,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update parent details
// @route   PUT /api/parents/:id
// @access  Private/Admin
const updateParentProfile = async (req, res, next) => {
  try {
    const { name, email, phone, occupation, village, address } = req.body;

    let parent = await User.findById(req.params.id);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }

    // Capture old details for diff comparison
    const oldDetails = {
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      occupation: parent.occupation,
      village: parent.village,
      address: parent.address,
    };

    parent = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, occupation, village, address },
      { new: true, runValidators: true }
    );

    await logActivity(req.user.id, 'UPDATE_PARENT', `Updated parent: ${name}`, req);

    // Send change log email to parent
    try {
      const sendEmail = require('../utils/sendEmail');
      const changes = [];
      if (oldDetails.name !== parent.name) changes.push(`- Name: "${oldDetails.name}" ➔ "${parent.name}"`);
      if (oldDetails.email !== parent.email) changes.push(`- Email: "${oldDetails.email}" ➔ "${parent.email}"`);
      if (oldDetails.phone !== parent.phone) changes.push(`- Phone: "${oldDetails.phone || 'N/A'}" ➔ "${parent.phone || 'N/A'}"`);
      if (oldDetails.occupation !== parent.occupation) changes.push(`- Occupation: "${oldDetails.occupation || 'N/A'}" ➔ "${parent.occupation || 'N/A'}"`);
      if (oldDetails.village !== parent.village) changes.push(`- Village: "${oldDetails.village || 'N/A'}" ➔ "${parent.village || 'N/A'}"`);
      if (oldDetails.address !== parent.address) changes.push(`- Address: "${oldDetails.address || 'N/A'}" ➔ "${parent.address || 'N/A'}"`);

      if (changes.length > 0) {
        const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5174'}/login`;
        await sendEmail({
          email: parent.email,
          subject: 'SmartAttend - Profile Details Updated',
          message: `Dear ${parent.name},\n\nWe would like to inform you that your profile details have been updated by the school administration:\n\n${changes.join('\n')}\n\nPlease log in at: ${loginUrl} to review the changes.\n\nThank you,\nSmartAttend Administration`,
        });

        // Send profile update SMS alert to parent
        if (parent.phone) {
          try {
            const sendSMS = require('../utils/sendSMS');
            await sendSMS({
              phone: parent.phone,
              countryCode: parent.countryCode || '+91',
              message: `SmartAttend Rural\n\nDear ${parent.name},\n\nWe would like to inform you that your profile details have been updated by the school administration:\n\n${changes.join('\n')}\n\nPlease log in at: ${loginUrl} to review the changes.\n\nThank you,\nABC Rural School`,
            });
          } catch (smsErr) {
            console.error('Failed to send parent profile update SMS:', smsErr.message);
          }
        }
      }
    } catch (mailErr) {
      console.error('Failed to send parent profile update notification email:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      data: parent,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete parent user account
// @route   DELETE /api/parents/:id
// @access  Private/Admin
const deleteParentProfile = async (req, res, next) => {
  try {
    const parent = await User.findById(req.params.id);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }

    // Un-link student associations
    await Student.updateMany({ parentId: parent._id }, { $unset: { parentId: '' } });

    await User.findByIdAndDelete(req.params.id);

    await logActivity(req.user.id, 'DELETE_PARENT', `Deleted parent: ${parent.name}`, req);

    res.status(200).json({
      success: true,
      message: 'Parent profile removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlink student/child from parent
// @route   POST /api/parents/:id/unlink-child
// @access  Private/Admin
const unlinkChildFromParent = async (req, res, next) => {
  try {
    const { studentId } = req.body;

    const parent = await User.findById(req.params.id);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }

    await User.findByIdAndUpdate(parent._id, {
      $pull: { children: studentId },
    });

    await Student.findByIdAndUpdate(studentId, {
      $unset: { parentId: '' },
    });

    await logActivity(req.user.id, 'UNLINK_CHILD', `Unlinked student from parent ${parent.name}`, req);

    res.status(200).json({
      success: true,
      message: 'Child unlinked from parent successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle parent account status (Active/Deactivated)
// @route   PUT /api/parents/:id/toggle-status
// @access  Private/Admin
const toggleParentStatus = async (req, res, next) => {
  try {
    const parent = await User.findById(req.params.id);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }

    const currentActive = parent.isActive !== false && parent.status !== 'Deactivated';
    const newActiveState = !currentActive;

    parent.isActive = newActiveState;
    parent.status = newActiveState ? 'Active' : 'Deactivated';
    await parent.save();

    res.status(200).json({
      success: true,
      message: `Parent account ${newActiveState ? 'activated' : 'deactivated'} successfully`,
      data: parent,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset parent login password
// @route   PUT /api/parents/:id/reset-password
// @access  Private/Admin
const resetParentPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const parent = await User.findById(req.params.id).select('+password');
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }

    parent.password = newPassword;
    await parent.save();

    res.status(200).json({
      success: true,
      message: `Password reset successfully for ${parent.name}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Link student/child to parent
// @route   POST /api/parents/:id/link-child
// @access  Private/Admin
const linkChildToParent = async (req, res, next) => {
  try {
    const { studentId } = req.body;

    const parent = await User.findById(req.params.id);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Link student to parent
    await User.findByIdAndUpdate(parent._id, {
      $addToSet: { children: student._id },
    });

    // Update parentId link on Student
    student.parentId = parent._id;
    await student.save();

    await logActivity(req.user.id, 'LINK_CHILD', `Linked child ${student.name} to parent ${parent.name}`, req);

    res.status(200).json({
      success: true,
      message: 'Child linked to parent successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teacher contact details for a student
// @route   GET /api/parent/teacher-contact/:studentId
// @access  Private/Parent
const getTeacherContact = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Security: Only allow parents to access their linked children teacher contacts
    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.id);
      if (!parent || !parent.children.includes(studentId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to access contact info for this student.' });
      }
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const Class = require('../models/Class');
    const assignedClass = await Class.findById(student.classId);
    if (!assignedClass) {
      return res.status(404).json({ success: false, message: 'Assigned classroom standard not found.' });
    }

    const teacher = await User.findById(assignedClass.classTeacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'No teacher currently assigned to this classroom standard.' });
    }

    res.status(200).json({
      success: true,
      data: {
        teacherName: teacher.name,
        phoneNumber: teacher.phone || teacher.phoneNumber || '',
        countryCode: teacher.countryCode || '+91',
        email: teacher.email,
        class: assignedClass.grade,
        section: assignedClass.section,
        whatsappEnabled: teacher.whatsappEnabled !== undefined ? teacher.whatsappEnabled : true,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getParentsList,
  createParentProfile,
  updateParentProfile,
  deleteParentProfile,
  linkChildToParent,
  unlinkChildFromParent,
  toggleParentStatus,
  resetParentPassword,
  getTeacherContact,
};
