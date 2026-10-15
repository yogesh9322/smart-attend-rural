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
 * Dynamic Child Finder matching both English and Devanagari (Hindi/Marathi) names
 */
const findChildInQuery = (userQuery, children) => {
  if (!children || children.length === 0) return null;
  const q = (userQuery || '').toLowerCase().trim();

  // 1. Direct English substring matching
  for (const c of children) {
    const fullName = (c.name || '').toLowerCase();
    const firstName = (c.firstName || fullName.split(' ')[0] || '').toLowerCase();
    const lastName = (fullName.split(' ')[1] || '').toLowerCase();

    if (fullName && q.includes(fullName)) return c;
    if (firstName && q.includes(firstName)) return c;
    if (lastName && lastName.length > 2 && q.includes(lastName)) return c;
  }

  // 2. Devanagari sound mapping for student names (handles Nitin -> नितिन/नितीन, Sakshi -> साक्षी, Jay -> जय, Pawar -> पवार etc.)
  for (const c of children) {
    const fullName = (c.name || '').toLowerCase();
    const firstName = (c.firstName || fullName.split(' ')[0] || '').toLowerCase();
    const lastName = (fullName.split(' ')[1] || '').toLowerCase();

    const devanagariVariants = [];
    if (firstName.includes('nitin')) devanagariVariants.push('नितिन', 'नितीन');
    if (firstName.includes('sakshi')) devanagariVariants.push('साक्षी', 'साक्षि');
    if (firstName.includes('jay')) devanagariVariants.push('जय', 'जे');
    if (firstName.includes('rohan')) devanagariVariants.push('रोहन');
    if (firstName.includes('priya')) devanagariVariants.push('प्रिया');
    if (firstName.includes('aarav')) devanagariVariants.push('आरव');
    if (firstName.includes('rahul')) devanagariVariants.push('राहुल');
    if (firstName.includes('sneha')) devanagariVariants.push('स्नेहा');

    if (lastName.includes('pawar')) devanagariVariants.push('पवार');
    if (lastName.includes('patil')) devanagariVariants.push('पाटील', 'पाटिल');
    if (lastName.includes('shinde')) devanagariVariants.push('शिंदे');
    if (lastName.includes('jadhav')) devanagariVariants.push('जाधव');
    if (lastName.includes('deshmukh')) devanagariVariants.push('देशमुख');

    for (const v of devanagariVariants) {
      if (q.includes(v)) return c;
    }
  }

  return null;
};

/**
 * Dynamic Rule-Based Fallback Generator & Intelligence Assistant
 * Parses the live JSON context embedded in systemPrompt to accurately answer Parent queries across all core intents
 */
