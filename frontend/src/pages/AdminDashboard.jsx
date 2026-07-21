import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import AIInsightsWidget from '../components/AIInsightsWidget';
import WelcomeGuide from '../components/AI/WelcomeGuide';
import { getDashboardStats, getNotices } from '../services/api';
import socket from '../services/socket';
import {
  FaGraduationCap,
  FaChalkboardTeacher,
  FaCalendarCheck,
  FaUserTimes,
  FaPlus,
  FaFileAlt,
  FaBullhorn
} from 'react-icons/fa';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const AdminDashboard = () => {
  const { t } = useTranslation('common');
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [statsRes, noticesRes] = await Promise.all([
        getDashboardStats(),
        getNotices()
      ]);
      
      if (statsRes.success) {
        setStats(statsRes.data);
      }
      if (noticesRes.success) {
        setNotices(noticesRes.data.slice(0, 2)); // show top 2 recent notices
      }
    } catch (err) {
      console.error(err);
      if (!isBackground) setError('Failed to retrieve dashboard reports.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    socket.on('attendance_updated', () => fetchData(true));
    socket.on('student_updated', () => fetchData(true));
    socket.on('leave_updated', () => fetchData(true));

    return () => {
      socket.off('attendance_updated');
      socket.off('student_updated');
      socket.off('leave_updated');
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const counters = stats?.counters || {
    totalStudents: 0,
    totalTeachers: 0,
    todayPercentage: 0,
    absentToday: 0
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
      <WelcomeGuide />

      {/* AI Recommendations Insight Banner */}
      <AIInsightsWidget />

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

        {/* Today's Attendance % */}
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-150 p-5 flex items-center gap-4">
          <div className="p-3.5 bg-green-50 rounded-2xl text-primary border border-green-100">
            <FaCalendarCheck className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">{t('dashboard.presentRate')}</p>
            <h3 className="text-2xl font-extrabold text-gray-800">{counters.todayPercentage}%</h3>
          </div>
        </div>

        {/* Absent Students count */}
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-150 p-5 flex items-center gap-4">
          <div className="p-3.5 bg-red-50 rounded-2xl text-red-600 border border-red-100">
            <FaUserTimes className="text-2xl" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">{t('dashboard.absentStudents')}</p>
            <h3 className="text-2xl font-extrabold text-gray-800">{counters.absentToday}</h3>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm">
        <h3 className="text-base font-bold text-gray-700 mb-4">{t('common.quickActions')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            to="/students"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <FaPlus />
            <span>{t('students.addStudent')}</span>
          </Link>
          <Link
            to="/teachers"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary hover:bg-secondary-dark text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <FaPlus />
            <span>{t('teachers.addTeacher')}</span>
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

      {/* Graphs Layout Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Class-wise Attendance Rates Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm">
          <h3 className="text-base font-bold text-gray-700 mb-4">{t('dashboard.starPerformers')} (%)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.classWise || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="className" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="rate" fill="#1565C0" name="Attendance Rate (%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Attendance Trends Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm">
          <h3 className="text-base font-bold text-gray-700 mb-4">{t('dashboard.monthlyChart')} (%)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.monthlyTrends || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#2E7D32" strokeWidth={3} activeDot={{ r: 8 }} name="Average Attendance (%)" />
              </LineChart>
            </ResponsiveContainer>
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
    </motion.div>
  );
};

export default AdminDashboard;
