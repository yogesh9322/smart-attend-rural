/**
 * Manages language translations and fallback constants for localizations
 */

const LOCALIZED_TEMPLATES = {
  en: {
    welcome: "Hello! I am SmartAttend AI. I can help you with attendance, reports, notices, students and school information. How can I assist you today?",
    offline: "I am currently offline. Please check your network connection and try again.",
    suggested: {
      admin: ["Show today's attendance summary.", "Students below 75%.", "Generate monthly report."],
      teacher: ["How do I mark attendance?", "Show absent students.", "Generate attendance report."],
      parent: ["What is my child's attendance?", "How do I request leave?", "Explain today's notice."]
    }
  },
  hi: {
    welcome: "नमस्ते! मैं SmartAttend AI हूँ। मैं उपस्थिति, रिपोर्ट, नोटिस और विद्यालय संबंधी जानकारी में आपकी सहायता कर सकता हूँ। आज मैं आपकी क्या मदद करूँ?",
    offline: "मैं इस समय ऑफलाइन हूँ। कृपया अपना नेटवर्क कनेक्शन जांचें और पुनः प्रयास करें।",
    suggested: {
      admin: ["आज की उपस्थिति का सारांश दिखाएं।", "75% से कम उपस्थिति वाले छात्र।", "मासिक रिपोर्ट जनरेट करें।"],
      teacher: ["उपस्थिति कैसे दर्ज करें?", "अनुपस्थित छात्रों को दिखाएं।", "उपस्थिति रिपोर्ट जनरेट करें।"],
      parent: ["मेरे बच्चे की उपस्थिति क्या है?", "मैं छुट्टी के लिए आवेदन कैसे करूँ?", "आज के नोटिस का विवरण दें।"]
    }
  },
  mr: {
    welcome: "नमस्कार! मी SmartAttend AI आहे. मी उपस्थिती, अहवाल, सूचना आणि शाळेशी संबंधित माहितीमध्ये मदत करू शकतो. आज मी तुम्हाला कशी मदत करू शकतो?",
    offline: "मी सध्या ऑफलाइन आहे. कृपया तुमचे नेटवर्क तपासा आणि पुन्हा प्रयत्न करा.",
    suggested: {
      admin: ["आजच्या उपस्थितीचा गोषवारा दाखवा.", "७५% पेक्षा कमी उपस्थिती असलेले विद्यार्थी.", "मासिक अहवाल तयार करा."],
      teacher: ["उपस्थिती कशी नोंदवायची?", "गैरहजर विद्यार्थी दाखवा.", "उपस्थिती अहवाल तयार करा."],
      parent: ["माझ्या पाल्याची उपस्थिती काय आहे?", "मी रजेसाठी अर्ज कसा करू?", "आजची नोटीस स्पष्ट करा."]
    }
  }
};

/**
 * Returns localized templates
 * @param {String} lang - Language code ('en', 'hi', 'mr')
 * @returns {Object} - Localized properties
 */
const getLocalizedTemplate = (lang) => {
  return LOCALIZED_TEMPLATES[lang] || LOCALIZED_TEMPLATES.en;
};

module.exports = {
  getLocalizedTemplate,
};
