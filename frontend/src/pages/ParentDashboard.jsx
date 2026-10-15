import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  getAttendanceReport,
  getParentNotices,
  getLeaveRequests,
  getSchoolEvents,
  getAISummary,
  getStudentTodayStatus
} from '../services/api';
import socket from '../services/socket';
import DownloadStudentReportModal from '../components/DownloadStudentReportModal';
import {
  FaGraduationCap,
  FaCalendarCheck,
  FaFilePdf,
  FaBell,
  FaCalendarAlt,
  FaBriefcaseMedical,
  FaPaperPlane,
  FaRobot
} from 'react-icons/fa';

const ParentDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [attendance, setAttendance] = useState([]);
  const [todayStatusData, setTodayStatusData] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [events, setEvents] = useState([]);
  const [dailySummary, setDailySummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const children = user?.children || [];
  const currentChild = children[selectedChildIndex];

  const fetchParentData = useCallback(async (isBackground = false) => {
    if (!currentChild) {
      if (!isBackground) setLoading(false);
      return;
    }

    try {
      if (!isBackground) setLoading(true);
      const [attendanceRes, noticesRes, leavesRes, eventsRes, summaryRes, todayStatusRes] = await Promise.all([
        getAttendanceReport({ studentId: currentChild._id }),
        getParentNotices(),
        getLeaveRequests(),
        getSchoolEvents(),
        getAISummary({ lang: i18n.language }).catch(() => ({ success: false })),
        getStudentTodayStatus(currentChild._id).catch(() => ({ success: false }))
      ]);

      if (attendanceRes && attendanceRes.success) {
        setAttendance(attendanceRes.data);
      }
      if (noticesRes && noticesRes.success) {
        setNotices(noticesRes.data.slice(0, 4));
      }
      if (leavesRes && leavesRes.success) {
        const childLeaves = leavesRes.data.filter(l => l.studentId?._id === currentChild._id);
        setLeaves(childLeaves);
      }
      if (eventsRes && eventsRes.success) {
        setEvents(eventsRes.data.slice(0, 3));
      }
      if (summaryRes && summaryRes.success) {
        setDailySummary(summaryRes.summary);
      }
      if (todayStatusRes && todayStatusRes.success) {
        setTodayStatusData(todayStatusRes.data || todayStatusRes);
      } else {
        setTodayStatusData(null);
      }
    } catch (err) {
      console.error('Failed to load parent metrics:', err);
      if (!isBackground) setError('Error loading student metrics.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [currentChild, i18n.language]);

  useEffect(() => {
    fetchParentData();
  }, [fetchParentData]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchParentData(true);
    };

    socket.on('attendance_updated', handleUpdate);
    socket.on('leave_updated', handleUpdate);

    return () => {
      socket.off('attendance_updated', handleUpdate);
      socket.off('leave_updated', handleUpdate);
    };
  }, [fetchParentData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="p-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs text-center max-w-lg mx-auto mt-10 font-sans">
        <FaGraduationCap className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {t('dashboard_extra.noLinkedStudents')}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {t('dashboard_extra.noLinkedStudentsSubtitle')}
        </p>
      </div>
    );
  }

  // Calculate statistics for the current child
  const totalDays = attendance.length;
  const presents = attendance.filter((r) => r.status === 'Present').length;
  const absents = attendance.filter((r) => r.status === 'Absent').length;
  const lates = attendance.filter((r) => r.status === 'Late').length;

  const netPresents = presents + lates;
  const attendanceRate = totalDays > 0 ? Math.round((netPresents / totalDays) * 100) : 100;

  // Get status for today from backend school-timezone computation
  const todayStatus = todayStatusData?.status || 'NOT_MARKED';
  const todayDisplayStatus =
    (todayStatus === 'PRESENT'
      ? t('attendance.present', { defaultValue: 'Present' })
      : todayStatus === 'ABSENT'
      ? t('attendance.absent', { defaultValue: 'Absent' })
      : todayStatus === 'LATE'
      ? t('attendance.late', { defaultValue: 'Late' })
      : todayStatus === 'ON_LEAVE'
      ? t('attendance.onLeave', { defaultValue: 'On Leave' })
      : todayStatus === 'NOT_SCHEDULED'
      ? t('attendance.notScheduled', { defaultValue: 'Not Scheduled' })
      : t('teacher_dashboard.notMarked', { defaultValue: 'Not Marked Yet' }));
  const todayUpdateMessage =
    todayStatusData?.updateMessage || "Today's attendance has not been marked yet.";

  // Calculate monthly stats from backend or fallback to local records
  let monthlyPercentage = null;
  let monthlySupportingText = 'No attendance recorded this month';

  if (todayStatusData?.monthlyStats) {
    monthlyPercentage = todayStatusData.monthlyStats.percentage;
    monthlySupportingText = todayStatusData.monthlyStats.supportingText;
  } else if (attendance.length > 0) {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();
    const thisMonthRecs = attendance.filter((r) => {
      const d = new Date(r.date);
      return d.getFullYear() === currYear && d.getMonth() === currMonth && d <= now;
    });
    const totalMonthDays = thisMonthRecs.length;
    const attendedMonthDays = thisMonthRecs.filter((r) => r.status === 'Present' || r.status === 'Late').length;
    if (totalMonthDays > 0) {
      monthlyPercentage = Math.round((attendedMonthDays / totalMonthDays) * 100);
      monthlySupportingText = `${attendedMonthDays} of ${totalMonthDays} school days`;
    }
  }

  // Group by month for Bar Chart using real attendance data
  const monthlyData = {};
  const lang = i18n.language || 'en';
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-US';

  attendance.forEach((rec) => {
    const d = new Date(rec.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleString(locale, { month: 'short' });

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { key: monthKey, month: monthLabel, total: 0, present: 0, sortDate: d };
    }
    monthlyData[monthKey].total += 1;
    if (rec.status === 'Present' || rec.status === 'Late') {
      monthlyData[monthKey].present += 1;
    }
  });

  const chartData = Object.values(monthlyData)
    .filter((m) => m.total > 0)
    .sort((a, b) => a.sortDate - b.sortDate)
    .map((m) => ({
      month: m.month,
      rate: Math.round((m.present / m.total) * 100),
    }));

  const handleDownloadReport = () => {
    setIsReportModalOpen(true);
  };

  const currentLeaveStatus = leaves.length > 0 ? leaves[0].status : t('parent_dashboard.noLeaveRequest');

  // Time of day greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 
    ? t('parent_dashboard.greeting')
    : hour < 17 
    ? t('parent_dashboard.greetingAfternoon') 
    : t('parent_dashboard.greetingEvening');

  const formatChildGrade = (classId) => {
    if (!classId || !classId.grade) return 'Student';
    const cleanGrade = String(classId.grade).replace(/^grade\s+/i, '').trim();
    const section = classId.section ? `-${classId.section}` : '';
    return `Grade ${cleanGrade}${section}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6 font-sans text-slate-800 dark:text-[#F8FAFC]"
      style={{ fontFamily: 'Inter, "Noto Sans Devanagari", system-ui, -apple-system, sans-serif' }}
    >
      {/* 1. Header & Parent Context */}
      <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {user?.photo ? (
              <img
                src={user.photo}
                alt={user?.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-[#263247] shadow-2xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#182235] text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-[#263247] flex items-center justify-center font-semibold text-lg">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-[#F8FAFC]">
                {timeGreeting}, {user?.name || t('parent_dashboard.welcomeParent')}
              </h1>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#1E293B] dark:text-[#E2E8F0] dark:border-[#334155]">
                {t('roles.parent', { defaultValue: 'Parent Account' })}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal mt-1 flex items-center gap-2 flex-wrap">
              <span>{todayUpdateMessage}</span>
              {todayStatusData?.todayDate && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#182235] text-slate-600 dark:text-[#94A3B8] font-medium border border-slate-200 dark:border-[#263247]">
                  {todayStatusData.todayDate}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadReport}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-[#F8FAFC] dark:hover:bg-[#E2E8F0] dark:text-[#0F172A] dark:border-transparent rounded-xl text-xs sm:text-sm font-semibold shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer self-start md:self-auto"
        >
          <FaFilePdf className="text-red-600 dark:text-red-600 text-sm shrink-0" />
          <span>{t('parent_dashboard.downloadReport')}</span>
        </button>
      </div>

      {/* 2. Child Selector */}
      {children.length > 0 && (
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#94A3B8]">
              {t('parent_dashboard.selectChild')}
            </span>
            <span className="text-xs text-slate-400 dark:text-[#94A3B8]">
              {children.length} {children.length === 1 ? 'child enrolled' : 'children enrolled'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map((child, idx) => {
              const isSelected = selectedChildIndex === idx;
              return (
                <button
                  key={child._id}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/60 dark:bg-[#062c1d] border-emerald-500/80 dark:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50/60 dark:bg-[#182235] border-slate-200 dark:border-[#263247] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs ${
                      isSelected
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-[#263247] text-slate-600 dark:text-[#CBD5E1]'
                    }`}>
                      {child.name ? child.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-semibold ${isSelected ? 'text-emerald-950 dark:text-emerald-300' : 'text-slate-800 dark:text-[#F8FAFC]'}`}>
                        {child.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                        {formatChildGrade(child.classId)} • {t('parent_dashboard.rollNo')} {child.rollNo || 'N/A'}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Today's Update */}
      <div className={`p-4 rounded-2xl border shadow-2xs flex items-start gap-3.5 transition-all ${
        todayStatus === 'PRESENT'
          ? 'bg-emerald-50/60 border-emerald-200 dark:bg-[#062c1d]/60 dark:border-emerald-800/60'
          : todayStatus === 'ABSENT'
          ? 'bg-rose-50/60 border-rose-200 dark:bg-[#3b1212]/60 dark:border-rose-900/60'
          : todayStatus === 'LATE'
          ? 'bg-amber-50/60 border-amber-200 dark:bg-[#36200d]/60 dark:border-amber-800/60'
          : todayStatus === 'ON_LEAVE'
          ? 'bg-blue-50/60 border-blue-200 dark:bg-[#0f2342]/60 dark:border-blue-800/60'
          : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-[#263247]'
      }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
          todayStatus === 'PRESENT'
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700/50'
            : todayStatus === 'ABSENT'
            ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700/50'
            : todayStatus === 'LATE'
            ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700/50'
            : todayStatus === 'ON_LEAVE'
            ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700/50'
            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-[#182235] dark:text-[#CBD5E1] dark:border-[#263247]'
        }`}>
          <FaCalendarCheck className="text-base" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
              {t('parent_dashboard.todaysUpdate')} • {currentChild?.name}
            </span>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              todayStatus === 'PRESENT'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-[#062c1d] dark:text-emerald-300 dark:border-emerald-600'
                : todayStatus === 'ABSENT'
                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-[#3b1212] dark:text-rose-300 dark:border-rose-700'
                : todayStatus === 'LATE'
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-[#36200d] dark:text-amber-300 dark:border-amber-700'
                : todayStatus === 'ON_LEAVE'
                ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-[#0f2342] dark:text-blue-300 dark:border-blue-700'
                : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-[#182235] dark:text-slate-300 dark:border-[#334155]'
            }`}>
              {todayDisplayStatus}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-[#F8FAFC] mt-1 leading-snug">
            {todayUpdateMessage}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-[#94A3B8]">
            {todayStatusData?.hasRecord ? (
              <span>
                {t('parent_dashboard.verifiedByTeacher')}{' '}
                {todayStatusData.verifiedBy && `(${todayStatusData.verifiedBy})`}
              </span>
            ) : todayStatusData?.isOnLeave ? (
              <span>Approved leave request active today</span>
            ) : (
              <span>{t('parent_dashboard.awaitingTeacherUpdate')}</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Compact Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Attendance Rate */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-[#062c1d] text-emerald-600 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
              <FaGraduationCap className="text-sm" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-[#CBD5E1]">
              {t('parent_dashboard.attendanceRate')}
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-semibold text-slate-900 dark:text-[#F8FAFC] leading-tight">
              {attendanceRate}%
            </div>
          </div>
          <p className="text-[11px] font-normal text-slate-400 dark:text-[#94A3B8]">
            {t('parent_dashboard.thisAcademicTerm')}
          </p>
        </div>

        {/* Attendance This Month */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-[#1e1b4b] text-indigo-600 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
              <FaCalendarAlt className="text-sm" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-[#CBD5E1]">
              {t('parent_dashboard.attendanceThisMonth', { defaultValue: 'Attendance This Month' })}
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
              {monthlyPercentage !== null ? `${monthlyPercentage}%` : 'N/A'}
            </div>
          </div>
          <p className="text-[11px] font-normal text-slate-400 dark:text-[#94A3B8] truncate">
            {monthlySupportingText}
          </p>
        </div>

        {/* Leave Status */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-[#0f2342] text-blue-600 dark:text-blue-400 border border-blue-150 dark:border-blue-800/60 flex items-center justify-center shrink-0">
              <FaBriefcaseMedical className="text-sm" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-[#CBD5E1]">
              {t('parent_dashboard.leaveStatus')}
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC] truncate leading-tight">
              {currentLeaveStatus}
            </div>
          </div>
          <p className="text-[11px] font-normal text-slate-400 dark:text-[#94A3B8] truncate">
            {leaves.length > 0 ? t('parent_dashboard.latestLeaveApplication') : t('parent_dashboard.noLeaveRequest')}
          </p>
        </div>

        {/* Unread Notices */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-[#231238] text-purple-600 dark:text-purple-400 border border-purple-150 dark:border-purple-800/60 flex items-center justify-center shrink-0">
              <FaBell className="text-sm" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-[#CBD5E1]">
              {t('parent_dashboard.unreadNotices')}
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-semibold text-slate-900 dark:text-[#F8FAFC] leading-tight">
              {notices.length}
            </div>
          </div>
          <p className="text-[11px] font-normal text-slate-400 dark:text-[#94A3B8]">
            {t('parent_dashboard.noticesOverview')}
          </p>
        </div>
      </div>

      {/* 5. Quick Actions */}
      <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-5 shadow-2xs">
        <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC] mb-3">
          {t('parent_dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/attendance/calendar')}
            className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-[#182235] hover:bg-emerald-50/60 dark:hover:bg-[#263247] border border-slate-200 dark:border-[#263247] hover:border-emerald-300 dark:hover:border-emerald-500/50 rounded-xl text-xs font-medium text-slate-700 dark:text-[#F8FAFC] hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
          >
            <div className="p-2 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
              <FaCalendarAlt className="text-sm" />
            </div>
            <span className="truncate">{t('parent_dashboard.viewCalendar')}</span>
          </button>

          <button
            onClick={() => navigate('/leave-request')}
            className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-[#182235] hover:bg-emerald-50/60 dark:hover:bg-[#263247] border border-slate-200 dark:border-[#263247] hover:border-emerald-300 dark:hover:border-emerald-500/50 rounded-xl text-xs font-medium text-slate-700 dark:text-[#F8FAFC] hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
          >
            <div className="p-2 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
              <FaPaperPlane className="text-sm" />
            </div>
            <span className="truncate">{t('parent_dashboard.applyLeave')}</span>
          </button>

          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-[#182235] hover:bg-emerald-50/60 dark:hover:bg-[#263247] border border-slate-200 dark:border-[#263247] hover:border-emerald-300 dark:hover:border-emerald-500/50 rounded-xl text-xs font-medium text-slate-700 dark:text-[#F8FAFC] hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
          >
            <div className="p-2 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-lg text-red-600 dark:text-red-400 shrink-0">
              <FaFilePdf className="text-sm" />
            </div>
            <span className="truncate">{t('parent_dashboard.downloadReport')}</span>
          </button>

          <button
            onClick={() => navigate('/parent-ai')}
            className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-[#182235] hover:bg-emerald-50/60 dark:hover:bg-[#263247] border border-slate-200 dark:border-[#263247] hover:border-emerald-300 dark:hover:border-emerald-500/50 rounded-xl text-xs font-medium text-slate-700 dark:text-[#F8FAFC] hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
          >
            <div className="p-2 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-lg text-purple-600 dark:text-purple-400 shrink-0">
              <FaRobot className="text-sm" />
            </div>
            <span className="truncate">{t('parent_dashboard.chatWithAi')}</span>
          </button>
        </div>
      </div>

      {/* 6. Attendance Trend & Upcoming Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Attendance Trend Chart */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-5 shadow-2xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC] mb-0.5">
              {t('parent_dashboard.monthlyAttendanceTrend')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal">
              Monthly breakdown of present attendance percentages.
            </p>
          </div>

          {chartData.length > 0 ? (
            <div className="mt-4 pt-6">
              {/* Chart container with Y-axis scale + gridlines */}
              <div className="relative flex items-stretch gap-3">
                {/* Y-axis Labels (100%, 75%, 50%, 25%, 0%) */}
                <div className="flex flex-col justify-between text-[10px] font-medium text-slate-400 dark:text-[#94A3B8] pr-1 select-none h-32">
                  <span className="leading-none">100%</span>
                  <span className="leading-none">75%</span>
                  <span className="leading-none">50%</span>
                  <span className="leading-none">25%</span>
                  <span className="leading-none">0%</span>
                </div>

                {/* Chart Area with Horizontal Grid Lines & Bars */}
                <div className="relative flex-1 h-32">
                  {/* Background Grid Lines (5 exact levels: 100%, 75%, 50%, 25%, 0%) */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div className="border-b border-slate-100 dark:border-[#263247] w-full"></div>
                    <div className="border-b border-slate-100 dark:border-[#263247] w-full"></div>
                    <div className="border-b border-slate-100 dark:border-[#263247] w-full"></div>
                    <div className="border-b border-slate-100 dark:border-[#263247] w-full"></div>
                    <div className="border-b border-slate-200 dark:border-[#263247] w-full"></div>
                  </div>

                  {/* Bars Layer (Mathematically aligned 0% to 100%) */}
                  <div className="relative z-10 flex items-end justify-around h-full">
                    {chartData.map((d) => (
                      <div key={d.month} className="flex flex-col items-center justify-end flex-1 max-w-[64px] h-full">
                        {/* Bar element with height = d.rate% exactly */}
                        <div
                          style={{ height: `${d.rate}%` }}
                          className="relative w-7 sm:w-8 bg-emerald-600 dark:bg-emerald-500 rounded-t transition-all duration-200 hover:bg-emerald-700 dark:hover:bg-emerald-400"
                        >
                          {/* Percentage label positioned directly above the top edge of the bar */}
                          <span className="absolute bottom-[100%] left-1/2 -translate-x-1/2 mb-1 text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] text-center whitespace-nowrap leading-none">
                            {d.rate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* X-axis Month Labels */}
              <div className="flex items-center justify-around pl-9 pt-2">
                {chartData.map((d) => (
                  <span key={d.month} className="text-[11px] font-medium text-slate-600 dark:text-[#94A3B8] text-center flex-1 max-w-[64px]">
                    {d.month}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
              {t('parent_dashboard.noAttendanceTrendData')}
            </div>
          )}
        </div>

        {/* Upcoming School Events */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
                {t('parent_dashboard.upcomingSchoolEvents')}
              </h2>
              <Link to="/school-events" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                {t('parent_dashboard.viewAll')}
              </Link>
            </div>

            <div className="space-y-3">
              {events.length > 0 ? (
                events.map((ev) => (
                  <div key={ev._id} className="p-3 border border-slate-150 dark:border-[#263247] rounded-xl bg-slate-50/60 dark:bg-[#182235]">
                    <span className="inline-block text-[10px] font-medium px-2 py-0.5 bg-emerald-50 dark:bg-[#062c1d] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-md">
                      {ev.type || 'Event'}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] mt-1.5">
                      {ev.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                      {new Date(ev.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
                  {t('parent_dashboard.noUpcomingEvents')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Recent Daily Logs & Recent Notices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Daily Logs */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] p-5 rounded-2xl shadow-2xs lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC] mb-3">
            {t('parent_dashboard.recentDailyLogs')}
          </h2>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-[#263247] text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#182235] text-xs font-semibold text-slate-500 dark:text-[#94A3B8]">
                  <th className="px-4 py-2.5">{t('parent_dashboard.date')}</th>
                  <th className="px-4 py-2.5">{t('parent_dashboard.status')}</th>
                  <th className="px-4 py-2.5">{t('parent_dashboard.remarks')}</th>
                  <th className="px-4 py-2.5">{t('parent_dashboard.verifiedBy')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-[#263247] text-xs font-normal text-slate-700 dark:text-[#CBD5E1]">
                {attendance.slice(0, 5).map((record) => (
                  <tr key={record._id} className="hover:bg-slate-50/80 dark:hover:bg-[#182235] transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-[#F8FAFC]">
                      {new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        record.status === 'Present'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#062c1d] dark:text-emerald-300 dark:border-emerald-800/60'
                          : record.status === 'Absent'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-[#3b1212] dark:text-red-300 dark:border-red-800/60'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#36200d] dark:text-amber-300 dark:border-amber-800/60'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-[#94A3B8] italic max-w-[140px] truncate">
                      {record.remarks || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-[#CBD5E1]">
                      {record.markedBy?.name || 'Class Teacher'}
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
                      {t('parent_dashboard.noDailyRecords')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2.5">
            {attendance.slice(0, 5).map((record) => (
              <div key={record._id} className="p-3 border border-slate-200 dark:border-[#263247] rounded-xl bg-slate-50/50 dark:bg-[#182235] flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
                    {new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                    {record.markedBy?.name || 'Class Teacher'}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                  record.status === 'Present'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#062c1d] dark:text-emerald-300 dark:border-emerald-800/60'
                    : record.status === 'Absent'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-[#3b1212] dark:text-red-300 dark:border-red-800/60'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#36200d] dark:text-amber-300 dark:border-amber-800/60'
                }`}>
                  {record.status}
                </span>
              </div>
            ))}
            {attendance.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
                {t('parent_dashboard.noDailyRecords')}
              </div>
            )}
          </div>
        </div>

        {/* Recent Notices */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] p-5 rounded-2xl shadow-2xs lg:col-span-1">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
              {t('parent_dashboard.recentNotices')}
            </h2>
            <Link to="/notices" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
              {t('parent_dashboard.viewAll')}
            </Link>
          </div>

          <div className="space-y-3">
            {notices.map((notice) => {
              const isSchool = notice.noticeType === 'School' || notice.scope === 'Entire School';
              return (
                <div key={notice._id} className="p-3.5 border border-slate-150 dark:border-[#263247] rounded-xl bg-slate-50/50 dark:bg-[#182235]">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium mb-1 border ${
                    isSchool
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#0f2342] dark:text-blue-300 dark:border-blue-800/60'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#062c1d] dark:text-emerald-300 dark:border-emerald-800/60'
                  }`}>
                    {isSchool ? t('parent_dashboard.schoolNotice') : t('parent_dashboard.classNotice')}
                  </span>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC]">
                    {notice.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-[#CBD5E1] font-normal line-clamp-2 leading-relaxed">
                    {notice.content || notice.description}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400 dark:text-[#94A3B8] font-normal">
                    {new Date(notice.createdAt || notice.publishDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              );
            })}
            {notices.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
                No recent notices.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download Student Report Dialog */}
      <DownloadStudentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        children={children}
        initialChildId={currentChild?._id}
      />
    </motion.div>
  );
};

export default ParentDashboard;
