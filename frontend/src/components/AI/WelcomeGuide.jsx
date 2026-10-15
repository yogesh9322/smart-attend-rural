import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getDashboardStats,
  getLeaveRequests,
  getNotices,
  getSchoolEvents
} from '../../services/api';
import socket from '../../services/socket';
import {
  FaSun,
  FaCalendarCheck,
  FaFileAlt,
  FaBullhorn,
  FaCalendarAlt,
  FaCheckCircle,
  FaSpinner
} from 'react-icons/fa';

const WelcomeGuide = ({ dashboardStats }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [localStats, setLocalStats] = useState(dashboardStats || null);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const [noticesCount, setNoticesCount] = useState(0);
  const [nextEvent, setNextEvent] = useState(null);

  // Sync prop changes
  useEffect(() => {
    if (dashboardStats) {
      setLocalStats(dashboardStats);
    }
  }, [dashboardStats]);

  const loadSummaryData = useCallback(async () => {
    try {
      setLoading(true);
      const promises = [
        getLeaveRequests().catch(() => ({ success: false })),
        getNotices().catch(() => ({ success: false })),
        getSchoolEvents().catch(() => ({ success: false }))
      ];

      if (!dashboardStats) {
        promises.push(getDashboardStats().catch(() => ({ success: false })));
      }

      const results = await Promise.all(promises);
      const leavesRes = results[0];
      const noticesRes = results[1];
      const eventsRes = results[2];
      const statsRes = !dashboardStats ? results[3] : null;

      if (statsRes?.success && statsRes.data) {
        setLocalStats(statsRes.data);
      }

      // 1. Pending leave requests awaiting administrator review
      if (leavesRes?.success && Array.isArray(leavesRes.data)) {
        const pending = leavesRes.data.filter((l) => l.status === 'Pending').length;
        setPendingLeavesCount(pending);
      }

      // 2. Active published notices count
      if (noticesRes?.success && Array.isArray(noticesRes.data)) {
        setNoticesCount(noticesRes.data.length);
      }

      // 3. Next upcoming school event
      if (eventsRes?.success && Array.isArray(eventsRes.data)) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const upcoming = eventsRes.data
          .filter((e) => new Date(e.date) >= startOfToday)
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        setNextEvent(upcoming[0] || null);
      }
    } catch (err) {
      console.error('Failed to load morning summary data:', err);
    } finally {
      setLoading(false);
    }
  }, [dashboardStats]);

  useEffect(() => {
    loadSummaryData();

    // Listen to real-time events to keep summary current
    const handleUpdate = () => loadSummaryData();
    socket.on('leave_updated', handleUpdate);
    socket.on('attendance_updated', handleUpdate);
    socket.on('notice_created', handleUpdate);

    return () => {
      socket.off('leave_updated', handleUpdate);
      socket.off('attendance_updated', handleUpdate);
      socket.off('notice_created', handleUpdate);
    };
  }, [loadSummaryData]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (!user) return null;

  const roleTitle = user.role === 'admin'
    ? 'Administrator'
    : user.role === 'teacher'
    ? 'Teacher'
    : 'Parent';

  const todayCounters = localStats?.counters || {};
  const isTodayMarked = todayCounters.isTodayMarked || todayCounters.markedToday > 0;
  const todayPercentage = todayCounters.todayPercentage ?? 0;
  const absentCount = todayCounters.absentToday ?? 0;

  const formattedTodayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const formattedEventDate = nextEvent?.date
    ? new Date(nextEvent.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    : '';

  // Determine if all items are fully caught up
  const isAllCaughtUp =
    !loading &&
    pendingLeavesCount === 0 &&
    isTodayMarked;

  return (
    <div className="bg-white dark:bg-[#151E2E] border border-gray-150 dark:border-[#263247] rounded-2xl p-3.5 sm:p-4 shadow-2xs font-sans transition-colors">
      {/* Top: Greeting & Administrator Identification */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#2E7D32] dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-2xs">
          <FaSun className="text-lg animate-spin-slow text-amber-500" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-gray-800 dark:text-white leading-tight">
              {greeting}, {user.name}!
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-[#2E7D32] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {roleTitle}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-[#94A3B8] font-semibold mt-0.5">
            {formattedTodayDate}
          </p>
        </div>
      </div>

      {/* Concise Data-Driven School Summary */}
      <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-[#263247]/80">
        {loading ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">
            <FaSpinner className="animate-spin text-[#2E7D32]" />
            <span>Updating morning school summary...</span>
          </div>
        ) : isAllCaughtUp ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/50">
            <FaCheckCircle className="text-sm text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>You're all caught up! No pending leave requests or unread notices require attention today.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 1. Today's Attendance Metric */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border ${
              isTodayMarked
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                : 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
            }`}>
              <FaCalendarCheck className="text-[11px] shrink-0" />
              <span>
                {isTodayMarked
                  ? `Today's Attendance: ${todayPercentage}% (${absentCount} absent)`
                  : "Today's Attendance: Not marked yet"}
              </span>
            </div>

            {/* 2. Pending Leaves Metric (only when > 0) */}
            {pendingLeavesCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                <FaFileAlt className="text-[11px] shrink-0" />
                <span>
                  {pendingLeavesCount} Pending Leave Request{pendingLeavesCount > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* 3. Published Notices Metric */}
            {noticesCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                <FaBullhorn className="text-[11px] shrink-0" />
                <span>
                  {noticesCount} Active Notice{noticesCount > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* 4. Upcoming Event Metric */}
            {nextEvent && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-purple-50/80 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60">
                <FaCalendarAlt className="text-[11px] shrink-0" />
                <span className="truncate max-w-[260px] sm:max-w-none">
                  Upcoming: {nextEvent.title} ({formattedEventDate})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeGuide;
