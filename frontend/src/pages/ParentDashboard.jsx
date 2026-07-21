import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import AIInsightsWidget from '../components/AIInsightsWidget';
import WelcomeGuide from '../components/AI/WelcomeGuide';
import { getAttendanceReport, getParentNotices, getLeaveRequests, getSchoolEvents } from '../services/api';
import socket from '../services/socket';
import { generateClassReportPDF } from '../utils/pdfGenerator';
import {
  FaGraduationCap,
  FaCalendarCheck,
  FaFilePdf,
  FaBullhorn,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaPaperPlane,
  FaRobot,
  FaCalendarAlt,
  FaBriefcaseMedical,
  FaBell
} from 'react-icons/fa';

const ParentDashboard = () => {
  const { user } = useAuth();
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [attendance, setAttendance] = useState([]);
  const [notices, setNotices] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [events, setEvents] = useState([]);
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
      const [attendanceRes, noticesRes, leavesRes, eventsRes] = await Promise.all([
        getAttendanceReport({ studentId: currentChild._id }),
        getParentNotices(),
        getLeaveRequests(),
        getSchoolEvents()
      ]);

      if (attendanceRes.success) {
        setAttendance(attendanceRes.data);
      }
      if (noticesRes.success) {
        setNotices(noticesRes.data.slice(0, 3));
      }
      if (leavesRes.success) {
        // Filter leaves submitted for this child
        const childLeaves = leavesRes.data.filter(l => l.studentId?._id === currentChild._id);
        setLeaves(childLeaves);
      }
      if (eventsRes.success) {
        setEvents(eventsRes.data.slice(0, 3));
      }
    } catch (err) {
      console.error('Failed to load parent metrics:', err);
      if (!isBackground) setError('Error loading student metrics.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [currentChild]);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="p-12 bg-white border border-gray-150 rounded-3xl shadow-sm text-center max-w-xl mx-auto mt-12">
        <FaGraduationCap className="text-5xl text-gray-300 mx-auto mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-gray-700">No Linked Student Records</h3>
        <p className="text-sm text-gray-400 mt-1">
          Please contact the school administrative office to link your parent account to your child's student profile.
        </p>
      </div>
    );
  }

  // Calculate statistics for the current child
  const totalDays = attendance.length;
  const presents = attendance.filter((r) => r.status === 'Present').length;
  const absents = attendance.filter((r) => r.status === 'Absent').length;
  const lates = attendance.filter((r) => r.status === 'Late').length;
  const leavesApproved = attendance.filter((r) => r.status === 'Leave').length;

  const netPresents = presents + lates;
  const attendanceRate = totalDays > 0 ? Math.round((netPresents / totalDays) * 100) : 100;

  // Get status for today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendance.find(
    (r) => new Date(r.date).toISOString().split('T')[0] === todayStr
  );
  const todayStatus = todayRecord ? todayRecord.status : 'Not Marked Yet';

  // Group by month for custom Bar Chart
  const monthlyData = {};
  attendance.forEach((rec) => {
    const d = new Date(rec.date);
    const monthName = d.toLocaleString('default', { month: 'short' });
    if (!monthlyData[monthName]) {
      monthlyData[monthName] = { month: monthName, total: 0, present: 0 };
    }
    monthlyData[monthName].total += 1;
    if (rec.status === 'Present' || rec.status === 'Late') {
      monthlyData[monthName].present += 1;
    }
  });

  const chartData = Object.values(monthlyData).map((m) => ({
    month: m.month,
    rate: Math.round((m.present / m.total) * 100),
  })).reverse(); // show chronological

  // PDF report downloader
  const handleDownloadPDF = () => {
    if (!currentChild) return;
    const classInfo = currentChild.classId || { grade: 'Grade', section: 'N/A' };
    generateClassReportPDF(
      classInfo,
      [currentChild],
      attendance,
      'Full Academic Year'
    );
  };

  const currentLeaveStatus = leaves.length > 0 ? leaves[0].status : 'No Request';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Child selector tabs if parent has multiple children */}
      {children.length > 1 && (
        <div className="flex border-b border-gray-150 bg-white p-2 rounded-2xl shadow-sm">
          {children.map((child, idx) => (
            <button
              key={child._id}
              onClick={() => setSelectedChildIndex(idx)}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                selectedChildIndex === idx
                  ? 'bg-green-50 text-[#2E7D32] border border-green-100'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {child.name} (Roll {child.rollNo})
            </button>
          ))}
        </div>
      )}

      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            {user?.photo ? (
              <img
                src={user.photo}
                alt={user?.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-[#2E7D32] shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-950/50 text-[#2E7D32] dark:text-green-400 border-2 border-[#2E7D32] flex items-center justify-center font-bold text-lg shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>{user?.name || 'Parent Dashboard'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950 text-[#2E7D32] dark:text-green-400 border border-green-200 dark:border-green-800">
                Parent
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-300 font-semibold mt-0.5">
              Child: <strong className="text-gray-800 dark:text-gray-100">{currentChild.name}</strong> ({currentChild.classId?.grade || 'Grade'}-{currentChild.classId?.section || 'Section'} • Roll {currentChild.rollNo})
            </p>
          </div>
        </div>

        {/* PDF Download Button */}
        <button
          onClick={handleDownloadPDF}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition cursor-pointer self-start sm:self-auto"
        >
          <FaFilePdf />
          <span>Download Report</span>
        </button>
      </div>

      {/* AI Welcome Daily Summary Guide */}
      <WelcomeGuide />

      {/* AI Recommendations Insight Banner */}
      <AIInsightsWidget />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Attendance Rate */}
        <div className="bg-white border border-gray-155 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-green-50 text-[#2E7D32] border border-green-100 rounded-2xl">
            <FaGraduationCap className="text-xl" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Attendance Rate</p>
            <h3 className="text-xl font-black text-gray-800 mt-0.5">{attendanceRate}%</h3>
          </div>
        </div>

        {/* Today's Status */}
        <div className="bg-white border border-gray-155 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl border ${
            todayStatus === 'Present'
              ? 'bg-green-50 text-green-700 border-green-100'
              : todayStatus === 'Absent'
              ? 'bg-red-50 text-red-700 border-red-100 animate-pulse'
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            <FaCalendarCheck className="text-xl" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Today's Status</p>
            <h3 className="text-sm font-extrabold text-gray-800 mt-0.5">{todayStatus}</h3>
          </div>
        </div>

        {/* Leave status */}
        <div className="bg-white border border-gray-155 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-2xl">
            <FaBriefcaseMedical className="text-xl" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Leave Status</p>
            <h3 className="text-sm font-extrabold text-gray-800 mt-0.5">{currentLeaveStatus}</h3>
          </div>
        </div>

        {/* Unread notices */}
        <div className="bg-white border border-gray-155 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-2xl">
            <FaBell className="text-xl" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Unread Notices</p>
            <h3 className="text-xl font-black text-gray-800 mt-0.5">{notices.length}</h3>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-md">
        <h3 className="text-sm font-extrabold text-gray-800 mb-4 uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/attendance/calendar')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-green-50 border border-gray-150 hover:border-green-200 rounded-2xl text-xs font-bold text-gray-700 hover:text-[#2E7D32] transition cursor-pointer"
          >
            <FaCalendarAlt className="text-lg" />
            <span>View Calendar</span>
          </button>
          <button
            onClick={() => navigate('/leave-request')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-green-50 border border-gray-150 hover:border-green-200 rounded-2xl text-xs font-bold text-gray-700 hover:text-[#2E7D32] transition cursor-pointer"
          >
            <FaPaperPlane className="text-lg" />
            <span>Apply Leave</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-green-50 border border-gray-150 hover:border-green-200 rounded-2xl text-xs font-bold text-gray-700 hover:text-[#2E7D32] transition cursor-pointer"
          >
            <FaFilePdf className="text-lg" />
            <span>Download Report</span>
          </button>
          <button
            onClick={() => navigate('/parent-ai')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-green-50 border border-gray-150 hover:border-green-200 rounded-2xl text-xs font-bold text-gray-700 hover:text-[#2E7D32] transition cursor-pointer"
          >
            <FaRobot className="text-lg" />
            <span>Chat with AI</span>
          </button>
        </div>
      </div>

      {/* Analytics custom CSS charts & events timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom CSS Monthly Bar Chart */}
        <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider mb-4">
            Monthly Attendance Trend (%)
          </h3>
          {chartData.length > 0 ? (
            <div className="flex items-end justify-between h-48 pt-4">
              {chartData.map((d) => (
                <div key={d.month} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full flex items-end justify-center h-36">
                    <div
                      style={{ height: `${d.rate}%` }}
                      className="w-8 bg-[#2E7D32] rounded-t-md hover:opacity-90 transition-all duration-300 relative group"
                      title={`Present: ${d.rate}%`}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {d.rate}%
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{d.month}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 font-bold text-center py-16">
              No attendance records found for this child standard yet.
            </p>
          )}
        </div>

        {/* Upcoming School Events */}
        <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">
              Upcoming School Events
            </h3>
            <Link to="/school-events" className="text-xs font-bold text-[#2E7D32] hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {events.length > 0 ? (
              events.map((ev) => (
                <div key={ev._id} className="p-3 border border-gray-100 rounded-2xl bg-gray-50 bg-opacity-35">
                  <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-green-50 text-[#2E7D32] border border-green-150 rounded-full uppercase tracking-wider">
                    {ev.type}
                  </span>
                  <h4 className="text-xs font-bold text-gray-800 mt-1">{ev.title}</h4>
                  <span className="text-[9px] text-gray-400 font-bold block mt-1 uppercase">
                    {new Date(ev.date).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 font-bold text-center py-12">
                No events scheduled.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Roster logs & notices grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Daily Logs Table */}
        <div className="bg-white border border-gray-150 p-5 rounded-3xl shadow-sm lg:col-span-2">
          <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider mb-4">
            Recent Daily Logs
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-150 text-left">
              <thead>
                <tr className="bg-gray-50 bg-opacity-60 text-[10px] font-extrabold text-gray-450 uppercase tracking-widest">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3">Verified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
                {attendance.slice(0, 5).map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5 text-gray-600">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        record.status === 'Present'
                          ? 'bg-green-50 border-green-150 text-green-700'
                          : record.status === 'Absent'
                          ? 'bg-red-50 border-red-150 text-red-700 animate-pulse'
                          : 'bg-amber-50 border-amber-250 text-amber-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 italic font-medium max-w-[120px] truncate">
                      {record.remarks || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 font-medium">
                      {record.markedBy?.name || 'Class Teacher'}
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-xs text-gray-400 font-bold">
                      No daily records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notices list */}
        <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-5 rounded-3xl shadow-sm lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              Recent Notices
            </h3>
            <Link to="/notices" className="text-xs font-bold text-[#2E7D32] dark:text-green-400 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {notices.map((notice) => {
              const isSchool = notice.noticeType === 'School' || notice.scope === 'Entire School';
              return (
                <div key={notice._id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-750">
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold mb-1 border ${
                    isSchool
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                  }`}>
                    {isSchool ? '🏫 School Notice' : '👨‍🏫 Class Notice'}
                  </span>
                  <h4 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1">
                    {notice.title}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-300 font-medium line-clamp-3 leading-relaxed">
                    {notice.content || notice.description}
                  </p>
                  <div className="mt-2 text-[9px] text-gray-400 font-bold uppercase">
                    {new Date(notice.createdAt || notice.publishDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(notice.createdAt || notice.publishDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ParentDashboard;
