const { getTranslationPrompt } = require('./promptService');
const { callGemini } = require('./aiService');

/**
 * Translates text into English, Hindi, and Marathi
 * @param {String} text - Text to translate
 * @returns {Object} - Object containing translations
 */
const translateNoticeText = async (text) => {
  const systemPrompt = "You are a professional multilingual translator.";

  try {
    const [enRes, hiRes, mrRes] = await Promise.all([
      callGemini(systemPrompt, getTranslationPrompt(text, 'English')),
      callGemini(systemPrompt, getTranslationPrompt(text, 'Hindi')),
      callGemini(systemPrompt, getTranslationPrompt(text, 'Marathi'))
    ]);

    return {
      englishNotice: enRes || text,
      hindiNotice: hiRes || text,
      marathiNotice: mrRes || text,
    };
  } catch (err) {
    console.error('Translation service connection failed. Using original text.', err);
    return {
      englishNotice: text,
      hindiNotice: text,
      marathiNotice: text,
    };
  }
};

module.exports = {
  translateNoticeText,
};
