/**
 * Utility helper for Text-to-Speech (TTS) normalization, voice selection,
 * and browser SpeechSynthesis playback in SmartAttend Rural.
 */

/**
 * Normalizes text ONLY for Speech Synthesis pronunciation in Marathi & Hindi.
 * Does NOT alter the displayed UI message text.
 * Converts common brand names and English technical terms to Devanagari script
 * so that mr-IN and hi-IN speech engines can pronounce them naturally.
 */
export const getSpeechText = (text, appLang) => {
  if (!text || typeof text !== 'string') return '';

  // 1. Remove markdown formatting symbols for clean vocal presentation
  let cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#+\s?/g, '')
    .trim();

  // 2. Failsafe: detect if the message content itself is Devanagari script (Marathi/Hindi)
  const hasDevanagari = /[\u0900-\u097F]/.test(cleanText);
  let effectiveLang = appLang;

  if (hasDevanagari && appLang === 'en') {
    // If text is written in Devanagari script, auto-detect Marathi vs Hindi for proper TTS voice selection
    const isMarathiText = /\b(मी|आहे|पाल्या|रजेचे|शाळेच्या|सूचनांबद्दल|कॅलेंडर|उपस्थिती|नाही|आहोत)\b/i.test(cleanText);
    effectiveLang = isMarathiText ? 'mr' : 'hi';
  }

  if (effectiveLang === 'mr') {
    // Normalization for Marathi Speech Synthesis
    cleanText = cleanText
      .replace(/SmartAttend\s+AI/gi, 'स्मार्टअटेंड एआय')
      .replace(/SmartAttend/gi, 'स्मार्टअटेंड')
      .replace(/AI\s+Assistant/gi, 'एआय सहाय्यक')
      .replace(/AI/gi, 'एआय')
      .replace(/\bAahe\b/gi, 'आहे')
      .replace(/\bahe\b/gi, 'आहे')
      .replace(/\bERP\b/gi, 'ईआरपी')
      .replace(/\bPDF\b/gi, 'पीडीएफ')
      .replace(/\bCSV\b/gi, 'सीएसव्ही')
      .replace(/\bSMS\b/gi, 'एसएमएस')
      .replace(/\bApp\b/gi, 'अ‍ॅप');
  } else if (effectiveLang === 'hi') {
    // Normalization for Hindi Speech Synthesis
    cleanText = cleanText
      .replace(/SmartAttend\s+AI/gi, 'स्मार्टअटेंड एआई')
      .replace(/SmartAttend/gi, 'स्मार्टअटेंड')
      .replace(/AI\s+Assistant/gi, 'एआई सहायक')
      .replace(/AI/gi, 'एआई')
      .replace(/\bERP\b/gi, 'ईआरपी')
      .replace(/\bPDF\b/gi, 'पीडीएफ')
      .replace(/\bCSV\b/gi, 'सीएसवी')
      .replace(/\bSMS\b/gi, 'एसएमएस')
      .replace(/\bApp\b/gi, 'ऐप');
  }

  return cleanText;
};

/**
 * Selects the best available browser voice matching the target app language or text script.
 * Prefers native voices (mr-IN for Marathi, hi-IN for Hindi, en-IN for English).
 * For Marathi/Devanagari, falls back to a Hindi voice if no native Marathi voice is installed,
 * ensuring Devanagari text is read with 100% clarity rather than falling back to English.
 */
export const selectVoiceForLanguage = (voices, appLang, text = '') => {
  const getLangCode = (lang) => {
    if (lang === 'mr') return 'mr-IN';
    if (lang === 'hi') return 'hi-IN';
    return 'en-IN';
  };

  // Failsafe: if text contains Devanagari script, force a Devanagari-compatible locale for voice matching
  const hasDevanagari = text && typeof text === 'string' && /[\u0900-\u097F]/.test(text);
  let effectiveLang = appLang;
  if (hasDevanagari && appLang === 'en') {
    const isMarathiText = /\b(मी|आहे|पाल्या|रजेचे|शाळेच्या|सूचनांबद्दल|कॅलेंडर|उपस्थिती|नाही|आहोत)\b/i.test(text);
    effectiveLang = isMarathiText ? 'mr' : 'hi';
  }

  const langCode = getLangCode(effectiveLang);

  if (!voices || voices.length === 0) {
    return { langCode, voice: null, effectiveLang };
  }

  if (effectiveLang === 'mr') {
    const voice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('mr')) ||
                  voices.find(v => v.name && v.name.toLowerCase().includes('marathi')) ||
                  voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi')) ||
                  voices.find(v => v.name && v.name.toLowerCase().includes('hindi')) ||
                  null;
    return { langCode, voice, effectiveLang };
  }

  if (effectiveLang === 'hi') {
    const voice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi')) ||
                  voices.find(v => v.name && v.name.toLowerCase().includes('hindi')) ||
                  voices.find(v => v.lang && v.lang.toLowerCase().startsWith('mr')) ||
                  null;
    return { langCode, voice, effectiveLang };
  }

  // Default English (en)
  const voice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-in')) ||
                voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) ||
                null;
  return { langCode, voice, effectiveLang };
};
