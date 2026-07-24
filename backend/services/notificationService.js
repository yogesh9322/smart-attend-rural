const admin = require('firebase-admin');

let fcmInitialized = false;

// Check if Firebase variables are present, initialize if possible
if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    fcmInitialized = true;
    console.log('Firebase Cloud Messaging Initialized Successfully');
  } catch (error) {
    console.error('Firebase Initialisation Failed:', error.message);
  }
} else {
  console.log('Firebase credentials missing. SMS/Push notifications will run in Console/Mock mode.');
}

const sendSMS = require('../utils/sendSMS');
const sendEmail = require('../utils/sendEmail');
const { logActivity } = require('../utils/activityLogger');

/**
 * Sends attendance notification to Parents
 * @param {String} parentPhone - Phone number of parent
 * @param {String} parentEmail - Email of parent
 * @param {String} studentName - Name of student
 * @param {String} status - Attendance status (e.g. Absent, Late)
 * @param {String} dateStr - Date string
 */
const sendParentNotification = async (parentPhone, parentEmail, studentName, status, dateStr, teacher = null) => {
  let teacherDetails = 'the school administration';
  if (teacher && teacher.name) {
    teacherDetails = `${teacher.name} (Email: ${teacher.email || 'N/A'}, Phone: ${teacher.phone || 'N/A'})`;
  }

  const messageBody = `SmartAttend Rural\n\nDear Parent,\n\nYour child, ${studentName}, was marked absent on ${dateStr}.\n\nIf this absence was unexpected, please contact the class teacher: ${teacherDetails}.\n\nThank you,\nABC Rural School`;

  const User = require('../models/User');
  let actorId = null;
  try {
    if (teacher && teacher._id) {
      actorId = teacher._id;
    } else {
      const parentUser = await User.findOne({ $or: [{ email: parentEmail }, { phone: parentPhone }] });
      if (parentUser) {
        actorId = parentUser._id;
      } else {
        const adminUser = await User.findOne({ role: 'admin' });
        if (adminUser) actorId = adminUser._id;
      }
    }
  } catch (dbErr) {
    console.error('Failed to resolve actorId for notification logging:', dbErr.message);
  }

  // Trigger SMS Gateway dispatch
  if (parentPhone) {
    try {
      await sendSMS({
        phone: parentPhone,
        message: messageBody
      });
      if (actorId) {
        await logActivity(actorId, 'SMS_NOTIFICATION_SENT', `Sent attendance SMS to parent for student ${studentName} (${parentPhone})`);
      }
    } catch (smsErr) {
      console.error(`SMS send error for ${parentPhone}:`, smsErr.message);
      if (actorId) {
        await logActivity(actorId, 'SMS_NOTIFICATION_FAILED', `Failed to send attendance SMS to ${parentPhone}. Error: ${smsErr.message}`);
      }
    }
  }

  // Trigger Email dispatch
  if (parentEmail) {
    try {
      await sendEmail({
        email: parentEmail,
        subject: `SmartAttend: Attendance Alert - ${studentName} is ${status}`,
        message: messageBody
      });
      if (actorId) {
        await logActivity(actorId, 'EMAIL_NOTIFICATION_SENT', `Sent attendance email to parent for student ${studentName} (${parentEmail})`);
      }
    } catch (emailErr) {
      console.error(`Email send error for ${parentEmail}:`, emailErr.message);
      if (actorId) {
        await logActivity(actorId, 'EMAIL_NOTIFICATION_FAILED', `Failed to send attendance email to ${parentEmail}. Error: ${emailErr.message}`);
      }
    }
  }

  // Firebase Push Notification
  if (fcmInitialized) {
    try {
      console.log(`[FCM] Sending push notification to parent: ${parentEmail}`);
    } catch (error) {
      console.error('[FCM Error]', error.message);
    }
  }
};

/**
 * Sends custom alert notice to all users or groups
 * @param {String} title - Notice title
 * @param {String} body - Notice body
 * @param {String} targetAudience - Group ('all', 'teachers', 'parents')
 */
const sendNoticeAlert = async (title, body, targetAudience) => {
  const User = require('../models/User');
  try {
    const filter = {};
    if (targetAudience === 'teachers') filter.role = 'teacher';
    if (targetAudience === 'parents') filter.role = 'parent';
    
    const adminUser = await User.findOne({ role: 'admin' });
    const actorId = adminUser ? adminUser._id : null;

    const users = await User.find(filter).select('phone countryCode email name');
    for (const u of users) {
      const messageBody = `SmartAttend Rural\n\nDear ${u.name},\n\nA new notice has been published by the administration:\n\nTitle: "${title}"\nDescription: ${body}\n\nThank you,\nABC Rural School`;

      if (u.phone) {
        try {
          await sendSMS({
            phone: u.phone,
            countryCode: u.countryCode || '+91',
            message: messageBody
          });
          if (actorId) {
            await logActivity(actorId, 'SMS_NOTICE_SENT', `Notice "${title}" SMS sent to user ${u.name} (${u.phone})`);
          }
        } catch (smsErr) {
          console.error(`Notice SMS send error for ${u.phone}:`, smsErr.message);
          if (actorId) {
            await logActivity(actorId, 'SMS_NOTICE_FAILED', `Failed to send notice SMS to ${u.phone}. Error: ${smsErr.message}`);
          }
        }
      }

      if (u.email) {
        try {
          await sendEmail({
            email: u.email,
            subject: `SmartAttend Notice: ${title}`,
            message: messageBody
          });
          if (actorId) {
            await logActivity(actorId, 'EMAIL_NOTICE_SENT', `Notice "${title}" email sent to user ${u.name} (${u.email})`);
          }
        } catch (emailErr) {
          console.error(`Notice Email send error for ${u.email}:`, emailErr.message);
          if (actorId) {
            await logActivity(actorId, 'EMAIL_NOTICE_FAILED', `Failed to send notice email to ${u.email}. Error: ${emailErr.message}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to dispatch notice broadcast:', err.message);
  }
};

module.exports = {
  sendParentNotification,
  sendNoticeAlert,
};
