/**
 * Houses specialized prompts for OCR document extraction, translation, notice generation, and predictions
 */

const getOCRPrompt = (extractedText) => {
  return `
You are an expert OCR Document Parser. Analyze the following extracted text from a medical certificate or leave application document:
"${extractedText}"

Extract the following parameters and return them strictly in JSON format matching this schema:
{
  "studentName": "Name of the student",
  "doctorName": "Doctor name or N/A",
  "hospital": "Hospital/Clinic name or N/A",
  "leaveDates": "e.g. 2026-07-02 to 2026-07-05",
  "reason": "Brief summary of medical/family reason"
}
Do not write any introductory or trailing text. Return ONLY the valid JSON object.
  `;
};

const getNoticePrompt = (shortText) => {
  return `
You are a professional School PR Officer. Take this short notice draft:
"${shortText}"

Generate a formal, professional notice announcement. Return your response strictly in the following format:
Title: [Formal Title]
Body: [Professional Notice Details and Guidelines]

Provide the translation in English first, then Hindi, then Marathi, separated clearly by "---".
  `;
};

const getTranslationPrompt = (text, targetLang) => {
  return `
Translate the following announcement text to ${targetLang}. Keep the layout, title, and line breaks exactly the same:
"${text}"
  `;
};

const getReportPrompt = (schoolStats) => {
  return `
You are a Senior Education Inspector. Based on these school stats:
${JSON.stringify(schoolStats, null, 2)}

Generate an AI Smart Report containing:
1. Executive Summary
2. Attendance Trend Analysis
3. Top Performing Classes
4. Low Attendance Warning Flag
5. Practical AI Recommendations

Keep it simple, short, and highly structured with bullet points.
  `;
};

module.exports = {
  getOCRPrompt,
  getNoticePrompt,
  getTranslationPrompt,
  getReportPrompt,
};
