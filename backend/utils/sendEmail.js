const { sendViaResend } = require('../services/emailService');
const {
  getSchoolName,
  getSignatureText,
  wrapEmailHtml,
} = require('./emailBranding');

/**
 * Centralized email sending utility for SmartAttend Rural.
 * Uses Resend over HTTPS for reliable production email delivery.
 * 
 * @param {Object} options
 * @param {string} [options.email] - Recipient email address
 * @param {string} [options.to] - Alternative alias for recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.message] - Plain text message
 * @param {string} [options.text] - Alternative alias for plain text
 * @param {string} [options.html] - HTML body (auto-generated if omitted)
 * @param {string} [options.schoolName] - Configured school name override (optional)
 * @returns {Promise<{ success: boolean, id: string, provider: string }>}
 */
const sendEmail = async (options) => {
  const recipient = (options.email || options.to || '').trim();
  const subject = (options.subject || '').trim();
  const schoolName = options.schoolName || await getSchoolName();
  const signature = getSignatureText(schoolName);

  // 1. Ensure plain text ends with consistent signature
  let textBody = (options.message || options.text || '').trim();
  if (textBody && !textBody.includes('Powered by SmartAttend Rural')) {
    textBody = `${textBody}\n\nThank you,\n${signature}`;
  }

  // 2. Ensure HTML body exists and adheres to standardized template
  let htmlBody = options.html;
  if (!htmlBody && textBody) {
    const formattedParagraphs = textBody
      .split('\n\n')
      .map(p => `<p style="margin: 0 0 12px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    htmlBody = wrapEmailHtml({
      title: subject,
      subtitle: 'SmartAttend Rural School Notification',
      schoolName,
      bodyHtml: formattedParagraphs,
    });
  }

  // 3. Primary Delivery: Resend via HTTPS API
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    return await sendViaResend({
      to: recipient,
      subject,
      text: textBody,
      html: htmlBody,
    });
  }

  // 4. In production, Resend is mandatory because outbound SMTP is blocked
  if (process.env.NODE_ENV === 'production') {
    const err = new Error('RESEND_API_KEY is not configured in production environment. Email delivery aborted.');
    console.error(`[Email Error] ${err.message}`);
    throw err;
  }

  // 5. Optional local development fallback via SMTP (if explicitly configured)
  if (process.env.SMTP_HOST && process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
    try {
      const nodemailer = require('nodemailer');
      const { getSenderInfo } = require('./emailBranding');
      const sender = getSenderInfo();

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
        family: 4,
      });

      const info = await transporter.sendMail({
        from: sender.formatted,
        to: recipient,
        subject,
        text: textBody,
        html: htmlBody,
      });

      return {
        success: true,
        id: info.messageId,
        provider: 'smtp-fallback',
      };
    } catch (smtpErr) {
      console.error(`[SMTP Error] Delivery failed: ${smtpErr.message}`);
      throw new Error(`SMTP fallback delivery failed: ${smtpErr.message}`);
    }
  }

  // 6. Neither Resend nor SMTP is configured
  const noConfigErr = new Error(
    'No email service configured. Please set RESEND_API_KEY and EMAIL_FROM in your environment.'
  );
  console.error(`[Email Config Error] ${noConfigErr.message}`);
  throw noConfigErr;
};

module.exports = sendEmail;
