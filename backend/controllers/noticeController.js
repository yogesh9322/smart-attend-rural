const Notice = require('../models/Notice');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Notification = require('../models/Notification');
const { sendNoticeAlert } = require('../services/notificationService');

// ==============================================================================
// 1. GENERAL / COMPATIBILITY HANDLERS
// ==============================================================================

// @desc    Get notices (General / Legacy fallback)
// @route   GET /api/notices
// @access  Private
const getNotices = async (req, res, next) => {
  try {
    const { status, noticeType, category, search } = req.query;
    let query = {};

    if (status) query.status = status;
    if (noticeType) query.noticeType = noticeType;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      const teacherClasses = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).select('_id');
      const classIds = teacherClasses.map(c => c._id);

      query.$or = [
        { noticeType: 'School' },
        { createdBy: req.user.id },
        { classId: { $in: classIds } }
      ];
    } else if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.id);
      const children = await Student.find({ _id: { $in: parent?.children || [] } }).select('classId');
      const childrenClassIds = children.map(c => c.classId).filter(Boolean);

      query.status = 'Published';
      query.$or = [
        { noticeType: 'School' },
        { classId: { $in: childrenClassIds } }
      ];
    }

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

// @desc    Get single notice
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

// @desc    Get all notices for Admin (School & Class notices, all statuses)
// @route   GET /api/admin/notices
// @access  Private/Admin
const getAdminNotices = async (req, res, next) => {
  try {
    const { status, noticeType, search } = req.query;
    let query = {};

    if (status && status !== 'All') query.status = status;
    if (noticeType) query.noticeType = noticeType;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

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
      // Notify all teachers and parents
      sendNoticeAlert(title, content || description, 'all')
        .catch(err => console.error('Notice notification error:', err.message));

      await Notification.create({
        title: '🏫 School Notice: ' + title,
        message: `Official Announcement: "${title}" has been published by the administration.`,
        category: 'notice',
      });
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
      sendNoticeAlert(notice.title, notice.content || notice.description, notice.targetAudience || 'all')
        .catch(err => console.error('Notice notification error:', err.message));

      await Notification.create({
        title: '🏫 School Notice: ' + notice.title,
        message: `Official Announcement: "${notice.title}" has been published by the administration.`,
        category: 'notice',
      });
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

// @desc    Get teacher's notices (for assigned classes / created by teacher)
// @route   GET /api/teacher/notices
// @access  Private/Teacher
const getTeacherNotices = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const teacher = await User.findById(req.user.id);
    const teacherClasses = await Class.find({
      $or: [
        { classTeacherId: req.user.id },
        { _id: { $in: teacher?.assignedClasses || [] } }
      ]
    }).select('_id');
    const classIds = teacherClasses.map(c => c._id);

    let query = {
      $or: [
        { createdBy: req.user.id },
        { noticeType: 'School', targetAudience: { $in: ['all', 'teachers'] } },
        { classId: { $in: classIds } }
      ]
    };

    if (status && status !== 'All') query.status = status;
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const notices = await Notice.find(query)
      .populate('createdBy', 'name role')
      .populate('classId', 'grade section')
      .sort({ createdAt: -1 });

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
          title: `👨‍🏫 Class Notice: ${title}`,
          message: `Class Announcement from Teacher: "${title}"`,
          category: 'notice',
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
          title: `👨‍🏫 Class Notice: ${notice.title}`,
          message: `Class Announcement from Teacher: "${notice.title}"`,
          category: 'notice',
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

// @desc    Get notices for Parent (School Notices + Child's Assigned Class Notices)
// @route   GET /api/parent/notices
// @access  Private/Parent
const getParentNotices = async (req, res, next) => {
  try {
    const parent = await User.findById(req.user.id);
    const children = await Student.find({ _id: { $in: parent?.children || [] } }).select('classId');
    const childrenClassIds = children.map(c => c.classId).filter(Boolean);

    const query = {
      status: 'Published',
      $or: [
        { noticeType: 'School', targetAudience: { $in: ['all', 'parents'] } },
        { classId: { $in: childrenClassIds } }
      ]
    };

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
