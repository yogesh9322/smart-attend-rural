import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import AIChatWindow from '../components/AIChatWindow';
import AISmartSearch from '../components/AI/AISmartSearch';
import {
  getStudents,
  getClasses,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationApi,
  createNotification,
  globalSearch
} from '../services/api';
import socket from '../services/socket';
import {
  FaSchool,
  FaGraduationCap,
  FaChalkboardTeacher,
  FaCalendarCheck,
  FaFileAlt,
  FaBullhorn,
  FaSignOutAlt,
  FaBars,
  FaBell,
  FaTimes,
  FaWifi,
  FaCloudUploadAlt,
  FaUserCircle,
  FaCog,
  FaSearch,
  FaClock,
  FaChartLine,
  FaChalkboard,
  FaCheckDouble,
  FaTrash,
  FaComments,
  FaMicrophone,
  FaVolumeUp,
  FaPaperPlane,
  FaSpinner,
  FaUsers,
  FaCalendarAlt,
  FaRobot,
  FaSun,
  FaMoon,
  FaReply,
  FaCheck
} from 'react-icons/fa';

const MainLayout = ({ children }) => {
  const { user, logoutUser } = useAuth();
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();

  // Notification Feeds
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Language Dropdown Control
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  // Global Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchCache, setSearchCache] = useState([]);

  // AI Chat Assistant State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'ai', text: t('ai.welcome') }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  // Reply Modal States
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyToUser, setReplyToUser] = useState(null); // { id: '...', name: '...' }
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const handleOpenReply = (e, notif) => {
    e.stopPropagation();
    const parentId = notif.senderId?._id || notif.senderId;
    const parentName = notif.senderId?.name || 'Parent';
    setReplyToUser({ id: parentId, name: parentName, notifId: notif._id });
    setReplySubject(`Reply to: ${notif.title}`);
    setReplyMessage('');
    setReplyModalOpen(true);
    setNotifOpen(false); // Close dropdown
  };

  const handleSendReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyMessage) return;
    try {
      setReplyLoading(true);
      await createNotification({
        userId: replyToUser.id,
        title: `Reply from Teacher (${user?.name})`,
        message: replyMessage,
        category: 'user'
      });

      // Automatically mark the original parent notification as read
      if (replyToUser.notifId) {
        await handleMarkAsRead(replyToUser.notifId);
      }

      setReplyModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setReplyLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    if (chatOpen) scrollToBottom();
  }, [chatMessages, chatOpen]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      if (data.success) {
        setNotifications(data.data);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.log('Notifications fetch failed.');
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleNewNotif = (notif) => {
      // Only process if it belongs to this user or is global
      const thisUserId = user?.id || user?._id;
      if (!notif.userId || notif.userId === thisUserId) {
        setNotifications((prev) => {
          if (prev.some((n) => n._id === notif._id)) return prev;
          return [notif, ...prev].slice(0, 50);
        });
        if (!notif.isRead) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    };

    socket.on('notification_received', handleNewNotif);

    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      clearInterval(interval);
      socket.off('notification_received', handleNewNotif);
    };
  }, [user]);

  // Sync welcome message on language change
  useEffect(() => {
    setChatMessages((prev) => {
      const copy = [...prev];
      if (copy.length > 0 && copy[0].id === 1) {
        copy[0].text = t('ai.welcome');
      }
      return copy;
    });
  }, [t]);

  // Hydrate search cache for Admin users
  useEffect(() => {
    const hydrateSearchCache = async () => {
      if (user?.role !== 'admin') return;
      try {
        const cache = [];

        // 1. Fetch Students
        const studentsRes = await getStudents();
        if (studentsRes.success) {
          studentsRes.data.forEach((s) => {
            cache.push({
              id: s._id,
              name: s.name,
              type: 'student',
              sub: `Roll ${s.rollNo} • ${s.classId?.grade || 'Class'}-${s.classId?.section || ''}`,
              path: `/students?search=${encodeURIComponent(s.name)}`
            });
          });
        }

        // 2. Fetch Classes
        const classesRes = await getClasses();
        if (classesRes.success) {
          classesRes.data.forEach((c) => {
            cache.push({
              id: c._id,
              name: `${c.grade} - ${c.section}`,
              type: 'class',
              sub: `Room ${c.roomNo || 'N/A'}`,
              path: `/classes?search=${encodeURIComponent(c.grade)}`
            });
          });
        }

        setSearchCache(cache);
      } catch (err) {
        console.log('Search cache hydration pending...');
      }
    };

    hydrateSearchCache();
  }, [user]);

  const handleGlobalSearch = async (val) => {
    setGlobalSearch(val);
    if (!val.trim() || val.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const resData = await globalSearch(val);
      if (resData.success) {
        const results = [];
        const data = resData.data;
        
        if (data.students) {
          data.students.forEach((s) => {
            results.push({
              id: s._id,
              name: s.name,
              type: 'Student',
              sub: `Roll: ${s.rollNo} • Standard: ${s.classId?.grade || 'N/A'}-${s.classId?.section || 'N/A'}`,
              path: user?.role === 'parent' ? '/my-children' : '/students'
            });
          });
        }
        if (data.teachers) {
          data.teachers.forEach((t) => {
            results.push({
              id: t._id,
              name: t.name,
              type: 'Teacher',
              sub: t.email,
              path: user?.role === 'parent' ? '/contact-teacher' : '/profile'
            });
          });
        }
        if (data.notices) {
          data.notices.forEach((n) => {
            results.push({
              id: n._id,
              name: n.title,
              type: 'Announcement',
              sub: n.content.slice(0, 30),
              path: '/notices'
            });
          });
        }
        if (data.events) {
          data.events.forEach((e) => {
            results.push({
              id: e._id,
              name: e.title,
              type: 'School Event',
              sub: e.description.slice(0, 30),
              path: user?.role === 'admin' ? '/events' : '/school-events'
            });
          });
        }

        setSearchResults(results.slice(0, 5));
      }
    } catch (err) {
      console.error('Global search error:', err);
    }
  };

  const handleSelectSearchResult = (item) => {
    setGlobalSearch('');
    setSearchResults([]);
    navigate(item.path);
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      await markAllNotificationsAsRead();
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNotif = async (id) => {
    try {
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      await deleteNotificationApi(id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await markNotificationAsRead(id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await handleMarkAsRead(notif._id);
    }
    if (notif.category === 'user' && user?.role === 'parent') {
      navigate('/contact-teacher');
    } else if (notif.category === 'leave') {
      navigate('/leave-request');
    }
    setNotifOpen(false);
  };

  // Text-To-Speech (Vocalization)
  const speakResponse = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // stop any active speech
      const utterance = new SpeechSynthesisUtterance(text);
      // Map voices based on active language
      const langCodes = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' };
      utterance.lang = langCodes[i18n.language] || 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speech-To-Text (Voice Recognition Input)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Speech Recognition not supported.");
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    const langCodes = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' };
    recognition.lang = langCodes[i18n.language] || 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    setIsListening(true);
    recognition.start();

    // Set a safety timeout to keep listening open for up to 5 seconds
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      handleStopListening();
    }, 5000);

    recognition.onresult = (event) => {
      let liveText = '';
      for (let i = 0; i < event.results.length; i++) {
        liveText += event.results[i][0].transcript;
      }
      setChatInput(liveText);
    };

    recognition.onerror = (err) => {
      console.error('Speech recognition error:', err.error);
      handleStopListening();
      if (err.error === 'not-allowed') {
        alert("Microphone permission denied! Please click the lock icon in the URL address bar and change Microphone to 'Allow'.");
      }
    };

    recognition.onend = () => {
      handleStopListening();
    };
  };

  const handleStopListening = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // already stopped
      }
    }
    setIsListening(false);
  };

  // Send message to AI Chat Assistant
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text: userMessage }]);

    // Check offline state
    if (!isOnline) {
      setChatMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: 'ai', text: t('ai.offline') }
      ]);
      speakResponse(t('ai.offline'));
      return;
    }

    try {
      setAiLoading(true);
      const data = await getAIChatResponse({ message: userMessage, lang: i18n.language });
      if (data.success) {
        setChatMessages((prev) => [
          ...prev,
          { id: Date.now(), sender: 'ai', text: data.reply }
        ]);
        speakResponse(data.reply);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const getLinks = () => {
    const common = [
      { name: t('nav.dashboard'), path: '/', icon: <FaSchool /> },
      { name: t('nav.notices'), path: '/notices', icon: <FaBullhorn /> },
    ];

    if (user?.role === 'admin') {
      return [
        { name: t('nav.dashboard'), path: '/', icon: <FaSchool /> },
        { name: 'School Notices', path: '/notices', icon: <FaBullhorn /> },
        { name: t('nav.students'), path: '/students', icon: <FaGraduationCap /> },
        { name: t('nav.teachers'), path: '/teachers', icon: <FaChalkboardTeacher /> },
        { name: t('nav.parents'), path: '/parents', icon: <FaUserCircle /> },
        { name: t('nav.classes'), path: '/classes', icon: <FaSchool /> },
        { name: t('nav.leave_request'), path: '/leave-request', icon: <FaPaperPlane /> },
        { name: 'Attendance Insights', path: '/ai-analytics', icon: <FaChartLine /> },
        { name: 'School Calendar', path: '/school-calendar', icon: <FaCalendarAlt /> },
        { name: 'Manage Events', path: '/events', icon: <FaCalendarAlt /> },
        { name: 'Advanced Reports', path: '/advanced-reports', icon: <FaFileAlt /> },
        { name: t('nav.settings'), path: '/settings', icon: <FaCog /> },
        { name: t('nav.profile'), path: '/profile', icon: <FaUserCircle /> },
      ];
    }

    if (user?.role === 'teacher') {
      return [
        { name: t('nav.dashboard'), path: '/', icon: <FaSchool /> },
        { name: t('nav.my_classes'), path: '/my-classes', icon: <FaChalkboard /> },
        { name: t('nav.attendance'), path: '/attendance/mark', icon: <FaCalendarCheck /> },
        { name: t('nav.history'), path: '/attendance/history', icon: <FaFileAlt /> },
        { name: t('nav.students'), path: '/students', icon: <FaGraduationCap /> },
        { name: t('nav.leave_request'), path: '/leave-request', icon: <FaPaperPlane /> },
        { name: 'Attendance Insights', path: '/ai-analytics', icon: <FaChartLine /> },
        { name: 'School Calendar', path: '/school-calendar', icon: <FaCalendarAlt /> },
        { name: 'Advanced Reports', path: '/advanced-reports', icon: <FaFileAlt /> },
        { name: 'Class Notices', path: '/notices', icon: <FaBullhorn /> },
        { name: t('nav.timetable'), path: '/timetable', icon: <FaClock /> },
        { name: t('nav.profile'), path: '/profile', icon: <FaUserCircle /> },
      ];
    }

    if (user?.role === 'parent') {
      return [
        { name: t('nav.dashboard'), path: '/', icon: <FaSchool /> },
        { name: t('nav.my_children'), path: '/my-children', icon: <FaUsers /> },
        { name: t('nav.attendance_calendar'), path: '/attendance/calendar', icon: <FaCalendarAlt /> },
        { name: 'School Calendar', path: '/school-calendar', icon: <FaCalendarAlt /> },
        { name: t('nav.reports'), path: '/reports', icon: <FaFileAlt /> },
        { name: t('nav.leave_request'), path: '/leave-request', icon: <FaPaperPlane /> },
        { name: t('nav.notices'), path: '/notices', icon: <FaBullhorn /> },
        { name: t('nav.contact_teacher'), path: '/contact-teacher', icon: <FaChalkboardTeacher /> },
        { name: t('nav.school_events'), path: '/school-events', icon: <FaCalendarAlt /> },
        { name: t('nav.ai_assistant'), path: '/parent-ai', icon: <FaRobot /> },
        { name: t('nav.profile'), path: '/profile', icon: <FaUserCircle /> },
      ];
    }

    return common;
  };

  const menuItems = getLinks();

  const languagesList = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' }
  ];

  const currentLanguage = languagesList.find(l => l.code === i18n.language) || languagesList[0];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-primary dark:bg-gray-900 text-white transition-transform duration-300 transform md:translate-x-0 md:relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 bg-primary-dark dark:bg-gray-950 border-b border-green-800 dark:border-gray-800">
          <Link to="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <FaSchool className="text-2xl text-green-200" />
            <span className="text-lg font-bold tracking-wider">SmartAttend</span>
          </Link>
          <button
            className="p-1 rounded md:hidden hover:bg-green-700 dark:hover:bg-gray-800 focus:outline-none"
            onClick={() => setSidebarOpen(false)}
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-green-800 dark:bg-gray-800 text-white'
                    : 'text-green-100 dark:text-gray-300 hover:bg-green-700 dark:hover:bg-gray-800 hover:text-white'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 bg-primary-dark dark:bg-gray-950 border-t border-green-800 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-750 dark:bg-red-950 hover:bg-red-700 dark:hover:bg-red-900 rounded-lg border border-green-700 dark:border-red-900 hover:border-red-650 transition-colors duration-150"
          >
            <FaSignOutAlt />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <header className="relative z-10 flex items-center justify-between h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              className="p-1 -ml-1 text-gray-500 dark:text-gray-400 rounded-lg md:hidden hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white focus:outline-none"
              onClick={() => setSidebarOpen(true)}
            >
              <FaBars className="text-xl" />
            </button>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Language Selector Selector Dropdown */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-850 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none cursor-pointer"
              >
                <span>🌐</span>
                <span className="hidden sm:inline">{currentLanguage.name}</span>
                <span className="text-[8px] text-gray-400">▼</span>
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-1.5 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-50 py-1">
                  {languagesList.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setLangOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-left cursor-pointer"
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center">
              {!isOnline ? (
                <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950 rounded-full border border-amber-200 dark:border-amber-900">
                  <FaWifi className="animate-pulse" />
                  <span>Offline</span>
                </span>
              ) : pendingCount > 0 ? (
                <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-950 rounded-full border border-blue-200 dark:border-blue-900">
                  <FaCloudUploadAlt className={isSyncing ? 'animate-bounce' : 'animate-pulse'} />
                  <span>Syncing {pendingCount} records</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-green-800 dark:text-green-200 bg-green-150 dark:bg-green-950 bg-opacity-70 rounded-full border border-green-200 dark:border-green-900">
                  <span className="w-2 h-2 rounded-full bg-green-600"></span>
                  <span>Online</span>
                </span>
              )}
            </div>

            {/* Dark Mode Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none cursor-pointer"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <FaSun className="text-xl text-yellow-500" /> : <FaMoon className="text-xl" />}
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-1.5 text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none cursor-pointer"
              >
                <FaBell className="text-xl" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 block h-4 w-4 rounded-full bg-red-600 text-[10px] font-extrabold text-white text-center leading-4">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 max-h-[420px] flex flex-col overflow-hidden">
                  {/* Header Bar */}
                  <div className="px-4 py-3 border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex justify-between items-center text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-800 dark:text-white font-bold">System Notifications</span>
                      {unreadCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold">
                          {unreadCount} New
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-[10px] font-medium">
                          All read
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[#2E7D32] dark:text-green-400 hover:underline flex items-center gap-1 cursor-pointer font-bold text-[11px]"
                      >
                        <FaCheckDouble className="text-[11px]" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => {
                        const isUnread = !notif.isRead;
                        return (
                          <div
                            key={notif._id}
                            onClick={() => handleNotifClick(notif)}
                            className={`p-3 text-xs leading-normal relative flex justify-between items-start gap-2.5 cursor-pointer transition-colors duration-150 border-l-4 ${
                              isUnread
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100/70 border-l-[#2E7D32] dark:border-l-green-500'
                                : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 border-l-transparent'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isUnread && (
                                    <span className="w-2 h-2 rounded-full bg-[#2E7D32] dark:bg-green-400 shrink-0"></span>
                                  )}
                                  <h4 className={`text-xs truncate ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>
                                    {notif.title}
                                  </h4>
                                </div>
                                {isUnread && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 uppercase tracking-wider shrink-0">
                                    Unread
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] leading-relaxed ${isUnread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                {notif.message}
                              </p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[9px] text-gray-400 font-medium">
                                  {new Date(notif.createdAt).toLocaleDateString()} • {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {!isUnread && (
                                  <span className="text-[9px] text-gray-400 font-medium flex items-center gap-1">
                                    <FaCheck className="text-[9px] text-emerald-600" /> Read
                                  </span>
                                )}
                              </div>
                              {user?.role === 'teacher' && notif.category === 'user' && notif.senderId?._id !== user?.id && (
                                <button
                                  onClick={(e) => handleOpenReply(e, notif)}
                                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-[10px] font-bold rounded-md shadow-2xs cursor-pointer border-0"
                                >
                                  <FaReply className="text-[9px]" />
                                  <span>Reply</span>
                                </button>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotif(notif._id);
                              }}
                              className="text-gray-300 hover:text-red-500 dark:hover:text-red-400 p-1 cursor-pointer transition shrink-0"
                              title="Delete notification"
                            >
                              <FaTrash className="text-xs" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 px-4 text-gray-400 space-y-1">
                        <FaBell className="text-2xl text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-xs font-semibold">No notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-800" />

            <Link to="/profile" className="flex items-center gap-2">
              {user?.photo ? (
                <img
                  src={user.photo}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                />
              ) : (
                <FaUserCircle className="text-2xl text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-white transition-colors" />
              )}
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                  {t(`roles.${user?.name}`, { defaultValue: user?.name })}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t(`roles.${user?.role}`, { defaultValue: `${user?.role} Account` })}
                </span>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 md:p-6 bg-gray-50 dark:bg-gray-950 dark:text-white">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>

        <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-3 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">
          © {new Date().getFullYear()} SmartAttend Rural. Designed for growth and rural development.
        </footer>
      </div>

      {/* Reply Message Modal */}
      {replyModalOpen && replyToUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-xl text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-wider">
                Send Reply to {replyToUser.name}
              </h3>
              <button
                onClick={() => setReplyModalOpen(false)}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-white cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSendReplySubmit} className="space-y-4">
              <div>
                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase mb-1">
                  Subject
                </span>
                <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {replySubject}
                </span>
              </div>

              <div>
                <label htmlFor="replyText" className="block text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase mb-1">
                  Your Reply Message
                </label>
                <textarea
                  id="replyText"
                  rows="5"
                  required
                  placeholder="Type your reply here..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReplyModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500 dark:text-gray-450 hover:bg-gray-50 dark:hover:bg-gray-950 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replyLoading}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer"
                >
                  {replyLoading ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI Chat Assistant Widget */}
      <AIChatWindow />
    </div>
  );
};

export default MainLayout;
