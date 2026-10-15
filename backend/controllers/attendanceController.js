const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Class = require('../models/Class');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const Settings = require('../models/Settings');
const ExcelJS = require('exceljs');
const { sendParentNotification } = require('../services/notificationService');
const { broadcastAttendanceUpdate } = require('../services/socketService');
const {
  getSchoolTimezone,
  getLocalDateString,
  getUtcBoundariesForDateStr,
  isDateScheduled,
  formatSchoolTime,
} = require('../utils/dateUtils');

// @desc    Mark or update attendance (bulk operation)
// @route   POST /api/attendance
// @access  Private/Teacher/Admin
const markAttendance = async (req, res, next) => {
  try {
    const { classId, date, records } = req.body; // records: [{ studentId, status, remarks, syncMode, aiVerified }]

    if (!classId || !date || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Please provide classId, date, and records array' });
    }

    const timezone = await getSchoolTimezone();
    // Normalize date string to school-local date YYYY-MM-DD
    const inputDateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)
      ? date.substring(0, 10)
      : getLocalDateString(new Date(date), timezone);
    const { startOfDay: normalizedDate } = getUtcBoundariesForDateStr(inputDateStr);

    // 1. Authorization check: Teacher can only mark attendance for assigned classes
    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      if (!teacher.assignedClasses.includes(classId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to submit attendance for this class' });
      }
    }

    // 2. Date validation check: Teacher can only submit/edit attendance for today in school-local timezone
    const todayLocalStr = getLocalDateString(new Date(), timezone);
    if (req.user.role === 'teacher' && inputDateStr !== todayLocalStr) {
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
      // Parents can only query their authorized children's records
      const parent = await User.findById(req.user.id);
      const childStrIds = (parent?.children || []).map(c => c.toString());
      if (studentId && !childStrIds.includes(studentId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this student\'s records' });
      }
      // If no studentId provided, restrict query to all parent's children
      if (!studentId) {
        query.studentId = { $in: parent?.children || [] };
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
      if (studentId) {
        const studentObj = await Student.findById(studentId);
        if (!studentObj || !teacherClassStrIds.includes(studentObj.classId?.toString())) {
          return res.status(403).json({ success: false, message: 'Not authorized to view records for this student' });
        }
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

    const timezone = await getSchoolTimezone();
    const todayDateStr = getLocalDateString(new Date(), timezone);

    res.status(200).json({
      success: true,
      count: validRecords.length,
      data: validRecords,
      todayDateStr,
      timezone,
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
    const Settings = require('../models/Settings');
    const settings = (await Settings.findOne()) || {};
    const timezone = await getSchoolTimezone();
    const todayDateStr = getLocalDateString(new Date(), timezone);
    const { startOfDay: today, nextDay: tomorrow } = getUtcBoundariesForDateStr(todayDateStr);
    const isSchoolOpenToday = isDateScheduled(todayDateStr, settings, timezone);

    const formatClassName = (c) => {
      const gradeStr = String(c.grade || '').trim();
      const normalizedGrade = gradeStr.toLowerCase().startsWith('grade')
        ? `Grade ${gradeStr.replace(/^grade\s*/i, '').trim()}`
        : `Grade ${gradeStr}`;
      return `${normalizedGrade}-${c.section}`;
    };

    let teacherClassIds = [];
    let classesList = [];
    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      classesList = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).sort({ grade: 1, section: 1 });
      teacherClassIds = classesList.map((c) => c._id);
    } else {
      classesList = await Class.find({}).sort({ grade: 1, section: 1 });
    }

    // 1. Active eligible students per class
    const studentQuery = req.user.role === 'teacher'
      ? { classId: { $in: teacherClassIds }, status: 'Active' }
      : { status: 'Active' };
    const activeStudents = await Student.find(studentQuery).select('_id name rollNo classId status');
    const totalStudentsCount = activeStudents.length;
    const totalTeachersCount = await User.countDocuments({ role: 'teacher' });

    const studentMap = new Map();
    const classStudentsMap = new Map();
    for (const c of classesList) {
      classStudentsMap.set(c._id.toString(), []);
    }
    for (const st of activeStudents) {
      const sId = st._id.toString();
      const cId = st.classId ? st.classId.toString() : null;
      studentMap.set(sId, st);
      if (cId && classStudentsMap.has(cId)) {
        classStudentsMap.get(cId).push(st);
      }
    }

    const activeStudentIds = activeStudents.map((s) => s._id);

    // Helper to deduplicate attendance records per active student per day
    const getValidStudentRecordsMap = (records) => {
      const recMap = new Map();
      for (const r of records) {
        const sId = r.studentId?._id ? r.studentId._id.toString() : r.studentId ? r.studentId.toString() : null;
        if (!sId || !studentMap.has(sId)) continue;
        const dStr = r.date ? new Date(r.date).toISOString().split('T')[0] : 'unknown';
        const key = `${sId}_${dStr}`;
        if (!recMap.has(key)) {
          recMap.set(key, r);
        }
      }
      return recMap;
    };

    // 2. Today's stats query
    const todayQuery = {
      date: { $gte: today, $lt: tomorrow },
      studentId: { $in: activeStudentIds },
    };

    const rawTodayAttendance = await Attendance.find(todayQuery).populate('studentId', 'name rollNo classId');
    const todayRecordMap = getValidStudentRecordsMap(rawTodayAttendance);
    const todayAttendance = Array.from(todayRecordMap.values());

    const presentToday = todayAttendance.filter((a) => a.status === 'Present').length;
    const lateToday = todayAttendance.filter((a) => a.status === 'Late').length;
    const absentToday = todayAttendance.filter((a) => a.status === 'Absent').length;
    const leaveToday = todayAttendance.filter((a) => a.status === 'Leave' || a.status === 'Excused').length;

    const markedCount = presentToday + lateToday + absentToday + leaveToday;

    // List of today's absents
    const absentStudentsList = todayAttendance
      .filter((a) => a.status === 'Absent')
      .map((a) => ({
        id: a.studentId ? a.studentId._id : null,
        name: a.studentId ? a.studentId.name : 'Student',
        rollNo: a.studentId ? a.studentId.rollNo : '-',
        class: a.studentId?.classId || a.classId,
      }));

    // -------------------------------------------------------------------------
    // 2.1 Calculate per-class today attendance status & metrics
    // -------------------------------------------------------------------------
    const todayClasses = [];
    for (const c of classesList) {
      const cIdStr = c._id.toString();
      const cStudents = classStudentsMap.get(cIdStr) || [];
      const expectedStudents = cStudents.length;
      const cStudentIdSet = new Set(cStudents.map((s) => s._id.toString()));

      // Attendance records for this class on today's school-local date
      // Explicitly check BOTH classId and active student membership
      const cTodayRecords = todayAttendance.filter((r) => {
        const recClassId = r.classId?._id ? r.classId._id.toString() : r.classId?.toString();
        const sId = r.studentId?._id ? r.studentId._id.toString() : r.studentId?.toString();
        return recClassId === cIdStr && sId && cStudentIdSet.has(sId);
      });

      const markedStudents = cTodayRecords.length;
      const presentCount = cTodayRecords.filter((r) => r.status === 'Present').length;
      const lateCount = cTodayRecords.filter((r) => r.status === 'Late').length;
      const absentCount = cTodayRecords.filter((r) => r.status === 'Absent').length;
      const leaveCount = cTodayRecords.filter((r) => r.status === 'Leave' || r.status === 'Excused').length;
      const attendedCount = presentCount + lateCount;

      let latestUpdate = null;
      for (const r of cTodayRecords) {
        const t = new Date(r.updatedAt || r.createdAt);
        if (!latestUpdate || t > latestUpdate) {
          latestUpdate = t;
        }
      }
      const lastUpdatedFormatted = latestUpdate ? formatSchoolTime(latestUpdate, timezone) : null;

      const isClassActive = !c.isArchived && c.status !== 'Archived';
      const isScheduled = isSchoolOpenToday && isClassActive;

      let status = 'Pending';
      if (!isScheduled) {
        status = 'Not Scheduled';
      } else if (markedStudents === 0) {
        status = 'Pending';
      } else if (expectedStudents > 0 && markedStudents >= expectedStudents) {
        status = 'Marked';
      } else if (markedStudents > 0) {
        status = 'Partially Marked';
      }

      todayClasses.push({
        classId: c._id,
        className: formatClassName(c),
        grade: c.grade,
        section: c.section,
        expectedStudents,
        markedStudents,
        status, // 'Marked' | 'Partially Marked' | 'Pending' | 'Not Scheduled'
        isMarked: status === 'Marked',
        isPartiallyMarked: status === 'Partially Marked',
        isPending: status === 'Pending',
        isNotScheduled: status === 'Not Scheduled',
        lastUpdated: latestUpdate ? latestUpdate.toISOString() : null,
        lastUpdatedTime: lastUpdatedFormatted,
        presentCount,
        lateCount,
        absentCount,
        leaveCount,
        present: attendedCount,
        absent: absentCount,
        total: expectedStudents,
        percentage: markedStudents > 0 && expectedStudents > 0 ? Math.round((attendedCount / expectedStudents) * 100) : null,
      });
    }

    // -------------------------------------------------------------------------
    // 3. Date Filtering & Period Resolution (Monthly, Specific Date, Custom Range)
    // -------------------------------------------------------------------------
    const periodType = req.query.periodType || 'monthly'; // 'monthly' | 'date' | 'range'
    const currDate = new Date();
    const currYear = currDate.getUTCFullYear();
    const currMonth = currDate.getUTCMonth() + 1; // 1-12

    let filterStart = null;
    let filterEnd = null;
    let filterDescription = '';
    let selectedYear = currYear;
    let selectedMonth = currMonth;
    let specificDateStr = '';
    let customStartDateStr = '';
    let customEndDateStr = '';

    if (periodType === 'date') {
      specificDateStr = req.query.date || currDate.toISOString().split('T')[0];
      const parts = specificDateStr.split('-').map(Number);
      const y = parts[0] || currYear;
      const m = parts[1] || currMonth;
      const d = parts[2] || currDate.getUTCDate();
      filterStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      filterEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      filterDescription = filterStart.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      selectedYear = y;
      selectedMonth = m;
    } else if (periodType === 'range') {
      customStartDateStr = req.query.startDate || currDate.toISOString().split('T')[0];
      customEndDateStr = req.query.endDate || currDate.toISOString().split('T')[0];
      const sParts = customStartDateStr.split('-').map(Number);
      const eParts = customEndDateStr.split('-').map(Number);
      filterStart = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0));
      filterEnd = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999));
      filterDescription = `${filterStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} – ${filterEnd.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}`;
      selectedYear = eParts[0];
      selectedMonth = eParts[1];
    } else {
      // 'monthly' (default)
      const qYear = parseInt(req.query.year, 10);
      const qMonth = parseInt(req.query.month, 10);
      selectedYear = (!isNaN(qYear) && qYear >= 2000 && qYear <= 2100) ? qYear : currYear;
      selectedMonth = (!isNaN(qMonth) && qMonth >= 1 && qMonth <= 12) ? qMonth : currMonth;

      filterStart = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0));
      filterEnd = new Date(Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59, 999));
      const mName = filterStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' });
      filterDescription = `${mName} ${selectedYear}`;
    }

    // Fetch all attendance records within the selected filter period
    const periodAttendanceRecords = await Attendance.find({
      date: { $gte: filterStart, $lte: filterEnd },
      studentId: { $in: activeStudentIds },
    });
    const periodRecordMap = getValidStudentRecordsMap(periodAttendanceRecords);
    const validPeriodRecords = Array.from(periodRecordMap.values());

    // -------------------------------------------------------------------------
    // 4. Class-wise performance for the selected period
    // -------------------------------------------------------------------------
    const classWiseStats = [];
    for (const c of classesList) {
      const cIdStr = c._id.toString();
      const cStudents = classStudentsMap.get(cIdStr) || [];
      const classStudentsCount = cStudents.length;
      const cStudentIdSet = new Set(cStudents.map((s) => s._id.toString()));

      const classPeriodRecords = validPeriodRecords.filter((r) => {
        const recClassId = r.classId?._id ? r.classId._id.toString() : r.classId?.toString();
        const sId = r.studentId?._id ? r.studentId._id.toString() : r.studentId?.toString();
        return recClassId === cIdStr && sId && cStudentIdSet.has(sId);
      });

      const presentCount = classPeriodRecords.filter((r) => r.status === 'Present').length;
      const lateCount = classPeriodRecords.filter((r) => r.status === 'Late').length;
      const absentCount = classPeriodRecords.filter((r) => r.status === 'Absent').length;
      const leaveCount = classPeriodRecords.filter((r) => r.status === 'Leave' || r.status === 'Excused').length;
      const classPresent = presentCount + lateCount;
      const classMarked = classPresent + absentCount + leaveCount;
      const isMarked = classMarked > 0;

      const rate = isMarked
        ? Math.round((classPresent / classMarked) * 100)
        : null;

      const matchedTodayClass = todayClasses.find((tc) => tc.classId.toString() === cIdStr);

      classWiseStats.push({
        classId: c._id,
        className: formatClassName(c),
        total: classStudentsCount,
        marked: classMarked,
        isMarked,
        present: classPresent,
        presentCount,
        lateCount,
        absent: absentCount,
        leaveCount,
        rate: rate !== null ? rate : 0,
        percentage: rate,
        todayStatus: matchedTodayClass?.status || 'Pending',
        todayMarked: matchedTodayClass?.markedStudents || 0,
        isTodayMarked: matchedTodayClass?.status === 'Marked',
        lastUpdatedTime: matchedTodayClass?.lastUpdatedTime || null,
      });
    }

    const todayDenom = markedCount > 0 ? totalStudentsCount : 0;
    const todayPercentage = todayDenom > 0
      ? Math.round(((presentToday + lateToday) / todayDenom) * 100)
      : 0;

    // -------------------------------------------------------------------------
    // 5. Daily / Aggregated Attendance Trend for the selected period
    // -------------------------------------------------------------------------
    const diffMs = filterEnd.getTime() - filterStart.getTime();
    const rangeDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    let aggregationType = 'daily';
    let aggregationLabel = 'Daily Attendance';
    if (periodType === 'range') {
      if (rangeDays > 92) {
        aggregationType = 'monthly';
        aggregationLabel = 'Monthly Aggregated';
      } else if (rangeDays > 31) {
        aggregationType = 'weekly';
        aggregationLabel = 'Weekly Aggregated';
      }
    }

    const dailyTrends = [];
    if (periodType === 'date') {
      // For a specific date, show daily attendance trend for that month so the chart displays the month's context
      const pYear = filterStart.getUTCFullYear();
      const pMonth = filterStart.getUTCMonth();
      const monthStart = new Date(Date.UTC(pYear, pMonth, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(pYear, pMonth + 1, 0, 23, 59, 59, 999));

      const monthRecords = await Attendance.find({
        date: { $gte: monthStart, $lte: monthEnd },
        studentId: { $in: activeStudentIds },
      });
      const monthRecordMap = getValidStudentRecordsMap(monthRecords);
      const validMonthRecords = Array.from(monthRecordMap.values());

      const curIter = new Date(monthStart);
      let dayIndex = 1;
      while (curIter <= monthEnd) {
        const dStart = new Date(curIter);
        const dEnd = new Date(curIter);
        dEnd.setUTCHours(23, 59, 59, 999);
        const dateISO = dStart.toISOString().split('T')[0];

        const dayRecords = validMonthRecords.filter((r) => {
          const rDate = new Date(r.date);
          return rDate >= dStart && rDate <= dEnd;
        });

        const dayPresent = dayRecords.filter((r) => r.status === 'Present').length;
        const dayLate = dayRecords.filter((r) => r.status === 'Late').length;
        const dayAbsent = dayRecords.filter((r) => r.status === 'Absent').length;
        const dayLeave = dayRecords.filter((r) => r.status === 'Leave' || r.status === 'Excused').length;
        const dayAttended = dayPresent + dayLate;
        const dayMarked = dayAttended + dayAbsent + dayLeave;
        const hasData = dayMarked > 0;
        const rate = hasData ? Math.round((dayAttended / dayMarked) * 100) : null;

        const dayNum = dStart.getUTCDate();
        const dayFullFormatted = dStart.toLocaleDateString('en-US', {
          timeZone: 'UTC',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        dailyTrends.push({
          date: dateISO,
          day: dayNum,
          dayIndex,
          label: `${dayNum}`,
          formattedDate: dayFullFormatted,
          rate,
          hasData,
          present: dayPresent,
          late: dayLate,
          absent: dayAbsent,
          leave: dayLeave,
          attended: dayAttended,
          marked: dayMarked,
          eligible: totalStudentsCount,
          isSelectedDate: dateISO === specificDateStr,
        });

        curIter.setUTCDate(curIter.getUTCDate() + 1);
        dayIndex++;
      }
    } else if (aggregationType === 'weekly') {
      // Group into 7-day calendar intervals
      const curWeekStart = new Date(filterStart);
      let weekIndex = 1;
      while (curWeekStart <= filterEnd) {
        const wStart = new Date(curWeekStart);
        const wEnd = new Date(curWeekStart);
        wEnd.setUTCDate(curWeekStart.getUTCDate() + 6);
        wEnd.setUTCHours(23, 59, 59, 999);
        if (wEnd > filterEnd) {
          wEnd.setTime(filterEnd.getTime());
        }

        const weekRecords = validPeriodRecords.filter((r) => {
          const rDate = new Date(r.date);
          return rDate >= wStart && rDate <= wEnd;
        });

        const wPresent = weekRecords.filter((r) => r.status === 'Present').length;
        const wLate = weekRecords.filter((r) => r.status === 'Late').length;
        const wAbsent = weekRecords.filter((r) => r.status === 'Absent').length;
        const wLeave = weekRecords.filter((r) => r.status === 'Leave' || r.status === 'Excused').length;
        const wAttended = wPresent + wLate;
        const wMarked = wAttended + wAbsent + wLeave;
        const hasData = wMarked > 0;
        const rate = hasData ? Math.round((wAttended / wMarked) * 100) : null;

        const wStartLabel = wStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
        const wEndLabel = wEnd.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
        const dateISO = wStart.toISOString().split('T')[0];

        dailyTrends.push({
          date: dateISO,
          day: wStart.getUTCDate(),
          dayIndex: weekIndex,
          label: wStartLabel,
          formattedDate: `Week ${weekIndex} (${wStartLabel} – ${wEndLabel})`,
          rate,
          hasData,
          present: wPresent,
          late: wLate,
          absent: wAbsent,
          leave: wLeave,
          attended: wAttended,
          marked: wMarked,
          eligible: totalStudentsCount,
        });

        curWeekStart.setUTCDate(curWeekStart.getUTCDate() + 7);
        curWeekStart.setUTCHours(0, 0, 0, 0);
        weekIndex++;
      }
    } else if (aggregationType === 'monthly') {
      // Group into monthly intervals
      const curMonthStart = new Date(Date.UTC(filterStart.getUTCFullYear(), filterStart.getUTCMonth(), 1, 0, 0, 0, 0));
      let monthIndex = 1;
      while (curMonthStart <= filterEnd) {
        const mStart = new Date(curMonthStart);
        if (mStart < filterStart) {
          mStart.setTime(filterStart.getTime());
        }
        const mEnd = new Date(Date.UTC(curMonthStart.getUTCFullYear(), curMonthStart.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        if (mEnd > filterEnd) {
          mEnd.setTime(filterEnd.getTime());
        }

        const mRecords = validPeriodRecords.filter((r) => {
          const rDate = new Date(r.date);
          return rDate >= mStart && rDate <= mEnd;
        });

        const mPresent = mRecords.filter((r) => r.status === 'Present').length;
        const mLate = mRecords.filter((r) => r.status === 'Late').length;
        const mAbsent = mRecords.filter((r) => r.status === 'Absent').length;
        const mLeave = mRecords.filter((r) => r.status === 'Leave' || r.status === 'Excused').length;
        const mAttended = mPresent + mLate;
        const mMarked = mAttended + mAbsent + mLeave;
        const hasData = mMarked > 0;
        const rate = hasData ? Math.round((mAttended / mMarked) * 100) : null;

        const mShort = curMonthStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
        const mFull = curMonthStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
        const dateISO = curMonthStart.toISOString().split('T')[0];

        dailyTrends.push({
          date: dateISO,
          day: 1,
          dayIndex: monthIndex,
          label: mShort,
          formattedDate: mFull,
          rate,
          hasData,
          present: mPresent,
          late: mLate,
          absent: mAbsent,
          leave: mLeave,
          attended: mAttended,
          marked: mMarked,
          eligible: totalStudentsCount,
        });

        curMonthStart.setUTCMonth(curMonthStart.getUTCMonth() + 1);
        monthIndex++;
      }
    } else {
      // Standard daily iteration (Monthly view or Range <= 31 days)
      const curIter = new Date(filterStart);
      let dayIndex = 1;
      while (curIter <= filterEnd) {
        const dStart = new Date(curIter);
        const dEnd = new Date(curIter);
        dEnd.setUTCHours(23, 59, 59, 999);
        const dateISO = dStart.toISOString().split('T')[0];

        const dayRecords = validPeriodRecords.filter((r) => {
          const rDate = new Date(r.date);
          return rDate >= dStart && rDate <= dEnd;
        });

        const dayPresent = dayRecords.filter((r) => r.status === 'Present').length;
        const dayLate = dayRecords.filter((r) => r.status === 'Late').length;
        const dayAbsent = dayRecords.filter((r) => r.status === 'Absent').length;
        const dayLeave = dayRecords.filter((r) => r.status === 'Leave' || r.status === 'Excused').length;
        const dayAttended = dayPresent + dayLate;
        const dayMarked = dayAttended + dayAbsent + dayLeave;
        const hasData = dayMarked > 0;
        const rate = hasData ? Math.round((dayAttended / dayMarked) * 100) : null;

        const dayNum = dStart.getUTCDate();
        let dayLabel = `${dayNum}`;
        if (periodType === 'range') {
          if (rangeDays <= 7) {
            const wShort = dStart.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });
            dayLabel = `${wShort} ${dayNum}`;
          } else {
            const mShort = dStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
            dayLabel = `${mShort} ${dayNum}`;
          }
        }

        const dayFullFormatted = dStart.toLocaleDateString('en-US', {
          timeZone: 'UTC',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        dailyTrends.push({
          date: dateISO,
          day: dayNum,
          dayIndex,
          label: dayLabel,
          formattedDate: dayFullFormatted,
          rate, // null if no attendance records! Recharts leaves a clean gap!
          hasData,
          present: dayPresent,
          late: dayLate,
          absent: dayAbsent,
          leave: dayLeave,
          attended: dayAttended,
          marked: dayMarked,
          eligible: totalStudentsCount,
        });

        curIter.setUTCDate(curIter.getUTCDate() + 1);
        dayIndex++;
      }
    }

    // Ensure all data points are sorted chronologically
    dailyTrends.sort((a, b) => new Date(a.date) - new Date(b.date));

    const hasPeriodData = dailyTrends.some((d) => d.hasData);
    const periodMarkedTotal = dailyTrends.reduce((sum, d) => sum + d.marked, 0);
    const periodAttendedTotal = dailyTrends.reduce((sum, d) => sum + d.attended, 0);
    const periodPercentage = periodMarkedTotal > 0
      ? Math.round((periodAttendedTotal / periodMarkedTotal) * 100)
      : null;

    // School-wide average daily attendance across all completed/marked attendance days up to current school-local date
    // Exclude unmarked days and future days (< tomorrow)
    const allCompletedRecords = await Attendance.find({
      date: { $lt: tomorrow },
      studentId: { $in: activeStudentIds },
    });
    const validAllCompletedRecords = Array.from(
      getValidStudentRecordsMap(allCompletedRecords).values()
    );
    const allCompletedAttended = validAllCompletedRecords.filter(
      (r) => r.status === 'Present' || r.status === 'Late'
    ).length;
    const allCompletedMarked = validAllCompletedRecords.filter(
      (r) =>
        r.status === 'Present' ||
        r.status === 'Late' ||
        r.status === 'Absent' ||
        r.status === 'Leave' ||
        r.status === 'Excused'
    ).length;
    const schoolWideAvgDailyAttendance = allCompletedMarked > 0
      ? Math.round((allCompletedAttended / allCompletedMarked) * 100)
      : null;

    // Use periodPercentage to match the analytics charts for the active period/date/month, or schoolWideAvgDailyAttendance
    const avgDailyAttendance = periodPercentage !== null
      ? periodPercentage
      : schoolWideAvgDailyAttendance;

    // -------------------------------------------------------------------------
    // 6. Real Weekly Trends (Mon - Fri of current week) in UTC (Teacher Dashboard)
    // -------------------------------------------------------------------------
    const weeklyTrends = [];
    const curr = new Date();
    const currentDay = curr.getUTCDay();
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayDate = new Date(curr);
    mondayDate.setUTCDate(curr.getUTCDate() + distanceToMon);
    mondayDate.setUTCHours(0, 0, 0, 0);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    for (let i = 0; i < 5; i++) {
      const dStart = new Date(mondayDate);
      dStart.setUTCDate(mondayDate.getUTCDate() + i);
      const dEnd = new Date(dStart);
      dEnd.setUTCDate(dStart.getUTCDate() + 1);

      const rawDayRecords = await Attendance.find({
        date: { $gte: dStart, $lt: dEnd },
        studentId: { $in: activeStudentIds },
      });
      const dayRecordMap = getValidStudentRecordsMap(rawDayRecords);

      const formattedDate = dStart.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
      const dateISO = dStart.toISOString().split('T')[0];

      const dayEntry = {
        name: dayLabels[i],
        dayFull: fullDayNames[i],
        date: dateISO,
        formattedDate,
        classes: {},
      };

      let combPresent = 0;
      let combAbsent = 0;
      let combLate = 0;
      let combLeave = 0;
      let combMarked = 0;
      let combTotal = 0;
      let combEligibleMarkedTotal = 0;

      for (const c of classesList) {
        const cIdStr = c._id.toString();
        const classKey = formatClassName(c);
        const cStudents = classStudentsMap.get(cIdStr) || [];
        const cTotal = cStudents.length;

        let cPresent = 0;
        let cAbsent = 0;
        let cLate = 0;
        let cLeave = 0;

        for (const st of cStudents) {
          const rec = dayRecordMap.get(`${st._id.toString()}_${dateISO}`);
          if (rec) {
            if (rec.status === 'Present') cPresent++;
            else if (rec.status === 'Late') cLate++;
            else if (rec.status === 'Absent') cAbsent++;
            else if (rec.status === 'Leave' || rec.status === 'Excused') cLeave++;
          }
        }

        const cAttended = cPresent + cLate;
        const cMarked = cPresent + cAbsent + cLate + cLeave;
        const cIsMarked = cMarked > 0;
        const cPercentage = cIsMarked && cTotal > 0
          ? Math.min(100, Math.max(0, Math.round((cAttended / cTotal) * 100)))
          : null;

        if (cIsMarked) {
          combEligibleMarkedTotal += cTotal;
        }

        dayEntry[classKey] = cPercentage;
        dayEntry.classes[classKey] = {
          classId: c._id,
          className: classKey,
          present: cPresent,
          absent: cAbsent,
          late: cLate,
          leave: cLeave,
          attended: cAttended,
          marked: cMarked,
          total: cTotal,
          isMarked: cIsMarked,
          percentage: cPercentage,
        };

        combPresent += cPresent;
        combAbsent += cAbsent;
        combLate += cLate;
        combLeave += cLeave;
        combMarked += cMarked;
        combTotal += cTotal;
      }

      const combAttended = combPresent + combLate;
      const combIsMarked = combMarked > 0;
      const combEligibleDenominator = combEligibleMarkedTotal > 0 ? combEligibleMarkedTotal : combTotal;
      const combPercentage = combIsMarked && combEligibleDenominator > 0
        ? Math.min(100, Math.max(0, Math.round((combAttended / combEligibleDenominator) * 100)))
        : null;

      const combAbsentPct = combIsMarked && combEligibleDenominator > 0
        ? Math.min(100, Math.max(0, Math.round((combAbsent / combEligibleDenominator) * 100)))
        : 0;

      dayEntry['Combined Attendance'] = combPercentage;
      dayEntry.combined = {
        className: 'Combined Attendance',
        present: combPresent,
        absent: combAbsent,
        late: combLate,
        leave: combLeave,
        attended: combAttended,
        marked: combMarked,
        eligibleTotal: combEligibleDenominator,
        total: combTotal,
        isMarked: combIsMarked,
        percentage: combPercentage,
      };

      dayEntry.Present = combPercentage !== null ? combPercentage : 0;
      dayEntry.Absent = combAbsentPct;
      dayEntry.totalRecords = combMarked;

      weeklyTrends.push(dayEntry);
    }

    // -------------------------------------------------------------------------
    // 7. Available Years and Legacy Monthly Trends for 12 months
    // -------------------------------------------------------------------------
    const distinctYearsAgg = await Attendance.aggregate([
      { $match: { studentId: { $in: activeStudentIds } } },
      { $project: { year: { $year: "$date" } } },
      { $group: { _id: "$year" } },
      { $sort: { _id: -1 } }
    ]);
    let availableYears = distinctYearsAgg.map((y) => y._id).filter(Boolean);
    if (!availableYears.includes(currYear)) {
      availableYears.unshift(currYear);
    }
    if (!availableYears.includes(currYear - 1)) {
      availableYears.push(currYear - 1);
    }
    availableYears.sort((a, b) => b - a);

    res.status(200).json({
      success: true,
      data: {
        schoolTimezone: timezone,
        schoolLocalDate: todayDateStr,
        isSchoolOpenToday,
        todayClasses,
        todayClassStatus: todayClasses.reduce((acc, tc) => {
          acc[tc.classId] = tc.status;
          return acc;
        }, {}),
        todayLastUpdatedMap: todayClasses.reduce((acc, tc) => {
          acc[tc.classId] = tc.lastUpdatedTime;
          return acc;
        }, {}),
        counters: {
          totalStudents: totalStudentsCount,
          totalTeachers: totalTeachersCount,
          totalClasses: classesList.length,
          todayPercentage,
          avgDailyAttendance,
          schoolWideAvgDailyAttendance,
          markedToday: markedCount,
          isTodayMarked: markedCount > 0,
          presentToday,
          absentToday,
          lateToday,
          leaveToday,
        },
        absentStudents: absentStudentsList,
        classWise: classWiseStats,
        dailyTrends,
        weeklyTrends,
        periodInfo: {
          periodType,
          selectedYear,
          selectedMonth,
          specificDate: specificDateStr,
          startDate: customStartDateStr,
          endDate: customEndDateStr,
          description: filterDescription,
          rangeDays,
          aggregationType,
          aggregationLabel,
          hasData: hasPeriodData,
          totalMarked: periodMarkedTotal,
          periodPercentage,
        },
        selectedYear,
        selectedMonth,
        availableYears,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's today attendance status and concise update
// @route   GET /api/attendance/student-today/:studentId
// @access  Private
const getStudentTodayStatus = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const student = await Student.findById(studentId).populate('classId', 'grade section classTeacherId');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Authorization: If parent, verify child belongs to parent
    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.id);
      const childStrIds = (parent?.children || []).map(c => c.toString());
      if (!childStrIds.includes(studentId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this student\'s records' });
      }
    }

    const settings = (await Settings.findOne()) || {};
    const timezone = await getSchoolTimezone();
    const todayDateStr = getLocalDateString(new Date(), timezone);
    const { startOfDay, endOfDay, nextDay } = getUtcBoundariesForDateStr(todayDateStr);
    const isScheduled = isDateScheduled(todayDateStr, settings, timezone);

    // Check if student has an active approved leave covering today
    const activeLeave = await LeaveRequest.findOne({
      studentId,
      status: 'Approved',
      fromDate: { $lte: endOfDay },
      toDate: { $gte: startOfDay },
    });

    // Query today's attendance record (strictly today's UTC boundaries)
    const todayRecord = await Attendance.findOne({
      studentId,
      date: { $gte: startOfDay, $lt: nextDay },
    }).populate('markedBy', 'name');

    let status = 'NOT_MARKED';
    let updateMessage = "Today's attendance has not been marked yet.";
    let markedTime = null;

    if (todayRecord) {
      markedTime = formatSchoolTime(todayRecord.updatedAt || todayRecord.createdAt, timezone);
      const rawStatus = todayRecord.status;
      if (rawStatus === 'Present') {
        status = 'PRESENT';
        updateMessage = `${student.name} is marked Present today${markedTime ? ` (recorded at ${markedTime})` : ''}.`;
      } else if (rawStatus === 'Absent') {
        status = 'ABSENT';
        updateMessage = `${student.name} was marked Absent today${todayRecord.remarks ? `. Reason: "${todayRecord.remarks}"` : ''}.`;
      } else if (rawStatus === 'Late') {
        status = 'LATE';
        updateMessage = `${student.name} arrived Late today${markedTime ? ` at ${markedTime}` : ''}${todayRecord.remarks ? `. Note: "${todayRecord.remarks}"` : ''}.`;
      } else if (rawStatus === 'Leave' || rawStatus === 'Excused') {
        status = 'ON_LEAVE';
        updateMessage = `${student.name} is on approved Leave today.`;
      }
    } else if (activeLeave) {
      status = 'ON_LEAVE';
      updateMessage = `${student.name} is on approved Leave today (Reason: "${activeLeave.reason}").`;
    } else if (!isScheduled) {
      status = 'NOT_SCHEDULED';
      updateMessage = `School is not scheduled for attendance today.`;
    }

    // Calculate Monthly Stats for the current school-local month (or queried month)
    // Exclude future dates, weekends, holidays, and dates without finalized attendance
    const targetMonth = req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : todayDateStr.substring(0, 7);
    const isCurrentMonth = targetMonth === todayDateStr.substring(0, 7);

    const monthStartDateStr = `${targetMonth}-01`;
    const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
    const lastDayNum = new Date(targetYear, targetMonthNum, 0).getDate();
    const monthEndDateStr = isCurrentMonth ? todayDateStr : `${targetMonth}-${String(lastDayNum).padStart(2, '0')}`;

    const { startOfDay: monthStartUtc } = getUtcBoundariesForDateStr(monthStartDateStr);
    const { endOfDay: monthEndUtc } = getUtcBoundariesForDateStr(monthEndDateStr);

    const monthRecords = await Attendance.find({
      studentId,
      date: { $gte: monthStartUtc, $lte: monthEndUtc },
    }).sort({ date: 1 });

    const validMonthlyDates = new Map();
    for (const rec of monthRecords) {
      const recDateStr = getLocalDateString(rec.date, timezone);
      if (isCurrentMonth && recDateStr > todayDateStr) continue;
      if (!isDateScheduled(recDateStr, settings, timezone)) continue;
      validMonthlyDates.set(recDateStr, rec.status);
    }

    const totalSchoolDays = validMonthlyDates.size;
    let attendedDays = 0;
    let presentsCount = 0;
    let latesCount = 0;
    let absentsCount = 0;
    let leavesCount = 0;

    for (const [dStr, recStatus] of validMonthlyDates.entries()) {
      if (recStatus === 'Present') {
        presentsCount++;
        attendedDays++;
      } else if (recStatus === 'Late') {
        latesCount++;
        attendedDays++;
      } else if (recStatus === 'Absent') {
        absentsCount++;
      } else if (recStatus === 'Leave' || recStatus === 'Excused') {
        leavesCount++;
      }
    }

    const monthlyPercentage = totalSchoolDays > 0 ? Math.round((attendedDays / totalSchoolDays) * 100) : null;
    const supportingText = totalSchoolDays > 0
      ? `${attendedDays} of ${totalSchoolDays} school days`
      : 'No attendance recorded this month';

    const monthlyStats = {
      month: targetMonth,
      percentage: monthlyPercentage,
      attendedDays,
      totalSchoolDays,
      presents: presentsCount,
      lates: latesCount,
      absents: absentsCount,
      leaves: leavesCount,
      supportingText,
    };

    res.status(200).json({
      success: true,
      data: {
        studentId: student._id,
        studentName: student.name,
        classInfo: student.classId,
        todayDate: todayDateStr,
        timezone,
        schoolName: settings.schoolName || 'Smart Rural Model School',
        isScheduled,
        status, // 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'NOT_MARKED' | 'NOT_SCHEDULED'
        displayStatus:
          status === 'PRESENT'
            ? 'Present'
            : status === 'ABSENT'
            ? 'Absent'
            : status === 'LATE'
            ? 'Late'
            : status === 'ON_LEAVE'
            ? 'On Leave'
            : status === 'NOT_SCHEDULED'
            ? 'Not Scheduled'
            : 'Not Marked Yet',
        updateMessage,
        hasRecord: !!todayRecord,
        verifiedBy: todayRecord?.markedBy?.name || '',
        isOnLeave: !!activeLeave || status === 'ON_LEAVE',
        todayRecord: todayRecord
          ? {
              _id: todayRecord._id,
              status: todayRecord.status,
              remarks: todayRecord.remarks,
              markedBy: todayRecord.markedBy?.name || 'Class Teacher',
              markedAt: todayRecord.updatedAt || todayRecord.createdAt,
              markedTime,
            }
          : null,
        activeLeave: activeLeave
          ? {
              _id: activeLeave._id,
              reason: activeLeave.reason,
              fromDate: activeLeave.fromDate,
              toDate: activeLeave.toDate,
            }
          : null,
        monthlyStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate student report (Attendance, Monthly Summary, Leave History)
// @route   GET /api/attendance/student-report
// @access  Private
const getStudentReport = async (req, res, next) => {
  try {
    const {
      studentId,
      reportType = 'attendance', // 'attendance' | 'monthly' | 'leave'
      period = 'month', // 'month' | 'year' | 'custom'
      startDate,
      endDate,
      format = 'json', // 'json' | 'csv'
    } = req.query;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid student ID' });
    }

    const student = await Student.findById(studentId)
      .populate('classId', 'grade section roomNo academicYear');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    // Backend parent-child authorization check - never trust frontend ID alone
    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.id);
      const childStrIds = (parent?.children || []).map(c => c.toString());
      if (!childStrIds.includes(studentId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to access reports for this student' });
      }
    }

    const settings = (await Settings.findOne()) || {};
    const timezone = await getSchoolTimezone();
    const todayLocalStr = getLocalDateString(new Date(), timezone);
    const [todayYear, todayMonth, todayDay] = todayLocalStr.split('-').map(Number);
    const schoolName = settings.schoolName || 'Smart Rural Model School';

    let rangeStartStr = '';
    let rangeEndStr = todayLocalStr;
    let periodLabel = '';

    if (period === 'month') {
      const monthPadded = String(todayMonth).padStart(2, '0');
      rangeStartStr = `${todayYear}-${monthPadded}-01`;
      rangeEndStr = todayLocalStr;
      const monthName = new Date(Date.UTC(todayYear, todayMonth - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
      periodLabel = `${monthName} ${todayYear}`;
    } else if (period === 'year') {
      // Academic year: starts June 1 of start year
      const academicStartYear = todayMonth >= 6 ? todayYear : todayYear - 1;
      const academicEndYear = academicStartYear + 1;
      rangeStartStr = `${academicStartYear}-06-01`;
      rangeEndStr = todayLocalStr;
      periodLabel = `Academic Year ${academicStartYear}-${academicEndYear}`;
    } else if (period === 'custom') {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Please provide both Start Date and End Date for custom range' });
      }
      if (startDate > endDate) {
        return res.status(400).json({ success: false, message: 'Start Date cannot be after End Date' });
      }
      rangeStartStr = startDate;
      rangeEndStr = endDate;
      periodLabel = `${startDate} to ${endDate}`;
    } else {
      rangeStartStr = `${todayYear}-01-01`;
      rangeEndStr = todayLocalStr;
      periodLabel = 'All Dates';
    }

    const { startOfDay: startBoundary } = getUtcBoundariesForDateStr(rangeStartStr);
    const { endOfDay: endBoundary } = getUtcBoundariesForDateStr(rangeEndStr);

    const safeStudentName = student.name.replace(/[^a-zA-Z0-9]/g, '-');
    const safePeriodLabel = periodLabel.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `${safeStudentName}-${reportType === 'leave' ? 'Leave-History' : reportType === 'monthly' ? 'Monthly-Summary' : 'Attendance'}-${safePeriodLabel}`;

    const classLabel = student.classId
      ? `${String(student.classId.grade || '').toLowerCase().startsWith('grade') ? student.classId.grade : `Grade ${student.classId.grade}`}-${student.classId.section || ''}`
      : 'N/A';

    // 1. LEAVE HISTORY REPORT
    if (reportType === 'leave') {
      const leaves = await LeaveRequest.find({
        studentId,
        $or: [
          { fromDate: { $gte: startBoundary, $lte: endBoundary } },
          { toDate: { $gte: startBoundary, $lte: endBoundary } },
          { fromDate: { $lte: startBoundary }, toDate: { $gte: endBoundary } },
        ],
      })
        .populate('approvedBy', 'name role')
        .sort({ fromDate: -1 });

      if (leaves.length === 0) {
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          return res.status(200).send(`Student Name,Class,From Date,To Date,Status,Reason,Remarks\n"No leave records found for ${student.name} in ${periodLabel}."\n`);
        }
        return res.status(200).json({
          success: true,
          empty: true,
          message: `No leave records found for ${student.name} in ${periodLabel}.`,
          data: {
            student: { id: student._id, name: student.name, rollNo: student.rollNo, class: classLabel },
            schoolName,
            period: periodLabel,
            range: { start: rangeStartStr, end: rangeEndStr },
            records: [],
            totalCount: 0,
            filename: `${filename}.pdf`,
          },
        });
      }

      if (format === 'csv') {
        let csv = 'Student Name,Class,From Date,To Date,Status,Reason,Remarks,Reviewed By\n';
        for (const l of leaves) {
          const from = getLocalDateString(l.fromDate, timezone);
          const to = getLocalDateString(l.toDate, timezone);
          const reviewer = l.approvedBy ? `${l.approvedBy.name} (${l.approvedBy.role})` : 'N/A';
          csv += `"${student.name}","${classLabel}","${from}","${to}","${l.status}","${(l.reason || '').replace(/"/g, '""')}","${(l.remarks || '').replace(/"/g, '""')}","${reviewer}"\n`;
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.status(200).send(csv);
      }

      return res.status(200).json({
        success: true,
        empty: false,
        data: {
          student: { id: student._id, name: student.name, rollNo: student.rollNo, class: classLabel },
          schoolName,
          period: periodLabel,
          range: { start: rangeStartStr, end: rangeEndStr },
          records: leaves.map(l => ({
            id: l._id,
            fromDate: getLocalDateString(l.fromDate, timezone),
            toDate: getLocalDateString(l.toDate, timezone),
            status: l.status,
            reason: l.reason,
            remarks: l.remarks || '',
            reviewedBy: l.approvedBy ? `${l.approvedBy.name} (${l.approvedBy.role})` : 'N/A',
            createdAt: l.createdAt,
          })),
          totalCount: leaves.length,
          filename: `${filename}.pdf`,
        },
      });
    }

    // 2. ATTENDANCE REPORT & MONTHLY SUMMARY
    const records = await Attendance.find({
      studentId,
      date: { $gte: startBoundary, $lte: endBoundary },
    })
      .populate('markedBy', 'name')
      .sort({ date: -1 });

    if (records.length === 0) {
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.status(200).send(`Date,Student Name,Class,Status,Remarks,Verified By\n"No attendance records found for ${student.name} in ${periodLabel}."\n`);
      }
      return res.status(200).json({
        success: true,
        empty: true,
        message: `No attendance records found for ${student.name} in ${periodLabel}.`,
        data: {
          student: { id: student._id, name: student.name, rollNo: student.rollNo, admissionNo: student.admissionNo, class: classLabel },
          schoolName,
          period: periodLabel,
          range: { start: rangeStartStr, end: rangeEndStr },
          records: [],
          stats: { totalDays: 0, presents: 0, absents: 0, lates: 0, leaves: 0, attendanceRate: 0 },
          monthlyBreakdown: [],
          filename: `${filename}.pdf`,
        },
      });
    }

    const totalDays = records.length;
    const presents = records.filter(r => r.status === 'Present').length;
    const absents = records.filter(r => r.status === 'Absent').length;
    const lates = records.filter(r => r.status === 'Late').length;
    const leaves = records.filter(r => r.status === 'Leave' || r.status === 'Excused').length;
    const attendedDays = presents + lates;
    const attendanceRate = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;

    // Monthly breakdown
    const monthlyMap = new Map();
    for (const r of records) {
      const dStr = getLocalDateString(r.date, timezone);
      const monthKey = dStr.substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthKey, total: 0, presents: 0, absents: 0, lates: 0, leaves: 0 });
      }
      const m = monthlyMap.get(monthKey);
      m.total += 1;
      if (r.status === 'Present') m.presents += 1;
      else if (r.status === 'Absent') m.absents += 1;
      else if (r.status === 'Late') m.lates += 1;
      else if (r.status === 'Leave' || r.status === 'Excused') m.leaves += 1;
    }

    const monthlyBreakdown = Array.from(monthlyMap.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(m => ({
        ...m,
        attendanceRate: m.total > 0 ? Math.round(((m.presents + m.lates) / m.total) * 100) : 0,
      }));

    if (format === 'csv') {
      let csv = '';
      if (reportType === 'monthly') {
        csv = 'Month,Total Marked Days,Present,Absent,Late,Leave,Attendance Rate %\n';
        for (const m of monthlyBreakdown) {
          csv += `"${m.month}",${m.total},${m.presents},${m.absents},${m.lates},${m.leaves},${m.attendanceRate}%\n`;
        }
      } else {
        csv = 'Date,Student Name,Roll No,Class,Status,Remarks,Verified By\n';
        for (const r of records) {
          const dStr = getLocalDateString(r.date, timezone);
          const verifier = r.markedBy?.name || 'Class Teacher';
          csv += `"${dStr}","${student.name}","${student.rollNo || ''}","${classLabel}","${r.status}","${(r.remarks || '').replace(/"/g, '""')}","${verifier}"\n`;
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      success: true,
      empty: false,
      data: {
        student: { id: student._id, name: student.name, rollNo: student.rollNo, admissionNo: student.admissionNo, class: classLabel },
        schoolName,
        period: periodLabel,
        range: { start: rangeStartStr, end: rangeEndStr },
        stats: { totalDays, presents, absents, lates, leaves, attendanceRate },
        monthlyBreakdown,
        records: records.map(r => ({
          id: r._id,
          date: getLocalDateString(r.date, timezone),
          status: r.status,
          remarks: r.remarks || '',
          markedBy: r.markedBy?.name || 'Class Teacher',
        })),
        filename: `${filename}.pdf`,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export attendance history (Excel .xlsx or CSV)
// @route   GET /api/attendance/export-history
// @access  Private (Teacher / Admin)
const exportAttendanceHistory = async (req, res, next) => {
  try {
    const {
      classId,
      date,
      startDate,
      endDate,
      format = 'xlsx', // 'xlsx' | 'csv'
      studentId,
    } = req.query;

    if (!classId) {
      return res.status(400).json({ success: false, message: 'Please select a valid class to export.' });
    }

    const settings = (await Settings.findOne()) || {};
    const schoolName = settings.schoolName || 'Smart Rural Model School';
    const timezone = await getSchoolTimezone();
    const todayDateStr = getLocalDateString(new Date(), timezone);

    // Verify teacher authorization
    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id);
      const teacherClasses = await Class.find({
        $or: [
          { classTeacherId: req.user.id },
          { _id: { $in: teacher?.assignedClasses || [] } }
        ]
      }).select('_id');
      const teacherClassStrIds = teacherClasses.map((c) => c._id.toString());

      if (!teacherClassStrIds.includes(classId.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to export attendance records for this class.'
        });
      }
    }

    const targetClass = await Class.findById(classId).populate('classTeacherId', 'name');
    if (!targetClass) {
      return res.status(404).json({ success: false, message: 'Class record not found.' });
    }

    const gradeClean = String(targetClass.grade || '').replace(/^grade\s*/i, '').trim();
    const classLabel = `Grade ${gradeClean}-${targetClass.section || ''}`;
    const safeClassLabel = `Grade-${gradeClean}-${targetClass.section || ''}`.replace(/[^a-zA-Z0-9_-]/g, '-');

    // Determine date boundaries
    let rangeStartStr = '';
    let rangeEndStr = '';
    let isSingleDay = false;

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      rangeStartStr = date;
      rangeEndStr = date;
      isSingleDay = true;
    } else if (startDate || endDate) {
      rangeStartStr = startDate || endDate;
      rangeEndStr = endDate || startDate;
      if (rangeStartStr === rangeEndStr) {
        isSingleDay = true;
      }
    } else {
      rangeStartStr = todayDateStr;
      rangeEndStr = todayDateStr;
      isSingleDay = true;
    }

    const { startOfDay: startBoundary } = getUtcBoundariesForDateStr(rangeStartStr);
    const { endOfDay: endBoundary } = getUtcBoundariesForDateStr(rangeEndStr);

    let targetStudent = null;
    if (studentId) {
      targetStudent = await Student.findById(studentId);
      if (!targetStudent) {
        return res.status(404).json({ success: false, message: 'Student record not found.' });
      }
    }

    const periodLabel = isSingleDay ? rangeStartStr : `${rangeStartStr} to ${rangeEndStr}`;
    const filenameDateSuffix = isSingleDay ? rangeStartStr : `${rangeStartStr}_to_${rangeEndStr}`;
    const safePrefix = targetStudent
      ? `${targetStudent.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${safeClassLabel}`
      : safeClassLabel;
    const filename = `${safePrefix}_Attendance_Report_${filenameDateSuffix}.${format === 'csv' ? 'csv' : 'xlsx'}`;

    // Expected students in class
    const allStudentsInClass = await Student.find({ classId }).sort({ rollNo: 1, name: 1 });
    const totalStudentsInClass = allStudentsInClass.length;

    // Fetch attendance records in range
    const attendanceQuery = {
      classId,
      date: { $gte: startBoundary, $lte: endBoundary },
    };
    if (studentId) {
      attendanceQuery.studentId = studentId;
    }

    const records = await Attendance.find(attendanceQuery)
      .populate('studentId', 'name rollNo admissionNo classId')
      .populate('classId', 'grade section')
      .populate('markedBy', 'name')
      .sort({ date: 1, 'studentId.rollNo': 1 });

    const validRecords = records.filter(r => r.studentId);

    // Calculate metrics
    let presents = 0;
    let absents = 0;
    let lates = 0;
    let leaves = 0;

    for (const r of validRecords) {
      if (r.status === 'Present') presents++;
      else if (r.status === 'Absent') absents++;
      else if (r.status === 'Late') lates++;
      else if (r.status === 'Leave' || r.status === 'Excused') leaves++;
    }

    const attendedCount = presents + lates;
    const totalMarkedRecords = validRecords.length;
    const studentIdsInReport = new Set(validRecords.map(r => String(r.studentId?._id || r.studentId)));
    const totalStudentsDisplay = targetStudent
      ? 1
      : isSingleDay
      ? (totalStudentsInClass > 0 ? totalStudentsInClass : studentIdsInReport.size)
      : (studentIdsInReport.size > 0 ? studentIdsInReport.size : totalStudentsInClass);
    const attendancePercentage = totalMarkedRecords > 0
      ? Math.round((attendedCount / totalMarkedRecords) * 100)
      : 0;

    const teacherName = req.user.name || 'Teacher';
    const nowLocalTime = formatSchoolTime(new Date(), timezone);
    const reportGeneratedTimestamp = `${todayDateStr} ${nowLocalTime ? `• ${nowLocalTime}` : ''}`;

    // Marking completeness status
    let markingStatusText = '';
    if (isSingleDay) {
      if (totalMarkedRecords === 0) {
        markingStatusText = 'Not Marked (0 records saved for this date)';
      } else if (totalMarkedRecords >= totalStudentsInClass && totalStudentsInClass > 0) {
        markingStatusText = `Complete (${totalMarkedRecords} of ${totalStudentsInClass} students recorded)`;
      } else {
        const diff = Math.max(0, totalStudentsInClass - totalMarkedRecords);
        markingStatusText = `Partially Marked (${totalMarkedRecords} of ${totalStudentsInClass} recorded • ${diff} unmarked)`;
      }
    } else {
      markingStatusText = `${totalMarkedRecords} attendance entries recorded over date range`;
    }

    // --- CSV FORMAT EXPORT ---
    if (format === 'csv') {
      let csv = '';
      csv += `"${schoolName.replace(/"/g, '""')}"\n`;
      csv += targetStudent
        ? `"Student Attendance Report - ${targetStudent.name.replace(/"/g, '""')} (${classLabel})"\n`
        : `"Attendance Report - ${classLabel}"\n`;
      csv += `"Period: ${periodLabel}","Teacher: ${teacherName}","Generated Date: ${reportGeneratedTimestamp}","Status: ${markingStatusText}"\n\n`;
      csv += `"Attendance Summary"\n`;
      csv += `"Total Students","Present","Absent","Late","On Leave","Attendance Percentage"\n`;
      csv += `${totalStudentsDisplay},${presents},${absents},${lates},${leaves},"${attendancePercentage}%"\n\n`;
      csv += `"Sr. No.","Roll No.","Student Name","Class / Section","Attendance Date","Status","Remarks","Marked By"\n`;

      if (validRecords.length === 0) {
        csv += `"","","No attendance records found for ${classLabel} in ${periodLabel}.","","","","",""\n`;
      } else {
        validRecords.forEach((r, idx) => {
          const recDateStr = getLocalDateString(r.date, timezone);
          const studentName = r.studentId?.name || 'N/A';
          const rollNo = r.studentId?.rollNo || 'N/A';
          const markedByName = r.markedBy?.name || targetClass.classTeacherId?.name || 'Class Teacher';
          const remarks = r.remarks ? r.remarks.replace(/"/g, '""') : '';
          csv += `${idx + 1},"${rollNo}","${studentName.replace(/"/g, '""')}","${classLabel}","${recDateStr}","${r.status}","${remarks}","${markedByName.replace(/"/g, '""')}"\n`;
        });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    // --- EXCEL (.xlsx) WORKBOOK CREATION ---
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartAttend Rural';
    workbook.lastModifiedBy = teacherName;
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Attendance Report', {
      views: [{ state: 'normal' }], // Avoid freezing rows 1-10 so school name and summary are not duplicated or pinned
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
      }
    });

    // Configure Print Titles so printed pages repeat ONLY the student table's column headers (Row 11),
    // and do NOT repeat the school name or summary rows
    sheet.pageSetup.printTitlesRow = '11:11';

    const borderThin = {
      top: { style: 'thin', color: { argb: 'D0D7DE' } },
      left: { style: 'thin', color: { argb: 'D0D7DE' } },
      bottom: { style: 'thin', color: { argb: 'D0D7DE' } },
      right: { style: 'thin', color: { argb: 'D0D7DE' } },
    };

    // 1. School Header Row (Row 1)
    sheet.mergeCells('A1:H1');
    const row1 = sheet.getCell('A1');
    row1.value = schoolName.toUpperCase();
    row1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: '1E4620' } };
    row1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    // 2. Report Subtitle Row (Row 2)
    sheet.mergeCells('A2:H2');
    const row2 = sheet.getCell('A2');
    row2.value = targetStudent
      ? `STUDENT ATTENDANCE REPORT — ${targetStudent.name.toUpperCase()} (ROLL NO. ${targetStudent.rollNo || 'N/A'})`
      : `STUDENT ATTENDANCE REPORT — ${classLabel.toUpperCase()}`;
    row2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '333333' } };
    row2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Row 3: Spacing
    sheet.getRow(3).height = 8;

    // 3. Metadata Table (Rows 4-6)
    if (targetStudent) {
      sheet.getCell('A4').value = 'Student Name:';
      sheet.getCell('B4').value = `${targetStudent.name} (Roll: ${targetStudent.rollNo || 'N/A'})`;
    } else {
      sheet.getCell('A4').value = 'Class & Section:';
      sheet.getCell('B4').value = classLabel;
    }
    sheet.getCell('D4').value = 'Attendance Period:';
    sheet.getCell('E4').value = periodLabel;

    sheet.getCell('A5').value = 'Generated By:';
    sheet.getCell('B5').value = teacherName;
    sheet.getCell('D5').value = 'Report Generated:';
    sheet.getCell('E5').value = reportGeneratedTimestamp;

    sheet.getCell('A6').value = 'Class Teacher:';
    sheet.getCell('B6').value = targetClass.classTeacherId?.name || 'Class Teacher';
    sheet.getCell('D6').value = 'Marking Status:';
    sheet.getCell('E6').value = markingStatusText;

    // Style metadata cells
    ['A4', 'D4', 'A5', 'D5', 'A6', 'D6'].forEach((cellKey) => {
      const cell = sheet.getCell(cellKey);
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '555555' } };
    });
    ['B4', 'E4', 'B5', 'E5', 'B6', 'E6'].forEach((cellKey) => {
      const cell = sheet.getCell(cellKey);
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '111111' } };
    });

    // Row 7: Spacing
    sheet.getRow(7).height = 8;

    // 4. Summary Banner (Row 8 & 9)
    const summaryHeaders = ['Total Students', 'Present', 'Absent', 'Late', 'On Leave', 'Attendance %'];
    const summaryValues = [
      totalStudentsDisplay,
      presents,
      absents,
      lates,
      leaves,
      `${attendancePercentage}%`
    ];

    sheet.getRow(8).height = 22;
    sheet.getRow(9).height = 24;

    const summaryColKeys = ['B', 'C', 'D', 'E', 'F', 'G'];
    summaryHeaders.forEach((hdr, idx) => {
      const colLetter = summaryColKeys[idx];
      const hCell = sheet.getCell(`${colLetter}8`);
      hCell.value = hdr;
      hCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '444444' } };
      hCell.alignment = { horizontal: 'center', vertical: 'middle' };
      hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      hCell.border = borderThin;

      const vCell = sheet.getCell(`${colLetter}9`);
      vCell.value = summaryValues[idx];
      vCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: idx === 5 ? '1E4620' : '111111' } };
      vCell.alignment = { horizontal: 'center', vertical: 'middle' };
      vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
      vCell.border = borderThin;
    });

    // Row 10: Spacing
    sheet.getRow(10).height = 10;

    // 5. Student Attendance Table Headers (Row 11)
    const tableColumns = [
      'Sr. No.',
      'Roll No.',
      'Student Name',
      'Class / Section',
      'Attendance Date',
      'Status',
      'Remarks',
      'Marked By',
    ];

    sheet.getRow(11).height = 26;
    tableColumns.forEach((colName, idx) => {
      const cell = sheet.getRow(11).getCell(idx + 1);
      cell.value = colName;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = {
        horizontal: idx === 2 || idx === 6 || idx === 7 ? 'left' : 'center',
        vertical: 'middle'
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2E7D32' } // SmartAttend green fill
      };
      cell.border = borderThin;
    });

    // 6. Data Rows (Row 12+)
    let currentRowIdx = 12;

    if (validRecords.length === 0) {
      sheet.mergeCells(`A${currentRowIdx}:H${currentRowIdx}`);
      const emptyCell = sheet.getCell(`A${currentRowIdx}`);
      emptyCell.value = `No attendance records found for ${classLabel} in ${periodLabel}.`;
      emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '777777' } };
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyCell.border = borderThin;
      sheet.getRow(currentRowIdx).height = 30;
      currentRowIdx++;
    } else {
      validRecords.forEach((r, idx) => {
        const row = sheet.getRow(currentRowIdx);
        row.height = 22;

        const recDateStr = getLocalDateString(r.date, timezone);
        const studentName = r.studentId?.name || 'N/A';
        const rollNo = r.studentId?.rollNo || 'N/A';
        const markedByName = r.markedBy?.name || targetClass.classTeacherId?.name || 'Class Teacher';
        const remarksStr = r.remarks || '';

        const rowValues = [
          idx + 1,
          rollNo,
          studentName,
          classLabel,
          recDateStr,
          r.status,
          remarksStr,
          markedByName,
        ];

        rowValues.forEach((val, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = val;
          cell.font = { name: 'Calibri', size: 10, color: { argb: '222222' } };
          cell.border = borderThin;
          cell.alignment = {
            horizontal: colIdx === 2 || colIdx === 6 || colIdx === 7 ? 'left' : 'center',
            vertical: 'middle'
          };

          // Status cell styling
          if (colIdx === 5) {
            cell.font = { name: 'Calibri', size: 10, bold: true };
            if (r.status === 'Present') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
              cell.font.color = { argb: '1B5E20' };
            } else if (r.status === 'Absent') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBEE' } };
              cell.font.color = { argb: 'B71C1C' };
            } else if (r.status === 'Late') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8E1' } };
              cell.font.color = { argb: 'B78103' };
            } else if (r.status === 'Leave' || r.status === 'Excused') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E3F2FD' } };
              cell.font.color = { argb: '0D47A1' };
            }
          }
        });

        currentRowIdx++;
      });
    }

    // Set Column Widths
    sheet.getColumn(1).width = 9;   // Sr. No.
    sheet.getColumn(2).width = 12;  // Roll No.
    sheet.getColumn(3).width = 28;  // Student Name
    sheet.getColumn(4).width = 18;  // Class / Section
    sheet.getColumn(5).width = 16;  // Attendance Date
    sheet.getColumn(6).width = 15;  // Status
    sheet.getColumn(7).width = 30;  // Remarks
    sheet.getColumn(8).width = 22;  // Marked By

    // Enable AutoFilter on table headers row 11
    sheet.autoFilter = {
      from: { row: 11, column: 1 },
      to: { row: Math.max(12, currentRowIdx - 1), column: 8 },
    };

    // Send .xlsx binary stream
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAttendance,
  getAttendance,
  getDashboardStats,
  getStudentTodayStatus,
  getStudentReport,
  exportAttendanceHistory,
};
