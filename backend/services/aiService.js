const fetch = require('node-fetch').default || global.fetch; // Supports node fetch compatibility
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Predicts absenteeism risk for a student based on recent history
 */
const predictAbsenteeism = async (attendanceRecords) => {
  if (!attendanceRecords || attendanceRecords.length === 0) {
    return { risk: 'Low', percentage: 0, factors: ['No attendance history yet.'] };
  }

  const total = attendanceRecords.length;
  const absents = attendanceRecords.filter((r) => r.status === 'Absent').length;
  const attendanceRate = ((total - absents) / total) * 100;

  let risk = 'Low';
  let factors = [];

  if (attendanceRate < 75) {
    risk = 'High';
    factors.push('Overall attendance is below the 75% critical threshold.');
  } else if (attendanceRate < 85) {
    risk = 'Medium';
    factors.push('Attendance is fluctuating and needs attention.');
  }

  const recent = attendanceRecords.slice(-5);
  const consecutiveAbsences = recent.reduce((acc, curr) => {
    if (curr.status === 'Absent') {
      return acc + 1;
    }
    return 0;
  }, 0);

  if (consecutiveAbsences >= 3) {
    risk = 'High';
    factors.push(`Student has been absent for ${consecutiveAbsences} consecutive class days.`);
  }

  return {
    risk,
    attendanceRate: Math.round(attendanceRate),
    factors,
    recommendation: risk === 'High' ? 'Flag for Principal-parent counseling session.' : 'Monitor weekly standard trends.',
  };
};

/**
 * Mocks Face-matching verification
 */
const verifyFaceAttendance = async (imageUrl, studentTemplates) => {
  console.log(`[AI FACE API] Analyzing image URL: ${imageUrl}`);
  return {
    success: true,
    matchedCount: studentTemplates.length,
    confidence: 0.96,
    message: 'Face verification completed successfully',
  };
};

/**
 * Dynamic Rule-Based Fallback Generator (Ensures 100% Uptime even if API key has model restrictions)
 */
const generateRuleBasedInsights = (schoolData) => {
  const { counters, classWise, cohortCounters } = schoolData;
  const cards = [];
  const recommendations = [];

  if (counters.highRisk > 0) {
    cards.push({
      title: 'High Risk Alert',
      text: `${counters.highRisk} student(s) have dropped below the critical attendance threshold and require urgent intervention.`,
      type: 'risk',
      metric: `${counters.highRisk} Students`
    });
    recommendations.push('Contact parents of High Risk students immediately.');
    recommendations.push('Schedule one-on-one counseling with the school principal.');
  }

  if (counters.averageAttendance >= 80) {
    cards.push({
      title: 'Healthy Attendance Rate',
      text: `School average attendance is stable at ${counters.averageAttendance}%. Overall classroom engagement remains strong.`,
      type: 'success',
      metric: `${counters.averageAttendance}%`
    });
  } else {
    cards.push({
      title: 'Attendance Drop Warning',
      text: `School average attendance is currently low at ${counters.averageAttendance}%. Review class registers for patterns.`,
      type: 'warning',
      metric: `${counters.averageAttendance}%`
    });
    recommendations.push('Organize a parent-teacher meeting to discuss attendance drops.');
  }

  if (classWise && classWise.length > 0) {
    const sortedClasses = [...classWise].sort((a, b) => b.rate - a.rate);
    const bestClass = sortedClasses[0];
    if (bestClass) {
      cards.push({
        title: 'Top Performing Class',
        text: `Grade ${bestClass.className} achieved the highest attendance rate of ${bestClass.rate}%.`,
        type: 'info',
        metric: `${bestClass.rate}%`
      });
    }
  }

  if (cohortCounters?.perfectAttendance > 0) {
    cards.push({
      title: 'Perfect Attendance Cohort',
      text: `${cohortCounters.perfectAttendance} student(s) achieved 100% perfect attendance performance this term.`,
      type: 'success',
      metric: `${cohortCounters.perfectAttendance} Students`
    });
    recommendations.push('Recognize students with 100% attendance during morning assembly.');
  }

  return {
    cards: cards.length > 0 ? cards : [{ title: 'Live System Active', text: 'Attendance metrics are being monitored in real time.', type: 'info' }],
    recommendations: recommendations.length > 0 ? recommendations : ['Maintain regular attendance logging.'],
    summary: `Current school average attendance is ${counters.averageAttendance}%. ${counters.highRisk > 0 ? `${counters.highRisk} students are flagged as high risk.` : 'All classes demonstrate healthy performance.'} Real-time socket monitoring is active.`
  };
};

