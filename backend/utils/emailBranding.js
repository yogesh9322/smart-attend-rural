const Settings = require('../models/Settings');

/**
 * Dynamically retrieves the configured school name from the database.
 * If not configured or DB error occurs, falls back safely to 'SmartAttend Rural'.
 * Never returns a conflicting hardcoded school name.
 * 
 * @returns {Promise<string>}
 */
const getSchoolName = async () => {
  try {
    const settings = await Settings.findOne().select('schoolName');
    if (settings && typeof settings.schoolName === 'string' && settings.schoolName.trim()) {
      return settings.schoolName.trim();
    }
  } catch (err) {
    console.warn('[Email Branding] Failed to query school settings, using fallback:', err.message);
  }

  if (process.env.DEFAULT_SCHOOL_NAME && process.env.DEFAULT_SCHOOL_NAME.trim()) {
    return process.env.DEFAULT_SCHOOL_NAME.trim();
  }

  return 'SmartAttend Rural';
};

/**
 * Resolves the centralized application base URL for links in emails.
 * Uses APP_BASE_URL, FRONTEND_URL, or CLIENT_URL.
 * In production mode, guarantees an HTTPS URL and never outputs localhost.
 * 
 * @returns {string}
 */
const getAppBaseUrl = () => {
  let url = process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.APP_BASE_URL;
  if (url && typeof url === 'string' && url.trim()) {
    url = url.trim().replace(/\/+$/, '');
    // In production, ensure no accidental localhost leakage
    if (process.env.NODE_ENV === 'production' && url.includes('localhost')) {
      return (process.env.PRODUCTION_FRONTEND_URL || process.env.CLIENT_URL || 'https://smart-attend-rural.vercel.app').replace(/\/+$/, '');
    }
    return url;
  }

  if (process.env.NODE_ENV === 'production') {
    return (process.env.PRODUCTION_FRONTEND_URL || process.env.CLIENT_URL || 'https://smart-attend-rural.vercel.app').replace(/\/+$/, '');
  }

  return 'http://localhost:5174';
};

/**
 * Returns consistent email sender details
 */
const getSenderInfo = () => {
  const displayName = (process.env.FROM_NAME || 'SmartAttend Rural').trim();
  const emailAddress = (process.env.EMAIL_FROM || process.env.FROM_EMAIL || process.env.SMTP_EMAIL || 'notifications@smartattend-rural.org').trim();
  return {
    displayName,
    emailAddress,
    formatted: `"${displayName}" <${emailAddress}>`,
  };
};

/**
 * Standard signature string
 * Pattern: [Configured School Name] | Powered by SmartAttend Rural
 */
const getSignatureText = (schoolName) => {
  const name = schoolName && schoolName.trim() ? schoolName.trim() : 'SmartAttend Rural';
  return `${name} | Powered by SmartAttend Rural`;
};

/**
 * Wraps any email body into a standardized, responsive HTML template
 */
