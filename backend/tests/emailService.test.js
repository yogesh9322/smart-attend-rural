const test = require('node:test');
const assert = require('node:assert');

const {
  sendViaResend,
  isValidEmail,
  maskEmail,
  getSenderAddress,
  setMockTransport,
} = require('../services/emailService');

const sendEmail = require('../utils/sendEmail');

const {
  getAppBaseUrl,
  buildPasswordResetEmail,
  buildNoticeAlertEmail,
  buildWelcomeCredentialsEmail,
} = require('../utils/emailBranding');

test('Email Service & Delivery Test Suite', async (t) => {
  const originalEnv = { ...process.env };

  t.afterEach(() => {
    // Restore environment and reset mock transport
    process.env = { ...originalEnv };
    setMockTransport(null);
  });

  // 1. Recipient Email Validation Tests
  await t.test('isValidEmail correctly identifies valid and invalid addresses', () => {
    assert.strictEqual(isValidEmail('teacher@school.edu'), true);
    assert.strictEqual(isValidEmail('parent.name+label@example.co.in'), true);
    assert.strictEqual(isValidEmail('student123@domain.org'), true);

    assert.strictEqual(isValidEmail(''), false);
    assert.strictEqual(isValidEmail('plainaddress'), false);
    assert.strictEqual(isValidEmail('@missingusername.com'), false);
    assert.strictEqual(isValidEmail('username@.com'), false);
    assert.strictEqual(isValidEmail('username@domain'), false);
    assert.strictEqual(isValidEmail(null), false);
    assert.strictEqual(isValidEmail(undefined), false);
  });

  // 2. Safe Email Masking Tests (PII Protection in Logs)
  await t.test('maskEmail obfuscates email addresses for secure logging', () => {
    assert.strictEqual(maskEmail('principal@school.edu'), 'p***l@school.edu');
    assert.strictEqual(maskEmail('yo@rural.org'), 'y***@rural.org');
    assert.strictEqual(maskEmail(''), '***');
    assert.strictEqual(maskEmail(null), '***');
  });

  // 3. Sender Address Configuration Tests
  await t.test('getSenderAddress builds standard formatted sender string', () => {
    process.env.FROM_NAME = 'Model Rural School';
    process.env.EMAIL_FROM = 'alerts@modelruralschool.edu';
    process.env.NODE_ENV = 'production';

    assert.strictEqual(
      getSenderAddress(),
      'Model Rural School <alerts@modelruralschool.edu>'
    );
  });

  await t.test('getSenderAddress throws error in production if EMAIL_FROM is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.EMAIL_FROM;
    delete process.env.FROM_EMAIL;

    assert.throws(
      () => getSenderAddress(),
      /EMAIL_FROM is required in production environment/
    );
  });

  // 4. Input Validation Before Dispatch
  await t.test('sendViaResend rejects invalid recipient address before provider call', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.EMAIL_FROM = 'test@example.com';

    await assert.rejects(
      async () => {
        await sendViaResend({
          to: 'invalid-email-format',
          subject: 'Test Subject',
          text: 'Hello world',
        });
      },
      /Invalid recipient email address/
    );
  });

  await t.test('sendViaResend rejects empty subject line', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.EMAIL_FROM = 'test@example.com';

    await assert.rejects(
      async () => {
        await sendViaResend({
          to: 'valid@example.com',
          subject: '   ',
          text: 'Hello world',
        });
      },
      /Email subject is required and cannot be empty/
    );
  });

  await t.test('sendViaResend rejects empty email body', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.EMAIL_FROM = 'test@example.com';

    await assert.rejects(
      async () => {
        await sendViaResend({
          to: 'valid@example.com',
          subject: 'Valid Subject',
        });
      },
      /Email content is required/
    );
  });

  // 5. Successful Provider Response Test (Mocked Resend)
  await t.test('sendViaResend confirms successful delivery when provider returns ID', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.EMAIL_FROM = 'notifications@school.org';
    process.env.FROM_NAME = 'SmartAttend Rural';

    const expectedId = 'resend_msg_test_abc123';

    // Inject mock transport
    setMockTransport(async (payload) => {
      assert.strictEqual(payload.to, 'parent@village.org');
      assert.strictEqual(payload.subject, 'School Report');
      assert.strictEqual(payload.from, 'SmartAttend Rural <notifications@school.org>');
      return { success: true, id: expectedId, provider: 'resend' };
    });

    const result = await sendViaResend({
      to: 'parent@village.org',
      subject: 'School Report',
      text: 'Student attendance update.',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, expectedId);
    assert.strictEqual(result.provider, 'resend');
  });

  // 6. Provider API Failure Test & No Fake Success
  await t.test('sendViaResend propagates provider rejection and never returns fake success', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.EMAIL_FROM = 'notifications@school.org';

    setMockTransport(async () => {
      const error = new Error('Resend rate limit exceeded (429)');
      error.statusCode = 429;
      throw error;
    });

    await assert.rejects(
      async () => {
        await sendViaResend({
          to: 'parent@village.org',
          subject: 'Notice',
          text: 'Notice body',
        });
      },
      /Resend rate limit exceeded/
    );
  });

  // 7. Password Reset URL Generation & Email Branding
  await t.test('buildPasswordResetEmail generates secure URL using CLIENT_URL and never outputs localhost in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://smart-attend-rural.vercel.app';

    const baseUrl = getAppBaseUrl();
    assert.strictEqual(baseUrl, 'https://smart-attend-rural.vercel.app');
    assert.strictEqual(baseUrl.includes('localhost'), false);

    const token = 'a1b2c3d4e5f67890';
    const emailData = buildPasswordResetEmail({
      user: { name: 'Principal Sharma', email: 'principal@school.edu' },
      resetToken: token,
      schoolName: 'Govt Model School',
      appBaseUrl: baseUrl,
    });

    assert.strictEqual(emailData.subject, 'SmartAttend Password Reset Request');
    assert.strictEqual(emailData.html.includes(`https://smart-attend-rural.vercel.app/reset-password/${token}`), true);
    assert.strictEqual(emailData.message.includes(`https://smart-attend-rural.vercel.app/reset-password/${token}`), true);
  });

  // 8. Notice Email Formatting Test
  await t.test('buildNoticeAlertEmail formats announcement with school branding and signature', () => {
    const noticeData = buildNoticeAlertEmail({
      recipientName: 'Mrs. Patil',
      title: 'Annual Sports Meet 2026',
      content: 'The sports meet is scheduled for Friday morning.',
      schoolName: 'Zilla Parishad High School',
      appBaseUrl: 'https://smart-attend-rural.vercel.app',
    });

    assert.strictEqual(noticeData.subject, 'SmartAttend Notice: Annual Sports Meet 2026');
    assert.strictEqual(noticeData.html.includes('Annual Sports Meet 2026'), true);
    assert.strictEqual(noticeData.html.includes('Zilla Parishad High School'), true);
    assert.strictEqual(noticeData.message.includes('Powered by SmartAttend Rural'), true);
  });

  // 9. sendEmail integration wrapper with Resend
  await t.test('sendEmail wraps content and successfully dispatches via Resend', async () => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.EMAIL_FROM = 'notifications@school.org';
    process.env.FROM_NAME = 'SmartAttend Rural';

    let capturedPayload = null;
    setMockTransport(async (payload) => {
      capturedPayload = payload;
      return { success: true, id: 'resend_msg_test_999', provider: 'resend' };
    });

    const result = await sendEmail({
      email: 'teacher@school.org',
      subject: 'Class Assignment',
      message: 'You have been assigned to Grade 5-A',
      schoolName: 'Model Rural School',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, 'resend_msg_test_999');
    assert.strictEqual(capturedPayload.to, 'teacher@school.org');
    assert.strictEqual(capturedPayload.text.includes('Powered by SmartAttend Rural'), true);
    assert.strictEqual(capturedPayload.html.includes('Model Rural School'), true);
  });
});
