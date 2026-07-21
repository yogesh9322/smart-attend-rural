/**
 * Formats raw AI response output to sanitize and ensure standard markdown compatibility
 */

/**
 * Format and sanitize response text
 * @param {String} text - Raw Gemini output
 * @returns {String} - Sanitized markdown response
 */
const formatResponse = (text) => {
  if (!text) return '';

  let sanitized = text.trim();

  // Strip prefixes like "AI:", "Assistant:", "SmartAttend AI:" if generated
  sanitized = sanitized.replace(/^(AI|Assistant|SmartAttend AI):\s*/i, '');

  // Ensure bold text works properly in markdown
  // e.g. replacing any broken double asterisks
  
  return sanitized;
};

module.exports = {
  formatResponse,
};
