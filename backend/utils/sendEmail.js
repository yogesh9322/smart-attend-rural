const nodemailer = require('nodemailer');
const {
  getSenderInfo,
  getSchoolName,
  getSignatureText,
  wrapEmailHtml,
} = require('./emailBranding');

/**
 * Centralized email sending utility for SmartAttend Rural
 * Enforces standardized sender identity, branding, and dynamic school signatures.
 * 
 * @param {Object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Plain text message
 * @param {string} [options.html] - HTML body (auto-generated if omitted)
 * @param {string} [options.schoolName] - Configured school name override (optional)
 */
const sendEmail = async (options) => {
  const sender = getSenderInfo();
  const schoolName = options.schoolName || await getSchoolName();
  const signature = getSignatureText(schoolName);

  // Ensure plain text ends with consistent signature
  let textBody = options.message || '';
  if (!textBody.includes('Powered by SmartAttend Rural')) {
    textBody = textBody.trim() + `\n\nThank you,\n${signature}`;
  }

  // Ensure HTML body exists and adheres to standardized template
  let htmlBody = options.html;
  if (!htmlBody && textBody) {
    const formattedParagraphs = textBody
      .split('\n\n')
      .map(p => `<p style="margin: 0 0 12px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    htmlBody = wrapEmailHtml({
      title: options.subject,
      subtitle: 'SmartAttend Rural School Notification',
      schoolName,
      bodyHtml: formattedParagraphs,
    });
  }

  // If SMTP configurations are not fully configured in env, log to console as fallback
  if (!process.env.SMTP_HOST || !process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log('\n=======================================');
    console.log('       --- MOCK EMAIL DISPATCHED ---');
    console.log(`From: ${sender.formatted}`);
    console.log(`To: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`School: ${schoolName}`);
    console.log(`Message:\n${textBody}`);
    console.log('=======================================\n');
    return { success: true, mock: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
      family: 4, // Force IPv4 only to prevent Render ENETUNREACH errors over IPv6
    });

    const mailOptions = {
      from: sender.formatted,
      to: options.email,
      subject: options.subject,
      text: textBody,
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.warn(`\n[SMTP WARNING] connection failed: ${err.message}. Falling back to console logging.`);
    console.log('\n======================================================');
    console.log('    --- SMTP FAIL FALLBACK: MOCK EMAIL SENT ---');
    console.log(`From: ${sender.formatted}`);
    console.log(`To: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`School: ${schoolName}`);
    console.log(`Message:\n${textBody}`);
    console.log('======================================================\n');
    return { success: true, mock: true, error: err.message };
  }
};

module.exports = sendEmail;
