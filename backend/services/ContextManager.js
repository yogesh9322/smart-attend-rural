const Student = require('../models/Student');
const Class = require('../models/Class');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Notice = require('../models/Notice');
const LeaveRequest = require('../models/LeaveRequest');
const SchoolEvent = require('../models/SchoolEvent');

/**
 * Gathers relevant contextual application data based on user role
 * @param {Object} user - Request user details
 * @param {Array} recentHistory - Optional recent chat logs array for context continuity
 * @returns {Object} - Compiled context data for prompt injection
 */
const getContextData = async (user, recentHistory = []) => {
  const context = {
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    currentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    schoolStats: {},
    recentNotices: [],
    upcomingEvents: [],
    recentConversation: [],
  };

  try {
    // Format recent chat conversation for context continuity (pronoun resolution, follow-up queries)
    if (Array.isArray(recentHistory) && recentHistory.length > 0) {
      context.recentConversation = recentHistory.map(h => ({
        question: h.question,
        answer: h.answer
      }));
    }

    // 1. Common context: Published notices & upcoming school events
    const notices = await Notice.find({ status: 'Published' }).sort({ publishDate: -1 }).limit(10);
    const events = await SchoolEvent.find({}).sort({ date: 1 }).limit(10);

    context.recentNotices = notices.map(n => ({
      title: n.title,
      content: n.content,
      category: n.category,
      type: n.noticeType || 'School',
      publishDate: n.publishDate ? new Date(n.publishDate).toISOString().split('T')[0] : '',
      isRead: n.readBy ? n.readBy.some(id => id.toString() === user._id.toString()) : false,
    }));

    context.upcomingEvents = events.map(e => ({
      title: e.title,
      description: e.description || '',
      type: e.type,
      date: new Date(e.date).toISOString().split('T')[0],
    }));

    // Common navigation routes reference for SmartAttend Rural
    const navigationRoutes = {
      attendance: 'Sidebar -> Attendance (or click child card on Parent Dashboard)',
      applyLeave: 'Sidebar -> Leave Request (select child, choose dates, enter reason, submit)',
      leaveStatus: 'Sidebar -> Leave Request (view list of submitted leave applications)',
      notices: 'Sidebar -> Notice Board (or Notices section on Parent Dashboard)',
      calendar: 'Sidebar -> Calendar (view school holidays, exams, and event schedule)',
      children: 'Sidebar -> My Children (view child profiles, roll numbers, and teacher contact)',
      reports: 'Sidebar -> Reports (or click "Download Report" button on Parent Dashboard)',
      profile: 'Account Menu (top right profile icon/avatar) -> Profile Settings',
      teacherContact: 'My Children section / Teacher Contact card on Parent Dashboard',
    };

    // 2. Role-specific context aggregation
    if (user.role === 'admin') {
      const studentCount = await Student.countDocuments({});
      const teacherCount = await User.countDocuments({ role: 'teacher' });
      const classCount = await Class.countDocuments({});
      
      const records = await Attendance.find({});
      const total = records.length;
      const presents = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
      const avgRate = total > 0 ? Math.round((presents / total) * 100) : 100;
      const pendingLeaves = await LeaveRequest.countDocuments({ status: 'Pending' });

      context.schoolStats = {
        studentCount,
        teacherCount,
        classCount,
        avgRate,
        pendingLeaves,
        navigationRoutes,
      };
    } 
    else if (user.role === 'teacher') {
      const teacherUser = await User.findById(user._id).populate('assignedClasses');
      const classes = teacherUser?.assignedClasses || [];
      const classIds = classes.map(c => c._id);

      const students = await Student.find({ classId: { $in: classIds } });
      const studentIds = students.map(s => s._id);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const todaysAttendance = await Attendance.find({
        studentId: { $in: studentIds },
        date: { $gte: startOfDay, $lte: endOfDay }
      }).populate('studentId', 'name rollNo');

      const absentees = todaysAttendance.filter(a => a.status === 'Absent').map(a => a.studentId?.name);

      context.schoolStats = {
        assignedClasses: classes.map(c => `${c.grade}-${c.section}`),
        studentCount: students.length,
        absenteesToday: absentees,
        absenteesCount: absentees.length,
        navigationRoutes,
      };
    } 
    else if (user.role === 'parent') {
      // Find all children linked to parent
      let children = [];
      const parentUser = await User.findById(user._id).populate({
        path: 'children',
        populate: { path: 'classId', select: 'grade section classTeacherId' },
      });

      if (parentUser && parentUser.children && parentUser.children.length > 0) {
        children = parentUser.children;
      } else {
        children = await Student.find({ parentId: user._id }).populate({
          path: 'classId',
          select: 'grade section classTeacherId',
        });
      }

      const childrenDetails = [];

      for (const child of children) {
        // Attendance records for this child
        const records = await Attendance.find({ studentId: child._id }).sort({ date: -1 });
        const totalDays = records.length;
        const presentDays = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const absentDays = records.filter(r => r.status === 'Absent').length;
        const leaveDays = records.filter(r => r.status === 'Leave').length;
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

        // Today's attendance status (CURRENT DATE: midnight to end of day)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todayRecord = records.find(r => {
          const rDate = new Date(r.date);
          return rDate >= startOfDay && rDate <= endOfDay;
        });

        const todayAttendance = todayRecord ? todayRecord.status : 'Not marked yet today';

        // Yesterday's attendance status
        const startOfYesterday = new Date();
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        startOfYesterday.setHours(0, 0, 0, 0);

        const endOfYesterday = new Date();
        endOfYesterday.setDate(endOfYesterday.getDate() - 1);
        endOfYesterday.setHours(23, 59, 59, 999);

        const yesterdayRecord = records.find(r => {
          const rDate = new Date(r.date);
          return rDate >= startOfYesterday && rDate <= endOfYesterday;
        });

        const yesterdayAttendance = yesterdayRecord ? yesterdayRecord.status : 'Not marked for yesterday';

        // Recent 7 attendance logs
        const recentAttendanceLogs = records.slice(0, 7).map(r => ({
          date: new Date(r.date).toISOString().split('T')[0],
          status: r.status,
          remarks: r.remarks || '',
        }));

        // All leave requests for this child
        const leaves = await LeaveRequest.find({ studentId: child._id }).sort({ createdAt: -1 });
        const leaveApplications = leaves.map(l => ({
          fromDate: new Date(l.fromDate).toISOString().split('T')[0],
          toDate: new Date(l.toDate).toISOString().split('T')[0],
          reason: l.reason,
          status: l.status,
          remarks: l.remarks || '',
          createdAt: new Date(l.createdAt).toISOString().split('T')[0],
        }));

        // Fetch assigned class teacher info if available
        let teacherInfo = null;
        if (child.classId) {
          const classObj = await Class.findById(child.classId._id || child.classId).populate('classTeacherId', 'name phone email');
          if (classObj && classObj.classTeacherId) {
            teacherInfo = {
              teacherName: classObj.classTeacherId.name,
              phone: classObj.classTeacherId.phone || 'N/A',
              email: classObj.classTeacherId.email || 'N/A',
            };
          }
        }

        const gradeSection = child.classId ? `Grade ${child.classId.grade}-${child.classId.section}` : 'N/A';

        childrenDetails.push({
          childId: child._id.toString(),
          name: child.name,
          firstName: child.name ? child.name.split(' ')[0] : '',
          rollNo: child.rollNo,
          admissionNo: child.admissionNo || '',
          gender: child.gender || '',
          gradeSection,
          attendanceRate,
          totalDays,
          presentDays,
          absentDays,
          leaveDays,
          todayAttendance,
          yesterdayAttendance,
          recentAttendanceLogs,
          leaveApplications,
          teacherInfo,
        });
      }

      const unreadNoticesCount = context.recentNotices.filter(n => !n.isRead).length;

      context.schoolStats = {
        parentProfile: {
          name: user.name,
          email: user.email,
          phone: user.phone || 'N/A',
          occupation: user.occupation || 'N/A',
          village: user.village || 'N/A',
        },
        childrenCount: childrenDetails.length,
        childrenDetails,
        unreadNoticesCount,
        navigationRoutes,
      };
    }
  } catch (err) {
    console.error('Context manager data aggregation failed:', err);
  }

  return context;
};

module.exports = {
  getContextData,
};