const mockGeminiResponse = (systemPrompt, userMessage, lang = 'en') => {
  const q = (userMessage || '').toLowerCase().trim();
  
  const isMarathi = lang === 'mr' || (systemPrompt.includes('Target Response Language: Marathi') && !systemPrompt.includes('Target Response Language: English'));
  const isHindi = lang === 'hi' || (systemPrompt.includes('Target Response Language: Hindi') && !systemPrompt.includes('Target Response Language: English'));

  // 1. Extract JSON Data payload from systemPrompt
  let liveData = {};
  let notices = [];
  let events = [];
  let history = [];

  try {
    const liveMatch = systemPrompt.match(/Live Dashboard Data:\s*([\s\S]*?)\n\nActive Notices/);
    if (liveMatch) liveData = JSON.parse(liveMatch[1]);

    const noticesMatch = systemPrompt.match(/Active Notices & Announcements:\s*([\s\S]*?)\n\nUpcoming Events/);
    if (noticesMatch) notices = JSON.parse(noticesMatch[1]);

    const eventsMatch = systemPrompt.match(/Upcoming Events & Calendar:\s*([\s\S]*?)\n\nRecent Conversation/);
    if (eventsMatch) events = JSON.parse(eventsMatch[1]);

    const historyMatch = systemPrompt.match(/Recent Conversation History:\s*([\s\S]*?)\n------------------------------------------/);
    if (historyMatch) history = JSON.parse(historyMatch[1]);
  } catch (err) {
    console.error('Failed to parse prompt context JSON in mock fallback:', err.message);
  }

  const children = liveData.childrenDetails || [];

  // 2. Out of bounds check (recipes, coding, math, general news)
  if (
    q.includes('recipe') || 
    q.includes('cooking') || 
    q.includes('programming') || 
    q.includes('javascript') || 
    q.includes('story') || 
    q.includes('weather') || 
    q.includes('president') || 
    q.includes('prime minister') || 
    q.includes('history of world') || 
    q.includes('geography of america')
  ) {
    if (isMarathi) return 'मी फक्त SmartAttend Rural संबंधित प्रश्नांची उत्तरे देण्यास डिझाइन केले आहे.';
    if (isHindi) return 'मैं केवल SmartAttend Rural से संबंधित प्रश्नों के उत्तर देने के लिए डिज़ाइन किया गया हूँ।';
    return 'I am designed to help with SmartAttend Rural only.';
  }

  // 3. Greeting & Generic Capabilities Check
  const isGreetingQuery = 
    q === 'hi' || q === 'hello' || q === 'hey' || 
    q.includes('who are you') || q.includes('introduce') || 
    q.includes('नमस्ते') || q.includes('नमस्कार') || q.includes('कौन हो') || q.includes('कोण आहेस');

  const isCapabilityQuery = 
    q.includes('what can you do') || q.includes('what information can i see') || 
    q.includes('तुम्ही काय करू शकता') || q.includes('तुम्ही मला कशात मदत') || 
    q.includes('आप क्या कर सकते हैं') || q.includes('क्या सहायता');

  if (isGreetingQuery && !q.includes('present') && !q.includes('attendance') && !q.includes('उपस्थित') && !q.includes('आज')) {
    if (isMarathi) return 'नमस्कार! मी SmartAttend AI आहे, तुमचा डिजिटल शाळा सहाय्यक. मी तुमच्या पाल्याची उपस्थिती, रजेचे अर्ज, शाळेच्या सूचना आणि सुट्ट्यांचे कॅलेंडर तपासण्यात मदत करू शकतो. मी तुम्हाला कशी मदत करू?';
    if (isHindi) return 'नमस्ते! मैं SmartAttend AI हूँ, आपका डिजिटल स्कूल सहायक। मैं आपके बच्चे की उपस्थिति, छुट्टी के आवेदन, स्कूल के नोटिस और कैलेंडर देखने में आपकी मदद कर सकता हूँ। मैं आपकी क्या मदद कर सकता हूँ?';
    return 'Hello! I am SmartAttend AI, your digital school assistant. I can assist you with attendance records, leave applications, school notice boards, and event calendars. How can I help you today?';
  }

  if (isCapabilityQuery) {
    if (isMarathi) return 'तुमच्या पालका डॅशबोर्डवरून, तुम्ही तुमच्या मुलांची उपस्थिती तपासू शकता, सूचना पाहू शकता, रजेचे अर्ज व्यवस्थापित करू शकता, शालेय कार्यक्रम आणि कॅलेंडर तपासू शकता आणि उपलब्ध अहवाल मिळवू शकता.';
    if (isHindi) return 'अपने पैरेंट डैशबोर्ड से, आप अपने बच्चों की उपस्थिति की जांच कर सकते हैं, नोटिस देख सकते हैं, छुट्टी के अनुरोध प्रबंधित कर सकते हैं, स्कूल के कार्यक्रम और कैलेंडर देख सकते हैं, और उपलब्ध रिपोर्ट तक पहुंच सकते हैं।';
    return 'From your Parent Dashboard, you can check your children\'s attendance, view notices, manage leave requests, check school events and calendars, and access available reports.';
  }

  // 4. Check if user is answering a previous "Which child?" question or directly naming a child
  let matchedChild = findChildInQuery(q, children);
  let isFollowUpSelection = false;
  if (history && history.length > 0) {
    const lastAIAnswer = (history[history.length - 1]?.answer || '').toLowerCase();
    if (
      lastAIAnswer.includes('देखना चाहते हैं') || 
      lastAIAnswer.includes('जाणून घ्यायची आहे') || 
      lastAIAnswer.includes('which child')
    ) {
      isFollowUpSelection = true;
    }
  }

  if (matchedChild && isFollowUpSelection) {
    const { name, attendanceRate, presentDays, absentDays, todayAttendance } = matchedChild;
    const statusStr = todayAttendance === 'Present' ? (isMarathi ? 'आज उपस्थित होता' : isHindi ? 'आज उपस्थित था' : 'was present today') :
                      todayAttendance === 'Absent' ? (isMarathi ? 'आज अनुपस्थित म्हणून नोंदवला आहे' : isHindi ? 'आज अनुपस्थित दर्ज किया गया है' : 'was marked absent today') :
                      todayAttendance === 'Late' ? (isMarathi ? 'आज उशिरा उपस्थित म्हणून नोंदवला आहे' : isHindi ? 'आज देर से उपस्थित दर्ज किया गया है' : 'was marked late today') :
                      (isMarathi ? 'आजची हजेरी अद्याप नोंदवलेली नाही' : isHindi ? 'आज की उपस्थिति अभी दर्ज नहीं की गई है' : 'today\'s attendance has not been marked yet');

    if (isMarathi) return `${name} चा सध्याचा उपस्थिती दर ${attendanceRate}% आहे. ${name} ${statusStr}.`;
    if (isHindi) return `${name} की वर्तमान उपस्थिति दर ${attendanceRate}% है। ${name} ${statusStr}।`;
    return `${name}'s current attendance rate is ${attendanceRate}%. ${name} ${statusStr}.`;
  }

  // 5. INTENT C: PROFILE / ACCOUNT QUESTIONS
  const isProfileKeyword = 
    q.includes('profile') || q.includes('account') || q.includes('change my name') || 
    q.includes('update my profile') || q.includes('edit my profile') || q.includes('my info') || 
    q.includes('my details') || q.includes('update info') || q.includes('change info') || 
    q.includes('प्रोफ़ाइल') || q.includes('प्रोफाइल') || q.includes('खाता') || 
    q.includes('प्रोफाईल') || q.includes('माझी माहिती') || q.includes('माहिती बदला') || 
    q.includes('माहिती चेंज') || q.includes('नाव बदला') || q.includes('प्रोफाईल फोटो') || 
    q.includes('माहिती बदलणे') || q.includes('चेंज करू') || q.includes('मेरी जानकारी') || 
    q.includes('जानकारी बदलें') || q.includes('चेंज करना') || q.includes('माहिती कशी');

  if (isProfileKeyword) {
    const isPictureQuery = q.includes('picture') || q.includes('photo') || q.includes('avatar') || q.includes('फोटो') || q.includes('चित्र');
    if (isPictureQuery) {
      if (isMarathi) return 'तुमचा प्रोफाइल फोटो अपडेट करण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "Profile / प्रोफाइल" या पर्यायावर क्लिक करा.';
      if (isHindi) return 'अपना प्रोफाइल फोटो अपडेट करने के लिए, कृपया बाएं पैनल (Sidebar) से "Profile / प्रोफाइल" पर क्लिक करें।';
      return 'To update your profile picture, please click on "Profile" in the left side panel.';
    } else {
      if (isMarathi) return 'तुमची माहिती किंवा प्रोफाइल बदलण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "Profile / प्रोफाइल" या पर्यायावर क्लिक करा. तेथे तुम्ही तुमची वैयक्तिक माहिती, मोबाईल नंबर व प्रोफाइल फोटो अपडेट करू शकता.';
      if (isHindi) return 'अपनी जानकारी या प्रोफाइल बदलने के लिए, कृपया बाएं पैनल (Sidebar) से "Profile / प्रोफाइल" पर क्लिक करें। वहां आप अपनी व्यक्तिगत जानकारी, मोबाइल नंबर और प्रोफाइल फोटो अपडेट कर सकते हैं।';
      return 'To change or update your information, please click on "Profile" in the left side panel. There you can update your personal details, phone number, and profile picture.';
    }
  }

  // 6. INTENT E: REPORT QUESTIONS
  const isReportKeyword = 
    q.includes('report') || q.includes('download') || q.includes('export') || 
    q.includes('pdf') || q.includes('csv') || q.includes('अहवाल') || 
    q.includes('अहवालाची') || q.includes('रिपोर्ट') || q.includes('रिपोर्ट्स') || 
    q.includes('डाउनलोड') || q.includes('बघावा') || q.includes('पाहावा') || 
    q.includes('पहाणे') || q.includes('देखें') || q.includes('बघा');

  if (isReportKeyword) {
    if (isMarathi) return 'उपस्थिती अहवाल पाहण्यासाठी किंवा डाउनलोड करण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "Reports / अहवाल" या पर्यायावर क्लिक करा. तेथे तुम्ही तुमच्या मुलाचा सविस्तर उपस्थिती अहवाल पाहू व डाउनलोड करू शकता.';
    if (isHindi) return 'उपस्थिति रिपोर्ट देखने या डाउनलोड करने के लिए, कृपया बाएं पैनल (Sidebar) से "Reports / रिपोर्ट" पर क्लिक करें। वहां आप अपने बच्चे की विस्तृत उपस्थिति रिपोर्ट देख और डाउनलोड कर सकते हैं।';
    return 'To view or download attendance reports, please click on "Reports" in the left side panel. There you can view and download detailed attendance reports for your child.';
  }

  // 7. INTENT D: TEACHER COMMUNICATION QUESTIONS
  const isTeacherKeyword = 
    q.includes('teacher') || q.includes('communicate with teacher') || 
    q.includes('contact teacher') || q.includes('contact my child') || 
    q.includes('message my child') || q.includes('शिक्षक') || 
    q.includes('शिक्षकांशी') || q.includes('शिक्षकांचा') || q.includes('शिक्षकांचे') || 
    q.includes('शिक्षकांशी संपर्क') || q.includes('अध्यापक') || q.includes('नंबर');

  if (isTeacherKeyword) {
    if (isMarathi) return 'शिक्षकांशी संपर्क साधण्यासाठी किंवा त्यांची माहिती पाहण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "Contact Teacher / शिक्षकांशी संपर्क" या पर्यायावर क्लिक करा.';
    if (isHindi) return 'शिक्षक से संपर्क करने या विवरण देखने के लिए, कृपया बाएं पैनल (Sidebar) से "Contact Teacher / शिक्षक से संपर्क" पर क्लिक करें।';
    return 'To contact the teacher or view their contact details, please click on "Contact Teacher" in the left side panel.';
  }

  // 8. Intent Helpers for Attendance
  const isTodayKeyword = 
    q.includes('today') || q.includes('आज') || q.includes('आजची') || 
    q.includes('आजचा') || q.includes('आजचे') || q.includes('शाळेत आला') || q.includes('शाळेत आली');

  const isYesterdayKeyword = 
    q.includes('yesterday') || q.includes('काल') || q.includes('कालची') || q.includes('कालचा') || q.includes('कल');

  const isAttendanceKeyword = 
    q.includes('attendance') || q.includes('present') || q.includes('absent') || 
    q.includes('percentage') || q.includes('rate') || q.includes('history') || 
    q.includes('उपस्थित') || q.includes('उपस्थिती') || q.includes('हजर') || 
    q.includes('हजेरी') || q.includes('गैरहजर') || q.includes('टक्केवारी') || 
    q.includes('अनुपस्थित') || q.includes('नोंदवली') || q.includes('तपासा') || 
    q.includes('दाखवा') || q.includes('आला था') || q.includes('आई थी') || 
    q.includes('दर्ज') || q.includes('कमी') || q.includes('कम') || q.includes('उपस्थितीची') || 
    q.includes('कितनी') || q.includes('किती');

  const isChildKeyword = 
    q.includes('child') || q.includes('son') || q.includes('daughter') || 
    q.includes('kid') || q.includes('मुलगा') || q.includes('मुलगी') || 
    q.includes('मुलाची') || q.includes('मुलीची') || q.includes('बच्चा') || 
    q.includes('बेटा') || q.includes('बेटी') || q.includes('बच्चे');

  // INTENT A: TODAY_ATTENDANCE
  if (isTodayKeyword && (isAttendanceKeyword || isChildKeyword)) {
    let targetChild = matchedChild;

    if (!targetChild && children.length > 0) {
      if (q.includes('his') || q.includes('her') || q.includes('he') || q.includes('she') || q.includes('him') || q.includes('त्याची') || q.includes('तिची') || q.includes('उसका') || q.includes('उसकी') || q.includes('तो') || q.includes('ती')) {
        for (let i = history.length - 1; i >= 0; i--) {
          const pastText = (history[i].question + ' ' + history[i].answer).toLowerCase();
          const found = findChildInQuery(pastText, children);
          if (found) {
            targetChild = found;
            break;
          }
        }
      }

      if (!targetChild && children.length > 1) {
        const namesList = children.map(c => c.firstName || c.name).join(', ');
        if (isMarathi) return `तुम्हाला कोणत्या मुलाची आजची उपस्थिती जाणून घ्यायची आहे — ${namesList}?`;
        if (isHindi) return `आप किस बच्चे की आज की उपस्थिति देखना चाहते हैं: ${namesList}?`;
        return `Which child's today's attendance would you like to know — ${namesList}?`;
      }

      if (!targetChild && children.length === 1) {
        targetChild = children[0];
      }
    }

    if (targetChild) {
      const status = targetChild.todayAttendance;
      const childName = targetChild.name;

      if (status === 'Present') {
        if (isMarathi) return `होय, ${childName} आज उपस्थित होता.`;
        if (isHindi) return `हाँ, ${childName} आज उपस्थित था।`;
        return `Yes, ${childName} was present today.`;
      }
      if (status === 'Absent') {
        if (isMarathi) return `नाही, ${childName} आज अनुपस्थित म्हणून नोंदवला आहे.`;
        if (isHindi) return `नहीं, ${childName} को आज अनुपस्थित दर्ज किया गया है।`;
        return `No, ${childName} was marked absent today.`;
      }
      if (status === 'Late') {
        if (isMarathi) return `${childName} आज उशिरा उपस्थित म्हणून नोंदवला आहे.`;
        if (isHindi) return `${childName} को आज देर से उपस्थित दर्ज किया गया है।`;
        return `${childName} was marked late today.`;
      }
      if (isMarathi) return `${childName} ची आजची उपस्थिती अद्याप नोंदवलेली नाही.`;
      if (isHindi) return `${childName} की आज की उपस्थिति अभी दर्ज नहीं की गई है।`;
      return `Today's attendance has not been marked yet for ${childName}.`;
    }
  }

  // INTENT B: YESTERDAY_ATTENDANCE
  if (isYesterdayKeyword || q === 'काल?' || q === 'काल' || q === 'yesterday?' || q === 'yesterday' || q === 'कल?' || q === 'कल') {
    let targetChild = matchedChild;
    if (!targetChild && children.length > 0) {
      if (history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          const pastText = (history[i].question + ' ' + history[i].answer).toLowerCase();
          const found = findChildInQuery(pastText, children);
          if (found) {
            targetChild = found;
            break;
          }
        }
      }
      if (!targetChild && children.length > 0) {
        targetChild = children[0];
      }
    }

    if (targetChild) {
      const yStatus = targetChild.yesterdayAttendance;
      const childName = targetChild.name;

      if (yStatus === 'Present') {
        if (isMarathi) return `होय, ${childName} काल उपस्थित होता.`;
        if (isHindi) return `हाँ, ${childName} कल उपस्थित था।`;
        return `Yes, ${childName} was present yesterday.`;
      }
      if (yStatus === 'Absent') {
        if (isMarathi) return `नाही, ${childName} काल अनुपस्थित होता.`;
        if (isHindi) return `नहीं, ${childName} को कल अनुपस्थित दर्ज किया गया था।`;
        return `No, ${childName} was marked absent yesterday.`;
      }
      if (isMarathi) return `${childName} ची कालची उपस्थिती नोंदवलेली नव्हती.`;
      if (isHindi) return `${childName} की कल की उपस्थिति दर्ज नहीं की गई थी।`;
      return `Attendance for yesterday was not marked for ${childName}.`;
    }
  }

  // INTENT F: LEAVE QUESTIONS
  const isLeaveKeyword = 
    q.includes('leave') || q.includes('apply') || q.includes('request') || 
    q.includes('cancel') || q.includes('छुट्टी') || q.includes('छुट्टियों') || 
    q.includes('रजा') || q.includes('रजे') || q.includes('रजेचा') || 
    q.includes('रजेच्या') || q.includes('रजेचे') || q.includes('रजेसाठी') || 
    q.includes('रजेत') || q.includes('अर्ज') || q.includes('अर्जाची') || 
    q.includes('अर्जाबद्दल') || q.includes('अर्जीत');

  if (isLeaveKeyword) {
    const isLeaveHowOrInfo = 
      q.includes('how') || q.includes('apply') || q.includes('where') || 
      q.includes('info') || q.includes('information') || q.includes('process') || 
      q.includes('कैसे') || q.includes('कसा') || q.includes('कशी') || 
      q.includes('कुठे') || q.includes('माहिती') || q.includes('जानकारी') || 
      q.includes('विवरण') || q.includes('करावा') || q.includes('द्या') || 
      q.includes('सांगा') || q.includes('पाहिजे') || q.includes('रजेच्या') || 
      q.includes('रजेचा') || q.includes('अर्जाची');

    if (isLeaveHowOrInfo) {
      if (isMarathi) return 'रजेचा अर्ज करण्यासाठी किंवा माहिती पाहण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "Leave Request / रजेचा अर्ज" या पर्यायावर क्लिक करा. तेथे तुम्ही पाल्याची निवड करून, रजेच्या तारखा आणि कारण भरून अर्ज सबमिट करू शकता.';
      if (isHindi) return 'छुट्टी का आवेदन करने या विवरण देखने के लिए, कृपया बाएं पैनल (Sidebar) से "Leave Request / छुट्टी का अनुरोध" पर क्लिक करें। वहां आप बच्चे का चयन करके, तिथियां और कारण दर्ज करके आवेदन जमा कर सकते हैं।';
      return 'To submit or view a leave request, please click on "Leave Request" in the left side panel. From there, select your child, pick the leave dates, enter the reason, and submit your request.';
    } else {
      const allLeaves = [];
      children.forEach(c => {
        if (c.leaveApplications && c.leaveApplications.length > 0) {
          c.leaveApplications.forEach(l => {
            allLeaves.push({ childName: c.name, ...l });
          });
        }
      });

      if (allLeaves.length > 0) {
        const leaveSummaries = allLeaves.map(l => `${l.childName}: ${l.reason} (${l.status}, ${l.fromDate} to ${l.toDate})`).join('; ');
        if (isMarathi) return `तुमच्याकडे ${allLeaves.length} रजा अर्ज आहेत: ${leaveSummaries}. अधिक माहितीसाठी किंवा नवीन अर्जासाठी डाव्या पॅनेलवरील 'Leave Request / रजेचा अर्ज' वापरा.`;
        if (isHindi) return `आपके पास ${allLeaves.length} छुट्टी के आवेदन हैं: ${leaveSummaries}। अधिक विवरण या नए आवेदन के लिए बाएं पैनल से 'Leave Request' का उपयोग करें।`;
        return `You have ${allLeaves.length} leave application(s): ${leaveSummaries}. For details or to apply, use 'Leave Request' from the side panel.`;
      } else {
        if (isMarathi) return 'रजेचा अर्ज करण्यासाठी किंवा माहिती पाहण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "Leave Request / रजेचा अर्ज" या पर्यायावर क्लिक करा.';
        if (isHindi) return 'छुट्टी का आवेदन करने या विवरण देखने के लिए, कृपया बाएं पैनल (Sidebar) से "Leave Request / छुट्टी का अनुरोध" पर क्लिक करें।';
        return 'To submit or view a leave request, please click on "Leave Request" in the left side panel.';
      }
    }
  }

  // INTENT G: SCHOOL EVENTS / CALENDAR QUESTIONS
  const isCalendarKeyword = 
    q.includes('event') || q.includes('calendar') || q.includes('holiday') || 
    q.includes('exam') || q.includes('schedule') || q.includes('कार्यक्रम') || 
    q.includes('कैलेंडर') || q.includes('कॅलेंडर') || q.includes('सुट्टी') || 
    q.includes('सुट्ट्या') || q.includes('सुट्ट्यांची') || q.includes('सुट्टीची') || 
    q.includes('सुट्ट्यांबद्दल') || q.includes('परीक्षा');

  if (isCalendarKeyword) {
    if (isMarathi) return 'शालेय कार्यक्रम, सुट्ट्या व परीक्षांचे कॅलेंडर पाहण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "School Calendar / शालेय कॅलेंडर" किंवा "School Events" या पर्यायावर क्लिक करा.';
    if (isHindi) return 'स्कूल के कार्यक्रमों, छुट्टियों और परीक्षाओं का कैलेंडर देखने के लिए, कृपया बाएं पैनल (Sidebar) से "School Calendar / स्कूल कैलेंडर" पर क्लिक करें।';
    return 'To view school events, holidays, and examination schedules, please click on "School Calendar" or "School Events" in the left side panel.';
  }

  // INTENT H: NOTICE QUESTIONS
  const isNoticeKeyword = 
    q.includes('notice') || q.includes('announcement') || q.includes('unread') || 
    q.includes('news') || q.includes('सूचना') || q.includes('सूचनांची') || 
    q.includes('सूचनेची') || q.includes('सूचनांबद्दल') || q.includes('घोषणा') || 
    q.includes('नोटीस');

  if (isNoticeKeyword) {
    const unreadCount = liveData.unreadNoticesCount || 0;
    if (isMarathi) return `शाळेच्या व वर्गाच्या नवीन सूचना पाहण्यासाठी, कृपया डाव्या बाजूच्या पॅनेल (Sidebar) मधील "Notices / सूचना" या पर्यायावर क्लिक करा. तुमच्याकडे सध्या ${unreadCount} न वाचलेल्या सूचना आहेत.`;
    if (isHindi) return `स्कूल और कक्षा की नई सूचनाएं देखने के लिए, कृपया बाएं पैनल (Sidebar) से "Notices / सूचनाएं" पर क्लिक करें। आपके पास वर्तमान में ${unreadCount} अपठित सूचनाएं हैं।`;
    return `To view school and class notices, please click on "Notices" in the left side panel. You currently have ${unreadCount} unread notices.`;
  }

  // INTENT I: CHILDREN DETAILS (roll number, class, admission number, list children)
  if (
    q.includes('children') || q.includes('kids') || q.includes('roll number') || 
    q.includes('roll no') || q.includes('class') || q.includes('admission') || 
    q.includes('enrolled') || q.includes('मुले') || q.includes('माझी मुले') || 
    q.includes('बच्चे') || q.includes('रोल') || q.includes('प्रवेश')
  ) {
    let targetChild = matchedChild || (children.length > 0 ? children[0] : null);

    const isListChildrenQuery = q.includes('show my children') || q.includes('what are my children') || q.includes('how many children') || q.includes('tell me about my children') || q.includes('माझी मुले') || q.includes('मेरे बच्चे');
    if (isListChildrenQuery && children.length > 0) {
      const namesStr = children.map(c => c.name).join(', ');
      if (isMarathi) return `तुमच्याकडे सध्या ${children.length} नोंदणीकृत मुले आहेत: ${namesStr}.`;
      if (isHindi) return `आपके पास वर्तमान में ${children.length} नामांकित बच्चे हैं: ${namesStr}।`;
      return `You currently have ${children.length} enrolled children: ${namesStr}.`;
    }

    if (targetChild) {
      if (q.includes('roll') || q.includes('रोल')) {
        if (isMarathi) return `${targetChild.name} चा रोल नंबर ${targetChild.rollNo} आहे.`;
        if (isHindi) return `${targetChild.name} का रोल नंबर ${targetChild.rollNo} है।`;
        return `${targetChild.name}'s roll number is ${targetChild.rollNo}.`;
      }
      if (q.includes('class') || q.includes('grade') || q.includes('वर्ग') || q.includes('कक्षा')) {
        if (isMarathi) return `${targetChild.name} ${targetChild.gradeSection} मध्ये शिकत आहे.`;
        if (isHindi) return `${targetChild.name} ${targetChild.gradeSection} में है।`;
        return `${targetChild.name} is in ${targetChild.gradeSection}.`;
      }
      if (q.includes('admission') || q.includes('प्रवेश')) {
        if (isMarathi) return `${targetChild.name} चा प्रवेश क्रमांक ${targetChild.admissionNo} आहे.`;
        if (isHindi) return `${targetChild.name} का प्रवेश क्रमांक ${targetChild.admissionNo} है।`;
        return `${targetChild.name}'s admission number is ${targetChild.admissionNo}.`;
      }
    }
  }

  // INTENT J: ATTENDANCE SUMMARY & HISTORY (Overall %, absent count, history)
  if (isAttendanceKeyword || matchedChild) {
    let targetChild = matchedChild;

    if (!targetChild && children.length > 0) {
      if (q.includes('his') || q.includes('her') || q.includes('he') || q.includes('she') || q.includes('him') || q.includes('त्याची') || q.includes('तिची') || q.includes('उसका') || q.includes('उसकी')) {
        for (let i = history.length - 1; i >= 0; i--) {
          const pastText = (history[i].question + ' ' + history[i].answer).toLowerCase();
          const found = findChildInQuery(pastText, children);
          if (found) {
            targetChild = found;
            break;
          }
        }
      }

      if (!targetChild && children.length > 1) {
        const namesList = children.map(c => c.firstName || c.name).join(', ');
        if (isMarathi) return `आपण कोणत्या पाल्याची उपस्थिती पाहू इच्छिता: ${namesList}?`;
        if (isHindi) return `आप किस बच्चे की उपस्थिति देखना चाहते हैं: ${namesList}?`;
        return `Which child would you like attendance information for: ${namesList}?`;
      }

      if (!targetChild && children.length === 1) {
        targetChild = children[0];
      }
    }

    if (targetChild) {
      const { name, attendanceRate, presentDays, absentDays } = targetChild;

      const isHistoryQuery = q.includes('history') || q.includes('इतिहास');
      if (isHistoryQuery) {
        if (isMarathi) return 'तुम्ही उपस्थिती विभागात तुमच्या पाल्याचा अलिकडील उपस्थिती इतिहास पाहू शकता. अलिकडील नोंदींमध्ये हजर, गैरहजर आणि उशिरा आलेल्या स्थितींचा समावेश आहे.';
        if (isHindi) return 'आप उपस्थिति अनुभाग में अपने बच्चे की हालिया उपस्थिति इतिहास देख सकते हैं। हालिया रिकॉर्ड में उपस्थित, अनुपस्थित और देर से आने की स्थिति शामिल है।';
        return "You can view your child's recent attendance history in the Attendance section. The recent records include present, absent, and late statuses.";
      }

      if (q.includes('absent') || q.includes('गैरहजर') || q.includes('अनुपस्थित')) {
        if (isMarathi) return `उपलब्ध उपस्थिती नोंदींनुसार, तुमचे मूल ${absentDays} दिवस गैरहजर होते.`;
        if (isHindi) return `उपलब्ध उपस्थिति रिकॉर्ड के आधार पर, आपका बच्चा ${absentDays} दिन अनुपस्थित था।`;
        return `Based on the available attendance records, your child was absent on ${absentDays} days.`;
      }

      if (q.includes('present') || q.includes('हजर') || q.includes('उपस्थित')) {
        if (isMarathi) return `उपलब्ध उपस्थिती नोंदींनुसार, तुमचे मूल ${presentDays} दिवस हजर होते.`;
        if (isHindi) return `उपलब्ध उपस्थिति रिकॉर्ड के आधार पर, आपका बच्चा ${presentDays} दिन उपस्थित था।`;
        return `Based on the available attendance records, your child was present on ${presentDays} days.`;
      }

      if (isMarathi) return `${name} ची सध्याची उपस्थिती टक्केवारी ${attendanceRate}% आहे.`;
      if (isHindi) return `${name} की वर्तमान उपस्थिति दर ${attendanceRate}% है।`;
      return `${name}'s current attendance rate is ${attendanceRate}%.`;
    }
  }

  // INTENT K: DASHBOARD SUMMARY & GENERAL HELP
  if (
    q.includes('dashboard') || q.includes('summary') || q.includes('update') || 
    q.includes('today') || q.includes('know') || q.includes('important') || 
    q.includes('डैशबोर्ड') || q.includes('डॅशबोर्ड') || q.includes('सारांश') || 
    q.includes('अपडेट')
  ) {
    const childStatus = children[0]?.todayAttendance || 'Not marked yet';
    const childRate = children[0]?.attendanceRate || 100;
    const unreadCount = liveData.unreadNoticesCount || 0;

    if (isMarathi) return `आजचे अपडेट: तुमच्या पाल्याची उपस्थिती ${childStatus} आहे, तुमच्याकडे ${unreadCount} न वाचलेल्या सूचना आहेत, आणि तुमचा सध्याचा उपस्थिती दर ${childRate}% आहे.`;
    if (isHindi) return `आज का अपडेट: आपके बच्चे की उपस्थिति ${childStatus} है, आपके पास ${unreadCount} अपठित नोटिस हैं, और आपकी वर्तमान उपस्थिति दर ${childRate}% है।`;
    return `Today's update: your child's attendance is ${childStatus}, you have ${unreadCount} unread notices, and your current attendance rate is ${childRate}%.`;
  }

  // 12. Final Fallback if intent completely unknown
  if (isMarathi) return 'मी आपल्याला उपस्थिती, रजेचे अर्ज, सूचना, कॅलेंडर आणि डॅशबोर्ड नेव्हिगेशनबद्दल माहिती देऊ शकतो.';
  if (isHindi) return 'मैं आपको उपस्थिति, छुट्टी के आवेदन, नोटिस, कैलेंडर और डैशबोर्ड नेविगेशन के बारे में जानकारी दे सकता हूँ।';
  return 'From your Parent Dashboard, you can check your children\'s attendance, view notices, manage leave requests, check school events and calendars, and access available reports.';
};

