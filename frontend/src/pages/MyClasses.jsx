import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getClasses, getStudents, getDashboardStats } from '../services/api';
import { hasOfflineAttendance } from '../services/db';
import { FaGraduationCap, FaCalendarCheck, FaFolderOpen, FaSpinner, FaChalkboard, FaClock, FaUsers } from 'react-icons/fa';

const MyClasses = () => {
  const { t } = useTranslation();
  const [classes, setClasses] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [lastUpdatedMap, setLastUpdatedMap] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchClassesAndStats = async () => {
      try {
        setLoading(true);
        const classesRes = await getClasses();

        if (classesRes.success) {
          const fetchedClasses = classesRes.data;
          setClasses(fetchedClasses);

          // Get stats to find online marked classes today
          const statsRes = await getDashboardStats();
          const today = new Date().toISOString().split('T')[0];

          const counts = {};
          const statusMap = {};
          const timeMap = {};

          const timezone = statsRes.data?.schoolTimezone || 'Asia/Kolkata';
          const todayDate = statsRes.data?.schoolLocalDate || new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
          const todayClasses = statsRes.data?.todayClasses || [];

          for (const cls of fetchedClasses) {
            // Fetch student count for this class standard
            const studentsRes = await getStudents({ classId: cls._id });
            if (studentsRes.success) {
              counts[cls._id] = studentsRes.data.length;
            }

            // Check if there is an offline cached record first
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

          setStudentCounts(counts);
          setAttendanceStatus(statusMap);
          setLastUpdatedMap(timeMap);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load class rosters.');
      } finally {
        setLoading(false);
      }
    };

    fetchClassesAndStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('my_classes.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {t('my_classes.subtitle')}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm">
          <FaChalkboard className="mx-auto text-5xl text-gray-300 dark:text-gray-600 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-gray-700 dark:text-white">{t('my_classes.noClassesAssigned')}</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => {
            const status = attendanceStatus[cls._id] || 'Pending';
            return (
              <div
                key={cls._id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xs hover:border-[#2E7D32] dark:hover:border-green-500 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Class Badge & Status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center justify-center p-3 bg-green-50 dark:bg-green-950 text-[#2E7D32] dark:text-green-400 rounded-2xl border border-green-100 dark:border-green-800">
                      <FaChalkboard className="text-xl" />
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        status === 'Marked'
                          ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                          : status === 'Partially Marked'
                          ? 'bg-amber-50 border-amber-250 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : status === 'Cached (Pending)'
                          ? 'bg-amber-50 border-amber-250 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : status === 'Not Scheduled'
                          ? 'bg-gray-100 border-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          : 'bg-red-50 border-red-150 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      }`}
                    >
                      {status === 'Marked'
                        ? `🟢 ${t('teacher_dashboard.marked', 'Marked')}`
                        : status === 'Partially Marked'
                        ? `🟠 ${t('teacher_dashboard.partiallyMarked', 'Partially Marked')}`
                        : status === 'Cached (Pending)'
                        ? `🟡 ${t('teacher_dashboard.cachedPending', 'Cached (Pending)')}`
                        : status === 'Not Scheduled'
                        ? `⚪ ${t('teacher_dashboard.notScheduled', 'Not Scheduled')}`
                        : `🔴 ${t('teacher_dashboard.pending', 'Pending')}`}
                    </span>
                  </div>

                  {/* Class Title */}
                  <h3 className="text-xl font-extrabold text-gray-800 dark:text-white tracking-tight">
                    {cls.grade} - {cls.section}
                  </h3>
                  
                  {/* Class Metadata */}
                  <div className="mt-4 space-y-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                    <div className="flex items-center gap-2">
                      <FaGraduationCap className="text-gray-400 text-sm" />
                      <span>
                        <strong className="text-gray-800 dark:text-gray-200">{studentCounts[cls._id] ?? '...'}</strong> {t('dashboard.totalStudents')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium pt-1">
                      <span>Room: <strong className="text-gray-800 dark:text-gray-200">{cls.roomNo || 'N/A'}</strong></span>
                      <span>Session: <strong className="text-gray-800 dark:text-gray-200">{cls.academicYear || '2026-2027'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-semibold pt-2 border-t border-gray-150 dark:border-gray-700">
                      <FaClock className="text-gray-400 text-xs" />
                      <span>
                        Last Updated:{' '}
                        <strong className="text-gray-800 dark:text-gray-200">
                          {lastUpdatedMap[cls._id]
                            ? `Today • ${lastUpdatedMap[cls._id]}`
                            : t('teacher_dashboard.notMarkedToday', 'Not marked today')}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-gray-150 dark:border-gray-700 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(`/attendance/mark?classId=${cls._id}`)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] border border-transparent rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <FaCalendarCheck />
                    <span>Take Attendance</span>
                  </button>
                  <button
                    onClick={() => navigate(`/students?classId=${cls._id}`)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl transition-all cursor-pointer"
                  >
                    <FaUsers />
                    <span>View Students</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyClasses;