/**
 * Generates dynamic JSON insights using Google Gemini API
 */
const generateGeminiInsights = async (schoolData) => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey.includes('placeholder')) {
    return generateRuleBasedInsights(schoolData);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
    You are an enterprise AI data analyst for a rural school attendance system. 
    Analyze the following real-time attendance database JSON payload and generate insights.
    
    Data Payload:
    ${JSON.stringify(schoolData, null, 2)}
    
    Output exactly in this JSON format (no markdown, no backticks, purely valid parseable JSON):
    {
      "cards": [
        {
          "title": "Short catchy title (e.g., High Risk Student, Perfect Attendance)",
          "text": "The main insight text based strictly on the data.",
          "type": "risk | success | warning | info",
          "metric": "e.g., 58%, 7%, +2%"
        }
      ],
      "recommendations": [
        "String recommendation 1",
        "String recommendation 2"
      ],
      "summary": "A comprehensive one-paragraph executive summary (around 3-4 sentences) explaining the current state of attendance, notable risks, and short-term predictions based on historical patterns."
    }
    
    Rules:
    - Never invent data. Use ONLY the data provided.
    - If the data is empty or lacks students, mention that data is currently insufficient.
    - Generate 3 to 6 impactful cards.
    - Generate 3 to 5 actionable recommendations.
    `;

    const result = await model.generateContent(prompt);
    let cleanText = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Gemini API Error (using dynamic fallback):', error.message);
    return generateRuleBasedInsights(schoolData);
  }
};

/**
 * Fallback AI response handler in case Gemini API key is missing or encounters a rate limit
 */
const mockGeminiResponse = (systemPrompt, userMessage) => {
  const q = userMessage.toLowerCase();
  
  // Boundary check: unrelated topics
  if (
    q.includes('recipe') || 
    q.includes('cooking') || 
    q.includes('programming') || 
    q.includes('javascript') || 
    q.includes('story') || 
    q.includes('weather') || 
    q.includes('news') || 
    q.includes('president') || 
    q.includes('prime minister') || 
    q.includes('history') || 
    q.includes('geography')
  ) {
    if (systemPrompt.includes('Marathi')) {
      return 'मी फक्त SmartAttend Rural संबंधित प्रश्नांची उत्तरे देण्यास डिझाइन केले आहे.';
    }
    if (systemPrompt.includes('Hindi')) {
      return 'मैं केवल SmartAttend Rural से संबंधित प्रश्नों के उत्तर देने के लिए डिज़ाइन किया गया हूँ।';
    }
    return 'I am designed to help with SmartAttend Rural only.';
  }

  // Attendance queries
  if (q.includes('attendance') || q.includes('mark') || q.includes('उपस्थिति') || q.includes('उपस्थिती')) {
    if (systemPrompt.includes('Marathi')) {
      return 'उपस्थिती नोंदवण्यासाठी, शिक्षक म्हणून लॉग इन करा, साईडबारमधील "उपस्थिती नोंदवा" वर क्लिक करा, वर्ग निवडा आणि उपस्थित/गैरहजर बटण दाबा.';
    }
    if (systemPrompt.includes('Hindi')) {
      return 'उपस्थिति दर्ज करने के लिए, शिक्षक के रूप में लॉग इन करें, साइडबार में "उपस्थिति दर्ज करें" पर क्लिक करें, कक्षा चुनें और उपस्थित/अनुपस्थित बटनों को दबाएं।';
    }
    return 'To mark attendance, log in as a Teacher, click "Mark Attendance" in the sidebar, select your class, and toggle the Present/Absent buttons.';
  }

  // Leave queries
  if (q.includes('leave') || q.includes('request') || q.includes('रजा') || q.includes('छुट्टी')) {
    if (systemPrompt.includes('Marathi')) {
      return 'रजेची विनंती करण्यासाठी, "रजा अर्ज" वर क्लिक करा, विद्यार्थ्याचे नाव निवडा, तारखा निवडा, कारण प्रविष्ट करा आणि सबमिट करा.';
    }
    if (systemPrompt.includes('Hindi')) {
      return 'छुट्टी का अनुरोध करने के लिए, "छुट्टी अनुरोध" पर क्लिक करें, छात्र का चयन करें, तिथियां चुनें, कारण दर्ज करें और सबमिट करें।';
    }
    return 'To request leave, click "Leave Request" in the sidebar, select your child, pick dates, enter a reason, and click Submit.';
  }

  // Reports
  if (q.includes('report') || q.includes('अहवाल') || q.includes('रिपोर्ट')) {
    if (systemPrompt.includes('Marathi')) {
      return 'अहवाल डाउनलोड करण्यासाठी, "प्रगत अहवाल" विभागावर जा, वर्ग किंवा विद्यार्थी निवडा आणि पीडीएफ किंवा सीएसव्ही डाउनलोड करा.';
    }
    if (systemPrompt.includes('Hindi')) {
      return 'रिपोर्ट डाउनलोड करने के लिए, "उन्नत रिपोर्ट" अनुभाग पर जाएं, कक्षा या छात्र चुनें और पीडीएफ या सीएसवी डाउनलोड करें।';
    }
    return 'To export reports, navigate to the "Advanced Reports" section, configure filters, and click Download PDF or Export CSV.';
  }

  // Default response containing school metadata details extracted from context
  if (systemPrompt.includes('Marathi')) {
    return 'मी स्मार्टअटेंड सहाय्यक आहे. मी आपल्याला उपस्थिती अहवाल, वर्ग वेळापत्रक, सुट्ट्यांचे कॅलेंडर आणि शाळा घोषणांबद्दल माहिती देऊ शकतो. आपल्याला नेमके काय हवे आहे?';
  }
  if (systemPrompt.includes('Hindi')) {
    return 'मैं स्मार्टअटेंड सहायक हूँ। मैं आपको उपस्थिति रिपोर्ट, कक्षा समय सारणी, छुट्टियों के कैलेंडर और स्कूल घोषणाओं के बारे में जानकारी दे सकता हूँ। आप क्या जानना चाहते हैं?';
  }
  return 'I am SmartAttend AI. I can assist you with attendance tracking, class standards, leave requests, announcements, and reports. How can I help you today?';
};

/**
 * Core call to Google Gemini API
 * @param {String} systemPrompt - Instruction and context
 * @param {String} userMessage - User input message
 * @returns {String} - Generated response
 */
const callGemini = async (systemPrompt, userMessage) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    return mockGeminiResponse(systemPrompt, userMessage);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nUser Question: ${userMessage}` }
            ]
          }
        ]
      })
    });

    const resJson = await response.json();
    if (resJson.candidates && resJson.candidates[0]?.content?.parts[0]?.text) {
      return resJson.candidates[0].content.parts[0].text;
    } else {
      console.warn('Gemini invalid candidate response. Falling back to contextual response.');
      return mockGeminiResponse(systemPrompt, userMessage);
    }
  } catch (err) {
    console.error('Gemini API connection error. Using local fallback.');
    return mockGeminiResponse(systemPrompt, userMessage);
  }
};

module.exports = {
  predictAbsenteeism,
  verifyFaceAttendance,
  generateGeminiInsights,
  callGemini,
};
