const AIRecommendation = require('../models/AIRecommendation');
const { getContextData } = require('./ContextManager');

/**
 * Compiles dashboard recommendations
 * @param {Object} user - Logged in user
 * @returns {Array} - List of suggestions strings
 */
const getDashboardRecommendations = async (user) => {
  const context = await getContextData(user);
  const items = [];

  if (user.role === 'admin') {
    items.push(
      "📈 Monthly attendance has fluctuated. Review Grade 5 attendance registry.",
      "🔔 Publish the upcoming Mid-Term Examination schedule notice.",
      "📝 You have " + (context.schoolStats.pendingLeaves || 2) + " pending student leave requests to review."
    );
  } 
  else if (user.role === 'teacher') {
    items.push(
      "📞 Contact parents of " + (context.schoolStats.absenteesCount || 3) + " students absent today.",
      "📝 Generate the monthly class progress sheets for this month.",
      "⏰ Review Grade roster. Verify missing check-ins before 5:00 PM."
    );
  } 
  else if (user.role === 'parent') {
    items.push(
      "🌟 Your child's attendance rate is healthy at " + (context.schoolStats.childrenDetails?.[0]?.attendanceRate || 95) + "%. Excellent job!",
      "📅 Check upcoming holidays calendar before planning leaves.",
      "📢 You have unread school announcements. Tap Notices to read."
    );
  }

  // Log to database
  await AIRecommendation.create({
    userId: user._id,
    role: user.role,
    category: 'Dashboard recommendation',
    items,
  });

  return items;
};

module.exports = {
  getDashboardRecommendations,
};