const wrapEmailHtml = ({ title, subtitle, schoolName, bodyHtml, actionButton, footerNotes }) => {
  const resolvedSchool = schoolName && schoolName.trim() ? schoolName.trim() : 'SmartAttend Rural';
  const signature = getSignatureText(resolvedSchool);
  const currentYear = new Date().getFullYear();

  const buttonHtml = actionButton && actionButton.url && actionButton.label
    ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${actionButton.url}" target="_blank" rel="noopener noreferrer" style="background-color: #2E7D32; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(46, 125, 50, 0.2);">
          ${actionButton.label}
        </a>
      </div>
      ${actionButton.url ? `
        <p style="color: #94a3b8; font-size: 11px; margin-top: 16px; word-break: break-all;">
          If the button above does not work, copy and paste this link into your browser:<br/>
          <a href="${actionButton.url}" style="color: #2E7D32; text-decoration: underline;">${actionButton.url}</a>
        </p>
      ` : ''}
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'SmartAttend Rural'}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <div style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <div style="background-color: #2E7D32; padding: 28px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">SmartAttend Rural</h1>
            <p style="margin: 6px 0 0 0; font-size: 12px; opacity: 0.9; font-weight: 500; letter-spacing: 0.3px;">
              ${subtitle || 'AI-Powered Attendance & Rural School Management'}
            </p>
          </div>

          <!-- Main Content Area -->
          <div style="padding: 32px 28px; background-color: #ffffff;">
            <!-- School Identity Badge -->
            <div style="margin-bottom: 20px;">
              <span style="display: inline-block; padding: 4px 12px; background-color: #e8f5e9; color: #2E7D32; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.3px;">
                🏫 ${resolvedSchool}
              </span>
            </div>

            ${title ? `<h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 19px; font-weight: 700; line-height: 1.4;">${title}</h2>` : ''}

            <div style="color: #334155; font-size: 14px; line-height: 1.65;">
              ${bodyHtml}
            </div>

            ${buttonHtml}

            ${footerNotes ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; color: #64748b; font-size: 12px; line-height: 1.6;">${footerNotes}</div>` : ''}
          </div>

          <!-- Signature & Footer -->
          <div style="background-color: #f8fafc; padding: 20px 24px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; line-height: 1.6;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #334155; font-size: 13px;">
              ${signature}
            </p>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">
              This is an automated notification. Please do not reply directly to this email.
            </p>
            <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 11px;">
              © ${currentYear} SmartAttend Rural. All rights reserved.
            </p>
          </div>

        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * Formats a clean plain-text email message with consistent headers and signature
 */
const formatPlainTextMessage = ({ greeting, bodyLines, actionUrl, actionLabel, schoolName }) => {
  const resolvedSchool = schoolName && schoolName.trim() ? schoolName.trim() : 'SmartAttend Rural';
  const signature = getSignatureText(resolvedSchool);

  let text = `SmartAttend Rural\n========================================\n\n`;
  if (greeting) {
    text += `${greeting}\n\n`;
  }
  if (Array.isArray(bodyLines)) {
    text += bodyLines.join('\n\n') + '\n\n';
  } else if (bodyLines) {
    text += `${bodyLines}\n\n`;
  }
  if (actionUrl) {
    text += `${actionLabel || 'Access URL'}: ${actionUrl}\n\n`;
  }
  text += `Thank you,\n${signature}`;
  return text;
};

// ==========================================
// WORKFLOW SPECIFIC EMAIL BUILDERS
// ==========================================

/**
 * 1. Password Reset Request Email
 */
const buildPasswordResetEmail = ({ user, resetToken, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const title = 'SmartAttend Password Reset Request';
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Hello <strong>${user.name || 'User'}</strong>,</p>
    <p style="margin: 0 0 16px 0;">You are receiving this email because a password reset was requested for your account at <strong>${resolvedSchool}</strong>.</p>
    <p style="margin: 0 0 16px 0;">Please click the button below to set a new password. This link is valid for <strong>10 minutes</strong>.</p>
  `;

  const footerNotes = `
    <p style="margin: 0;">If you did not request this password reset, please ignore this email and your password will remain safely unchanged.</p>
  `;

  const html = wrapEmailHtml({
    title: 'Password Reset Request',
    subtitle: 'Account Recovery & Authentication',
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: resetUrl,
      label: 'Reset Password',
    },
    footerNotes,
  });

  const message = formatPlainTextMessage({
    greeting: `Hello ${user.name || 'User'},`,
    bodyLines: [
      `You are receiving this email because a password reset was requested for your account at ${resolvedSchool}.`,
      `Please use the link below to set a new password. This link is valid for 10 minutes.`,
      `If you did not request this password reset, please ignore this email.`,
    ],
    actionUrl: resetUrl,
    actionLabel: 'Reset Password Link',
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

/**
 * 2. New Account Credentials (Teacher / Faculty or Parent)
 */
const buildWelcomeCredentialsEmail = ({ user, password, role, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const roleLabel = role === 'teacher' ? 'Faculty Member (Teacher)' : 'Parent';
  const subjectRole = role === 'teacher' ? 'Faculty' : 'Parent';

  const title = `Welcome to SmartAttend - Added as ${subjectRole}`;
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${user.name}</strong>,</p>
    <p style="margin: 0 0 16px 0;">Welcome to <strong>SmartAttend Rural</strong>!</p>
    <p style="margin: 0 0 16px 0;">You have been registered as a <strong>${roleLabel}</strong> at <strong>${resolvedSchool}</strong> by the school administration.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Your Portal Login Credentials</h3>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> <span style="color: #2E7D32;">${user.email}</span></p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Temporary Password:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password}</span></p>
    </div>
    <p style="margin: 0 0 16px 0;">Please log in to your dashboard to review your active dashboard, configure profile details, and access school attendance services.</p>
  `;

  const html = wrapEmailHtml({
    title: `Welcome to ${resolvedSchool}`,
    subtitle: `New ${subjectRole} Account Created`,
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: loginUrl,
      label: 'Log In to SmartAttend',
    },
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${user.name},`,
    bodyLines: [
      `Welcome to SmartAttend Rural!`,
      `You have been registered as a ${roleLabel} at ${resolvedSchool} by the school administration.`,
      `Here are your login credentials to access your dashboard:\nEmail: ${user.email}\nPassword: ${password}`,
      `Please log in to your portal to get started.`,
    ],
    actionUrl: loginUrl,
    actionLabel: 'Login Portal',
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

/**
 * 3. Class Standard Assignment Email (Teacher)
 */
const buildClassAssignmentEmail = ({ teacher, schoolClass, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const title = 'SmartAttend - New Class Standard Assigned';
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${teacher.name}</strong>,</p>
    <p style="margin: 0 0 16px 0;">We would like to inform you that you have been assigned as the class teacher for the following class at <strong>${resolvedSchool}</strong>:</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>Grade:</strong> ${schoolClass.grade}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Section:</strong> ${schoolClass.section}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Room No:</strong> ${schoolClass.roomNo || 'N/A'}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Academic Year:</strong> ${schoolClass.academicYear}</p>
    </div>
    <p style="margin: 0 0 16px 0;">Please log in to your teacher dashboard to manage attendance, student registers, and review student leave applications.</p>
  `;

  const html = wrapEmailHtml({
    title: 'Class Assignment Notification',
    subtitle: 'Teacher Rosters & Responsibilities',
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: loginUrl,
      label: 'Open Teacher Dashboard',
    },
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${teacher.name},`,
    bodyLines: [
      `We would like to inform you that you have been assigned as the class teacher for the following class at ${resolvedSchool}:`,
      `Class: ${schoolClass.grade}\nSection: ${schoolClass.section}\nRoom No: ${schoolClass.roomNo || 'N/A'}\nAcademic Year: ${schoolClass.academicYear}`,
      `Please log in to manage attendance, student registers, and review student leave requests.`,
    ],
    actionUrl: loginUrl,
    actionLabel: 'Login Portal',
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

/**
 * 4. Class Standard Details Updated Email (Teacher)
 */
const buildClassEditEmail = ({ teacher, oldClass, newClass, changes, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const title = `SmartAttend - Class Details Updated (${newClass.grade}-${newClass.section})`;
  const changesList = changes.map(c => `<li style="margin: 4px 0;">${c.replace(/^- /, '')}</li>`).join('');

  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${teacher.name}</strong>,</p>
    <p style="margin: 0 0 16px 0;">We would like to inform you that the details of your assigned class at <strong>${resolvedSchool}</strong> have been updated by the administration:</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <ul style="margin: 0; padding-left: 20px; color: #334155;">
        ${changesList}
      </ul>
    </div>
    <p style="margin: 0 0 16px 0;">Please log in to your portal to review your active student rosters.</p>
  `;

  const html = wrapEmailHtml({
    title: `Class Details Updated (${newClass.grade}-${newClass.section})`,
    subtitle: 'Class Standard Updates',
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: loginUrl,
      label: 'Review Class Rosters',
    },
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${teacher.name},`,
    bodyLines: [
      `We would like to inform you that the details of your assigned class standard at ${resolvedSchool} have been updated by the administration:`,
      changes.join('\n'),
      `Please log in to review your active student rosters.`,
    ],
    actionUrl: loginUrl,
    actionLabel: 'Login Portal',
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

/**
 * 5. Attendance Alert Email (Parent)
 */
const buildAttendanceAlertEmail = ({ parentName, studentName, status, dateStr, teacherDetails, schoolName }) => {
  const resolvedSchool = schoolName || 'SmartAttend Rural';
  const title = `SmartAttend: Attendance Alert - ${studentName} is ${status}`;

  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${parentName || 'Parent'}</strong>,</p>
    <p style="margin: 0 0 16px 0;">Your child, <strong>${studentName}</strong>, was recorded as <span style="display: inline-block; padding: 2px 8px; background-color: #fee2e2; color: #b91c1c; border-radius: 4px; font-weight: 700;">${status.toUpperCase()}</span> on <strong>${dateStr}</strong> at <strong>${resolvedSchool}</strong>.</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #ef4444; border-radius: 4px; padding: 12px 16px; margin: 16px 0;">
      <p style="margin: 0; font-size: 13px; color: #475569;">
        If this absence was unexpected or you need to submit a leave certificate, please contact the class teacher:<br/>
        <strong style="color: #1e293b;">${teacherDetails || 'School Administration'}</strong>
      </p>
    </div>
    <p style="margin: 0;">Regular attendance is critical for student success. Please connect with the school if assistance is required.</p>
  `;

  const html = wrapEmailHtml({
    title: `Attendance Notification: ${studentName}`,
    subtitle: 'Daily Attendance Alert',
    schoolName: resolvedSchool,
    bodyHtml,
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${parentName || 'Parent'},`,
    bodyLines: [
      `Your child, ${studentName}, was marked ${status} on ${dateStr} at ${resolvedSchool}.`,
      `If this absence was unexpected, please contact the class teacher: ${teacherDetails || 'School Administration'}.`,
    ],
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

/**
 * 6. Leave Request Submitted Email (Teacher & Admin)
 */
const buildLeaveCreatedEmail = ({ recipientName, recipientRole, studentName, classStr, fromStr, toStr, reason, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const title = `📩 New Leave Request: ${studentName}`;
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${recipientName || recipientRole}</strong>,</p>
    <p style="margin: 0 0 16px 0;">A new student leave request has been submitted by the parent at <strong>${resolvedSchool}</strong>:</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>Student:</strong> ${studentName}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Class:</strong> ${classStr}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Leave Duration:</strong> ${fromStr} to ${toStr}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Reason:</strong> "${reason || 'Not specified'}"</p>
    </div>
    <p style="margin: 0 0 16px 0;">Please review this leave application in your dashboard to approve or reject the request.</p>
  `;

  const html = wrapEmailHtml({
    title: `New Leave Request: ${studentName}`,
    subtitle: 'Student Leave Management',
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: loginUrl,
      label: 'Review Leave Application',
    },
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${recipientName || recipientRole},`,
    bodyLines: [
      `A new student leave application has been submitted for ${studentName} (${classStr}) at ${resolvedSchool}.`,
      `Duration: ${fromStr} to ${toStr}\nReason: "${reason || 'Not specified'}"`,
      `Please log in to your portal to review and process this leave request.`,
    ],
    actionUrl: loginUrl,
    actionLabel: 'Leave Management Portal',
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

/**
 * 7. Leave Request Status Updated Email (Parent)
 */
const buildLeaveStatusEmail = ({ parentName, childName, fromStr, toStr, status, approverName, remarks, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const isApproved = String(status).toLowerCase() === 'approved';
  const statusColor = isApproved ? '#2E7D32' : '#b91c1c';
  const statusBg = isApproved ? '#e8f5e9' : '#fee2e2';

  const title = `SmartAttend: Leave Request ${status} for ${childName}`;
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${parentName || 'Parent'}</strong>,</p>
    <p style="margin: 0 0 16px 0;">The leave application for <strong>${childName}</strong> from <strong>${fromStr}</strong> to <strong>${toStr}</strong> at <strong>${resolvedSchool}</strong> has been reviewed:</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> <span style="display: inline-block; padding: 2px 8px; background-color: ${statusBg}; color: ${statusColor}; border-radius: 4px; font-weight: 700;">${status.toUpperCase()}</span></p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Reviewed By:</strong> ${approverName || 'School Administration'}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Remarks:</strong> "${remarks || 'None'}"</p>
    </div>
    <p style="margin: 0 0 16px 0;">You can log in to your parent dashboard to view complete leave history and child attendance records.</p>
  `;

  const html = wrapEmailHtml({
    title: `Leave Request ${status}: ${childName}`,
    subtitle: 'Leave Status Notification',
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: loginUrl,
      label: 'View in Parent Dashboard',
    },
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${parentName || 'Parent'},`,
    bodyLines: [
      `The leave application for ${childName} from ${fromStr} to ${toStr} has been ${status.toUpperCase()} by ${approverName || 'School Administration'} at ${resolvedSchool}.`,
      `Status: ${status.toUpperCase()}\nRemarks: "${remarks || 'None'}"`,
    ],
    actionUrl: loginUrl,
    actionLabel: 'Parent Dashboard',
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

/**
 * 8. Notice Alert Email (Broadcast to Teachers / Parents)
 */
const buildNoticeAlertEmail = ({ recipientName, title, content, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const subject = `SmartAttend Notice: ${title}`;
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${recipientName || 'Member'}</strong>,</p>
    <p style="margin: 0 0 16px 0;">A new official announcement has been published by the administration at <strong>${resolvedSchool}</strong>:</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2E7D32; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px; font-weight: 700;">${title}</h3>
      <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${content || 'Please check the notice board for details.'}</div>
    </div>
    <p style="margin: 0 0 16px 0;">Please log in to your portal to view all active school notices and calendar schedules.</p>
  `;

  const html = wrapEmailHtml({
    title: `School Announcement: ${title}`,
    subtitle: 'Official School Notice',
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: loginUrl,
      label: 'Open Notice Board',
    },
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${recipientName || 'Member'},`,
    bodyLines: [
      `A new official notice has been published by the administration at ${resolvedSchool}:`,
      `Title: "${title}"\nDescription: ${content || 'Please check notice board'}`,
    ],
    actionUrl: loginUrl,
    actionLabel: 'Notice Board',
    schoolName: resolvedSchool,
  });

  return {
    subject,
    html,
    message,
  };
};

/**
 * 9. Profile Details Updated Email (Parent)
 */
const buildProfileUpdateEmail = ({ parentName, changes, schoolName, appBaseUrl }) => {
  const baseUrl = appBaseUrl || getAppBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const resolvedSchool = schoolName || 'SmartAttend Rural';

  const title = 'SmartAttend - Profile Details Updated';
  const changesList = changes.map(c => `<li style="margin: 4px 0;">${c.replace(/^- /, '')}</li>`).join('');

  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Dear <strong>${parentName || 'Parent'}</strong>,</p>
    <p style="margin: 0 0 16px 0;">We would like to inform you that your profile details at <strong>${resolvedSchool}</strong> have been updated by the school administration:</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <ul style="margin: 0; padding-left: 20px; color: #334155;">
        ${changesList}
      </ul>
    </div>
    <p style="margin: 0 0 16px 0;">Please log in to your dashboard to review your active details.</p>
  `;

  const html = wrapEmailHtml({
    title: 'Profile Details Updated',
    subtitle: 'Account Information Update',
    schoolName: resolvedSchool,
    bodyHtml,
    actionButton: {
      url: loginUrl,
      label: 'Review Profile Details',
    },
  });

  const message = formatPlainTextMessage({
    greeting: `Dear ${parentName || 'Parent'},`,
    bodyLines: [
      `We would like to inform you that your profile details have been updated by the school administration at ${resolvedSchool}:`,
      changes.join('\n'),
      `Please log in to review the changes.`,
    ],
    actionUrl: loginUrl,
    actionLabel: 'Login Portal',
    schoolName: resolvedSchool,
  });

  return {
    subject: title,
    html,
    message,
  };
};

module.exports = {
  getSchoolName,
  getAppBaseUrl,
  getSenderInfo,
  getSignatureText,
  wrapEmailHtml,
  formatPlainTextMessage,
  // Workflows
  buildPasswordResetEmail,
  buildWelcomeCredentialsEmail,
  buildClassAssignmentEmail,
  buildClassEditEmail,
  buildAttendanceAlertEmail,
  buildLeaveCreatedEmail,
  buildLeaveStatusEmail,
  buildNoticeAlertEmail,
  buildProfileUpdateEmail,
};
