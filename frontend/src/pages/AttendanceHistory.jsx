import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getClasses, getAttendanceReport, downloadAttendanceExport, getSchoolSettings } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { generateAttendanceHistoryPDF } from '../utils/pdfGenerator';
import { useTranslation } from 'react-i18next';
import {
  FaSearch,
  FaFileAlt,
  FaFileExcel,
  FaFilePdf,
  FaCalendarAlt,
  FaUser,
  FaSpinner,
  FaUsers,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaCalendarDay,
  FaFilter,
  FaPercent,
} from 'react-icons/fa';

const getTodayStr = () => new Date().toISOString().split('T')[0];

const AttendanceHistory = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [classFilter, setClassFilter] = useState('');
  const [dateMode, setDateMode] = useState('single'); // 'single' | 'range'
  const [dateFilter, setDateFilter] = useState(getTodayStr());
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Export State
  const [exportingExcel, setExportingExcel] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  // Standard date references for presets
  const todayStr = useMemo(() => getTodayStr(), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const last7DaysStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  }, []);
  const monthStartStr = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }, []);
  const monthEndStr = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  }, []);

  // Determine active preset
  const isTodayActive = dateMode === 'single' && dateFilter === todayStr;
  const isYesterdayActive = dateMode === 'single' && dateFilter === yesterdayStr;
  const isWeekActive = dateMode === 'range' && startDate === last7DaysStartStr && endDate === todayStr;
  const isMonthActive = dateMode === 'range' && startDate === monthStartStr && endDate === monthEndStr;

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [classesRes, settingsRes] = await Promise.allSettled([
          getClasses(),
          getSchoolSettings(),
        ]);

        if (classesRes.status === 'fulfilled' && classesRes.value?.success) {
          setClasses(classesRes.value.data || []);
          if (classesRes.value.data?.length > 0) {
            setClassFilter(classesRes.value.data[0]._id);
          }
        }

        if (settingsRes.status === 'fulfilled' && settingsRes.value?.success) {
          setSchoolSettings(settingsRes.value.data || null);
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!classFilter) {
      setRecords([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const params = { classId: classFilter };

      if (dateMode === 'single') {
        if (dateFilter) {
          params.startDate = dateFilter;
          params.endDate = dateFilter;
        }
      } else {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await getAttendanceReport(params);
      if (res.success) {
        setRecords(res.data || []);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error('Error loading attendance records:', err);
      setError(err.response?.data?.message || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [classFilter, dateMode, dateFilter, startDate, endDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Quick Preset Handlers
  const handlePreset = (preset) => {
    if (preset === 'today') {
      setDateMode('single');
      setDateFilter(todayStr);
    } else if (preset === 'yesterday') {
      setDateMode('single');
      setDateFilter(yesterdayStr);
    } else if (preset === 'week') {
      setDateMode('range');
      setStartDate(last7DaysStartStr);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      setDateMode('range');
      setStartDate(monthStartStr);
      setEndDate(monthEndStr);
    }
  };

  // Selected class info
  const selectedClass = useMemo(() => {
    return classes.find((c) => c._id === classFilter);
  }, [classes, classFilter]);

  const classLabel = selectedClass
    ? `Grade ${String(selectedClass.grade || '').replace(/^grade\s*/i, '')} - ${selectedClass.section || ''}`
    : 'Class';

  // Client-side local filtering (name/rollNo, status)
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const studentName = rec.studentId?.name || '';
      const studentRoll = String(rec.studentId?.rollNo || '');

      const matchesSearch = searchQuery
        ? studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          studentRoll.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const matchesStatus = statusFilter ? rec.status === statusFilter : true;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  // Summary Metrics synchronized with active filter dataset
  const summary = useMemo(() => {
    const dataset = filteredRecords;
    const totalMarked = dataset.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    dataset.forEach((r) => {
      if (r.status === 'Present') present++;
      else if (r.status === 'Absent') absent++;
      else if (r.status === 'Late') late++;
      else if (r.status === 'Leave' || r.status === 'Excused') leave++;
    });

    const attended = present + late;
    const rate = totalMarked > 0 ? Math.round((attended / totalMarked) * 100) : 0;
    const uniqueStudents = new Set(
      dataset.map((r) => String(r.studentId?._id || r.studentId || ''))
    ).size;

    return {
      totalMarked,
      totalStudents: uniqueStudents || totalMarked,
      present,
      absent,
      late,
      leave,
      rate,
    };
  }, [filteredRecords]);

  // Export Excel (.xlsx) handler using unified backend generator
  const handleExportExcel = async () => {
    if (!classFilter) {
      setExportError('Please select a class first.');
      return;
    }
    setExportError('');
    setExportSuccess('');
    setExportingExcel(true);

    try {
      const params = {
        classId: classFilter,
        format: 'xlsx',
      };

      if (dateMode === 'single') {
        params.date = dateFilter || getTodayStr();
      } else {
        params.startDate = startDate || getTodayStr();
        params.endDate = endDate || startDate || getTodayStr();
      }

      const response = await downloadAttendanceExport(params);

      let filename = `${classLabel.replace(/\s+/g, '-')}_Attendance_Report_${
        dateMode === 'single'
          ? (dateFilter || getTodayStr())
          : `${startDate || getTodayStr()}_to_${endDate || getTodayStr()}`
      }.xlsx`;

      const disposition =
        response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccess('Excel (.xlsx) report downloaded successfully.');
      setTimeout(() => setExportSuccess(''), 4000);
    } catch (err) {
      console.error('Export error:', err);
      setExportError(
        err.response?.data?.message || 'Failed to download attendance report. Please try again.'
      );
    } finally {
      setExportingExcel(false);
    }
  };

  // PDF Export Handler
  const handleExportPDF = async () => {
    if (!classFilter) {
      setExportError('Please select a class first.');
      return;
    }
    setExportError('');
    setExportSuccess('');
    setGeneratingPdf(true);

    try {
      const periodLabel =
        dateMode === 'single'
          ? dateFilter
            ? new Date(dateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'Select Date'
          : `${startDate} to ${endDate}`;

      const dateSuffix =
        dateMode === 'single'
          ? (dateFilter || getTodayStr())
          : `${startDate || getTodayStr()}_to_${endDate || getTodayStr()}`;

      await generateAttendanceHistoryPDF({
        schoolName: schoolSettings?.schoolName || 'Smart Rural Model School',
        schoolLogo: schoolSettings?.schoolLogo || '',
        classLabel,
        periodLabel,
        teacherName: user?.name || 'Class Teacher',
        summary,
        records: filteredRecords,
        filename: `${classLabel.replace(/\s+/g, '-')}_Attendance_History_Report_${dateSuffix}.pdf`,
      });

      setExportSuccess('PDF report generated and downloaded successfully.');
      setTimeout(() => setExportSuccess(''), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      setExportError('Failed to generate PDF report. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {t('nav.history', 'Attendance History')}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300">
              {classLabel}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-normal mt-0.5">
            {t(
              'nav.history_sub',
              'Search, filter, and review classroom roll call records.'
            )}
          </p>
        </div>

        {/* Action Buttons: Export Excel, Export PDF & Attendance Reports */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Excel (.xlsx) */}
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || !classFilter}
            title="Download formatted Excel workbook (.xlsx)"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {exportingExcel ? (
              <FaSpinner className="animate-spin text-xs" />
            ) : (
              <FaFileExcel className="text-sm" />
            )}
            <span>{exportingExcel ? 'Generating Excel...' : t('reports.downloadExcel', 'Export Excel')}</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={generatingPdf || !classFilter || filteredRecords.length === 0}
            title="Download formatted PDF attendance history report"
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold rounded-xl shadow-2xs transition disabled:opacity-50 cursor-pointer"
          >
            {generatingPdf ? (
              <FaSpinner className="animate-spin text-xs" />
            ) : (
              <FaFilePdf className="text-sm text-rose-600 dark:text-rose-400" />
            )}
            <span>{generatingPdf ? 'Generating PDF...' : t('reports.downloadPdf', 'Export PDF')}</span>
          </button>

          {/* Attendance Reports Navigation Link */}
          <Link
            to="/advanced-reports"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition"
            title="Go to Attendance Reports generator"
          >
            <FaFileAlt className="text-sm text-slate-500 dark:text-slate-400" />
            <span>{t('reports.title', 'Attendance Reports')}</span>
          </Link>
        </div>
      </div>

      {/* Export Notifications */}
      {exportSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-2xl flex items-center gap-2 no-print">
          <FaCheckCircle className="text-emerald-600 shrink-0" />
          <span>{exportSuccess}</span>
        </div>
      )}
      {exportError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-2xl flex items-center gap-2 no-print">
          <FaTimesCircle className="text-rose-600 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* 2. Filter & Date Range Selection Panel */}
      <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 no-print">
        {/* Top header row: Filter label & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <FaFilter className="text-xs text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Filter Records
            </span>
          </div>

          {/* Presets with clear active state */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => handlePreset('today')}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${
                isTodayActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset('yesterday')}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${
                isYesterdayActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => handlePreset('week')}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${
                isWeekActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset('month')}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${
                isMonthActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium'
              }`}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Inputs Responsive Grid: Class, Status, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Class Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('nav.classes', 'Class')}
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
            >
              <option value="">{t('classes.selectClass', 'Select Class')}</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  Grade {String(cls.grade || '').replace(/^grade\s*/i, '')} - {cls.section || ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Status Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('reports.status', 'Status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
            >
              <option value="">{t('dashboard_extra.allStatuses', 'All Statuses')}</option>
              <option value="Present">{t('attendance.present', 'Present')}</option>
              <option value="Absent">{t('attendance.absent', 'Absent')}</option>
              <option value="Late">{t('attendance.late', 'Late')}</option>
              <option value="Leave">{t('attendance.leave', 'On Leave')}</option>
            </select>
          </div>

          {/* 3. Student Search */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('common.search', 'Search')} {t('nav.students', 'Students')}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <FaSearch className="text-xs" />
              </span>
              <input
                type="text"
                placeholder={t('students.searchPlaceholder', 'Name or Roll No...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
              />
            </div>
          </div>
        </div>

        {/* Date Mode and Date Pickers Section */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5">
          {/* Dedicated Row for Date Mode Segmented Control */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap select-none">
              Date Mode:
            </span>
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-700/80 rounded-xl border border-slate-200/80 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setDateMode('single')}
                className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg transition-all cursor-pointer ${
                  dateMode === 'single'
                    ? 'bg-[#2E7D32] text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                Single Date
              </button>
              <button
                type="button"
                onClick={() => setDateMode('range')}
                className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg transition-all cursor-pointer ${
                  dateMode === 'range'
                    ? 'bg-[#2E7D32] text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                Date Range
              </button>
            </div>
          </div>

          {/* Date Pickers Container */}
          {dateMode === 'single' ? (
            <div className="w-full sm:w-[260px]">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="w-full sm:w-[240px]">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  From date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                />
              </div>
              <div className="w-full sm:w-[240px]">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  To date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Live Attendance Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Students (Neutral) */}
        <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Total Students
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs shrink-0">
              <FaUsers />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              {summary.totalStudents}
            </span>
            <span className="text-[11px] font-normal text-slate-400">
              {summary.totalMarked} {summary.totalMarked === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* Present (Subtle Green Tint) */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Present
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs shrink-0">
              <FaCheckCircle />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100 leading-none">
              {summary.present}
            </span>
            <span className="text-[11px] font-normal text-emerald-700/80 dark:text-emerald-300/80">
              {summary.totalMarked > 0 ? `${Math.round((summary.present / summary.totalMarked) * 100)}%` : '—'}
            </span>
          </div>
        </div>

        {/* Absent (Subtle Red Tint) */}
        <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-800/40 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              Absent
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-100/80 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 flex items-center justify-center text-xs shrink-0">
              <FaTimesCircle />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-rose-900 dark:text-rose-100 leading-none">
              {summary.absent}
            </span>
            <span className="text-[11px] font-normal text-rose-700/80 dark:text-rose-300/80">
              {summary.totalMarked > 0 ? `${Math.round((summary.absent / summary.totalMarked) * 100)}%` : '—'}
            </span>
          </div>
        </div>

        {/* Late (Subtle Amber Tint) */}
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Late
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs shrink-0">
              <FaClock />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-100 leading-none">
              {summary.late}
            </span>
            <span className="text-[11px] font-normal text-amber-700/80 dark:text-amber-300/80">
              {summary.totalMarked > 0 ? `${Math.round((summary.late / summary.totalMarked) * 100)}%` : '—'}
            </span>
          </div>
        </div>

        {/* On Leave (Subtle Blue Tint) */}
        <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-800/40 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-sky-800 dark:text-sky-300">
              On Leave
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-100/80 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs shrink-0">
              <FaCalendarDay />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-sky-900 dark:text-sky-100 leading-none">
              {summary.leave}
            </span>
            <span className="text-[11px] font-normal text-sky-700/80 dark:text-sky-300/80">
              {summary.totalMarked > 0 ? `${Math.round((summary.leave / summary.totalMarked) * 100)}%` : '—'}
            </span>
          </div>
        </div>

        {/* Attendance Rate (Neutral) */}
        <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Attendance Rate
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs shrink-0">
              <FaPercent />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              {summary.rate}%
            </span>
            <span className="text-[11px] font-normal text-slate-400">
              {summary.present + summary.late} of {summary.totalMarked}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Student Attendance Table */}
      <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xs">
        {/* Table header bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t('nav.history', 'Attendance Records')}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}
            </span>
            <span className="text-xs font-medium text-slate-400">
              • {classLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <FaCalendarAlt className="text-emerald-600" />
              {dateMode === 'single'
                ? dateFilter
                  ? new Date(dateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Select Date'
                : `${startDate} to ${endDate}`}
            </span>

            {/* Marking Status Badge for Single Date */}
            {dateMode === 'single' && (
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                  records.length === 0
                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
                }`}
              >
                {records.length === 0 ? 'Not Marked' : 'Marked'}
              </span>
            )}
          </div>
        </div>

        {/* Content body */}
        {loading ? (
          <div className="text-center py-16">
            <FaSpinner className="animate-spin text-3xl text-emerald-600 mx-auto mb-3" />
            <span className="text-xs text-slate-400 font-medium">{t('common.loading', 'Loading records...')}</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 font-medium text-sm">{error}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16">
            <FaUser className="mx-auto text-3xl text-slate-300 dark:text-slate-600 mb-3" />
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('students.noRecords', 'No attendance records found')}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {records.length === 0
                ? 'No roll call attendance records have been marked for this period.'
                : 'No records matched your search or status filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-150 dark:divide-gray-700 text-left">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-gray-700/40 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3.5">Sr. No.</th>
                  <th className="px-5 py-3.5">{t('students.rollNo', 'Roll No.')}</th>
                  <th className="px-5 py-3.5">{t('common.name', 'Student Name')}</th>
                  <th className="px-5 py-3.5">Class / Section</th>
                  <th className="px-5 py-3.5">{t('reports.date', 'Attendance Date')}</th>
                  <th className="px-5 py-3.5">{t('reports.status', 'Status')}</th>
                  <th className="px-5 py-3.5">{t('dashboard_extra.remarks', 'Remarks')}</th>
                  <th className="px-5 py-3.5">Marked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs text-slate-700 dark:text-slate-200 font-normal">
                {filteredRecords.map((rec, idx) => (
                  <tr
                    key={rec._id || idx}
                    className="hover:bg-slate-50/70 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                      {rec.studentId?.rollNo || 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                      {rec.studentId?.name || 'Unknown Student'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      {classLabel}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {new Date(rec.date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                          rec.status === 'Present'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                            : rec.status === 'Absent'
                            ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                            : rec.status === 'Late'
                            ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                            : 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-300'
                        }`}
                      >
                        {rec.status === 'Present'
                          ? t('attendance.present', 'Present')
                          : rec.status === 'Absent'
                          ? t('attendance.absent', 'Absent')
                          : rec.status === 'Late'
                          ? t('attendance.late', 'Late')
                          : rec.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 italic max-w-[180px] truncate">
                      {rec.remarks || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      {rec.markedBy?.name || 'Class Teacher'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceHistory;
