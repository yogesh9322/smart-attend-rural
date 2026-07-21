import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
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
  FaUserClock
} from 'react-icons/fa';

const TeacherDashboard = () => {
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
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

        // Evaluate today's attendance status per assigned class
        const statusMap = {};
        const timeMap = {};
        const today = new Date().toISOString().split('T')[0];

        for (const cls of classesRes.data) {
          const hasLocal = await hasOfflineAttendance(cls._id, today);
          if (hasLocal) {
            statusMap[cls._id] = 'Cached (Pending)';
            timeMap[cls._id] = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            const matchedClass = statsRes.data?.classWise?.find(
              (cw) => cw.className === `${cls.grade}-${cls.section}`
            );
            if (matchedClass && (matchedClass.present + matchedClass.absent > 0)) {
              statusMap[cls._id] = 'Marked';
              timeMap[cls._id] = matchedClass.lastUpdated
                ? new Date(matchedClass.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const avgAttendancePct = stats?.counters?.todayPercentage ?? (totalStudentsVal > 0 ? Math.round((presentVal / totalStudentsVal) * 100) : 0);

  // Class completion stats
  const markedClassesCount = Object.values(attendanceStatus).filter(s => s === 'Marked' || s.includes('Cached')).length;
  const pendingClassesCount = classes.length - markedClassesCount;
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

  // Dynamic Weekly Attendance Data fetched from Database for this teacher
  const weeklyAnalyticsData = (stats?.weeklyTrends && stats.weeklyTrends.length > 0)
    ? stats.weeklyTrends
    : [
        { name: 'Mon', Present: 0, Absent: 0 },
        { name: 'Tue', Present: 0, Absent: 0 },
        { name: 'Wed', Present: 0, Absent: 0 },
        { name: 'Thu', Present: 0, Absent: 0 },
        { name: 'Fri', Present: 0, Absent: 0 }
      ];

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
    const matchedClass = stats?.classWise?.find(cw => cw.className === `${cls.grade}-${cls.section}`);
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
            {greeting}, {user?.name || 'Teacher'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            {formattedTodayDate} • SmartAttend Rural School ERP
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
            <span>{isOnline ? 'Network Online' : 'Offline Mode'}</span>
          </span>
          {pendingCount > 0 && (
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-xs font-bold rounded-full">
              {pendingCount} Pending Syncs
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
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">Classes Today</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{classes.length}</span>
          </div>
        </div>

        {/* Attendance Completed */}
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaCheckCircle />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">Completed</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{markedClassesCount}</span>
          </div>
        </div>

        {/* Pending Attendance */}
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaUserTimes />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">Pending</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{pendingClassesCount}</span>
          </div>
        </div>

        {/* Leave Requests */}
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs hover:border-[#2E7D32] transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
            <FaClipboardList />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">Leave Requests</span>
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
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block truncate">Unread Notices</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">{unreadNoticesCount}</span>
          </div>
        </Link>
      </div>

      {/* Attendance Summary Grid: Metrics & Weekly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Attendance Bar Chart */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs lg:col-span-2 space-y-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-150 dark:border-gray-700 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Weekly Attendance Analytics
              </h3>
              <p className="text-[11px] text-gray-400 font-medium">Daily attendance percentage breakdown (Mon – Fri)</p>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border border-green-200 dark:border-green-800">
              Avg: {avgAttendancePct}%
            </span>
          </div>

          <div className="h-52 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAnalyticsData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }} domain={[0, 100]} unit="%" />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value, name) => [`${value}%`, name === 'Present' ? 'Present' : 'Absent']}
                />
                <Bar dataKey="Present" name="Present" fill="#2E7D32" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" name="Absent" fill="#D32F2F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center gap-6 pt-2 border-t border-gray-150 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#2E7D32] rounded-xs"></span> Present (%)
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#D32F2F] rounded-xs"></span> Absent (%)
            </span>
          </div>
        </div>

        {/* Today's Attendance Breakdown */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs lg:col-span-1 space-y-4 flex flex-col justify-between">
          <div className="border-b border-gray-150 dark:border-gray-700 pb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Today's Attendance Breakdown
            </h3>
            <p className="text-[11px] text-gray-400 font-medium">Real-time student headcount status</p>
          </div>

          <div className="space-y-3 font-medium text-xs">
            <div className="p-3 bg-green-50 dark:bg-green-950/40 rounded-xl border border-green-200 dark:border-green-800 flex justify-between items-center">
              <span className="text-green-800 dark:text-green-300 font-semibold">Present Students</span>
              <strong className="text-green-900 dark:text-green-200 font-bold text-sm">{presentVal}</strong>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 flex justify-between items-center">
              <span className="text-red-800 dark:text-red-300 font-semibold">Absent Students</span>
              <strong className="text-red-900 dark:text-red-200 font-bold text-sm">{absentVal}</strong>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex justify-between items-center">
              <span className="text-amber-800 dark:text-amber-300 font-semibold">Late Students</span>
              <strong className="text-amber-900 dark:text-amber-200 font-bold text-sm">{lateVal}</strong>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex justify-between items-center">
              <span className="text-blue-800 dark:text-blue-300 font-semibold">Approved Leaves</span>
              <strong className="text-blue-900 dark:text-blue-200 font-bold text-sm">{leaveVal}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-150 dark:border-gray-700 flex justify-between items-center text-xs font-bold">
            <span className="text-gray-400">Total Registered</span>
            <strong className="text-gray-900 dark:text-white">{totalStudentsVal} Students</strong>
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
                <span>My Assigned Classes</span>
              </h3>
              <p className="text-[11px] text-gray-400 font-medium">Daily attendance registers and student rosters</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-[#2E7D32] dark:bg-emerald-950 dark:text-green-300 border border-emerald-200 dark:border-emerald-800">
              {classes.length} {classes.length === 1 ? 'Class' : 'Classes'}
            </span>
          </div>

          {classes.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-750">
              <FaChalkboard className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">No classes assigned yet.</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Please contact school admin to assign classes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => {
                const status = attendanceStatus[cls._id] || 'Pending';
                const isMarked = status === 'Marked';
                const isCached = status.includes('Cached');

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
                            {String(cls.grade).toLowerCase().startsWith('grade') ? cls.grade : `Grade ${cls.grade}`} - Section {cls.section}
                          </h4>
                          <span className="text-[11px] font-semibold text-gray-400 block mt-0.5">
                            Class Register #{cls.roomNo || cls._id.slice(-4).toUpperCase()}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`ml-auto md:ml-2 text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                            isMarked
                              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800'
                              : isCached
                              ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isMarked ? 'bg-green-600' : isCached ? 'bg-amber-600' : 'bg-rose-600'}`}></span>
                          <span>
                            {isMarked
                              ? 'Attendance Marked'
                              : isCached
                              ? 'Attendance Cached (Pending Sync)'
                              : 'Attendance Pending'}
                          </span>
                        </span>
                      </div>

                      {/* Class Metadata Badges */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium pt-1">
                        <span className="flex items-center gap-1">
                          <FaUsers className="text-gray-400 text-[10px]" />
                          <span>Strength: <strong className="text-gray-800 dark:text-gray-200 font-bold">{cls.studentCount || 38} Students</strong></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <FaClock className="text-gray-400 text-[10px]" />
                          <span>
                            Last Updated:{' '}
                            <strong className="text-gray-800 dark:text-gray-200 font-bold">
                              {lastUpdatedMap[cls._id]
                                ? `Today • ${lastUpdatedMap[cls._id]}`
                                : `Today • ${currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
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
                        <span>Take Attendance</span>
                      </Link>
                      <Link
                        to={`/students?classId=${cls._id}`}
                        className="px-3.5 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl border border-gray-300 dark:border-gray-600 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FaUsers />
                        <span>View Students</span>
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
