const express = require('express');
const {
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
  getAIRecommendationsController
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect); // Secure chatbot endpoints

router.post('/chat', getAIChatResponse);
router.post('/summary', getAISummary);
router.get('/history', getAIChatHistory);
router.delete('/history', clearAIChatHistory);
router.get('/insights', getAIInsights);

router.post('/predict', predictStudentAttendanceController);
router.post('/report', generateAIReportController);
router.post('/notice', generateAINoticeController);
router.post('/translate', translateNoticeController);
router.post('/ocr', upload.single('file'), parseLeaveDocumentOCRController);
router.post('/search', executeNaturalLanguageSearchController);
router.post('/voice', processVoiceQueryController);
router.get('/recommendations', getAIRecommendationsController);

module.exports = router;
