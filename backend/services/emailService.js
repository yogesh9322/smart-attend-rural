const { Resend } = require('resend');

/**
 * Validates whether an email string adheres to RFC 5322 standard format.
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
};

/**
 * Masks an email address for safe logging without exposing PII.
 * @param {string} email
 * @returns {string}
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [name, domain] = parts;
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
};

/**
 * Resolves the verified sender address and display name.
 * Priority: EMAIL_FROM -> FROM_EMAIL -> fallback.
 * @returns {string} Formatted sender (e.g., 'SmartAttend Rural <notifications@your-domain.com>')
 */
const getSenderAddress = () => {
  const displayName = (process.env.FROM_NAME || 'SmartAttend Rural').trim();
  const fromEmail = (process.env.EMAIL_FROM || process.env.FROM_EMAIL || '').trim();

  if (!fromEmail) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_FROM is required in production environment.');
    }
    // In local development, fall back to Resend default onboarding sender
    return `${displayName} <onboarding@resend.dev>`;
  }

  if (fromEmail.includes('<') && fromEmail.includes('>')) {
    return fromEmail;
  }

  return `${displayName} <${fromEmail}>`;
};

// Internal test mock transport (for automated test isolation without real API calls)
let mockTransport = null;

const setMockTransport = (fn) => {
  mockTransport = fn;
};

/**
 * Initializes and returns the Resend client instance.
 * @returns {Resend}
 */
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('RESEND_API_KEY is not configured in environment variables.');
  }
  return new Resend(apiKey.trim());
};

/**
 * Sends an email via Resend API over HTTPS.
 * 
 * @param {Object} options
 * @param {string} [options.to] - Recipient email address
 * @param {string} [options.email] - Alternative alias for recipient email
 * @param {string} options.subject - Subject line
 * @param {string} [options.html] - HTML body
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.message] - Alternative alias for plain text body
 * @returns {Promise<{ success: boolean, id: string, provider: string }>}
 */
const sendViaResend = async (options) => {
  const recipient = (options.to || options.email || '').trim();
  const subject = (options.subject || '').trim();
  const htmlContent = options.html;
  const textContent = (options.text || options.message || '').trim();

  // 1. Validate recipient
  if (!recipient) {
    throw new Error('Recipient email address is required.');
  }
  if (!isValidEmail(recipient)) {
    throw new Error(`Invalid recipient email address: "${recipient}".`);
  }

  // 2. Validate subject
  if (!subject) {
    throw new Error('Email subject is required and cannot be empty.');
  }

  // 3. Validate content
  if (!htmlContent && !textContent) {
    throw new Error('Email content is required (must provide html or text body).');
  }

  // 4. Resolve sender address
  const fromAddress = getSenderAddress();

  // 5. Test transport hook (used in unit tests to mock Resend responses without network calls)
  if (mockTransport) {
    return await mockTransport({
      from: fromAddress,
      to: recipient,
      subject,
      html: htmlContent,
      text: textContent,
    });
  }

  // 6. Send through Resend Node.js SDK
  const resend = getResendClient();

  const payload = {
    from: fromAddress,
    to: [recipient],
    subject,
  };

  if (htmlContent) payload.html = htmlContent;
  if (textContent) payload.text = textContent;

  const result = await resend.emails.send(payload);

  if (result.error) {
    const errorDetails = result.error.message || JSON.stringify(result.error);
    console.error(`[Resend Error] Delivery rejected for ${maskEmail(recipient)}: ${errorDetails}`);
    const err = new Error(`Resend email delivery failed: ${errorDetails}`);
    err.statusCode = result.error.statusCode || 500;
    err.providerError = result.error;
    throw err;
  }

  if (!result.data || !result.data.id) {
    console.error(`[Resend Error] No message ID returned for recipient ${maskEmail(recipient)}`);
    throw new Error('Resend email delivery failed: Provider did not return an acceptance ID.');
  }

  console.log(`[Resend Success] Email delivered to ${maskEmail(recipient)} (ID: ${result.data.id})`);

  return {
    success: true,
    id: result.data.id,
    provider: 'resend',
  };
};

module.exports = {
  sendViaResend,
  isValidEmail,
  maskEmail,
  getSenderAddress,
  setMockTransport,
};
