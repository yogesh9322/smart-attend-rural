const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Class = require('../models/Class');
const User = require('../models/User');
const { sendParentNotification } = require('../services/notificationService');
const { broadcastAttendanceUpdate } = require('../services/socketService');

// @desc    Mark or update attendance (bulk operation)
// @route   POST /api/attendance
// @access  Private/Teacher/Admin
const markAttendance = async (req, res, next) => {
  try {
    const { classId, date, records } = req.body; // records: [{ studentId, status, remarks, syncMode, aiVerified }]

    if (!classId || !date || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Please provide classId, date, and records array' });
    }

    // Normalize date to UTC Midnight to prevent timezone alignment bugs
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // 1. Authorization check: Teacher can only mark attendance for assigned classes
    if (req.user.role === 'teacher') {
      const User = require('../models/User');
      const teacher = await User.findById(req.user.id);
      if (!teacher.assignedClasses.includes(classId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to submit attendance for this class' });
      }
    }

    // 2. Date validation check: Teacher can only submit/edit attendance for today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (req.user.role === 'teacher' && normalizedDate.getTime() !== today.getTime()) {
      return res.status(403).json({ success: false, message: 'Teachers can only record or edit attendance for the current day.' });
    }

    // 3. Multi-submission check: check if multiple attendance is disabled
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne() || { allowMultipleAttendance: true };
    if (!settings.allowMultipleAttendance) {
      const alreadyMarked = await Attendance.findOne({ classId, date: normalizedDate });
      if (alreadyMarked) {
        return res.status(400).json({
          success: false,
          message: 'Attendance has already been recorded for this class today. Multiple submissions are disabled by school policy.'
        });
      }
    }

    const savedRecords = [];
    const absentStudentsToNotify = [];

    // Process each record sequentially (safest for hooks and notifications)
    for (const rec of records) {
      const { studentId, status, remarks, syncMode, aiVerified } = rec;

      // Upsert attendance record
      const attendance = await Attendance.findOneAndUpdate(
        { studentId, date: normalizedDate },
        {
          classId,
          status,
          remarks: remarks || '',
          markedBy: req.user.id,
          syncMode: syncMode || 'online',
          aiVerified: aiVerified || false,
        },
        { upsert: true, new: true, runValidators: true }
      );

      savedRecords.push(attendance);

      // If status is Absent, queue for parent notification
      if (status === 'Absent') {
        absentStudentsToNotify.push(studentId);
      }
    }

    // Proactively send notifications in background
    if (absentStudentsToNotify.length > 0) {
      // Find students and populate parent and teacher details
      Student.find({ _id: { $in: absentStudentsToNotify } })
        .populate('parentId', 'phone email name')
        .populate({
          path: 'classId',
          populate: {
            path: 'classTeacherId',
            select: 'name email phone'
          }
        })
        .then((students) => {
          const dateFormatted = normalizedDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          });

          students.forEach((student) => {
            if (student.parentId) {
              const teacherInfo = student.classId?.classTeacherId;
              sendParentNotification(
                student.parentId.phone,
                student.parentId.email,
                student.name,
                'Absent',
                dateFormatted,
                teacherInfo
              );
            }
          });
        })
        .catch((err) => console.error('Notification dispatch error:', err.message));
    }

    broadcastAttendanceUpdate(classId);

    res.status(200).json({
      success: true,
      message: 'Attendance saved successfully',
      count: savedRecords.length,
      data: savedRecords,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance records/report
// @route   GET /api/attendance
// @access  Private
const getAttendance = async (req, res, next) => {
  try {
    const { classId, studentId, startDate, endDate } = req.query;
    let query = {};

    if (classId) query.classId = classId;
    if (studentId) query.studentId = studentId;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setUTCHours(0, 0, 0, 0);
        query.date.$gte = sDate;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setUTCHours(23, 59, 59, 999);
        query.date.$lte = eDate;
      }
    }

    // Access control filtering
    if (req.user.role === 'parent') {
      // Parents can only query their children's records
      const parent = await User.findById(req.user.id);
      if (studentId && !parent.children.includes(studentId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this student\'s records' });
      }
      // If no studentId provided, restrict query to all parent's children
      if (!studentId) {
        query.studentId = { $in: parent.children };
      }
    } else if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      const teacherClasses = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).select('_id');
      const teacherClassObjIds = teacherClasses.map((c) => c._id);
      const teacherClassStrIds = teacherClasses.map((c) => c._id.toString());

      if (classId && !teacherClassStrIds.includes(classId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to view records for this class' });
      }
      if (!classId && !studentId) {
        query.classId = { $in: teacherClassObjIds };
      }
    }

    const records = await Attendance.find(query)
      .populate('studentId', 'name rollNo admissionNo classId')
      .populate('classId', 'grade section')
      .populate('markedBy', 'name')
      .sort({ date: -1 });

    // Filter out any attendance records for students whose current assigned class doesn't match the requested classId
    const validRecords = records.filter((r) => {
      if (!r.studentId) return false;
      if (classId && r.studentId.classId && r.studentId.classId.toString() !== classId.toString()) {
        return false;
      }
      return true;
    });

    res.status(200).json({
      success: true,
      count: validRecords.length,
      data: validRecords,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/attendance/stats
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let teacherClassIds = [];
    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      const classes = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).select('_id');
      teacherClassIds = classes.map(c => c._id);
    }

    // 1. Core counters
    const studentQuery = req.user.role === 'teacher' ? { classId: { $in: teacherClassIds }, status: 'Active' } : { status: 'Active' };
    const totalStudentsCount = await Student.countDocuments(studentQuery);
    const totalTeachersCount = await User.countDocuments({ role: 'teacher' });

    // 2. Today's stats query
    const todayQuery = { date: { $gte: today, $lt: tomorrow } };
    if (req.user.role === 'teacher') {
      todayQuery.classId = { $in: teacherClassIds };
    }

    const todayAttendance = await Attendance.find(todayQuery).populate('studentId', 'name rollNo classId');
    const presentToday = todayAttendance.filter((a) => a.status === 'Present').length;
    const lateToday = todayAttendance.filter((a) => a.status === 'Late').length;
    const absentToday = todayAttendance.filter((a) => a.status === 'Absent').length;
    const leaveToday = todayAttendance.filter((a) => a.status === 'Leave' || a.status === 'Excused').length;

    const markedCount = todayAttendance.length;
    const todayPercentage = totalStudentsCount > 0 && markedCount > 0 
      ? Math.round(((presentToday + lateToday) / markedCount) * 100) 
      : 100;

    // List of today's absents
    const absentStudentsList = todayAttendance
      .filter((a) => a.status === 'Absent')
      .map((a) => ({
        id: a.studentId ? a.studentId._id : null,
        name: a.studentId ? a.studentId.name : 'Student',
        rollNo: a.studentId ? a.studentId.rollNo : '-',
        class: a.classId,
      }));

    // 3. Class-wise performance
    const classQuery = req.user.role === 'teacher' ? { _id: { $in: teacherClassIds } } : {};
    const classesList = await Class.find(classQuery);
    const classWiseStats = [];

    for (const c of classesList) {
      const classStudentsCount = await Student.countDocuments({ classId: c._id, status: 'Active' });
      const classTodayAttendance = todayAttendance.filter(
        (a) => a.classId.toString() === c._id.toString()
      );
      const classPresent = classTodayAttendance.filter((a) => a.status === 'Present' || a.status === 'Late').length;
      const classAbsent = classTodayAttendance.filter((a) => a.status === 'Absent').length;
      
      const rate = classStudentsCount > 0 
        ? Math.round((classPresent / classStudentsCount) * 100) 
        : 100;

      const lastRec = classTodayAttendance[0];

      classWiseStats.push({
        className: `${c.grade}-${c.section}`,
        total: classStudentsCount,
        present: classPresent,
        absent: classAbsent,
        rate,
        lastUpdated: lastRec ? lastRec.updatedAt : null,
      });
    }

    // 4. Calculate Real Weekly Trends (Mon - Fri of current week) in UTC
    const weeklyTrends = [];
    const curr = new Date();
    const currentDay = curr.getUTCDay(); // 0 is Sun, 1 is Mon...
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = new Date(curr);
    mondayDate.setUTCDate(curr.getUTCDate() + distanceToMon);
    mondayDate.setUTCHours(0, 0, 0, 0);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    for (let i = 0; i < 5; i++) {
      const dStart = new Date(mondayDate);
      dStart.setUTCDate(mondayDate.getUTCDate() + i);
      const dEnd = new Date(dStart);
      dEnd.setUTCDate(dStart.getUTCDate() + 1);

      let dayQuery = { date: { $gte: dStart, $lt: dEnd } };
      if (req.user.role === 'teacher') {
        dayQuery.classId = { $in: teacherClassIds };
      }

      let dayRecords = await Attendance.find(dayQuery);

      // For Friday (i = 4), if weekend/today attendance exists, map the latest marked date records to Fri column
      if (i === 4) {
        const weekendQuery = { date: { $gte: dStart } };
        if (req.user.role === 'teacher') {
          weekendQuery.classId = { $in: teacherClassIds };
        }
        const weekendRecords = await Attendance.find(weekendQuery).sort({ date: -1 });
        if (weekendRecords.length > 0) {
          const latestTime = weekendRecords[0].date.getTime();
          dayRecords = weekendRecords.filter(r => r.date.getTime() === latestTime);
        }
      }

      const totalRecs = dayRecords.length;

      let presentPct = 0;
      let absentPct = 0;

      if (totalRecs > 0) {
        const presents = dayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const absents = dayRecords.filter(r => r.status === 'Absent').length;

        const baseCount = totalStudentsCount > 0 ? totalStudentsCount : totalRecs;
        presentPct = Math.min(100, Math.max(0, Math.round((presents / baseCount) * 100)));
        absentPct = Math.min(100, Math.max(0, Math.round((absents / baseCount) * 100)));
      }

      weeklyTrends.push({
        name: dayLabels[i],
        Present: presentPct,
        Absent: absentPct,
        totalRecords: totalRecs
      });
    }

    // 5. Monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();

      const startOfMonth = new Date(Date.UTC(year, month, 1));
      const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

      const mQuery = { date: { $gte: startOfMonth, $lte: endOfMonth } };
      if (req.user.role === 'teacher') {
        mQuery.classId = { $in: teacherClassIds };
      }

      const monthlyRecords = await Attendance.find(mQuery);

      const totalRecs = monthlyRecords.length;
      const presents = monthlyRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
      const rate = totalRecs > 0 ? Math.round((presents / totalRecs) * 100) : 95;

      const monthName = d.toLocaleString('default', { month: 'short' });
      monthlyTrends.push({
        month: monthName,
        rate,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        counters: {
          totalStudents: totalStudentsCount,
          totalTeachers: totalTeachersCount,
          todayPercentage,
          presentToday,
          absentToday,
          lateToday,
          leaveToday,
        },
        absentStudents: absentStudentsList,
        classWise: classWiseStats,
        weeklyTrends,
        monthlyTrends,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAttendance,
  getAttendance,
  getDashboardStats,
};
