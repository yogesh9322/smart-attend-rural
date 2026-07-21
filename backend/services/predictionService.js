const Attendance = require('../models/Attendance');

/**
 * Predicts absenteeism risk statistics for a student
 * @param {String} studentId - Student MongoDB object ID
 * @returns {Object} - Predicted outputs
 */
const predictStudentAttendance = async (studentId) => {
  const records = await Attendance.find({ studentId });
  const total = records.length;
  
  if (total === 0) {
    return {
      riskScore: 10,
      riskLevel: 'Low',
      probability: 98,
      trend: 'Stable',
      predictionText: 'Attendance is currently stable at 98% with zero absences logged.'
    };
  }

  const presents = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const absents = records.filter(r => r.status === 'Absent').length;
  const leaves = records.filter(r => r.status === 'Leave').length;
  const rate = Math.round((presents / total) * 100);

  // Consecutive absences count
  const sorted = records.sort((a, b) => new Date(b.date) - new Date(a.date));
  let consecutiveAbsences = 0;
  for (const r of sorted) {
    if (r.status === 'Absent') {
      consecutiveAbsences++;
    } else {
      break;
    }
  }

  let riskScore = 100 - rate;
  if (consecutiveAbsences >= 3) {
    riskScore += 20;
  }
  if (leaves > 3) {
    riskScore += 10;
  }
  riskScore = Math.round(Math.min(Math.max(riskScore, 0), 100));

  let riskLevel = 'Low';
  let trend = 'Stable';
  let predictionText = 'Student attendance is stable and meets target levels.';

  if (riskScore > 50) {
    riskLevel = 'Critical';
    trend = 'Declining';
    predictionText = 'Critical absenteeism risk. Attendance may fall below 60%. Schedule an immediate parent consultation.';
  } else if (riskScore > 35) {
    riskLevel = 'High';
    trend = 'Declining';
    predictionText = 'High risk. Trend shows consistent absenteeism slots. Active counseling required.';
  } else if (riskScore > 20) {
    riskLevel = 'Medium';
    trend = 'Declining';
    predictionText = 'Moderate risk due to leaves. Suggested to review student participation.';
  }

  return {
    riskScore,
    riskLevel,
    probability: rate,
    trend,
    predictionText
  };
};

module.exports = {
  predictStudentAttendance,
};
