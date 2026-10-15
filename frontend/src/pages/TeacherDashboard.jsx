import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getClasses, getDashboardStats, getNotices, getLeaveRequests } from '../services/api';
import socket from '../services/socket';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { hasOfflineAttendance } from '../services/db';
import {
  FaCalendarCheck,
  FaFileAlt,
  FaBullhorn,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChalkboard,
  FaTasks,
  FaWifi,
  FaClock,
  FaUsers,
  FaUserTimes,
  FaChartBar,
  FaClipboardList,
  FaBell,
  FaUserClock,
  FaSearch,
  FaChevronDown
} from 'react-icons/fa';

const COMBINED_SERIES_KEY = 'Combined Attendance';

const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [lastUpdatedMap, setLastUpdatedMap] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const { pendingCount, isOnline } = useOfflineSync();
  const navigate = useNavigate();

  const [hoveredSeries, setHoveredSeries] = useState(null);
  const [selectedChartClass, setSelectedChartClass] = useState('ALL');
  const [multiSelectedSeries, setMultiSelectedSeries] = useState([COMBINED_SERIES_KEY]);
  const [isMultiDropdownOpen, setIsMultiDropdownOpen] = useState(false);
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const multiDropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (multiDropdownRef.current && !multiDropdownRef.current.contains(event.target)) {
        setIsMultiDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTeacherDashboardData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [classesRes, statsRes, noticesRes] = await Promise.all([
        getClasses(),
        getDashboardStats(),
        getNotices()
      ]);

      if (classesRes.success) {
        setClasses(classesRes.data || []);

        // Evaluate today's attendance status per assigned class using school-local data
        const statusMap = {};
        const timeMap = {};
        const timezone = statsRes.data?.schoolTimezone || 'Asia/Kolkata';
        const todayDate = statsRes.data?.schoolLocalDate || new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const todayClasses = statsRes.data?.todayClasses || [];

        for (const cls of classesRes.data) {
          const hasLocal = await hasOfflineAttendance(cls._id, todayDate);
          if (hasLocal) {
            statusMap[cls._id] = 'Cached (Pending)';
            timeMap[cls._id] = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
          } else {
            const matchedToday = todayClasses.find(
              (tc) => String(tc.classId) === String(cls._id)
            );
            if (matchedToday) {
              statusMap[cls._id] = matchedToday.status;
              timeMap[cls._id] = matchedToday.lastUpdatedTime || null;
            } else {
              statusMap[cls._id] = 'Pending';
              timeMap[cls._id] = null;
            }
          }
        }
        setAttendanceStatus(statusMap);
        setLastUpdatedMap(timeMap);
      }

      if (statsRes.success) {
        setStats(statsRes.data);
      }

      if (noticesRes.success) {
        setNotices(noticesRes.data.slice(0, 4));
      }

      // Fetch leave requests for assigned classes
      const leaveData = await getLeaveRequests();
      if (leaveData.success) {
        setLeaves(leaveData.data || []);
      }
    } catch (err) {
      console.error('Failed to load teacher dashboard metrics:', err);
      setError('Error loading teacher dashboard metrics.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeacherDashboardData();

    // Listen for real-time attendance and leave updates via Socket.IO
    socket.on('attendance_updated', () => {
      fetchTeacherDashboardData(true);
    });
    socket.on('leave_updated', () => {
      fetchTeacherDashboardData(true);
    });

    return () => {
      socket.off('attendance_updated');
      socket.off('leave_updated');
    };
  }, [fetchTeacherDashboardData, pendingCount]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E7D32]"></div>
        <span className="text-xs font-semibold text-gray-400">Loading School ERP Dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-center text-xs font-bold">
        {error}
      </div>
    );
  }

  // Calculate Attendance Stats dynamically from Database API for this teacher's assigned classes
  const presentVal = stats?.counters?.presentToday ?? 0;
  const absentVal = stats?.counters?.absentToday ?? 0;
  const lateVal = stats?.counters?.lateToday ?? 0;
  const leaveVal = stats?.counters?.leaveToday ?? 0;
  const totalStudentsVal = stats?.counters?.totalStudents || (presentVal + absentVal + lateVal + leaveVal);
  const avgAttendancePct = stats?.counters?.todayPercentage ?? (totalStudentsVal > 0 ? Math.round(((presentVal + lateVal) / totalStudentsVal) * 100) : 0);

  // Class completion stats
  const markedClassesCount = Object.values(attendanceStatus).filter(s => s === 'Marked' || s.includes('Cached')).length;
  const pendingClassesCount = Object.values(attendanceStatus).filter(s => s === 'Pending' || s === 'Partially Marked').length;
  const pendingLeavesCount = leaves.filter(l => l.status === 'Pending').length;

  // Unread Notices Dynamic Count
  const currentUserId = user?._id || user?.id;
  const unreadNoticesCount = notices.filter((n) => {
    if (!n.readBy || !Array.isArray(n.readBy)) return true;
    return !n.readBy.some(id => String(id) === String(currentUserId) || String(id?._id) === String(currentUserId));
  }).length;

  // Determine Greeting based on hour
  const currentHour = currentTime.getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Format Date
  const formattedTodayDate = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Format class label consistently (e.g., "Grade 6-A", "Grade 8-A")
  const formatClassLabel = (cls) => {
    const g = String(cls.grade || '').trim();
    const normGrade = g.toLowerCase().startsWith('grade')
      ? `Grade ${g.replace(/^grade\s*/i, '').trim()}`
      : `Grade ${g}`;
    return `${normGrade}-${cls.section}`;
  };

  const assignedClassNames = classes.length > 0
    ? [...classes]
        .sort((a, b) => formatClassLabel(a).localeCompare(formatClassLabel(b), undefined, { numeric: true }))
        .map((cls) => formatClassLabel(cls))
    : (stats?.classWise || []).map((cw) => cw.className);

  // Distinct colors: Grade 6-A (green), Grade 8-A (blue), Combined Attendance (orange)
  const EXTRA_CLASS_PALETTE = [
    '#7C3AED',
    '#0D9488',
    '#DB2777',
    '#4F46E5',
    '#CA8A04',
    '#059669',
    '#9333EA',
    '#2563EB',
    '#E11D48',
    '#0891B2'
  ];
  const COMBINED_COLOR = '#EA580C';

  const getClassColor = (className, idx = 0) => {
    const norm = String(className || '').toLowerCase();
    if (norm.includes('6-a') || norm.includes('6 - a')) return '#2E7D32';
    if (norm.includes('8-a') || norm.includes('8 - a')) return '#0284C7';
    if (idx < EXTRA_CLASS_PALETTE.length) {
      return EXTRA_CLASS_PALETTE[idx];
    }
    return `hsl(${Math.round((idx * 137.508) % 360)}, 65%, 42%)`;
  };

  // Determine selector mode based on assigned class count (6+ uses searchable multi-select defaulting to Combined Attendance)
  const isMultiSelectMode = assignedClassNames.length >= 6;

  const activeMultiSelections = multiSelectedSeries.filter(
    (item) => item === COMBINED_SERIES_KEY || assignedClassNames.includes(item)
  );
  const effectiveMultiSelections = activeMultiSelections.length > 0
    ? activeMultiSelections
    : [COMBINED_SERIES_KEY];

  const visibleClassSeries = isMultiSelectMode
    ? assignedClassNames.filter((name) => effectiveMultiSelections.includes(name))
    : selectedChartClass === 'ALL'
      ? assignedClassNames
      : assignedClassNames.filter((name) => name === selectedChartClass);

  const showCombinedSeries = isMultiSelectMode
    ? effectiveMultiSelections.includes(COMBINED_SERIES_KEY)
    : selectedChartClass === 'ALL';

  const totalVisibleBars = visibleClassSeries.length + (showCombinedSeries ? 1 : 0);

  // Automatically adapt bar widths and spacing for 1–3, 4–5, and 6+ series
  const dynamicBarSize =
    totalVisibleBars <= 1
      ? 24
      : totalVisibleBars <= 3
        ? 18
        : totalVisibleBars === 4
          ? 14
          : totalVisibleBars === 5
            ? 11
            : totalVisibleBars === 6
              ? 9
              : Math.max(4, Math.floor(52 / totalVisibleBars));

  const dynamicBarGap =
    totalVisibleBars <= 3
      ? 5
      : totalVisibleBars === 4
        ? 4
        : totalVisibleBars <= 6
          ? 2
          : 1;

  const dynamicBarCategoryGap =
    totalVisibleBars <= 1
      ? '28%'
      : totalVisibleBars <= 3
        ? '24%'
        : totalVisibleBars === 4
          ? '18%'
          : totalVisibleBars <= 6
            ? '14%'
            : '10%';

  const handleToggleMultiSeries = (seriesKey) => {
    setMultiSelectedSeries((prev) => {
      const validPrev = prev.filter(
        (item) => item === COMBINED_SERIES_KEY || assignedClassNames.includes(item)
      );
      const current = validPrev.length > 0 ? validPrev : [COMBINED_SERIES_KEY];
      if (current.includes(seriesKey)) {
        const next = current.filter((item) => item !== seriesKey);
        return next.length > 0 ? next : [COMBINED_SERIES_KEY];
      }
      return [...current, seriesKey];
    });
  };

  const filteredClassOptions = assignedClassNames.filter((clsName) =>
    clsName.toLowerCase().includes(classSearchQuery.trim().toLowerCase())
  );

  const multiSelectButtonLabel =
    effectiveMultiSelections.length === 1
      ? effectiveMultiSelections[0]
      : `${effectiveMultiSelections.length} Series Selected`;

  // Dynamic Weekly Attendance Data fetched from Database for this teacher
  const weeklyAnalyticsData = (stats?.weeklyTrends && stats.weeklyTrends.length > 0)
    ? stats.weeklyTrends
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => ({
        name: day,
        dayFull: day,
        formattedDate: day,
        classes: {},
        combined: {
          className: COMBINED_SERIES_KEY,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          attended: 0,
          marked: 0,
          eligibleTotal: totalStudentsVal,
          total: totalStudentsVal,
          isMarked: false,
          percentage: null,
        },
        [COMBINED_SERIES_KEY]: null,
      }));

  // Compute day percentage for the current selection using valid marked days only
  const getDaySelectionMetric = (dayData) => {
    if (showCombinedSeries && (visibleClassSeries.length === 0 || visibleClassSeries.length === assignedClassNames.length || !isMultiSelectMode)) {
      const isMarked = Boolean(dayData.combined?.isMarked && typeof dayData[COMBINED_SERIES_KEY] === 'number');
      return { isMarked, percentage: isMarked ? Number(dayData[COMBINED_SERIES_KEY]) : null };
    }
    if (visibleClassSeries.length === 1 && !showCombinedSeries) {
      const cInfo = dayData.classes?.[visibleClassSeries[0]];
      const isMarked = Boolean(cInfo?.isMarked && typeof cInfo.percentage === 'number');
      return { isMarked, percentage: isMarked ? Number(cInfo.percentage) : null };
    }
    // Weighted percentage across the selected classes for that day
    let attendedSum = 0;
    let eligibleSum = 0;
    let anyMarked = false;
    visibleClassSeries.forEach((clsName) => {
      const cInfo = dayData.classes?.[clsName];
      if (cInfo?.isMarked && cInfo.total > 0) {
        anyMarked = true;
        attendedSum += (cInfo.present || 0) + (cInfo.late || 0);
        eligibleSum += cInfo.total;
      }
    });
    if (!anyMarked && showCombinedSeries && dayData.combined?.isMarked) {
      return { isMarked: true, percentage: Number(dayData[COMBINED_SERIES_KEY]) };
    }
    return {
      isMarked: anyMarked && eligibleSum > 0,
      percentage: anyMarked && eligibleSum > 0 ? Math.round((attendedSum / eligibleSum) * 100) : null,
    };
  };

  // Ensure the average badge uses valid marked days only (never interpreting unmarked days as 0%)
  const markedDayMetrics = weeklyAnalyticsData
    .map((d) => getDaySelectionMetric(d))
    .filter((m) => m.isMarked && typeof m.percentage === 'number');

  const weeklyMarkedAvgPct = markedDayMetrics.length > 0
    ? Math.round(
        markedDayMetrics.reduce((sum, m) => sum + m.percentage, 0) / markedDayMetrics.length
      )
    : (stats?.counters?.isTodayMarked ? avgAttendancePct : null);

  const hasActiveMarkedData = weeklyAnalyticsData.some((d) => {
    if (showCombinedSeries && d.combined?.isMarked) return true;
    return visibleClassSeries.some((clsName) => d.classes?.[clsName]?.isMarked);
  });

  // Compact Tooltip for Weekly Attendance Trend Graph
  const renderWeeklyTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const dayData = payload[0]?.payload;
    if (!dayData) return null;

    const dateTitle = dayData.formattedDate || `${dayData.dayFull || dayData.name}${dayData.date ? ` (${dayData.date})` : ''}`;

    let activeTargetKey = COMBINED_SERIES_KEY;
    if (hoveredSeries && (hoveredSeries === COMBINED_SERIES_KEY || dayData.classes?.[hoveredSeries])) {
      activeTargetKey = hoveredSeries;
    } else if (!showCombinedSeries && visibleClassSeries.length > 0) {
      activeTargetKey = visibleClassSeries[0];
    }

    const isCombinedTarget = activeTargetKey === COMBINED_SERIES_KEY;

    const targetInfo = isCombinedTarget
      ? (dayData.combined || {
          className: COMBINED_SERIES_KEY,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          marked: 0,
          total: totalStudentsVal,
          isMarked: false,
          percentage: null,
        })
      : (dayData.classes?.[activeTargetKey] || {
          className: activeTargetKey,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          marked: 0,
          total: 0,
          isMarked: false,
          percentage: null,
        });

    const targetColor = isCombinedTarget
      ? COMBINED_COLOR
      : getClassColor(activeTargetKey, Math.max(0, assignedClassNames.indexOf(activeTargetKey)));

    const breakdownClasses = visibleClassSeries.length > 0 ? visibleClassSeries : assignedClassNames;
    const showClassBreakdown = (showCombinedSeries || visibleClassSeries.length > 1) && breakdownClasses.length > 0;
    const maxBreakdownRows = 4;
    const displayedBreakdownClasses = breakdownClasses.slice(0, maxBreakdownRows);
    const remainingBreakdownCount = breakdownClasses.length - displayedBreakdownClasses.length;

    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-xl px-3 py-2.5 text-white shadow-lg text-[11px] w-[215px] max-w-[225px] space-y-1.5 leading-snug">
        {/* Day & Date + Series Name & Percentage */}
        <div className="border-b border-gray-700/80 pb-1.5">
          <div className="text-[10px] font-semibold text-gray-300 truncate">{dateTitle}</div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="flex items-center gap-1.5 font-bold text-white truncate">
              <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: targetColor }}></span>
              <span className="truncate">{targetInfo.className || activeTargetKey}</span>
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold shrink-0 ${
                targetInfo.isMarked ? 'text-emerald-300 bg-emerald-500/20' : 'text-gray-300 bg-gray-700'
              }`}
            >
              {targetInfo.isMarked ? `${targetInfo.percentage}%` : 'Not Marked'}
            </span>
          </div>
        </div>

        {/* Marked / Total Students */}
        <div className="flex items-center justify-between text-[10px] text-gray-300">
          <span>Marked / Total:</span>
          <strong className="text-white">{targetInfo.marked} / {targetInfo.total}</strong>
        </div>

        {/* Present, Absent, Late, On Leave counts */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] bg-gray-800/80 px-2 py-1.5 rounded-lg border border-gray-700/60">
          <div className="flex justify-between">
            <span className="text-emerald-300">Present:</span>
            <strong className="text-white">{targetInfo.present}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-rose-300">Absent:</span>
            <strong className="text-white">{targetInfo.absent}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-300">Late:</span>
            <strong className="text-white">{targetInfo.late}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-sky-300">On Leave:</span>
            <strong className="text-white">{targetInfo.leave}</strong>
          </div>
        </div>

        {/* Compact Class Breakdown */}
        {showClassBreakdown && (
          <div className="pt-1 border-t border-gray-700/80 space-y-0.5 text-[10px]">
            {displayedBreakdownClasses.map((clsName) => {
              const idx = Math.max(0, assignedClassNames.indexOf(clsName));
              const cInfo = dayData.classes?.[clsName] || {
                marked: 0,
                total: 0,
                isMarked: false,
                percentage: null,
              };
              return (
                <div key={clsName} className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-1 truncate">
                    <span
                      className="w-1.5 h-1.5 rounded-xs shrink-0"
                      style={{ backgroundColor: getClassColor(clsName, idx) }}
                    ></span>
                    <span className="truncate">{clsName}</span>
                  </span>
                  <span className="font-semibold text-white shrink-0">
                    {cInfo.isMarked ? `${cInfo.percentage}% (${cInfo.marked}/${cInfo.total})` : `Unmarked (0/${cInfo.total})`}
                  </span>
                </div>
              );
            })}
            {remainingBreakdownCount > 0 && (
              <div className="text-[9px] text-gray-400 font-medium pt-0.5 text-right">
                +{remainingBreakdownCount} more {remainingBreakdownCount === 1 ? 'class' : 'classes'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Generate Dynamic ERP Database Alerts
  const alertsList = [];
  if (pendingClassesCount > 0) {
    alertsList.push({
      id: 'alt-pending-att',
      type: 'warning',
      title: 'Pending Attendance Submission',
      message: `You have ${pendingClassesCount} assigned class register(s) pending attendance marking for today.`
    });
  }
  if (pendingLeavesCount > 0) {
    alertsList.push({
      id: 'alt-pending-leaves',
      type: 'info',
      title: 'Student Leave Requests Pending',
      message: `${pendingLeavesCount} student leave request(s) are awaiting your review and approval.`
    });
  }
  // Low attendance classes alert
  classes.forEach(cls => {
    const matchedClass = stats?.classWise?.find(cw => cw.className === formatClassLabel(cls) || cw.className === `${cls.grade}-${cls.section}`);
    if (matchedClass && matchedClass.present + matchedClass.absent > 0) {
      const classPct = Math.round((matchedClass.present / (matchedClass.present + matchedClass.absent)) * 100);
      if (classPct < 75) {
        alertsList.push({
          id: `alt-low-att-${cls._id}`,
          type: 'danger',
          title: `Low Attendance Alert: ${cls.grade}-${cls.section}`,
          message: `Attendance for ${cls.grade}-${cls.section} is currently at ${classPct}% (below 75% threshold).`
        });
      }
    }
  });

  // Dynamic Absent Student Alerts for logged-in teacher's actual assigned classes
  if (stats?.absentStudents && stats.absentStudents.length > 0) {
    stats.absentStudents.slice(0, 3).forEach((st, idx) => {
      alertsList.push({
        id: `alt-absentee-${st.id || idx}`,
        type: 'danger',
        title: 'Student Absence Notice',
        message: `Student ${st.name} ${st.rollNo ? `(Roll No: ${st.rollNo})` : ''} was marked absent for today.`
      });
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
            {t('teacher_dashboard.welcomeBack')}, {user?.name || 'Teacher'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            {formattedTodayDate} • {t('teacher_dashboard.teacherPanel')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isOnline
                ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
                : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
            }`}
          >
            <FaWifi className="text-xs" />
            <span>{isOnline ? t('teacher_dashboard.onlineSyncReady') : t('teacher_dashboard.offlineMode')}</span>
          </span>
          {pendingCount > 0 && (
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-xs font-bold rounded-full">
              {pendingCount} {t('teacher_dashboard.pendingSync')}
            </span>
          )}
        </div>
      </div>

      {/* Today's Summary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Classes Today */}
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaChalkboard />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">{t('teacher_dashboard.assignedClasses')}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{classes.length}</span>
          </div>
        </div>

        {/* Attendance Completed */}
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaCheckCircle />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">{t('teacher_dashboard.marked')}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{markedClassesCount}</span>
          </div>
        </div>

        {/* Pending Attendance */}
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaUserTimes />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">{t('teacher_dashboard.pending')}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{pendingClassesCount}</span>
          </div>
        </div>

        {/* Leave Requests */}
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaClipboardList />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">{t('teacher_dashboard.recentLeaveRequests')}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{pendingLeavesCount}</span>
          </div>
        </div>

        {/* Dynamic Unread School Notices */}
        <Link
          to="/notices"
          className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaBullhorn />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">{t('teacher_dashboard.recentNotices')}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{unreadNoticesCount}</span>
          </div>
        </Link>
      </div>

      {/* Attendance Summary Grid: Metrics & Weekly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Attendance Bar Chart */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-150 dark:border-gray-700 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                {t('teacher_dashboard.weeklyAttendanceTrend')}
              </h3>
              <p className="text-[11px] text-gray-400 font-medium">Daily attendance percentage breakdown (Mon – Fri)</p>
            </div>
            <div className="flex items-center gap-2">
              {!isMultiSelectMode ? (
                <select
                  aria-label="Select class attendance series"
                  value={selectedChartClass}
                  onChange={(e) => setSelectedChartClass(e.target.value)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-50 dark:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] cursor-pointer"
                >
                  <option value="ALL">All Classes</option>
                  {assignedClassNames.map((clsName) => (
                    <option key={clsName} value={clsName}>
                      {clsName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative" ref={multiDropdownRef}>
                  <button
                    type="button"
                    aria-label="Select classes for comparison"
                    onClick={() => setIsMultiDropdownOpen((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-50 dark:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-[#2E7D32] focus:outline-none focus:ring-1 focus:ring-[#2E7D32] flex items-center gap-1.5 cursor-pointer max-w-[180px]"
                  >
                    <span className="truncate">{multiSelectButtonLabel}</span>
                    <FaChevronDown className="text-[9px] text-gray-400 shrink-0" />
                  </button>

                  {isMultiDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-2 space-y-2">
                      {/* Search input */}
                      <div className="relative">
                        <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400" />
                        <input
                          type="text"
                          value={classSearchQuery}
                          onChange={(e) => setClassSearchQuery(e.target.value)}
                          placeholder="Search classes..."
                          className="w-full pl-7 pr-2 py-1 text-[11px] bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[#2E7D32]"
                        />
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center justify-between px-1 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setMultiSelectedSeries([COMBINED_SERIES_KEY])}
                          className="text-[#EA580C] hover:underline cursor-pointer"
                        >
                          Combined Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setMultiSelectedSeries([COMBINED_SERIES_KEY, ...assignedClassNames])}
                          className="text-[#2E7D32] dark:text-green-400 hover:underline cursor-pointer"
                        >
                          Select All ({assignedClassNames.length})
                        </button>
                      </div>

                      {/* Combined Attendance Option */}
                      <div className="border-t border-b border-gray-100 dark:border-gray-700 py-1">
                        <label className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer text-[11px] font-bold text-gray-800 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={effectiveMultiSelections.includes(COMBINED_SERIES_KEY)}
                            onChange={() => handleToggleMultiSeries(COMBINED_SERIES_KEY)}
                            className="rounded border-gray-300 text-[#EA580C] focus:ring-[#EA580C] cursor-pointer"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: COMBINED_COLOR }}
                          ></span>
                          <span className="truncate">{COMBINED_SERIES_KEY}</span>
                        </label>
                      </div>

                      {/* Dynamic Class Options with Checkboxes */}
                      <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5">
                        {filteredClassOptions.length === 0 ? (
                          <div className="py-2 text-center text-[10px] text-gray-400 font-medium">
                            No matching classes
                          </div>
                        ) : (
                          filteredClassOptions.map((clsName) => {
                            const idx = Math.max(0, assignedClassNames.indexOf(clsName));
                            const isChecked = effectiveMultiSelections.includes(clsName);
                            return (
                              <label
                                key={clsName}
                                className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer text-[11px] font-semibold text-gray-700 dark:text-gray-200"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleMultiSeries(clsName)}
                                  className="rounded border-gray-300 text-[#2E7D32] focus:ring-[#2E7D32] cursor-pointer"
                                />
                                <span
                                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                                  style={{ backgroundColor: getClassColor(clsName, idx) }}
                                ></span>
                                <span className="truncate">{clsName}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border border-green-200 dark:border-green-800 shrink-0">
                Avg: {weeklyMarkedAvgPct !== null ? `${weeklyMarkedAvgPct}%` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="relative h-52 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyAnalyticsData}
                margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
                barGap={dynamicBarGap}
                barCategoryGap={dynamicBarCategoryGap}
                onMouseLeave={() => setHoveredSeries(null)}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  unit="%"
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(156, 163, 175, 0.12)' }}
                  content={renderWeeklyTooltip}
                  offset={10}
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
                />
                {visibleClassSeries.map((clsName) => {
                  const idx = assignedClassNames.indexOf(clsName);
                  return (
                    <Bar
                      key={clsName}
                      dataKey={clsName}
                      name={clsName}
                      fill={getClassColor(clsName, idx >= 0 ? idx : 0)}
                      radius={[4, 4, 0, 0]}
                      barSize={dynamicBarSize}
                      minPointSize={(val) => (val === null || val === undefined ? 0 : 3)}
                      onMouseEnter={() => setHoveredSeries(clsName)}
                      onMouseLeave={() => setHoveredSeries(null)}
                    />
                  );
                })}
                {showCombinedSeries && (
                  <Bar
                    dataKey={COMBINED_SERIES_KEY}
                    name={COMBINED_SERIES_KEY}
                    fill={COMBINED_COLOR}
                    radius={[4, 4, 0, 0]}
                    barSize={dynamicBarSize}
                    minPointSize={(val) => (val === null || val === undefined ? 0 : 3)}
                    onMouseEnter={() => setHoveredSeries(COMBINED_SERIES_KEY)}
                    onMouseLeave={() => setHoveredSeries(null)}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>

            {!hasActiveMarkedData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 text-center">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-[1px] px-4 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 shadow-2xs">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    No attendance marked for the selected series this week
                  </p>
                  <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                    Mark daily attendance registers to view Mon – Fri percentage bars
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 pt-2.5 border-t border-gray-150 dark:border-gray-700 text-[11px] font-bold text-gray-500 dark:text-gray-400">
            {visibleClassSeries.map((clsName) => {
              const idx = assignedClassNames.indexOf(clsName);
              return (
                <span key={clsName} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: getClassColor(clsName, idx >= 0 ? idx : 0) }}
                  ></span>
                  <span>{clsName}</span>
                </span>
              );
            })}
            {showCombinedSeries && (
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: COMBINED_COLOR }}
                ></span>
                <span>Combined Attendance</span>
              </span>
            )}
          </div>
        </div>

        {/* Today's Attendance Breakdown */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs lg:col-span-1 space-y-4 flex flex-col justify-between">
          <div className="border-b border-gray-150 dark:border-gray-700 pb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {t('teacher_dashboard.todayAttendance')}
            </h3>
            <p className="text-[11px] text-gray-400 font-medium">Real-time student headcount status</p>
          </div>

          <div className="space-y-3 font-medium text-xs">
            <div className="p-3 bg-green-50 dark:bg-green-950/40 rounded-xl border border-green-200 dark:border-green-800 flex justify-between items-center">
              <span className="text-green-800 dark:text-green-300 font-semibold">{t('attendance.present')}</span>
              <strong className="text-green-900 dark:text-green-200 font-bold text-sm">{presentVal}</strong>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 flex justify-between items-center">
              <span className="text-red-800 dark:text-red-300 font-semibold">{t('attendance.absent')}</span>
              <strong className="text-red-900 dark:text-red-200 font-bold text-sm">{absentVal}</strong>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex justify-between items-center">
              <span className="text-amber-800 dark:text-amber-300 font-semibold">{t('attendance.late')}</span>
              <strong className="text-amber-900 dark:text-amber-200 font-bold text-sm">{lateVal}</strong>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex justify-between items-center">
              <span className="text-blue-800 dark:text-blue-300 font-semibold">{t('attendance.leave')}</span>
              <strong className="text-blue-900 dark:text-blue-200 font-bold text-sm">{leaveVal}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-150 dark:border-gray-700 flex justify-between items-center text-xs font-bold">
            <span className="text-gray-400">{t('dashboard.totalStudents')}</span>
            <strong className="text-gray-900 dark:text-white">{totalStudentsVal}</strong>
          </div>
        </div>
      </div>

      {/* Assigned Classes Register & School Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Assigned Classes */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FaChalkboard className="text-[#2E7D32]" />
                <span>{t('teacher_dashboard.assignedClasses')}</span>
              </h3>
              <p className="text-[11px] text-gray-400 font-medium">Daily attendance registers and student rosters</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-[#2E7D32] dark:bg-emerald-950 dark:text-green-300 border border-emerald-200 dark:border-emerald-800">
              {classes.length}
            </span>
          </div>

          {classes.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-750">
              <FaChalkboard className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{t('my_classes.noClassesAssigned')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => {
                const status = attendanceStatus[cls._id] || 'Pending';
                const isMarked = status === 'Marked';
                const isPartial = status === 'Partially Marked';
                const isCached = status.includes('Cached');
                const isNotScheduled = status === 'Not Scheduled';

                const badgeConfig = isMarked
                  ? {
                      bg: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800',
                      dot: 'bg-green-600',
                      label: t('teacher_dashboard.marked', 'Marked')
                    }
                  : isPartial
                  ? {
                      bg: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
                      dot: 'bg-amber-500',
                      label: t('teacher_dashboard.partiallyMarked', 'Partially Marked')
                    }
                  : isCached
                  ? {
                      bg: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
                      dot: 'bg-amber-600',
                      label: t('teacher_dashboard.cachedPending', 'Cached (Pending)')
                    }
                  : isNotScheduled
                  ? {
                      bg: 'bg-gray-100 border-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
                      dot: 'bg-gray-400',
                      label: t('teacher_dashboard.notScheduled', 'Not Scheduled')
                    }
                  : {
                      bg: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
                      dot: 'bg-rose-600',
                      label: t('teacher_dashboard.pending', 'Pending')
                    };

                return (
                  <div
                    key={cls._id}
                    className="p-4 border border-gray-200 dark:border-gray-700 hover:border-[#2E7D32] dark:hover:border-green-500 rounded-xl transition-all duration-200 bg-gray-50/50 dark:bg-gray-750/70 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Class Details & Status */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-xs">
                          <FaChalkboard />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">
                            {cls.grade} - {cls.section}
                          </h4>
                          <span className="text-[11px] font-semibold text-gray-400 block mt-0.5">
                            Class Register #{cls.roomNo || cls._id.slice(-4).toUpperCase()}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`ml-auto md:ml-2 text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${badgeConfig.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dot}`}></span>
                          <span>{badgeConfig.label}</span>
                        </span>
                      </div>

                      {/* Class Metadata Badges */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium pt-1">
                        <span className="flex items-center gap-1">
                          <FaUsers className="text-gray-400 text-[10px]" />
                          <span>{t('my_classes.totalStudents')}: <strong className="text-gray-800 dark:text-gray-200 font-bold">{cls.studentCount || 0}</strong></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <FaClock className="text-gray-400 text-[10px]" />
                          <span>
                            Last Updated:{' '}
                            <strong className="text-gray-800 dark:text-gray-200 font-bold">
                              {lastUpdatedMap[cls._id]
                                ? `Today • ${lastUpdatedMap[cls._id]}`
                                : t('teacher_dashboard.notMarkedToday', 'Not marked today')}
                            </strong>
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-gray-200 dark:border-gray-700 shrink-0">
                      <Link
                        to={`/attendance/mark?classId=${cls._id}`}
                        className="px-3.5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FaCalendarCheck />
                        <span>{t('attendance.markAttendance', 'Mark Attendance')}</span>
                      </Link>
                      <Link
                        to={`/students?classId=${cls._id}`}
                        className="px-3.5 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl border border-gray-300 dark:border-gray-600 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FaUsers />
                        <span>{t('teacher_dashboard.viewStudents', 'View Students')}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent School Notices */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs lg:col-span-1 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-gray-150 dark:border-gray-700 pb-3 mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Recent School Notices
              </h3>
              <Link to="/notices" className="text-xs font-bold text-[#2E7D32] hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {notices.map((notice) => (
                <div key={notice._id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/60 dark:bg-gray-750">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#2E7D32] dark:bg-emerald-950 dark:text-green-300 border border-emerald-200 dark:border-emerald-800">
                      {notice.category || 'General'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {new Date(notice.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">
                    {notice.title}
                  </h4>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium line-clamp-2 leading-relaxed">
                    {notice.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-150 dark:border-gray-700 text-right">
            <Link to="/notices" className="text-xs font-bold text-[#2E7D32] hover:underline">
              Open Notice Board ➔
            </Link>
          </div>
        </div>
      </div>

      {/* Dynamic Database Attendance & Operational Alerts */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-150 dark:border-gray-700 pb-3">
          <FaBell className="text-[#2E7D32] text-sm" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Attendance & Operational Alerts
          </h3>
        </div>

        {alertsList.length === 0 ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-green-300 text-xs font-semibold flex items-center gap-2">
            <FaCheckCircle className="text-sm text-[#2E7D32]" />
            <span>All class registers are up to date and no operational alerts are active for your classes today.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alertsList.map((alt) => (
              <div
                key={alt.id}
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs font-medium ${
                  alt.type === 'danger'
                    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    : alt.type === 'warning'
                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                }`}
              >
                <FaExclamationTriangle className="text-sm mt-0.5 shrink-0" />
                <div>
                  <strong className="block font-bold mb-0.5">{alt.title}</strong>
                  <span className="leading-relaxed">{alt.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TeacherDashboard;
