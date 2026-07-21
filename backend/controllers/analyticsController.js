const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Class = require('../models/Class');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const { generateGeminiInsights } = require('../services/aiService');

// Helper to calculate statistics
const getStatsForStudents = async (req) => {
  let query = {};
  if (req.user && req.user.role === 'teacher') {
    const teacher = await User.findById(req.user.id);
    const classes = await Class.find({
      $or: [
        { classTeacherId: req.user.id },
        { _id: { $in: teacher?.assignedClasses || [] } }
      ]
    }).select('_id');
    const teacherClassIds = classes.map(c => c._id);
    query.classId = { $in: teacherClassIds };
  }

  const students = await Student.find(query).populate('classId');
  const studentStats = [];

  for (const student of students) {
    const records = await Attendance.find({ studentId: student._id });
    const total = records.length;
    const presents = records.filter(r => r.status === 'Present').length;
    const lates = records.filter(r => r.status === 'Late').length;
    const absents = records.filter(r => r.status === 'Absent').length;
    const leaves = records.filter(r => r.status === 'Leave').length;

    const rate = total > 0 ? Math.round(((presents + lates) / total) * 100) : 0;

    // Check consecutive absences
    const sortedRecords = records.sort((a, b) => new Date(b.date) - new Date(a.date));
    let consecutiveAbsences = 0;
    for (const r of sortedRecords) {
      if (r.status === 'Absent') {
        consecutiveAbsences++;
      } else {
        break; // Stop on first present/late/leave
      }
    }

    // Risk Classification
    let risk = 'Low';
    let recommendation = 'Excellent Performance';

    if (total > 0 && (rate < 75 || consecutiveAbsences >= 3)) {
      risk = 'High';
      recommendation = 'Contact Parent immediately & schedule counseling.';
    } else if (total > 0 && (rate < 85 || leaves > 3)) {
      risk = 'Medium';
      recommendation = 'Counselling Required. Monitor attendance weekly.';
    } else if (total === 0) {
      risk = 'High';
      recommendation = 'No attendance records logged yet for this student.';
    }

    studentStats.push({
      studentId: student._id,
      name: student.name,
      rollNo: student.rollNo,
      gender: student.gender,
      className: student.classId ? `${student.classId.grade}-${student.classId.section}` : 'N/A',
      rate,
      total,
      presents,
      lates,
      absents,
      leaves,
      consecutiveAbsences,
      risk,
      recommendation
    });
  }

  return studentStats;
};

// @desc    Get complete AI Attendance Analytics and insights
// @route   GET /api/analytics/dashboard
// @access  Private
const getDashboardAnalytics = async (req, res, next) => {
  try {
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

    const studentStats = await getStatsForStudents(req);

    // 1. Overall stats
    const totalStudents = studentStats.length;
    const studentsWithRecords = studentStats.filter(s => s.total > 0);
    const averageAttendance = studentsWithRecords.length > 0
      ? Math.round(studentsWithRecords.reduce((acc, curr) => acc + curr.rate, 0) / studentsWithRecords.length)
      : 0;

    // 2. Class-wise and Section-wise attendance
    const classData = {};
    studentStats.forEach(s => {
      if (!classData[s.className]) {
        classData[s.className] = { className: s.className, sum: 0, count: 0 };
      }
      if (s.total > 0) {
        classData[s.className].sum += s.rate;
        classData[s.className].count += 1;
      }
    });

    const classWise = Object.values(classData).map(c => ({
      className: c.className,
      rate: c.count > 0 ? Math.round(c.sum / c.count) : 0
    }));

    // 3. Gender-wise attendance
    const genderData = { Male: { sum: 0, count: 0 }, Female: { sum: 0, count: 0 }, Other: { sum: 0, count: 0 } };
    studentStats.forEach(s => {
      const g = s.gender || 'Male';
      if (genderData[g] && s.total > 0) {
        genderData[g].sum += s.rate;
        genderData[g].count += 1;
      }
    });

    const genderWise = Object.keys(genderData).map(g => ({
      gender: g,
      rate: genderData[g].count > 0 ? Math.round(genderData[g].sum / genderData[g].count) : 0
    }));

    // 4. Cohort lists
    const frequentlyAbsent = studentStats.filter(s => s.absents >= 5);
    const belowThreshold = studentStats.filter(s => s.total > 0 && s.rate < 75);
    const perfectAttendance = studentStats.filter(s => s.total > 0 && s.rate === 100);
    const improving = studentStats.filter(s => s.rate >= 90 && s.absents > 0 && s.absents <= 2);
    const declining = studentStats.filter(s => s.rate < 85 && s.absents > 2);

    // 5. Risk segmentation counters
    const riskSegmentation = {
      Low: studentStats.filter(s => s.risk === 'Low').length,
      Medium: studentStats.filter(s => s.risk === 'Medium').length,
      High: studentStats.filter(s => s.risk === 'High').length
    };

    // 6. Calculate Real Monthly Trends from DB for last 6 months
    const monthlyTrend = [];
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

      const mRecords = await Attendance.find(mQuery);
      const totalRecs = mRecords.length;
      const presents = mRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
      const rate = totalRecs > 0 ? Math.round((presents / totalRecs) * 100) : 0;

      const monthName = d.toLocaleString('default', { month: 'short' });
      monthlyTrend.push({
        month: monthName,
        rate,
        totalRecords: totalRecs
      });
    }

    // 7. Generate AI Insights via Google Gemini
    const payloadForGemini = {
      counters: {
        totalStudents,
        averageAttendance,
        lowRisk: riskSegmentation.Low,
        mediumRisk: riskSegmentation.Medium,
        highRisk: riskSegmentation.High,
      },
      classWise,
      cohortCounters: {
        frequentlyAbsent: frequentlyAbsent.length,
        perfectAttendance: perfectAttendance.length,
        improving: improving.length,
        declining: declining.length
      }
    };
    const geminiInsights = await generateGeminiInsights(payloadForGemini);

    res.status(200).json({
      success: true,
      data: {
        counters: {
          totalStudents,
          averageAttendance,
          lowRisk: riskSegmentation.Low,
          mediumRisk: riskSegmentation.Medium,
          highRisk: riskSegmentation.High,
        },
        classWise,
        genderWise,
        monthlyTrend,
        cohorts: {
          frequentlyAbsent: frequentlyAbsent.slice(0, 10),
          belowThreshold: belowThreshold.slice(0, 10),
          perfectAttendance: perfectAttendance.slice(0, 10),
          improving: improving.slice(0, 10),
          declining: declining.slice(0, 10)
        },
        aiInsights: geminiInsights,
        studentStats
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardAnalytics,
};
