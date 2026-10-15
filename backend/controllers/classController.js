const Class = require('../models/Class');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const {
  getSchoolName,
  getAppBaseUrl,
  buildClassAssignmentEmail,
  buildClassEditEmail,
} = require('../utils/emailBranding');

const sendClassAssignmentEmail = async (teacher, schoolClass) => {
  try {
    const schoolName = await getSchoolName();
    const appBaseUrl = getAppBaseUrl();

    const emailContent = buildClassAssignmentEmail({
      teacher,
      schoolClass,
      schoolName,
      appBaseUrl,
    });

    await sendEmail({
      email: teacher.email,
      subject: emailContent.subject,
      message: emailContent.message,
      html: emailContent.html,
      schoolName,
    });
  } catch (err) {
    console.error('Failed to send class assignment email:', err.message);
  }
};

const sendClassEditEmail = async (teacher, oldClass, newClass) => {
  try {
    const changes = [];
    if (oldClass.grade !== newClass.grade) {
      changes.push(`- Grade: "${oldClass.grade}" ➔ "${newClass.grade}"`);
    }
    if (oldClass.section !== newClass.section) {
      changes.push(`- Section: "${oldClass.section}" ➔ "${newClass.section}"`);
    }
    if (oldClass.roomNo !== newClass.roomNo) {
      changes.push(`- Room No: "${oldClass.roomNo || 'N/A'}" ➔ "${newClass.roomNo || 'N/A'}"`);
    }
    if (oldClass.academicYear !== newClass.academicYear) {
      changes.push(`- Academic Year: "${oldClass.academicYear}" ➔ "${newClass.academicYear}"`);
    }

    if (changes.length === 0) return;

    const schoolName = await getSchoolName();
    const appBaseUrl = getAppBaseUrl();

    const emailContent = buildClassEditEmail({
      teacher,
      oldClass,
      newClass,
      changes,
      schoolName,
      appBaseUrl,
    });

    await sendEmail({
      email: teacher.email,
      subject: emailContent.subject,
      message: emailContent.message,
      html: emailContent.html,
      schoolName,
    });
  } catch (err) {
    console.error('Failed to send class edit notification email:', err.message);
  }
};

