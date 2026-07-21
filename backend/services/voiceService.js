/**
 * Translates verbal command transcripts into routing paths and actionable requests
 */

const matchVoiceCommand = (transcript, role) => {
  const query = (transcript || '').toLowerCase();
  
  if (role === 'teacher') {
    if (query.includes('mark') || query.includes('attendance') || query.includes('नोंदवा')) {
      return { action: 'REDIRECT', path: '/attendance/mark', message: 'Opening attendance registration screen.' };
    }
    if (query.includes('report') || query.includes('history') || query.includes('अहवाल')) {
      return { action: 'REDIRECT', path: '/attendance/history', message: 'Opening class history ledger.' };
    }
  }

  if (role === 'parent') {
    if (query.includes('attendance') || query.includes('calendar') || query.includes('उपस्थिती')) {
      return { action: 'REDIRECT', path: '/attendance/calendar', message: 'Opening attendance calendar grid.' };
    }
    if (query.includes('leave') || query.includes('request') || query.includes('रजा')) {
      return { action: 'REDIRECT', path: '/leave-request', message: 'Opening leave request form.' };
    }
  }

  if (role === 'admin') {
    if (query.includes('report') || query.includes('generate') || query.includes('रिपोर्ट')) {
      return { action: 'REDIRECT', path: '/advanced-reports', message: 'Opening reports generation page.' };
    }
    if (query.includes('event') || query.includes('create') || query.includes('कार्यक्रम')) {
      return { action: 'REDIRECT', path: '/events', message: 'Opening events publisher.' };
    }
  }

  // Default fallback
  return { action: 'CHAT', path: null, message: 'Command processed. Let me answer that through chat!' };
};

module.exports = {
  matchVoiceCommand,
};
