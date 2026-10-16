/**
 * Diagnostic utility to verify email configuration and Resend credentials.
 * Run using: node scripts/verifyEmailConfig.js
 */
const dotenv = require('dotenv');
dotenv.config();

const { Resend } = require('resend');

const checkEmailConfig = async () => {
  console.log('\n======================================================');
  console.log('       SmartAttend Rural - Email Diagnostics');
  console.log('======================================================\n');

  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const emailFrom = (process.env.EMAIL_FROM || '').trim();
  const clientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '').trim();
  const fromName = (process.env.FROM_NAME || 'SmartAttend Rural').trim();

  console.log('1. Environment Configuration:');
  console.log('   - FROM_NAME:   ', fromName);
  console.log('   - CLIENT_URL:  ', clientUrl || 'NOT SET (defaults to https://smart-attend-rural-smkl.vercel.app)');
  console.log('   - EMAIL_FROM:  ', emailFrom || 'NOT SET (defaults to onboarding@resend.dev)');
  console.log('   - RESEND_API_KEY:', apiKey ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} chars)` : 'NOT SET');

  if (!apiKey) {
    console.error('\n❌ ERROR: RESEND_API_KEY is missing from environment variables.');
    console.log('👉 Solution: Obtain an API key from https://resend.com/api-keys and set RESEND_API_KEY in your Render dashboard.');
    return;
  }

  console.log('\n2. Testing Resend API Key Authentication...');
  try {
    const res = await fetch('https://api.resend.com/api-keys', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`\n❌ ERROR: Resend API Key authentication failed (HTTP ${res.status}).`);
      console.error(`   Provider response: ${errText}`);
      console.log('\n👉 How to fix:');
      console.log('   1. Sign in to https://resend.com');
      console.log('   2. Go to "API Keys" -> Click "Create API Key"');
      console.log('   3. Copy the full key (starts with "re_...")');
      console.log('   4. Update RESEND_API_KEY in your Render environment variables and redeploy.');
      return;
    }

    const keyData = await res.json();
    console.log('   ✅ Resend API Key is valid and active!');

    console.log('\n3. Validating Sender Address...');
    const isPublicDomain = /@(gmail|yahoo|hotmail|outlook|live)\.com$/i.test(emailFrom);
    if (isPublicDomain) {
      console.warn(`   ⚠️ WARNING: "${emailFrom}" is a public domain (@gmail.com).`);
      console.warn('   Resend does NOT allow sending from public domains like Gmail/Yahoo.');
      console.log('   👉 Solution:');
      console.log('      - For testing: set EMAIL_FROM=onboarding@resend.dev in Render.');
      console.log('      - For production: verify your domain at https://resend.com/domains, then set EMAIL_FROM=notifications@yourdomain.com.');
    } else if (emailFrom === 'onboarding@resend.dev') {
      console.log('   ℹ️ Using test sender "onboarding@resend.dev".');
      console.log('   Note: Resend allows sending only to the email address registered with your Resend account.');
    } else if (emailFrom) {
      console.log(`   ✅ Using custom domain sender: ${emailFrom}`);
    }

    console.log('\n4. Testing Live Email Dispatch (to delivered@resend.dev)...');
    const resend = new Resend(apiKey);
    const sender = isPublicDomain || !emailFrom
      ? `${fromName} <onboarding@resend.dev>`
      : (emailFrom.includes('<') ? emailFrom : `${fromName} <${emailFrom}>`);

    const sendResult = await resend.emails.send({
      from: sender,
      to: ['delivered@resend.dev'],
      subject: 'SmartAttend Rural - Email Diagnostic Test',
      text: 'This is an automated test from SmartAttend Rural diagnostic utility.',
    });

    if (sendResult.error) {
      console.error('\n❌ ERROR: Dispatch rejected by Resend:');
      console.error('  ', sendResult.error.message);
    } else {
      console.log('   ✅ Live email accepted by Resend successfully!');
      console.log(`   Message ID: ${sendResult.data.id}`);
      console.log('\n🎉 Your email service is properly configured and operational!\n');
    }
  } catch (err) {
    console.error('\n❌ Unexpected error during diagnostics:', err.message);
  }
};

checkEmailConfig();
