const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const Notification = require('../models/Notification');
const { uploadImage } = require('../services/cloudinaryService');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get all students
// @route   GET /api/students
// @access  Private
const getStudents = async (req, res, next) => {
  try {
    let query = {};

    // Parents can only see their linked children
    if (req.user.role === 'parent') {
      query.parentId = req.user.id;
    } else if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      const teacherClasses = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).select('_id');
      const teacherClassIds = teacherClasses.map((c) => c._id.toString());

      if (req.query.classId) {
        if (!teacherClassIds.includes(req.query.classId)) {
          return res.status(403).json({ success: false, message: 'Not authorized to view this class roster' });
        }
        query.classId = req.query.classId;
      } else {
        query.classId = { $in: teacherClassIds };
      }
    } else if (req.query.classId) {
      query.classId = req.query.classId;
    }

    // Search by Name, Roll Number, or Admission Number
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { rollNo: searchRegex },
        { admissionNo: searchRegex }
      ];
    }

    const students = await Student.find(query)
      .populate({
        path: 'classId',
        select: 'grade section classTeacherId',
        populate: { path: 'classTeacherId', select: 'name email phone' }
      })
      .populate('parentId', 'name email phone relationship alternatePhone');

    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single student details
// @route   GET /api/students/:id
// @access  Private
const getStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path: 'classId',
        select: 'grade section classTeacherId',
        populate: { path: 'classTeacherId', select: 'name email phone' }
      })
      .populate('parentId', 'name email phone relationship alternatePhone');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Teacher authorization check
    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      const assignedIds = (teacher.assignedClasses || []).map(id => id.toString());
      const classTeacherClasses = await Class.find({ classTeacherId: req.user.id }).select('_id');
      const classTeacherIds = classTeacherClasses.map(c => c._id.toString());
      const allAllowedIds = [...assignedIds, ...classTeacherIds];

      if (!student.classId || !allAllowedIds.includes(student.classId._id.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to view student details for this class' });
      }
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create student
// @route   POST /api/students
// @access  Private/Admin
const createStudent = async (req, res, next) => {
  try {
    const { name, rollNo, admissionNo, classId, parentId, gender, dob } = req.body;

    // Validate class standard
    const targetClass = await Class.findById(classId);
    if (!targetClass) {
      return res.status(400).json({ success: false, message: 'Invalid Class ID' });
    }

    // Validate parent user
    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      return res.status(400).json({ success: false, message: 'Invalid Parent User ID' });
    }

    // Check for duplicate admission number
    const studentExists = await Student.findOne({ admissionNo });
    if (studentExists) {
      return res.status(400).json({ success: false, message: 'Admission number already exists' });
    }

    // Check for duplicate roll number in class
    const rollNoExists = await Student.findOne({ classId, rollNo });
    if (rollNoExists) {
      return res.status(400).json({ success: false, message: `Roll number ${rollNo} is already taken in this class` });
    }

    let photoUrl = '';
    // Handle image upload if a file is present
    if (req.file) {
      const uploadResult = await uploadImage(req.file.path);
      photoUrl = uploadResult.url;
    }

    const student = await Student.create({
      name,
      rollNo,
      admissionNo,
      classId,
      parentId,
      gender,
      dob,
      photoUrl,
    });

    // Add student ObjectId link to parent user
    await User.findByIdAndUpdate(parentId, {
      $addToSet: { children: student._id },
    });

    // Create system notification
    await Notification.create({
      senderId: req.user.id,
      targetRole: 'admin',
      title: 'New Student Added',
      message: `Student ${name} (Roll No: ${rollNo}) has been registered in the database.`,
      category: 'user',
    });

    if (req.user) {
      await logActivity(req.user.id, 'CREATE_STUDENT', `Created student: ${name} (Roll: ${rollNo}, Adm: ${admissionNo})`, req);
    }

    res.status(201).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student details
// @route   PUT /api/students/:id
// @access  Private/Admin
const updateStudent = async (req, res, next) => {
  try {
    const { name, rollNo, admissionNo, classId, parentId, gender, dob, status } = req.body;

    let student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Update parent linkages if parent has changed
    const currentParentIdStr = student.parentId ? student.parentId.toString() : '';
    if (parentId && parentId !== currentParentIdStr) {
      const newParent = await User.findById(parentId);
      if (!newParent || newParent.role !== 'parent') {
        return res.status(400).json({ success: false, message: 'Invalid parent user ID' });
      }

      // Remove child from old parent if previously linked
      if (student.parentId) {
        await User.findByIdAndUpdate(student.parentId, {
          $pull: { children: student._id },
        });
      }

      // Add child to new parent
      await User.findByIdAndUpdate(parentId, {
        $addToSet: { children: student._id },
      });
    }

    let photoUrl = student.photoUrl;
    if (req.file) {
      const uploadResult = await uploadImage(req.file.path);
      photoUrl = uploadResult.url;
    }

    student = await Student.findByIdAndUpdate(
      req.params.id,
      { name, rollNo, admissionNo, classId, parentId, gender, dob, photoUrl, status },
      { new: true, runValidators: true }
    );

    if (req.user) {
      await logActivity(req.user.id, 'UPDATE_STUDENT', `Updated student details for: ${student.name}`, req);
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete student record
// @route   DELETE /api/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const studentName = student.name;

    // Remove child from parent user if linked
    if (student.parentId) {
      await User.findByIdAndUpdate(student.parentId, {
        $pull: { children: student._id },
      });
    }

    await Student.findByIdAndDelete(req.params.id);

    if (req.user) {
      await logActivity(req.user.id, 'DELETE_STUDENT', `Deleted student: ${studentName}`, req);
    }

    res.status(200).json({
      success: true,
      message: 'Student record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
};