/**
 * Core call to Google Gemini API
 * @param {String} systemPrompt - Instruction and context
 * @param {String} userMessage - User input message
 * @param {String} lang - User requested language ('en', 'hi', 'mr')
 * @returns {String} - Generated response
 */
const callGemini = async (systemPrompt, userMessage, lang = 'en') => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    return mockGeminiResponse(systemPrompt, userMessage, lang);
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

    if (!response.ok) {
      const safeErrLog = JSON.stringify(resJson).replace(new RegExp(apiKey, 'g'), '[REDACTED]');
      console.warn(`[AI Gemini API HTTP ${response.status} ${response.statusText}] Error response:`, safeErrLog);
      return mockGeminiResponse(systemPrompt, userMessage, lang);
    }

    if (resJson.candidates && resJson.candidates[0]?.content?.parts?.[0]?.text) {
      return resJson.candidates[0].content.parts[0].text;
    } else {
      const safeResponseLog = JSON.stringify({
        candidatesCount: resJson.candidates?.length,
        firstCandidateFinishReason: resJson.candidates?.[0]?.finishReason,
        promptFeedback: resJson.promptFeedback,
        error: resJson.error,
      }).replace(new RegExp(apiKey, 'g'), '[REDACTED]');
      console.warn('[AI Gemini Response Warning] Missing valid text candidate. Safe details:', safeResponseLog);
      return mockGeminiResponse(systemPrompt, userMessage, lang);
    }
  } catch (err) {
    console.error('[AI Gemini API Network/Execution Error]:', err.message);
    return mockGeminiResponse(systemPrompt, userMessage, lang);
  }
};

module.exports = {
  predictAbsenteeism,
  verifyFaceAttendance,
  generateGeminiInsights,
  callGemini,
};
