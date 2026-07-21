const AIChat = require('../models/AIChat');
const AIPrediction = require('../models/AIPrediction');
const AINoticeHistory = require('../models/AINoticeHistory');
const { getContextData } = require('../services/ContextManager');
const { buildPrompt } = require('../services/PromptBuilder');
const { formatResponse } = require('../services/ResponseFormatter');
const { callGemini } = require('../services/aiService');
const { predictStudentAttendance } = require('../services/predictionService');
const { generateSmartReport } = require('../services/reportService');
const { parseLeaveDocument } = require('../services/ocrService');
const { matchVoiceCommand } = require('../services/voiceService');
const { translateNoticeText } = require('../services/translationService');
const { getDashboardRecommendations } = require('../services/recommendationService');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get AI Chat assistant response
// @route   POST /api/ai/chat
// @access  Private
const getAIChatResponse = async (req, res, next) => {
  try {
    const { message, lang } = req.body;
    const userLang = lang || 'en';

    if (!message) {
      return res.status(400).json({ success: false, message: 'Please provide a message query.' });
    }

    // 1. Gather context data
    const context = await getContextData(req.user);

    // 2. Build system instructions prompt
    const prompt = buildPrompt(context, userLang);

    // 3. Request Gemini completion
    const rawAnswer = await callGemini(prompt, message);

    // 4. Format and sanitize response text
    const formattedAnswer = formatResponse(rawAnswer);

    // 5. Store conversation log in MongoDB
    await AIChat.create({
      userId: req.user.id,
      role: req.user.role,
      question: message,
      answer: formattedAnswer,
      language: userLang,
    });

    res.status(200).json({
      success: true,
      reply: formattedAnswer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get role-based AI summary report
// @route   POST /api/ai/summary
// @access  Private
const getAISummary = async (req, res, next) => {
  try {
    const { lang } = req.body;
    const userLang = lang || 'en';

    const context = await getContextData(req.user);
    const systemPrompt = buildPrompt(context, userLang);
    const summaryQuery = "Generate a concise bulleted summary of today's attendance stats and notices.";

    const rawSummary = await callGemini(systemPrompt, summaryQuery);
    const formattedSummary = formatResponse(rawSummary);

    res.status(200).json({
      success: true,
      summary: formattedSummary,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI chat log histories for user
// @route   GET /api/ai/history
// @access  Private
const getAIChatHistory = async (req, res, next) => {
  try {
    const history = await AIChat.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear user's AI Chat logs
// @route   DELETE /api/ai/history
// @access  Private
const clearAIChatHistory = async (req, res, next) => {
  try {
    await AIChat.deleteMany({ userId: req.user.id });
    res.status(200).json({
      success: true,
      message: 'AI chat history cleared successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI recommendation insights cards
// @route   GET /api/ai/insights
// @access  Private
const getAIInsights = async (req, res, next) => {
  try {
    const lang = req.query.lang || 'en';
    const context = await getContextData(req.user);
    const systemPrompt = buildPrompt(context, lang);

    const query = `Based on this school data, generate 3 extremely short bullet points of AI recommendations/insights for a ${req.user.role}. Start each bullet with a relevant emoji.`;
    const rawInsights = await callGemini(systemPrompt, query);
    const formattedInsights = formatResponse(rawInsights);

    // Split clean bullets into list array
    const list = formattedInsights
      .split('\n')
      .map(item => item.replace(/^[-*•]\s*/, '').trim())
      .filter(item => item.length > 0);

    res.status(200).json({
      success: true,
      insights: list.length > 0 ? list : [
        "💡 Monitor weekly class averages closely.",
        "💡 Review pending leave approvals today.",
        "💡 Ensure timetables align with notice guidelines."
      ]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Predict student attendance risk
// @route   POST /api/ai/predict
// @access  Private
const predictStudentAttendanceController = async (req, res, next) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Please provide a student ID.' });
    }

    const prediction = await predictStudentAttendance(studentId);

    // Save prediction in DB
    const predictionLog = await AIPrediction.create({
      studentId,
      riskScore: prediction.riskScore,
      riskLevel: prediction.riskLevel,
      probability: prediction.probability,
      trend: prediction.trend,
      predictionText: prediction.predictionText,
    });

    res.status(200).json({
      success: true,
      data: predictionLog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate AI Report
// @route   POST /api/ai/report
// @access  Private
const generateAIReportController = async (req, res, next) => {
  try {
    const report = await generateSmartReport(req.user);
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate AI Notice translation template
// @route   POST /api/ai/notice
// @access  Private
const generateAINoticeController = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Please provide short notice text.' });
    }

    const systemPrompt = "You are a professional notice builder.";
    const { getNoticePrompt } = require('../services/promptService');
    const prompt = getNoticePrompt(text);

    const rawResponse = await callGemini(systemPrompt, prompt);
    const parts = rawResponse.split('---');

    const enNotice = (parts[0] || '').trim();
    const hiNotice = (parts[1] || '').trim();
    const mrNotice = (parts[2] || '').trim();

    const log = await AINoticeHistory.create({
      userId: req.user.id,
      originalText: text,
      englishNotice: enNotice,
      hindiNotice: hiNotice,
      marathiNotice: mrNotice,
    });

    res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Translate Notice
// @route   POST /api/ai/translate
// @access  Private
const translateNoticeController = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Please provide text to translate.' });
    }

    const translations = await translateNoticeText(text);

    res.status(200).json({
      success: true,
      data: translations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    OCR leave medical certificate upload
// @route   POST /api/ai/ocr
// @access  Private
const parseLeaveDocumentOCRController = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a medical certificate file.' });
    }

    const ocrData = await parseLeaveDocument(req.file.path);

    res.status(200).json({
      success: true,
      data: ocrData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Natural Language Search
// @route   POST /api/ai/search
// @access  Private
const executeNaturalLanguageSearchController = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please provide a query.' });
    }

    const Student = require('../models/Student');
    const LeaveRequest = require('../models/LeaveRequest');
    const Attendance = require('../models/Attendance');

    const q = query.toLowerCase();
    let results = [];
    let message = 'Query matched standard logs.';

    if (q.includes('below 75') || q.includes('risk') || q.includes('कम')) {
      const students = await Student.find({}).populate('classId', 'grade section');
      const filtered = [];
      for (const s of students) {
        const records = await Attendance.find({ studentId: s._id });
        const total = records.length;
        const presents = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const rate = total > 0 ? (presents / total) * 100 : 100;
        if (rate < 75) {
          filtered.push({
            name: s.name,
            rollNo: s.rollNo,
            admissionNo: s.admissionNo,
            rate: Math.round(rate),
            class: s.classId ? `${s.classId.grade}-${s.classId.section}` : 'N/A'
          });
        }
      }
      results = filtered;
      message = `Found ${filtered.length} students below 75% attendance.`;
    } 
    else if (q.includes('leave') || q.includes('request') || q.includes('pending') || q.includes('रजा')) {
      const leaves = await LeaveRequest.find({ status: 'Pending' }).populate('studentId', 'name rollNo');
      results = leaves.map(l => ({
        name: l.studentId?.name || 'N/A',
        rollNo: l.studentId?.rollNo || 'N/A',
        dates: `${new Date(l.fromDate).toLocaleDateString()} to ${new Date(l.toDate).toLocaleDateString()}`,
        reason: l.reason,
        status: l.status
      }));
      message = `Found ${leaves.length} pending leave requests.`;
    } 
    else if (q.includes('absent') || q.includes('today') || q.includes('गैरहजर')) {
      const start = new Date();
      start.setHours(0,0,0,0);
      const end = new Date();
      end.setHours(23,59,59,999);
      const absents = await Attendance.find({
        status: 'Absent',
        date: { $gte: start, $lte: end }
      }).populate('studentId', 'name rollNo');
      
      results = absents.map(a => ({
        name: a.studentId?.name || 'N/A',
        rollNo: a.studentId?.rollNo || 'N/A',
        remarks: a.remarks || 'None'
      }));
      message = `Found ${absents.length} students absent today.`;
    }
    else {
      // General database regex search
      const students = await Student.find({
        name: { $regex: query, $options: 'i' }
      }).populate('classId', 'grade section').limit(5);
      
      results = students.map(s => ({
        name: s.name,
        rollNo: s.rollNo,
        class: s.classId ? `${s.classId.grade}-${s.classId.section}` : 'N/A'
      }));
    }

    res.status(200).json({
      success: true,
      message,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process Voice command
// @route   POST /api/ai/voice
// @access  Private
const processVoiceQueryController = async (req, res, next) => {
  try {
    const { transcript } = req.body;
    const action = matchVoiceCommand(transcript, req.user.role);
    res.status(200).json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard recommendations
// @route   GET /api/ai/recommendations
// @access  Private
const getAIRecommendationsController = async (req, res, next) => {
  try {
    const recommendations = await getDashboardRecommendations(req.user);
    res.status(200).json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAIChatResponse,
  getAISummary,
  getAIChatHistory,
  clearAIChatHistory,
  getAIInsights,
  predictStudentAttendanceController,
  generateAIReportController,
  generateAINoticeController,
  translateNoticeController,
  parseLeaveDocumentOCRController,
  executeNaturalLanguageSearchController,
  processVoiceQueryController,
  getAIRecommendationsController,
};
