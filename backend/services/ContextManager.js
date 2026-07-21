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
 * @returns {Object} - Compiled context data for prompt injection
 */
const getContextData = async (user) => {
  const context = {
    role: user.role,
    name: user.name,
    currentDate: new Date().toLocaleDateString(),
    schoolStats: {},
  };

  try {
    // 1. Common context: Recent notices & events
    const notices = await Notice.find({}).sort({ createdAt: -1 }).limit(3);
    const events = await SchoolEvent.find({}).sort({ date: 1 }).limit(3);

    context.recentNotices = notices.map(n => ({ title: n.title, content: n.content }));
    context.upcomingEvents = events.map(e => ({ title: e.title, type: e.type, date: new Date(e.date).toLocaleDateString() }));

    // 2. Role-specific context
    if (user.role === 'admin') {
      const studentCount = await Student.countDocuments({});
      const teacherCount = await User.countDocuments({ role: 'teacher' });
      const classCount = await Class.countDocuments({});
      
      // Calculate overall average attendance
      const records = await Attendance.find({});
      const total = records.length;
      const presents = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
      const avgRate = total > 0 ? Math.round((presents / total) * 100) : 100;

      // Pending leaves count
      const pendingLeaves = await LeaveRequest.countDocuments({ status: 'Pending' });

      context.schoolStats = {
        studentCount,
        teacherCount,
        classCount,
        avgRate,
        pendingLeaves,
      };
    } 
    else if (user.role === 'teacher') {
      // Find classes assigned to this teacher
      const teacherUser = await User.findById(user._id).populate('assignedClasses');
      const classes = teacherUser.assignedClasses || [];
      const classIds = classes.map(c => c._id);

      // Find students in these classes
      const students = await Student.find({ classId: { $in: classIds } });
      const studentIds = students.map(s => s._id);

      // Get today's attendance logs
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
      };
    } 
    else if (user.role === 'parent') {
      // Find children linked to parent
      const parentUser = await User.findById(user._id).populate('children');
      const children = parentUser.children || [];
      const childIds = children.map(c => c._id);

      const childrenDetails = [];

      for (const child of children) {
        // Compute average attendance rate
        const records = await Attendance.find({ studentId: child._id });
        const total = records.length;
        const presents = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const rate = total > 0 ? Math.round((presents / total) * 100) : 100;

        // Pending leaves for this child
        const pendingLeaves = await LeaveRequest.find({ studentId: child._id, status: 'Pending' });

        childrenDetails.push({
          name: child.name,
          rollNo: child.rollNo,
          attendanceRate: rate,
          pendingLeaves: pendingLeaves.map(l => ({ reason: l.reason, fromDate: new Date(l.fromDate).toLocaleDateString() })),
        });
      }

      context.schoolStats = {
        childrenCount: children.length,
        childrenDetails,
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
