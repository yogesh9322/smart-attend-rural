import axios from 'axios';

const getBaseApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return url.replace('localhost', window.location.hostname);
    }
    return url;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${hostname}:5000/api`;
};

const API_URL = getBaseApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let currentTabToken = null;
let currentTabUser = null;

export const setTabAuthContext = (token, user) => {
  if (token) {
    currentTabToken = token;
    try {
      sessionStorage.setItem('token', token);
      localStorage.setItem('token', token);
    } catch {}
  }
  if (user) {
    currentTabUser = user;
    try {
      sessionStorage.setItem('smartattend_user', JSON.stringify(user));
      localStorage.setItem('smartattend_user', JSON.stringify(user));
    } catch {}
  }
};

export const clearTabAuthContext = () => {
  currentTabToken = null;
  currentTabUser = null;
  try {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('smartattend_user');
    localStorage.removeItem('token');
    localStorage.removeItem('smartattend_user');
  } catch {}
};

// Intercept requests to inject the JWT token and active tab user context automatically
api.interceptors.request.use(
  (config) => {
    const token =
      currentTabToken ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    let activeUser = currentTabUser;
    if (!activeUser) {
      try {
        const raw = sessionStorage.getItem('smartattend_user') || localStorage.getItem('smartattend_user');
        if (raw) activeUser = JSON.parse(raw);
      } catch {}
    }

    if (activeUser?.email) {
      config.headers['X-User-Email'] = activeUser.email;
    }
    if (activeUser?.role) {
      config.headers['X-User-Role'] = activeUser.role;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth endpoints
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const googleLoginApi = async (credential) => {
  const response = await api.post('/auth/google', { credential });
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('/auth/profile');
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgotpassword', { email });
  return response.data;
};

export const resetPassword = async (token, password) => {
  const response = await api.put(`/auth/resetpassword/${token}`, { password });
  return response.data;
};

// Classes endpoints
export const getClasses = async () => {
  const response = await api.get('/classes');
  return response.data;
};

export const getClassDetails = async (classId) => {
  const response = await api.get(`/classes/${classId}`);
  return response.data;
};

export const createClass = async (classData) => {
  const response = await api.post('/classes', classData);
  return response.data;
};

// Students endpoints
export const getStudents = async (filters = {}) => {
  const response = await api.get('/students', { params: filters });
  return response.data;
};

export const getStudentDetails = async (id) => {
  const response = await api.get(`/students/${id}`);
  return response.data;
};

export const createStudent = async (studentFormData) => {
  const response = await api.post('/students', studentFormData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const updateStudent = async (id, studentFormData) => {
  const response = await api.put(`/students/${id}`, studentFormData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteStudent = async (id) => {
  const response = await api.delete(`/students/${id}`);
  return response.data;
};

// Attendance endpoints
export const markAttendance = async (attendanceData) => {
  const response = await api.post('/attendance', attendanceData);
  return response.data;
};

export const getAttendanceReport = async (filters = {}) => {
  const response = await api.get('/attendance', { params: filters });
  return response.data;
};

export const getStudentTodayStatus = async (studentId) => {
  const response = await api.get(`/attendance/student-today/${studentId}`);
  return response.data;
};

export const getStudentReportData = async (params = {}) => {
  const response = await api.get('/attendance/student-report', { params });
  return response.data;
};

export const downloadStudentReportCSV = async (params = {}) => {
  const response = await api.get('/attendance/student-report', {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });
  return response;
};

export const downloadAttendanceExport = async (params = {}) => {
  const response = await api.get('/attendance/export-history', {
    params,
    responseType: 'blob',
  });
  return response;
};

export const downloadAttendanceHistoryExport = downloadAttendanceExport;

export const getDashboardStats = async (params = {}) => {
  const response = await api.get('/attendance/stats', { params });
  return response.data;
};

export const getSchoolSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

// Notices endpoints
export const getNotices = async (params = {}) => {
  const response = await api.get('/notices', { params });
  return response.data;
};

export const markNoticeRead = async (id) => {
  const response = await api.put(`/notices/${id}/read`);
  return response.data;
};

export const getAdminNotices = async (params = {}) => {
  const response = await api.get('/notices/admin', { params });
  return response.data;
};

export const createAdminNotice = async (noticeData) => {
  const response = await api.post('/notices/admin', noticeData);
  return response.data;
};

export const updateAdminNotice = async (id, noticeData) => {
  const response = await api.put(`/notices/admin/${id}`, noticeData);
  return response.data;
};

export const deleteAdminNotice = async (id) => {
  const response = await api.delete(`/notices/admin/${id}`);
  return response.data;
};

export const getTeacherNotices = async (params = {}) => {
  const response = await api.get('/notices/teacher', { params });
  return response.data;
};

export const createTeacherNotice = async (noticeData) => {
  const response = await api.post('/notices/teacher', noticeData);
  return response.data;
};

export const updateTeacherNotice = async (id, noticeData) => {
  const response = await api.put(`/notices/teacher/${id}`, noticeData);
  return response.data;
};

export const deleteTeacherNotice = async (id) => {
  const response = await api.delete(`/notices/teacher/${id}`);
  return response.data;
};

export const getParentNotices = async (params = {}) => {
  const response = await api.get('/notices/parent', { params });
  return response.data;
};

export const createNotice = createAdminNotice;
export const deleteNotice = deleteAdminNotice;

// Leave Requests endpoints
export const getLeaveRequests = async () => {
  const response = await api.get('/leaves');
  return response.data;
};

export const createLeaveRequest = async (leaveData) => {
  const response = await api.post('/leaves', leaveData);
  return response.data;
};

export const updateLeaveStatus = async (id, statusData) => {
  const response = await api.put(`/leaves/${id}`, statusData);
  return response.data;
};

// Parent Teacher Contact endpoints
export const getTeacherContact = async (studentId) => {
  const response = await api.get(`/parent/teacher-contact/${studentId}`);
  return response.data;
};

// School Events endpoints
export const getSchoolEvents = async () => {
  const response = await api.get('/events');
  return response.data;
};

export const createSchoolEvent = async (eventData) => {
  const response = await api.post('/events', eventData);
  return response.data;
};

export const updateSchoolEvent = async (id, eventData) => {
  const response = await api.put(`/events/${id}`, eventData);
  return response.data;
};

export const deleteSchoolEvent = async (id) => {
  const response = await api.delete(`/events/${id}`);
  return response.data;
};

// Analytics endpoints
export const getDashboardAnalytics = async () => {
  const response = await api.get('/analytics/dashboard');
  return response.data;
};

// Global Search endpoint
export const globalSearch = async (query) => {
  const response = await api.get(`/search?q=${query}`);
  return response.data;
};

// User Profile & Password updates
export const updateProfile = async (profileData) => {
  const response = await api.put('/auth/profile', profileData);
  return response.data;
};

export const changePassword = async (passwordData) => {
  const response = await api.put('/auth/changepassword', passwordData);
  return response.data;
};

// AI endpoints
export const getAIChatResponse = async (chatData) => {
  const response = await api.post('/ai/chat', chatData);
  return response.data;
};

export const getAISummary = async (langData) => {
  const response = await api.post('/ai/summary', langData);
  return response.data;
};

export const getAIChatHistory = async () => {
  const response = await api.get('/ai/history');
  return response.data;
};

export const clearAIChatHistory = async () => {
  const response = await api.delete('/ai/history');
  return response.data;
};

export const createNotification = async (notifData) => {
  const response = await api.post('/notifications', notifData);
  return response.data;
};

export const getConversations = async () => {
  const response = await api.get('/notifications/conversations');
  return response.data;
};

export const getAIInsights = async (lang) => {
  const response = await api.get(`/ai/insights?lang=${lang || 'en'}`);
  return response.data;
};

export const predictStudentAttendance = async (studentId) => {
  const response = await api.post('/ai/predict', { studentId });
  return response.data;
};

export const generateAIReport = async () => {
  const response = await api.post('/ai/report');
  return response.data;
};

export const generateAINotice = async (text) => {
  const response = await api.post('/ai/notice', { text });
  return response.data;
};

export const translateNotice = async (text) => {
  const response = await api.post('/ai/translate', { text });
  return response.data;
};

export const parseLeaveDocumentOCR = async (formData) => {
  const response = await api.post('/ai/ocr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const executeNaturalLanguageSearch = async (query) => {
  const response = await api.post('/ai/search', { query });
  return response.data;
};

export const processVoiceQuery = async (transcript) => {
  const response = await api.post('/ai/voice', { transcript });
  return response.data;
};

export const getAIRecommendations = async () => {
  const response = await api.get('/ai/recommendations');
  return response.data;
};

// Missing Notification API calls
export const getNotifications = async () => {
  const response = await api.get('/notifications');
  return response.data;
};

export const markNotificationAsRead = async (id) => {
  const response = await api.put(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.put('/notifications/read-all');
  return response.data;
};

export const deleteNotificationApi = async (id) => {
  const response = await api.delete(`/notifications/${id}`);
  return response.data;
};

// Settings configurations & activity logs
export const updateSchoolSettings = async (settingsData) => {
  const response = await api.put('/settings', settingsData);
  return response.data;
};

export const getActivityLogs = async (params = {}) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  );
  const queryStr = new URLSearchParams(cleanParams).toString();
  const response = await api.get(`/settings/logs${queryStr ? `?${queryStr}` : ''}`);
  return response.data;
};

// File uploads
export const uploadAvatar = async (formData) => {
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// Teacher management
export const getTeachersList = async () => {
  const response = await api.get('/auth/teachers');
  return response.data;
};

export const registerTeacher = async (teacherData) => {
  const response = await api.post('/auth/register', teacherData);
  return response.data;
};

export const updateTeacher = async (id, teacherData) => {
  const response = await api.put(`/auth/teachers/${id}`, teacherData);
  return response.data;
};

export const toggleTeacherStatus = async (id) => {
  const response = await api.put(`/auth/teachers/${id}/toggle-status`);
  return response.data;
};

export const resetTeacherPassword = async (id, passwordData) => {
  const response = await api.put(`/auth/teachers/${id}/reset-password`, passwordData);
  return response.data;
};

export const deleteTeacher = async (id) => {
  const response = await api.delete(`/auth/teachers/${id}`);
  return response.data;
};

// Parent management
export const getParentsList = async () => {
  const response = await api.get('/parents');
  return response.data;
};

export const getParentDetails = async (id) => {
  const response = await api.get(`/parents/${id}`);
  return response.data;
};

export const createParent = async (parentData) => {
  const response = await api.post('/parents', parentData);
  return response.data;
};

export const updateParent = async (id, parentData) => {
  const response = await api.put(`/parents/${id}`, parentData);
  return response.data;
};

export const deleteParent = async (id) => {
  const response = await api.delete(`/parents/${id}`);
  return response.data;
};

export const linkChildToParent = async (parentId, studentId) => {
  const response = await api.post(`/parents/${parentId}/link-child`, { studentId });
  return response.data;
};

export const unlinkChildFromParent = async (parentId, studentId) => {
  const response = await api.post(`/parents/${parentId}/unlink-child`, { studentId });
  return response.data;
};

export const toggleParentStatus = async (id) => {
  const response = await api.put(`/parents/${id}/toggle-status`);
  return response.data;
};

export const resetParentPassword = async (id, passwordData) => {
  const response = await api.put(`/parents/${id}/reset-password`, passwordData);
  return response.data;
};

// Class standard management
export const updateClass = async (id, classData) => {
  const response = await api.put(`/classes/${id}`, classData);
  return response.data;
};

export const assignClassTeacher = async (classId, teacherId) => {
  const response = await api.put(`/classes/${classId}/assign-teacher`, {
    classTeacherId: teacherId,
    teacherId,
  });
  return response.data;
};

export const transferStudents = async (classId, targetClassId) => {
  const response = await api.put(`/classes/${classId}/transfer-students`, { targetClassId });
  return response.data;
};

export const archiveClass = async (classId) => {
  const response = await api.put(`/classes/${classId}/archive`);
  return response.data;
};

export const getParentsAuthList = async () => {
  const response = await api.get('/auth/parents');
  return response.data;
};

export default api;
