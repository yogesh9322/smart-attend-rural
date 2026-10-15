const Settings = require('../models/Settings');

/**
 * Get configured school timezone (from Settings, or process.env.TIMEZONE, default 'Asia/Kolkata')
 */
const getSchoolTimezone = async () => {
  try {
    const settings = await Settings.findOne().select('timezone');
    return settings?.timezone || process.env.TIMEZONE || 'Asia/Kolkata';
  } catch (err) {
    return process.env.TIMEZONE || 'Asia/Kolkata';
  }
};

/**
 * Format a Date or timestamp to YYYY-MM-DD string in the given timezone
 */
const getLocalDateString = (date = new Date(), timezone = 'Asia/Kolkata') => {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/**
 * Given a YYYY-MM-DD string, return UTC date boundaries:
 * startOfDay: YYYY-MM-DDT00:00:00.000Z
 * endOfDay: YYYY-MM-DDT23:59:59.999Z
 * nextDay: (YYYY-MM-DD + 1)T00:00:00.000Z
 */
const getUtcBoundariesForDateStr = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  return { startOfDay, endOfDay, nextDay, dateStr };
};

/**
 * Check if a dateStr (YYYY-MM-DD) is scheduled for classes
 * Checks weeklyOffs and holidays from settings
 */
const isDateScheduled = (dateStr, settings = {}, timezone = 'Asia/Kolkata') => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay(); // 0: Sunday, 1: Monday, ...

  const weeklyOffs = settings.weeklyOffs || [0];
  if (weeklyOffs.includes(dayOfWeek)) {
    return false;
  }

  const holidays = settings.holidays || [];
  for (const h of holidays) {
    if (!h.date) continue;
    const hStr = getLocalDateString(h.date, timezone);
    if (hStr === dateStr) {
      return false;
    }
  }

  return true;
};

/**
 * Format a timestamp into local school time, e.g. "09:30 AM"
 */
const formatSchoolTime = (timestamp, timezone = 'Asia/Kolkata') => {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

module.exports = {
  getSchoolTimezone,
  getLocalDateString,
  getUtcBoundariesForDateStr,
  isDateScheduled,
  formatSchoolTime,
};
