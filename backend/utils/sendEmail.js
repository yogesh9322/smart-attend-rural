const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // If SMTP configurations are not fully configured in env, log to console as fallback
  if (!process.env.SMTP_HOST || !process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log('\n=======================================');
    console.log('          --- MOCK EMAIL SENT ---');
    console.log(`To: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message:\n${options.message}`);
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
    });

    const mailOptions = {
      from: `${process.env.FROM_NAME || 'SmartAttend Rural'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.warn(`\n[SMTP WARNING] connection failed: ${err.message}. Falling back to console logging.`);
    console.log('\n======================================================');
    console.log('       --- SMTP FAIL FALLBACK: MOCK EMAIL SENT ---');
    console.log(`To: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message:\n${options.message}`);
    console.log('======================================================\n');
    return { success: true, mock: true, error: err.message };
  }
};

module.exports = sendEmail;
