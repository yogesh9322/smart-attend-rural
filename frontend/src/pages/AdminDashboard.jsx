import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import WelcomeGuide from '../components/AI/WelcomeGuide';
import SecurityActivityModal from '../components/SecurityActivityModal';
import { getDashboardStats, getNotices, getActivityLogs } from '../services/api';
import socket from '../services/socket';
import {
  FaGraduationCap,
  FaChalkboardTeacher,
  FaCalendarCheck,
  FaSchool,
  FaPlus,
  FaFileAlt,
  FaBullhorn,
  FaCalendarAlt,
  FaClock,
  FaFilter,
  FaUndo,
  FaShieldAlt,
  FaSpinner,
  FaInfoCircle,
  FaSignInAlt,
  FaUserPlus,
  FaUserMinus,
  FaEdit,
  FaTimesCircle
} from 'react-icons/fa';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList
} from 'recharts';

// Automatically choose an appropriate tick interval based on the range length and aggregation
const computeXAxisInterval = (data, aggType) => {
  if (!data || data.length <= 1) return 0;
  const len = data.length;
  if (len <= 7) return 0; // Show all daily labels for 1-7 days
  if (len <= 14) return 1; // Show every 2nd label for 8-14 days
  if (len <= 31) return Math.max(1, Math.floor(len / 7)); // Show ~6-8 evenly spaced ticks for monthly
  if (aggType === 'weekly') return len > 10 ? 1 : 0;
  if (aggType === 'monthly') return len > 8 ? 1 : 0;
  return 'preserveStartEnd';
};

