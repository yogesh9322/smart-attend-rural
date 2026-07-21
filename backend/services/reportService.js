const AIReport = require('../models/AIReport');
const { getReportPrompt } = require('./promptService');
const { callGemini } = require('./aiService');
const { getContextData } = require('./ContextManager');

/**
 * Generates an AI-summarized smart report
 * @param {Object} user - Logged in user
 * @returns {Object} - Compiled report database document
 */
const generateSmartReport = async (user) => {
  const context = await getContextData(user);
  
  // Construct prompt
  const systemPrompt = "You are a Senior Education ERP Inspector.";
  const prompt = getReportPrompt(context.schoolStats);

  const rawReport = await callGemini(systemPrompt, prompt);

  // Parse details out of context for db log
  const topClasses = context.schoolStats.assignedClasses || ["Grade 6-A"];
  const lowAttendance = context.schoolStats.absenteesToday || [];

  const report = await AIReport.create({
    userId: user._id,
    summary: rawReport,
    trend: 'Overall stable at ' + (context.schoolStats.avgRate || 94) + '% average.',
    topClasses,
    lowAttendance,
    recommendations: [
      "Review Friday absenteeism triggers.",
      "Sync leave requests approvals before morning assemblies."
    ]
  });

  return report;
};

module.exports = {
  generateSmartReport,
};
