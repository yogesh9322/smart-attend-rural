const Notice = require('../models/Notice');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Notification = require('../models/Notification');
const { sendNoticeAlert } = require('../services/notificationService');

// ==============================================================================
// 1. GENERAL / COMPATIBILITY HANDLERS
// ==============================================================================

// @desc    Get notices (General entry point - role-enforced)
// @route   GET /api/notices
// @access  Private
const getNotices = async (req, res, next) => {
  if (req.user.role === 'admin') {
    return getAdminNotices(req, res, next);
  } else if (req.user.role === 'teacher') {
    return getTeacherNotices(req, res, next);
  } else if (req.user.role === 'parent') {
    return getParentNotices(req, res, next);
  } else {
    return res.status(403).json({ success: false, message: 'Access denied: unknown role' });
  }
};

// @desc    Get single notice with strict role & class authorization
// @route   GET /api/notices/:id
// @access  Private
const getNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id)
      .populate('createdBy', 'name role')
      .populate('classId', 'grade section');

    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    // Role-based authorization verification on the backend
    if (req.user.role === 'admin') {
      // Admins are authorized for all school and class notices
    } else if (req.user.role === 'teacher') {
      const isCreator =
        notice.createdBy?._id?.toString() === req.user.id ||
        notice.createdBy?.toString() === req.user.id;

      if (!isCreator) {
        if (notice.status !== 'Published') {
          return res.status(403).json({ success: false, message: 'Access denied to unpublished notice.' });
        }

        const isSchoolNotice =
          (notice.noticeType === 'School' || notice.scope === 'Entire School') &&
          ['all', 'teachers'].includes(notice.targetAudience);

        if (!isSchoolNotice) {
          const teacher = await User.findById(req.user.id);
          const authorizedClasses = await Class.find({
            $or: [
              { classTeacherId: req.user.id },
              { _id: { $in: teacher?.assignedClasses || [] } }
            ]
          }).select('_id');
          const classIds = authorizedClasses.map(c => c._id.toString());
          const noticeClassId = (notice.classId?._id || notice.classId)?.toString();

          if (!classIds.includes(noticeClassId)) {
            return res.status(403).json({ success: false, message: 'Access denied: notice not for your assigned classes.' });
          }
        }
      }
    } else if (req.user.role === 'parent') {
      if (notice.status !== 'Published') {
        return res.status(403).json({ success: false, message: 'Access denied to unpublished notice.' });
      }

      const isSchoolNotice =
        (notice.noticeType === 'School' || notice.scope === 'Entire School') &&
        ['all', 'parents'].includes(notice.targetAudience);

      if (!isSchoolNotice) {
        const parent = await User.findById(req.user.id);
        const children = await Student.find({
          $or: [
            { parentId: req.user.id },
            { _id: { $in: parent?.children || [] } }
          ]
        }).select('classId');
        const classIds = children.map(c => c.classId?.toString()).filter(Boolean);
        const noticeClassId = (notice.classId?._id || notice.classId)?.toString();

        if (!classIds.includes(noticeClassId)) {
          return res.status(403).json({ success: false, message: 'Access denied: notice not relevant to your children.' });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 2. ADMINISTRATOR (PRINCIPAL) HANDLERS
// ==============================================================================

// @desc    Get all notices for Admin (School & Class notices across the school, all statuses)
// @route   GET /api/admin/notices
// @access  Private/Admin
const getAdminNotices = async (req, res, next) => {
  try {
    const { status, noticeType, category, search } = req.query;
    let andConditions = [];

    if (status && status !== 'All') {
      andConditions.push({ status });
    }

    if (noticeType && noticeType !== 'All') {
      if (noticeType === 'School') {
        andConditions.push({
          $or: [{ noticeType: 'School' }, { scope: 'Entire School' }]
        });
      } else if (noticeType === 'Class') {
        andConditions.push({
          $or: [
            { noticeType: 'Class' },
            { scope: { $in: ['Assigned Class', 'All Assigned Classes'] } }
          ]
        });
      }
    }

    if (category && category !== 'All') {
      andConditions.push({ category });
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      andConditions.push({
        $or: [
          { title: searchRegex },
          { content: searchRegex },
          { description: searchRegex }
        ]
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const notices = await Notice.find(query)
      .populate('createdBy', 'name role')
      .populate('classId', 'grade section')
      .sort({ isPinned: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notices.length,
      data: notices,
    });
  } catch (error) {
    next(error);
  }
};

// Helper to dispatch notice notifications to target audience only, strictly excluding the publisher
const dispatchNoticeNotifications = async (notice, senderId) => {
  try {
    const aud = notice.targetAudience || 'all';

    // 1. Dispatch SMS / Email alert respecting target audience
    sendNoticeAlert(notice.title, notice.content || notice.description, aud)
      .catch((err) => console.error('Notice notification error:', err.message));

    // 2. Identify target recipient accounts, EXCLUDING the publisher
    const recipientFilter = {
      _id: { $ne: senderId }
    };

    if (aud === 'teachers') {
      recipientFilter.role = 'teacher';
    } else if (aud === 'parents') {
      recipientFilter.role = 'parent';
    } else if (aud === 'all') {
      recipientFilter.role = { $in: ['teacher', 'parent'] };
    }

    const targetUsers = await User.find(recipientFilter).select('_id role');
    if (targetUsers.length > 0) {
      const notificationsToCreate = targetUsers.map((u) => ({
        userId: u._id,
        senderId: senderId,
        targetRole: u.role,
        title: '🏫 School Notice: ' + notice.title,
        message: `Official Announcement: "${notice.title}" has been published by the administration.`,
        category: 'notice',
        isRead: false,
      }));
      await Notification.insertMany(notificationsToCreate);
    }
  } catch (err) {
    console.error('Failed to dispatch notice notifications:', err.message);
  }
};

// @desc    Create School-wide Notice by Admin
// @route   POST /api/admin/notices
// @access  Private/Admin
const createAdminNotice = async (req, res, next) => {
  try {
    const {
      title, content, description, category, priority,
      attachment, status, publishDate, expiryDate, isPinned, targetAudience
    } = req.body;

    if (!title || (!content && !description)) {
      return res.status(400).json({ success: false, message: 'Please provide title and content' });
    }

    const notice = await Notice.create({
      title,
      content: content || description,
      description: description || content,
      category: category || 'General',
      noticeType: 'School',
      scope: 'Entire School',
      createdBy: req.user.id,
      createdByRole: 'admin',
      priority: priority || 'Medium',
      attachment: attachment || '',
      status: status || 'Published',
      publishDate: publishDate || Date.now(),
      expiryDate,
      targetAudience: targetAudience || 'all',
      isPinned: isPinned || false,
    });

    if (notice.status === 'Published') {
      await dispatchNoticeNotifications(notice, req.user.id);
    }

    res.status(201).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update any notice by Admin
// @route   PUT /api/admin/notices/:id
// @access  Private/Admin
const updateAdminNotice = async (req, res, next) => {
  try {
    let notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    const wasDraft = notice.status !== 'Published';
    const updatePayload = { ...req.body };

    if (updatePayload.status === 'Published' && wasDraft) {
      updatePayload.publishDate = Date.now();
    }

    notice = await Notice.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (notice.status === 'Published' && wasDraft) {
      await dispatchNoticeNotifications(notice, req.user.id);
    }

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete any notice by Admin
// @route   DELETE /api/admin/notices/:id
// @access  Private/Admin
const deleteAdminNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    await notice.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notice removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 3. TEACHER HANDLERS (Class Notices Only)
// ==============================================================================

// @desc    Get teacher's notices (for assigned classes / created by teacher / accessible school notices)
// @route   GET /api/teacher/notices
// @access  Private/Teacher
const getTeacherNotices = async (req, res, next) => {
  try {
    const { status, noticeType, category, search } = req.query;
    const teacher = await User.findById(req.user.id);
    const teacherClasses = await Class.find({
      $or: [
        { classTeacherId: req.user.id },
        { _id: { $in: teacher?.assignedClasses || [] } }
      ]
    }).select('_id');
    const classIds = teacherClasses.map(c => c._id);

    // Authorized notice pools for teacher:
    // 1. Notices created by this teacher
    // 2. School notices published for all or teachers
    // 3. Class notices published for teacher's assigned classes
    const accessConditions = [
      { createdBy: req.user.id },
      { noticeType: 'School', targetAudience: { $in: ['all', 'teachers'] }, status: 'Published' },
      { classId: { $in: classIds }, status: 'Published' }
    ];

    let andConditions = [{ $or: accessConditions }];

    // Status filter: Only teacher's own notices can be seen in Draft / Scheduled / Archived states
    if (status && status !== 'All') {
      if (status === 'Published') {
        andConditions.push({ status: 'Published' });
      } else {
        andConditions.push({ createdBy: req.user.id, status });
      }
    }

    // Notice Type filter
    if (noticeType && noticeType !== 'All') {
      if (noticeType === 'School') {
        andConditions.push({
          $or: [{ noticeType: 'School' }, { scope: 'Entire School' }]
        });
      } else if (noticeType === 'Class') {
        andConditions.push({
          $or: [
            { noticeType: 'Class' },
            { scope: { $in: ['Assigned Class', 'All Assigned Classes'] } }
          ]
        });
      }
    }

    if (category && category !== 'All') {
      andConditions.push({ category });
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      andConditions.push({
        $or: [
          { title: searchRegex },
          { content: searchRegex },
          { description: searchRegex }
        ]
      });
    }

    const query = { $and: andConditions };

    const notices = await Notice.find(query)
      .populate('createdBy', 'name role')
      .populate('classId', 'grade section')
      .sort({ isPinned: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notices.length,
      data: notices,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Class Notice by Teacher (Strictly Class Notices)
// @route   POST /api/teacher/notices
// @access  Private/Teacher
const createTeacherNotice = async (req, res, next) => {
  try {
    const {
      title, content, description, category, classId, priority,
      attachment, status, publishDate, expiryDate
    } = req.body;

    if (!title || (!content && !description) || !classId) {
      return res.status(400).json({ success: false, message: 'Please provide title, content, and assigned class' });
    }

    // Verify teacher is authorized for this classId
    const teacher = await User.findById(req.user.id);
    const authorizedClasses = await Class.find({
      $or: [
        { classTeacherId: req.user.id },
        { _id: { $in: teacher?.assignedClasses || [] } }
      ]
    }).select('_id');
    const authClassIds = authorizedClasses.map(c => c._id.toString());

    let targetClassId = classId;
    let scopeType = 'Assigned Class';

    if (classId === 'all_assigned') {
      if (authClassIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No assigned classes found for this teacher.' });
      }
      targetClassId = authClassIds[0];
      scopeType = 'All Assigned Classes';
    } else if (!authClassIds.includes(classId.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized to post notices for this class' });
    }

    // Force Teacher Notice constraints (Cannot be School-wide)
    const notice = await Notice.create({
      title,
      content: content || description,
      description: description || content,
      category: category || 'Homework',
      noticeType: 'Class',
      scope: scopeType,
      classId: targetClassId,
      teacherId: req.user.id,
      createdBy: req.user.id,
      createdByRole: 'teacher',
      priority: priority || 'Medium',
      attachment: attachment || '',
      status: status || 'Published',
      publishDate: publishDate || Date.now(),
      expiryDate,
      targetAudience: 'class',
      isPinned: false,
    });

    if (notice.status === 'Published') {
      // Notify parents of students in this assigned class
      const classStudents = await Student.find({ classId: targetClassId }).select('_id parentId');
      const parentIds = classStudents.map(s => s.parentId).filter(Boolean);

      if (parentIds.length > 0) {
        const notificationsToCreate = parentIds.map(pId => ({
          userId: pId,
          senderId: req.user.id,
          targetRole: 'parent',
          title: `👨‍🏫 Class Notice: ${title}`,
          message: `Class Announcement from Teacher: "${title}"`,
          category: 'notice',
          isRead: false,
        }));
        await Notification.insertMany(notificationsToCreate);
      }
    }

    res.status(201).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update teacher's own notice
// @route   PUT /api/teacher/notices/:id
// @access  Private/Teacher
const updateTeacherNotice = async (req, res, next) => {
  try {
    let notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    // Ensure teacher can only edit their own notices
    if (notice.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit another teacher or admin notice' });
    }

    const wasDraft = notice.status !== 'Published';
    const updatePayload = { ...req.body };
    delete updatePayload.noticeType;
    delete updatePayload.createdByRole;

    // Handle all_assigned conversion if passed during edit
    if (updatePayload.classId === 'all_assigned') {
      const teacher = await User.findById(req.user.id);
      const authorizedClasses = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).select('_id');

      if (authorizedClasses.length > 0) {
        updatePayload.classId = authorizedClasses[0]._id;
        updatePayload.scope = 'All Assigned Classes';
      }
    } else if (updatePayload.classId) {
      updatePayload.scope = 'Assigned Class';
    }

    if (updatePayload.status === 'Published' && wasDraft) {
      updatePayload.publishDate = Date.now();
    }

    notice = await Notice.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    // Notify parents if transitioning from Draft to Published
    if (notice.status === 'Published' && wasDraft) {
      const classStudents = await Student.find({ classId: notice.classId }).select('_id parentId');
      const parentIds = classStudents.map(s => s.parentId).filter(Boolean);

      if (parentIds.length > 0) {
        const notificationsToCreate = parentIds.map(pId => ({
          userId: pId,
          senderId: req.user.id,
          targetRole: 'parent',
          title: `👨‍🏫 Class Notice: ${notice.title}`,
          message: `Class Announcement from Teacher: "${notice.title}"`,
          category: 'notice',
          isRead: false,
        }));
        await Notification.insertMany(notificationsToCreate);
      }
    }

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete teacher's own notice
// @route   DELETE /api/teacher/notices/:id
// @access  Private/Teacher
const deleteTeacherNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    if (notice.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete another teacher or admin notice' });
    }

    await notice.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notice removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 4. PARENT HANDLERS (School & Child's Class Notices Only)
// ==============================================================================

// @desc    Get notices for Parent (School Notices + Linked Children's Class Notices)
// @route   GET /api/parent/notices
// @access  Private/Parent
const getParentNotices = async (req, res, next) => {
  try {
    const { noticeType, category, search } = req.query;
    const parent = await User.findById(req.user.id);

    // Find all linked children for this parent across both parentId and parent.children relations
    const children = await Student.find({
      $or: [
        { parentId: req.user.id },
        { _id: { $in: parent?.children || [] } }
      ]
    }).select('_id name classId rollNo');

    const childrenClassIds = children.map(c => c.classId).filter(Boolean);

    // Parent can ONLY access Published notices intended for parents/all or their children's classes
    const accessConditions = [
      { noticeType: 'School', targetAudience: { $in: ['all', 'parents'] } },
      { classId: { $in: childrenClassIds } }
    ];

    let andConditions = [
      { status: 'Published' },
      { $or: accessConditions }
    ];

    // Notice Type filter
    if (noticeType && noticeType !== 'All') {
      if (noticeType === 'School') {
        andConditions.push({
          $or: [{ noticeType: 'School' }, { scope: 'Entire School' }]
        });
      } else if (noticeType === 'Class') {
        andConditions.push({
          $or: [
            { noticeType: 'Class' },
            { scope: { $in: ['Assigned Class', 'All Assigned Classes'] } }
          ]
        });
      }
    }

    if (category && category !== 'All') {
      andConditions.push({ category });
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      andConditions.push({
        $or: [
          { title: searchRegex },
          { content: searchRegex },
          { description: searchRegex }
        ]
      });
    }

    const query = { $and: andConditions };

    const notices = await Notice.find(query)
      .populate('createdBy', 'name role')
      .populate('classId', 'grade section')
      .sort({ isPinned: -1, createdAt: -1 });

    // Attach relevant children to class notices to support parents with multiple children
    const noticesWithChildContext = notices.map(notice => {
      const noticeObj = notice.toObject();
      if (notice.classId) {
        const noticeClassIdStr = (notice.classId._id || notice.classId).toString();
        const matchingChildren = children.filter(ch =>
          ch.classId && ch.classId.toString() === noticeClassIdStr
        ).map(ch => ({
          _id: ch._id,
          name: ch.name,
          rollNo: ch.rollNo
        }));
        noticeObj.relevantChildren = matchingChildren;

        const gradeStr = notice.classId.grade ? String(notice.classId.grade).replace(/^grade\s+/i, '') : '';
        const secStr = notice.classId.section ? `-${notice.classId.section}` : '';
        noticeObj.relevantClassLabel = gradeStr ? `Grade ${gradeStr}${secStr}` : 'Class Notice';
      } else {
        noticeObj.relevantChildren = [];
        noticeObj.relevantClassLabel = 'Entire School';
      }
      return noticeObj;
    });

    res.status(200).json({
      success: true,
      count: noticesWithChildContext.length,
      data: noticesWithChildContext,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a notice as read by current user
// @route   PUT /api/notices/:id/read
// @access  Private
const markNoticeAsRead = async (req, res, next) => {
  try {
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { readBy: req.user.id } },
      { new: true }
    );

    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    next(error);
  }
};

// Legacy alias helpers
const createNotice = createAdminNotice;
const deleteNotice = deleteAdminNotice;

module.exports = {
  getNotices,
  getNotice,
  markNoticeAsRead,
  createNotice,
  deleteNotice,
  getAdminNotices,
  createAdminNotice,
  updateAdminNotice,
  deleteAdminNotice,
  getTeacherNotices,
  createTeacherNotice,
  updateTeacherNotice,
  deleteTeacherNotice,
  getParentNotices,
};
