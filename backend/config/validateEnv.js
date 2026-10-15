/**
 * Validates essential environment configurations on backend startup.
 * Provides clear diagnostic guidance for deployment environments (Render) and local setup.
 */
const validateEnv = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const warnings = [];

  if (isProd) {
    if (!process.env.RESEND_API_KEY) {
      warnings.push('CRITICAL: RESEND_API_KEY is missing. Email delivery will be rejected.');
    }
    if (!process.env.EMAIL_FROM) {
      warnings.push('WARNING: EMAIL_FROM is missing. Emails must be sent from a verified domain in Resend.');
    }
    if (!process.env.CLIENT_URL && !process.env.FRONTEND_URL) {
      warnings.push('NOTE: CLIENT_URL is not set. Links in emails will default to https://smart-attend-rural.vercel.app.');
    }
  } else {
    if (!process.env.RESEND_API_KEY) {
      console.log('ℹ️  [Email Service] RESEND_API_KEY not detected. Set RESEND_API_KEY in backend/.env for live email delivery.');
    }
  }

  if (warnings.length > 0) {
    console.warn('\n================ ENVIRONMENT DIAGNOSTICS ================');
    warnings.forEach((w) => console.warn(`⚠️  ${w}`));
    console.warn('=========================================================\n');
  }
};

module.exports = validateEnv;