// @desc    Get all classes with student count
// @route   GET /api/classes
// @access  Private
const getClasses = async (req, res, next) => {
  try {
    let query = {};

    // Teachers can only see classes they teach, unless they are Admin
    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      const assignedIds = teacher?.assignedClasses || [];
      query = {
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: assignedIds } }
        ]
      };
    }

    const Student = require('../models/Student');
    const classes = await Class.find(query).populate('classTeacherId', 'name email phone photo');

    const classesWithStats = await Promise.all(
      classes.map(async (c) => {
        const cObj = c.toObject();
        const studentCount = await Student.countDocuments({ classId: c._id });
        const isArchived = cObj.isArchived || cObj.status === 'Archived';
        return {
          ...cObj,
          studentCount,
          maxStudents: cObj.maxStudents || 40,
          status: isArchived ? 'Archived' : 'Active',
          isArchived,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: classesWithStats.length,
      data: classesWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single class
// @route   GET /api/classes/:id
// @access  Private
const getClass = async (req, res, next) => {
  try {
    const schoolClass = await Class.findById(req.params.id).populate('classTeacherId', 'name email phone photo');

    if (!schoolClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Teacher authorization check
    if (req.user.role === 'teacher' && schoolClass.classTeacherId?._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view details for this class' });
    }

    res.status(200).json({
      success: true,
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new class
// @route   POST /api/classes
// @access  Private/Admin
const createClass = async (req, res, next) => {
  try {
    const { grade, section, classTeacherId, roomNo, maxStudents, academicYear } = req.body;

    const teacher = await User.findById(classTeacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({ success: false, message: 'Invalid class teacher ID' });
    }

    const classExists = await Class.findOne({ grade, section });
    if (classExists) {
      return res.status(400).json({ success: false, message: 'Class with standard/section already exists' });
    }

    const newClass = await Class.create({
      grade,
      section,
      classTeacherId,
      roomNo,
      maxStudents: maxStudents || 40,
      academicYear,
    });

    await User.findByIdAndUpdate(classTeacherId, {
      $addToSet: { assignedClasses: newClass._id },
    });

    sendClassAssignmentEmail(teacher, newClass);

    res.status(201).json({
      success: true,
      data: newClass,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update class
// @route   PUT /api/classes/:id
// @access  Private/Admin
const updateClass = async (req, res, next) => {
  try {
    const { grade, section, classTeacherId, roomNo, maxStudents, academicYear } = req.body;

    let schoolClass = await Class.findById(req.params.id);
    if (!schoolClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const oldDetailsCopy = {
      grade: schoolClass.grade,
      section: schoolClass.section,
      roomNo: schoolClass.roomNo,
      academicYear: schoolClass.academicYear,
    };

    let isTeacherChanged = false;
    let newTeacherDoc = null;
    let oldTeacherDoc = null;
    if (classTeacherId && classTeacherId !== schoolClass.classTeacherId?.toString()) {
      newTeacherDoc = await User.findById(classTeacherId);
      if (!newTeacherDoc || newTeacherDoc.role !== 'teacher') {
        return res.status(400).json({ success: false, message: 'Invalid class teacher ID' });
      }
      isTeacherChanged = true;
      oldTeacherDoc = await User.findById(schoolClass.classTeacherId);

      if (schoolClass.classTeacherId) {
        await User.findByIdAndUpdate(schoolClass.classTeacherId, {
          $pull: { assignedClasses: schoolClass._id },
        });
      }

      await User.findByIdAndUpdate(classTeacherId, {
        $addToSet: { assignedClasses: schoolClass._id },
      });
    }

    schoolClass = await Class.findByIdAndUpdate(
      req.params.id,
      { grade, section, classTeacherId, roomNo, maxStudents: maxStudents || 40, academicYear },
      { new: true, runValidators: true }
    );

    if (isTeacherChanged) {
      if (newTeacherDoc) {
        sendClassAssignmentEmail(newTeacherDoc, schoolClass);
      }
    } else {
      User.findById(schoolClass.classTeacherId)
        .then((currentTeacher) => {
          if (currentTeacher) {
            sendClassEditEmail(currentTeacher, oldDetailsCopy, schoolClass);
          }
        })
        .catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete class
// @route   DELETE /api/classes/:id
// @access  Private/Admin
const deleteClass = async (req, res, next) => {
  try {
    const schoolClass = await Class.findById(req.params.id);
    if (!schoolClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const teacher = await User.findById(schoolClass.classTeacherId);
    if (teacher) {
      await User.findByIdAndUpdate(schoolClass.classTeacherId, {
        $pull: { assignedClasses: schoolClass._id },
      });
    }

    await Class.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Class deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle class archive status
// @route   PUT /api/classes/:id/archive
// @access  Private/Admin
const archiveClass = async (req, res, next) => {
  try {
    const schoolClass = await Class.findById(req.params.id);
    if (!schoolClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const currentArchived = schoolClass.isArchived || schoolClass.status === 'Archived';
    const newArchivedState = !currentArchived;

    schoolClass.isArchived = newArchivedState;
    schoolClass.status = newArchivedState ? 'Archived' : 'Active';
    await schoolClass.save();

    res.status(200).json({
      success: true,
      message: `Class ${newArchivedState ? 'archived' : 'reactivated'} successfully`,
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Transfer students to another target class
// @route   PUT /api/classes/:id/transfer-students
// @access  Private/Admin
const transferStudents = async (req, res, next) => {
  try {
    const { targetClassId } = req.body;
    const sourceClass = await Class.findById(req.params.id);
    const targetClass = await Class.findById(targetClassId);

    if (!sourceClass || !targetClass) {
      return res.status(400).json({ success: false, message: 'Source or target class not found' });
    }

    const Student = require('../models/Student');
    const result = await Student.updateMany(
      { classId: sourceClass._id },
      { classId: targetClass._id }
    );

    const srcGrade = String(sourceClass.grade).startsWith('Grade') ? sourceClass.grade : `Grade ${sourceClass.grade}`;
    const tgtGrade = String(targetClass.grade).startsWith('Grade') ? targetClass.grade : `Grade ${targetClass.grade}`;

    res.status(200).json({
      success: true,
      message: `Transferred ${result.modifiedCount || 0} students from ${srcGrade}-${sourceClass.section} to ${tgtGrade}-${targetClass.section}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign or change class teacher
// @route   PUT /api/classes/:id/assign-teacher
// @access  Private/Admin
const assignTeacher = async (req, res, next) => {
  try {
    const classTeacherId = req.body.classTeacherId || req.body.teacherId;
    let schoolClass = await Class.findById(req.params.id);

    if (!schoolClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const newTeacher = await User.findById(classTeacherId);
    if (!newTeacher || newTeacher.role !== 'teacher') {
      return res.status(400).json({ success: false, message: 'Invalid teacher ID' });
    }

    if (schoolClass.classTeacherId) {
      await User.findByIdAndUpdate(schoolClass.classTeacherId, {
        $pull: { assignedClasses: schoolClass._id },
      });
    }

    await User.findByIdAndUpdate(classTeacherId, {
      $addToSet: { assignedClasses: schoolClass._id },
    });

    schoolClass.classTeacherId = classTeacherId;
    await schoolClass.save();

    sendClassAssignmentEmail(newTeacher, schoolClass);

    const gradeLabel = String(schoolClass.grade).startsWith('Grade')
      ? schoolClass.grade
      : `Grade ${schoolClass.grade}`;

    res.status(200).json({
      success: true,
      message: `Teacher ${newTeacher.name} assigned to ${gradeLabel}-${schoolClass.section}`,
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  archiveClass,
  transferStudents,
  assignTeacher,
};
