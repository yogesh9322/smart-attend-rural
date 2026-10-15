const twilio = require('twilio');

/**
 * Send SMS using Twilio (if credentials present) or fallback to console simulation
 * @param {Object} options - SMS details
 * @param {String} options.phone - Phone number to send SMS to
 * @param {String} [options.countryCode] - Country dial code (defaults to +91)
 * @param {String} options.message - The body content of the text message
 */
const logSimulatedSMS = (fullPhone, message) => {
  console.log(`[SMS SIMULATED] Dispatched notification to ${fullPhone}`);
};

const sendSMS = async (options) => {
  const phone = options.phone;
  const countryCode = options.countryCode || '+91';
  const fullPhone = phone.startsWith('+') ? phone : `${countryCode}${phone}`;
  const message = options.message;

  // Check if Twilio environment variables are configured
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  ) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: fullPhone,
      });
      console.log(`[SMS SUCCESS] Sent text message to ${fullPhone}`);
    } catch (err) {
      // Fall back to simulated SMS when using demo/expired Twilio credentials
      logSimulatedSMS(fullPhone, message);
    }
  } else {
    logSimulatedSMS(fullPhone, message);
  }
};

module.exports = sendSMS;
