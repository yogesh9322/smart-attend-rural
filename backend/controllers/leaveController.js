const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/sendSMS');
const { logActivity } = require('../utils/activityLogger');
const {
  getSchoolName,
  getAppBaseUrl,
  buildLeaveCreatedEmail,
  buildLeaveStatusEmail,
} = require('../utils/emailBranding');

// @desc    Create leave request
// @route   POST /api/leaves
// @access  Private/Parent
const createLeaveRequest = async (req, res, next) => {
  try {
    const { studentId, fromDate, toDate, reason } = req.body;

    if (!studentId || !fromDate || !toDate || !reason) {
      return res.status(400).json({ success: false, message: 'Please provide studentId, fromDate, toDate, and reason' });
    }

    // Authorization check: Parent can only request leave for linked children
    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.id);
      if (!parent.children.includes(studentId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to request leave for this student' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Only parents can submit leave requests' });
    }

    const leave = await LeaveRequest.create({
      studentId,
      parentId: req.user.id,
      fromDate,
      toDate,
      reason,
      status: 'Pending',
    });

    // Notify class teacher AND school admins about new leave request
    try {
      const student = await Student.findById(studentId).populate('classId');
      const notificationsToCreate = [];
      const fromStr = new Date(fromDate).toLocaleDateString();
      const toStr = new Date(toDate).toLocaleDateString();

      // Resolve configured school name and base URL
      const schoolName = await getSchoolName();
      const appBaseUrl = getAppBaseUrl();

      // 1. Notify Class Teacher if assigned
      if (student?.classId?.classTeacherId) {
        notificationsToCreate.push({
          userId: student.classId.classTeacherId,
          senderId: req.user.id,
          title: `📩 New Leave Request: ${student.name}`,
          message: `Leave requested for ${student.name} (${student.classId?.grade || 'Grade'}-${student.classId?.section || 'Section'}) from ${fromStr} to ${toStr}. Reason: "${reason}"`,
          category: 'leave',
          isRead: false,
        });

        // Send actual Email & SMS alert to the Class Teacher
        const teacherUser = await User.findById(student.classId.classTeacherId).select('name email phone');
        if (teacherUser) {
          const classStr = `${student.classId?.grade || 'Grade'}-${student.classId?.section || 'Section'}`;
          const teacherMsg = `New Leave Request: Leave requested for ${student.name} (${classStr}) from ${fromStr} to ${toStr}. Reason: "${reason}"`;

          if (teacherUser.email) {
            try {
              const emailContent = buildLeaveCreatedEmail({
                recipientName: teacherUser.name,
                recipientRole: 'Class Teacher',
                studentName: student.name,
                classStr,
                fromStr,
                toStr,
                reason,
                schoolName,
                appBaseUrl,
              });

              await sendEmail({
                email: teacherUser.email,
                subject: emailContent.subject,
                message: emailContent.message,
                html: emailContent.html,
                schoolName,
              });
              await logActivity(req.user.id, 'EMAIL_NOTIFICATION_SENT', `Sent leave create email alert to Teacher ${teacherUser.name} (${teacherUser.email})`);
            } catch (err) {
              await logActivity(req.user.id, 'EMAIL_NOTIFICATION_FAILED', `Failed to send leave create email to Teacher ${teacherUser.name} (${teacherUser.email}). Error: ${err.message}`);
            }
          }
          if (teacherUser.phone) {
            try {
              await sendSMS({
                phone: teacherUser.phone,
                message: `[SmartAttend] ${teacherMsg}\n\n${schoolName} | Powered by SmartAttend Rural`
              });
              await logActivity(req.user.id, 'SMS_NOTIFICATION_SENT', `Sent leave create SMS alert to Teacher ${teacherUser.name} (${teacherUser.phone})`);
            } catch (err) {
              await logActivity(req.user.id, 'SMS_NOTIFICATION_FAILED', `Failed to send leave create SMS to Teacher ${teacherUser.name} (${teacherUser.phone}). Error: ${err.message}`);
            }
          }
        }
      }

      // 2. Notify all School Administrators
      const admins = await User.find({ role: 'admin' }).select('name email phone');
      for (const admin of admins) {
        notificationsToCreate.push({
          userId: admin._id,
          senderId: req.user.id,
          title: `📩 New Leave Request: ${student?.name || 'Student'}`,
          message: `Parent submitted leave request for ${student?.name || 'Student'} (${student?.classId?.grade || 'Grade'}-${student?.classId?.section || 'Section'}) from ${fromStr} to ${toStr}. Reason: "${reason}"`,
          category: 'leave',
          isRead: false,
        });

        const classStr = `${student?.classId?.grade || 'Grade'}-${student?.classId?.section || 'Section'}`;
        const adminMsg = `Parent submitted leave request for ${student?.name || 'Student'} (${classStr}) from ${fromStr} to ${toStr}. Reason: "${reason}"`;

        if (admin.email) {
          try {
            const emailContent = buildLeaveCreatedEmail({
              recipientName: admin.name,
              recipientRole: 'Administrator',
              studentName: student?.name || 'Student',
              classStr,
              fromStr,
              toStr,
              reason,
              schoolName,
              appBaseUrl,
            });

            await sendEmail({
              email: admin.email,
              subject: emailContent.subject,
              message: emailContent.message,
              html: emailContent.html,
              schoolName,
            });
            await logActivity(req.user.id, 'EMAIL_NOTIFICATION_SENT', `Sent leave create email alert to Admin ${admin.name} (${admin.email})`);
          } catch (err) {
            await logActivity(req.user.id, 'EMAIL_NOTIFICATION_FAILED', `Failed to send leave create email to Admin ${admin.name} (${admin.email}). Error: ${err.message}`);
          }
        }
        if (admin.phone) {
          try {
            await sendSMS({
              phone: admin.phone,
              message: `[SmartAttend] ${adminMsg}\n\n${schoolName} | Powered by SmartAttend Rural`
            });
            await logActivity(req.user.id, 'SMS_NOTIFICATION_SENT', `Sent leave create SMS alert to Admin ${admin.name} (${admin.phone})`);
          } catch (err) {
            await logActivity(req.user.id, 'SMS_NOTIFICATION_FAILED', `Failed to send leave create SMS to Admin ${admin.name} (${admin.phone}). Error: ${err.message}`);
          }
        }
      }

      if (notificationsToCreate.length > 0) {
        await Notification.insertMany(notificationsToCreate);
      }
    } catch (err) {
      console.error('Notification error on leave create:', err.message);
    }

    res.status(201).json({
      success: true,
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leave requests list
// @route   GET /api/leaves
// @access  Private
const getLeaveRequests = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'parent') {
      // Parents can only view their own requests
      query.parentId = req.user.id;
    } else if (req.user.role === 'teacher') {
      // Teachers view requests for students in their assigned or classTeacher classes
      const teacher = await User.findById(req.user.id);
      const teacherClasses = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).select('_id');
      const classIds = teacherClasses.map(c => c._id);
      const students = await Student.find({ classId: { $in: classIds } }).select('_id');
      const studentIds = students.map(s => s._id);
      query.studentId = { $in: studentIds };
    }

    const leaves = await LeaveRequest.find(query)
      .populate({
        path: 'studentId',
        select: 'name rollNo classId admissionNo',
        populate: { path: 'classId', select: 'grade section' }
      })
      .populate('parentId', 'name phone email')
      .populate('approvedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update leave status (Approve/Reject)
// @route   PUT /api/leaves/:id
// @access  Private/Teacher/Admin
const updateLeaveStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide status (Approved or Rejected)' });
    }

    let leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    // Role check: Only teachers or admins
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to approve/reject leave requests' });
    }

    leave.status = status;
    leave.remarks = remarks || '';
    leave.approvedBy = req.user.id;
    if (status === 'Approved') {
      leave.approvedAt = new Date();
    }
    await leave.save();

    // Populate student and parent info for clean notification text
    const populatedLeave = await LeaveRequest.findById(leave._id)
      .populate('studentId', 'name')
      .populate('parentId', 'name email phone');

    const parentUser = populatedLeave?.parentId;
    const reviewerRoleTitle = req.user.role === 'admin' ? 'School Administrator' : 'Class Teacher';
    const approverName = req.user.name ? `${req.user.name} (${reviewerRoleTitle})` : reviewerRoleTitle;
    const childName = populatedLeave?.studentId?.name || 'your child';
    const fromStr = new Date(leave.fromDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const toStr = new Date(leave.toDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const statusMsg = `Leave request for ${childName} (${fromStr} - ${toStr}) has been ${status.toUpperCase()} by ${approverName}.${remarks ? ` Remarks: "${remarks}"` : ''}`;

    // 1. Trigger in-app notification to Parent
    if (leave.parentId) {
      await Notification.create({
        userId: leave.parentId,
        senderId: req.user.id,
        title: status === 'Approved' ? `✅ Leave Approved for ${childName}` : `❌ Leave Rejected for ${childName}`,
        message: statusMsg,
        category: 'leave',
        isRead: false,
      });
    }

    // Resolve configured school name and base URL
    const schoolName = await getSchoolName();
    const appBaseUrl = getAppBaseUrl();

    // 2. Dispatch SMS Alert to Parent (Twilio Gateway / Console Simulation)
    if (parentUser?.phone) {
      try {
        await sendSMS({
          phone: parentUser.phone,
          message: `[SmartAttend] Leave Request ${status.toUpperCase()} for ${childName} (${fromStr} to ${toStr}). Reviewed by ${approverName}.${remarks ? ` Remarks: "${remarks}"` : ''}\n\n${schoolName} | Powered by SmartAttend Rural`,
        });
        await logActivity(req.user.id, 'SMS_NOTIFICATION_SENT', `Sent leave status (${status}) SMS alert to Parent ${parentUser.name || ''} (${parentUser.phone})`);
      } catch (err) {
        console.error('Leave SMS dispatch error:', err.message);
        await logActivity(req.user.id, 'SMS_NOTIFICATION_FAILED', `Failed to send leave status (${status}) SMS alert to Parent ${parentUser.name || ''} (${parentUser.phone}). Error: ${err.message}`);
      }
    }

    // 3. Dispatch Email Alert to Parent (SMTP Nodemailer / Console Simulation)
    if (parentUser?.email) {
      try {
        const emailContent = buildLeaveStatusEmail({
          parentName: parentUser.name,
          childName,
          fromStr,
          toStr,
          status,
          approverName,
          remarks,
          schoolName,
          appBaseUrl,
        });

        await sendEmail({
          email: parentUser.email,
          subject: emailContent.subject,
          message: emailContent.message,
          html: emailContent.html,
          schoolName,
        });
        await logActivity(req.user.id, 'EMAIL_NOTIFICATION_SENT', `Sent leave status (${status}) email alert to Parent ${parentUser.name || ''} (${parentUser.email})`);
      } catch (err) {
        console.error('Leave Email dispatch error:', err.message);
        await logActivity(req.user.id, 'EMAIL_NOTIFICATION_FAILED', `Failed to send leave status (${status}) email alert to Parent ${parentUser.name || ''} (${parentUser.email}). Error: ${err.message}`);
      }
    }

    // 4. Cross-role notification (Teacher <-> Admin) to prevent confusion
    try {
      if (req.user.role === 'teacher') {
        // Teacher approved/rejected -> Notify all School Administrators
        const admins = await User.find({ role: 'admin' }).select('_id');
        const adminNotifs = admins.map(a => ({
          userId: a._id,
          senderId: req.user.id,
          title: `ℹ️ Leave ${status} by Teacher for ${childName}`,
          message: `Class Teacher ${req.user.name || ''} has ${status.toLowerCase()} leave for ${childName} (${fromStr} - ${toStr}).${remarks ? ` Remarks: "${remarks}"` : ''}`,
          category: 'leave',
          isRead: false,
        }));
        if (adminNotifs.length > 0) {
          await Notification.insertMany(adminNotifs);
        }
      } else if (req.user.role === 'admin') {
        // Admin approved/rejected -> Notify assigned Class Teacher
        const student = await Student.findById(leave.studentId).populate('classId');
        if (student?.classId?.classTeacherId) {
          await Notification.create({
            userId: student.classId.classTeacherId,
            senderId: req.user.id,
            title: `ℹ️ Leave ${status} by Admin for ${childName}`,
            message: `School Administrator ${req.user.name || ''} has ${status.toLowerCase()} leave for ${childName} (${fromStr} - ${toStr}).${remarks ? ` Remarks: "${remarks}"` : ''}`,
            category: 'leave',
            isRead: false,
          });
        }
      }
    } catch (err) {
      console.error('Cross-role leave notification error:', err.message);
    }

    res.status(200).json({
      success: true,
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLeaveRequest,
  getLeaveRequests,
  updateLeaveStatus,
};