const MONTH_NAMES = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const AdminDashboard = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [recentLogsLoading, setRecentLogsLoading] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const getAuditBadgeInfo = (action = '') => {
    const act = (action || '').toUpperCase();
    if (act.includes('FAILED')) {
      return {
        label: 'Failed Attempt',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <FaTimesCircle className="text-[10px]" />
      };
    }
    if (act.includes('LOGIN')) {
      return {
        label: 'System Login',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <FaSignInAlt className="text-[10px]" />
      };
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('LINK')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <FaUserPlus className="text-[10px]" />
      };
    }
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('UNLINK')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <FaUserMinus className="text-[10px]" />
      };
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('RESET') || act.includes('PASSWORD') || act.includes('STATUS')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <FaEdit className="text-[10px]" />
      };
    }
    return {
      label: act.replace(/_/g, ' '),
      badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
      icon: <FaShieldAlt className="text-[10px]" />
    };
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const todayISO = now.toISOString().split('T')[0];

  // Active filters currently driving the charts
  const [activeFilters, setActiveFilters] = useState({
    periodType: 'monthly',
    year: currentYear,
    month: currentMonth,
    date: todayISO,
    startDate: todayISO,
    endDate: todayISO,
  });

  // Draft filter form controls
  const [filterPeriodType, setFilterPeriodType] = useState('monthly');
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterDate, setFilterDate] = useState(todayISO);
  const [filterStartDate, setFilterStartDate] = useState(todayISO);
  const [filterEndDate, setFilterEndDate] = useState(todayISO);

  const fetchData = useCallback(async (isBackground = false, filtersToUse = activeFilters) => {
    try {
      if (!isBackground) setLoading(true);
      const params = {
        periodType: filtersToUse.periodType,
        year: filtersToUse.year,
        month: filtersToUse.month,
        date: filtersToUse.date,
        startDate: filtersToUse.startDate,
        endDate: filtersToUse.endDate,
      };

      const [statsRes, noticesRes, logsRes] = await Promise.all([
        getDashboardStats(params),
        getNotices(),
        getActivityLogs({ limit: 5 })
      ]);
      
      if (statsRes.success) {
        setStats(statsRes.data);
      }
      if (noticesRes.success) {
        setNotices(noticesRes.data.slice(0, 2)); // show top 2 recent notices
      }
      if (logsRes && logsRes.success) {
        setRecentLogs(logsRes.data || []);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      if (!isBackground) setError('Failed to retrieve dashboard reports.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    fetchData(false, activeFilters);

    const onAttendanceUpdate = () => fetchData(true, activeFilters);
    const onStudentUpdate = () => fetchData(true, activeFilters);
    const onLeaveUpdate = () => fetchData(true, activeFilters);
    const onClassUpdate = () => fetchData(true, activeFilters);

    socket.on('attendance_updated', onAttendanceUpdate);
    socket.on('student_updated', onStudentUpdate);
    socket.on('leave_updated', onLeaveUpdate);
    socket.on('class_updated', onClassUpdate);

    return () => {
      socket.off('attendance_updated', onAttendanceUpdate);
      socket.off('student_updated', onStudentUpdate);
      socket.off('leave_updated', onLeaveUpdate);
      socket.off('class_updated', onClassUpdate);
    };
  }, [fetchData, activeFilters]);

  const handleApplyFilter = () => {
    const updated = {
      periodType: filterPeriodType,
      year: Number(filterYear),
      month: Number(filterMonth),
      date: filterDate,
      startDate: filterStartDate,
      endDate: filterEndDate,
    };
    setActiveFilters(updated);
    fetchData(false, updated);
  };

  const handleResetFilter = () => {
    const defaultState = {
      periodType: 'monthly',
      year: currentYear,
      month: currentMonth,
      date: todayISO,
      startDate: todayISO,
      endDate: todayISO,
    };
    setFilterPeriodType('monthly');
    setFilterYear(currentYear);
    setFilterMonth(currentMonth);
    setFilterDate(todayISO);
    setFilterStartDate(todayISO);
    setFilterEndDate(todayISO);
    setActiveFilters(defaultState);
    fetchData(false, defaultState);
  };

  const formatLastUpdated = (d) => {
    if (!d) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const counters = stats?.counters || {
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    todayPercentage: 0,
    avgDailyAttendance: null,
    absentToday: 0
  };

  const classWiseData = stats?.classWise || [];
  const dailyTrends = stats?.dailyTrends || [];
  const availableYears = stats?.availableYears || [new Date().getFullYear(), new Date().getFullYear() - 1];
  const hasTrendData = dailyTrends.some((d) => d.hasData);

  const periodInfo = stats?.periodInfo || {};
  const aggType = periodInfo.aggregationType || 'daily';
  const aggLabel = periodInfo.aggregationLabel || 'Daily Attendance';

  let trendChartTitle = 'Monthly Attendance Trend (%)';
  let trendChartSubtitle = `Daily attendance rates for ${periodInfo.description || 'selected month'}`;
  if (aggType === 'weekly') {
    trendChartTitle = 'Weekly Attendance Trend (%)';
    trendChartSubtitle = `Weekly aggregated attendance for ${periodInfo.description || 'selected period'}`;
  } else if (aggType === 'monthly') {
    trendChartTitle = 'Monthly Attendance Trend (%)';
    trendChartSubtitle = `Monthly aggregated attendance for ${periodInfo.description || 'selected period'}`;
  } else if (periodInfo.periodType === 'range') {
    trendChartTitle = 'Attendance Trend (%)';
    trendChartSubtitle = `Daily attendance rates for ${periodInfo.description || 'selected range'}`;
  } else if (periodInfo.periodType === 'date') {
    trendChartTitle = 'Monthly Attendance Trend (%)';
    trendChartSubtitle = `Daily attendance rates for the month of ${periodInfo.description || 'selected date'}`;
  }

  // Auto-adapt to horizontal bar chart when school has more than 5 classes
  const isHorizontalBarChart = classWiseData.length > 5;

  // Custom tooltip for Class-wise Attendance chart
  const renderClassTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const rateVal = data.percentage !== null && data.percentage !== undefined ? data.percentage : (data.isMarked ? data.rate : null);

    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white shadow-xl text-xs space-y-1.5 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-gray-700/80 pb-1.5 gap-2">
          <span className="font-bold text-sm text-white truncate">{data.className}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${rateVal !== null ? (rateVal >= 75 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300') : 'bg-gray-700 text-gray-300'}`}>
            {rateVal !== null ? `${rateVal}%` : 'Not Marked'}
          </span>
        </div>

        <div className="text-[10px] text-gray-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Enrolled:</span>
            <strong className="text-white">{data.total} Students</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status in Period:</span>
            <strong className={data.isMarked ? 'text-emerald-300' : 'text-amber-300'}>
              {data.isMarked ? `${data.marked} Records Marked` : 'Not Marked in Period'}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1.5 border-t border-gray-700/60 text-[10px] bg-gray-800/80 px-2 py-1.5 rounded-lg">
          <div className="flex justify-between">
            <span className="text-emerald-300">Present:</span>
            <strong className="text-white">{data.present ?? 0}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-rose-300">Absent:</span>
            <strong className="text-white">{data.absent ?? 0}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-300">Late:</span>
            <strong className="text-white">{data.lateCount ?? 0}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-sky-300">On Leave:</span>
            <strong className="text-white">{data.leaveCount ?? 0}</strong>
          </div>
        </div>
      </div>
    );
  };

  // Custom tooltip for Daily / Monthly Attendance Trend chart
  const renderTrendTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white shadow-xl text-xs space-y-1.5 min-w-[210px]">
        <div className="flex items-center justify-between border-b border-gray-700/80 pb-1.5 gap-2">
          <span className="font-bold text-sm text-white">{data.formattedDate || data.date}</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
              data.hasData && data.rate !== null
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {data.hasData && data.rate !== null ? `${data.rate}%` : 'No Records'}
          </span>
        </div>

        {data.hasData ? (
          <>
            <div className="text-[10px] text-gray-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Marked / Eligible:</span>
                <strong className="text-white">
                  {data.marked} / {data.eligible} Students
                </strong>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1.5 border-t border-gray-700/60 text-[10px] bg-gray-800/80 px-2 py-1.5 rounded-lg">
              <div className="flex justify-between">
                <span className="text-emerald-300">Present:</span>
                <strong className="text-white">{data.present}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-300">Absent:</span>
                <strong className="text-white">{data.absent}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-300">Late:</span>
                <strong className="text-white">{data.late}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-sky-300">On Leave:</span>
                <strong className="text-white">{data.leave}</strong>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[10px] text-gray-400 italic py-1">
            No attendance marked for this date.
          </p>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h2>
        <p className="text-sm text-gray-500 font-medium">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* AI Welcome Daily Summary Guide */}
      <WelcomeGuide dashboardStats={stats} />

      {/* Counters Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-150 p-5 flex items-center gap-4">
          <div className="p-3.5 bg-green-50 rounded-2xl text-primary border border-green-100">
            <FaGraduationCap className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">{t('dashboard.totalStudents')}</p>
            <h3 className="text-2xl font-extrabold text-gray-800">{counters.totalStudents}</h3>
          </div>
        </div>

        {/* Total Teachers */}
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-150 p-5 flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 rounded-2xl text-secondary border border-blue-100">
            <FaChalkboardTeacher className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">{t('dashboard.activeTeachers')}</p>
            <h3 className="text-2xl font-extrabold text-gray-800">{counters.totalTeachers}</h3>
          </div>
        </div>

        {/* Avg Daily Attendance */}
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-150 p-5 flex items-center gap-4">
          <div className="p-3.5 bg-green-50 rounded-2xl text-primary border border-green-100">
            <FaCalendarCheck className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">{t('dashboard.presentRate')}</p>
            {counters.avgDailyAttendance !== null && counters.avgDailyAttendance !== undefined ? (
              <h3 className="text-2xl font-extrabold text-gray-800">{counters.avgDailyAttendance}%</h3>
            ) : (
              <div>
                <h3 className="text-2xl font-extrabold text-gray-800">N/A</h3>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5 leading-tight">
                  No attendance recorded yet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Total Classes */}
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-150 p-5 flex items-center gap-4">
          <div className="p-3.5 bg-purple-50 rounded-2xl text-purple-600 border border-purple-100">
            <FaSchool className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">{t('dashboard.totalClasses')}</p>
            <h3 className="text-2xl font-extrabold text-gray-800">
              {counters.totalClasses ?? stats?.classWise?.length ?? 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm">
        <h3 className="text-base font-bold text-gray-700 mb-4">{t('common.quickActions')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link
            to="/students?action=add"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <FaPlus />
            <span>{t('students.addStudent')}</span>
          </Link>
          <Link
            to="/teachers?action=add"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary hover:bg-secondary-dark text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <FaPlus />
            <span>{t('teachers.addTeacher')}</span>
          </Link>
          <Link
            to="/parents?action=add"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <FaPlus />
            <span>{t('parents.addParent')}</span>
          </Link>
          <Link
            to="/reports"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold border border-gray-250 transition-colors cursor-pointer"
          >
            <FaFileAlt />
            <span>{t('nav.reports')}</span>
          </Link>
          <Link
            to="/notices"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold border border-gray-250 transition-colors cursor-pointer"
          >
            <FaBullhorn />
            <span>{t('nav.notices')}</span>
          </Link>
        </div>
      </div>

      {/* Compact Shared Date Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Mode Selector Pill Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setFilterPeriodType('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                filterPeriodType === 'monthly'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriodType('date')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                filterPeriodType === 'date'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              Specific Date
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriodType('range')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                filterPeriodType === 'range'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              Custom Date Range
            </button>
          </div>

          {/* Active Period Description Badge & Period Average */}
          <div className="flex items-center gap-2 self-start md:self-auto text-xs">
            <span className="text-gray-400 font-medium">Viewing:</span>
            <span className="font-bold text-gray-800 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
              {stats?.periodInfo?.description || 'Current Period'}
            </span>
            {stats?.periodInfo?.hasData && stats?.periodInfo?.periodPercentage !== null && (
              <span className="font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                {stats.periodInfo.periodPercentage}% Period Avg
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Controls based on selected filter type + Apply & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {filterPeriodType === 'monthly' && (
              <>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-month" className="text-gray-500 font-semibold text-xs">Month:</label>
                  <select
                    id="filter-month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(Number(e.target.value))}
                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-250 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {MONTH_NAMES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-year" className="text-gray-500 font-semibold text-xs">Year:</label>
                  <select
                    id="filter-year"
                    value={filterYear}
                    onChange={(e) => setFilterYear(Number(e.target.value))}
                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-250 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {filterPeriodType === 'date' && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="filter-date" className="text-gray-500 font-semibold text-xs">Date:</label>
                <input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-250 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                />
              </div>
            )}

            {filterPeriodType === 'range' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-start-date" className="text-gray-500 font-semibold text-xs">From:</label>
                  <input
                    id="filter-start-date"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-250 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-end-date" className="text-gray-500 font-semibold text-xs">To:</label>
                  <input
                    id="filter-end-date"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-250 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyFilter}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <FaFilter className="text-[10px]" />
              <span>Apply</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-250 transition-colors cursor-pointer"
            >
              <FaUndo className="text-[10px]" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Graphs Layout Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Class-wise Attendance (%) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-2xs flex flex-col justify-between h-full min-h-[440px]">
          <div className="flex items-start justify-between border-b border-gray-150 pb-3 mb-3 gap-2 min-h-[52px]">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Class-wise Attendance (%)
              </h3>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                Attendance rate across all school classes ({stats?.periodInfo?.description || 'Selected Period'})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                <FaClock className="text-[9px] text-gray-400" />
                <span>{formatLastUpdated(lastUpdated)}</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full flex-1 min-h-[280px] relative">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-xs font-semibold">Updating class analytics...</span>
              </div>
            ) : classWiseData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-semibold text-gray-400">
                No classes registered in the school yet.
              </div>
            ) : isHorizontalBarChart ? (
              <div className="h-full w-full overflow-y-auto pr-1">
                <div style={{ height: Math.max(280, classWiseData.length * 38), minHeight: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={classWiseData}
                      margin={{ top: 8, right: 36, left: 10, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" opacity={0.6} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        unit="%"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="className"
                        axisLine={false}
                        tickLine={false}
                        width={84}
                        tick={{ fill: '#374151', fontSize: 11, fontWeight: 700 }}
                      />
                      <Tooltip
                        content={renderClassTooltip}
                        cursor={{ fill: 'rgba(46, 125, 50, 0.08)' }}
                      />
                      <Bar
                        dataKey="rate"
                        fill="#2E7D32"
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                      >
                        <LabelList
                          dataKey="rate"
                          position="right"
                          formatter={(val) => (val !== null && val !== undefined ? `${val}%` : '')}
                          fill="#1B5E20"
                          fontSize={10}
                          fontWeight={700}
                          offset={8}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={classWiseData}
                  margin={{ top: 18, right: 12, left: -18, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.6} />
                  <XAxis
                    dataKey="className"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#374151', fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip
                    content={renderClassTooltip}
                    cursor={{ fill: 'rgba(46, 125, 50, 0.08)' }}
                  />
                  <Bar
                    dataKey="rate"
                    fill="#2E7D32"
                    radius={[4, 4, 0, 0]}
                    barSize={classWiseData.length <= 3 ? 36 : 26}
                  >
                    <LabelList
                      dataKey="rate"
                      position="top"
                      formatter={(val) => (val !== null && val !== undefined ? `${val}%` : '')}
                      fill="#1B5E20"
                      fontSize={10}
                      fontWeight={700}
                      offset={6}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-gray-150 text-[11px] font-medium text-gray-500 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#2E7D32]"></span>
              <span>Class Attendance Rate</span>
            </span>
            <span className="text-[10px] text-gray-400">
              {classWiseData.length} {classWiseData.length === 1 ? 'Class' : 'Classes'} Registered
            </span>
          </div>
        </div>

        {/* 2. Attendance Trend (%) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-2xs flex flex-col justify-between h-full min-h-[440px]">
          <div className="flex items-start justify-between border-b border-gray-150 pb-3 mb-3 gap-2 min-h-[52px]">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {trendChartTitle}
              </h3>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                {trendChartSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {aggType !== 'daily' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {aggLabel}
                </span>
              )}
              {stats?.periodInfo?.hasData && stats?.periodInfo?.periodPercentage !== null && (
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/15 text-emerald-800 border border-emerald-200">
                  {stats.periodInfo.periodPercentage}% Avg
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                <FaClock className="text-[9px] text-gray-400" />
                <span>{formatLastUpdated(lastUpdated)}</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full flex-1 min-h-[280px] relative">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-xs font-semibold">Updating trend analytics...</span>
              </div>
            ) : !hasTrendData ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl mb-2.5">
                  <FaCalendarAlt />
                </div>
                <h4 className="text-sm font-bold text-gray-800 mb-1">No Attendance Records Found</h4>
                <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                  No student attendance was recorded for {stats?.periodInfo?.description || 'the selected period'}. Try selecting a different month or date range.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyTrends}
                  margin={{ top: 12, right: 14, left: -18, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={16}
                    interval={computeXAxisInterval(dailyTrends, aggType)}
                    tick={{ fill: '#374151', fontSize: 10, fontWeight: 700 }}
                    padding={{ left: 10, right: 10 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip
                    content={renderTrendTooltip}
                    cursor={{ stroke: 'rgba(46, 125, 50, 0.25)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#2E7D32"
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={{ r: 3.5, fill: '#2E7D32', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 5.5, fill: '#1B5E20', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-gray-150 text-[11px] font-medium text-gray-500 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#2E7D32] rounded-full inline-block"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] inline-block -ml-2"></span>
              <span>{aggType === 'daily' ? 'Daily Attendance Rate' : `${aggLabel} Rate`}</span>
            </span>
            <span className="text-[10px] text-gray-400">
              Gaps indicate periods with no attendance logs
            </span>
          </div>
        </div>
      </div>

      {/* bottom layout: absent list and notices */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's Absentees list */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm lg:col-span-1 flex flex-col max-h-[400px]">
          <h3 className="text-base font-bold text-gray-700 mb-4">{t('dashboard.criticalWatchlist')}</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {stats?.absentStudents && stats.absentStudents.length > 0 ? (
              stats.absentStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-red-50 bg-opacity-70 border border-red-100 rounded-lg">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">{student.name}</h4>
                    <p className="text-xs text-gray-400">Roll No: {student.rollNo}</p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-100 rounded-full border border-red-150">
                    ABSENT
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                {t('dashboard.noLogs')}
              </p>
            )}
          </div>
        </div>

        {/* Recent notices board */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-gray-700">{t('dashboard.recentLogs')}</h3>
            <Link to="/notices" className="text-xs font-bold text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className="flex-1 space-y-4">
            {notices.length > 0 ? (
              notices.map((notice) => (
                <div key={notice._id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 bg-opacity-50">
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      {notice.isPinned && <span className="text-xs text-primary-dark">📌</span>}
                      {notice.title}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">
                      Audience: {notice.targetAudience}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-650 line-clamp-2 leading-relaxed">
                    {notice.content}
                  </p>
                  <div className="mt-2 text-[10px] text-gray-400 font-medium">
                    Posted on {new Date(notice.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                No school notices published yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Security Activity section */}
      <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2E7D32] border border-emerald-200 flex items-center justify-center font-bold text-sm shadow-xs">
              <FaShieldAlt />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800 leading-tight">Recent Security Activity</h3>
              <p className="text-[11px] text-gray-400 font-medium">Real-time system access and administrative audit trail</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSecurityModal(true)}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All Activity</span>
            <span className="text-[11px]">&rarr;</span>
          </button>
        </div>

        {/* Activity Stream */}
        <div className="space-y-2">
          {recentLogsLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs font-semibold text-gray-400">
              <FaSpinner className="animate-spin text-primary" />
              <span>Loading security activity...</span>
            </div>
          ) : recentLogs.length > 0 ? (
            recentLogs.slice(0, 5).map((log) => {
              const badgeInfo = getAuditBadgeInfo(log.action);
              return (
                <div key={log._id} className="p-2.5 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between text-xs hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className={`p-1 rounded-md text-[10px] font-bold shrink-0 border ${badgeInfo.badgeClass}`}>
                      {badgeInfo.icon}
                    </span>
                    <span className="font-semibold text-gray-800 truncate">{log.details}</span>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl text-center text-xs font-semibold text-gray-400 flex items-center justify-center gap-2">
              <FaInfoCircle className="text-gray-300" />
              <span>No recent security activity</span>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated System Security & Audit Activity Logs Modal */}
      <SecurityActivityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        user={user}
      />
    </motion.div>
  );
};

export default AdminDashboard;
