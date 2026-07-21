import React, { useState, useEffect } from 'react';
import { getStudents, getAttendanceReport, getDashboardStats } from '../services/api';
import {
  FaBrain,
  FaArrowDown,
  FaArrowUp,
  FaCalendarWeek,
  FaCalendarAlt,
  FaInfoCircle,
  FaSpinner,
  FaExclamationTriangle,
  FaAward
} from 'react-icons/fa';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from 'recharts';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Lists
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [starStudents, setStarStudents] = useState([]);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        const statsRes = await getDashboardStats();
        const studentsRes = await getStudents();
        const logsRes = await getAttendanceReport();

        if (statsRes.success) {
          setStats(statsRes.data);
        }

        if (studentsRes.success && logsRes.success) {
          const studentList = studentsRes.data;
          const logs = logsRes.data;

          const riskList = [];
          const starList = [];

          studentList.forEach((student) => {
            const studentLogs = logs.filter((r) => r.studentId?._id === student._id);
            const totalDays = studentLogs.length;
            if (totalDays > 0) {
              const presents = studentLogs.filter((r) => r.status === 'Present').length;
              const lates = studentLogs.filter((r) => r.status === 'Late').length;
              const rate = Math.round(((presents + lates) / totalDays) * 100);

              const sData = {
                id: student._id,
                name: student.name,
                rollNo: student.rollNo,
                class: student.classId ? `${student.classId.grade}-${student.classId.section}` : 'N/A',
                rate,
              };

              if (rate < 75) {
                riskList.push(sData);
              } else if (rate >= 95) {
                starList.push(sData);
              }
            }
          });

          setAtRiskStudents(riskList);
          setStarStudents(starList);
        }
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Weekly Trend Mock
  const weeklyTrends = [
    { name: 'Mon', rate: 92 },
    { name: 'Tue', rate: 94 },
    { name: 'Wed', rate: 89 },
    { name: 'Thu', rate: 95 },
    { name: 'Fri', rate: 87 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Advanced Analytics</h2>
        <p className="text-sm text-gray-500 font-medium">
          Monitor attendance trends, identify students with poor enrollment, and preview AI integrations.
        </p>
      </div>

      {/* Recharts Trends */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Area Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm">
          <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
            <FaCalendarWeek />
            <span>Weekly Presence Trends (%)</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[50, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" stroke="#1565C0" fill="#e3f2fd" strokeWidth={3} name="Presence Rate (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm">
          <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
            <FaCalendarAlt />
            <span>Monthly Performance Analysis (%)</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.monthlyTrends || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="rate" fill="#2E7D32" radius={[4, 4, 0, 0]} name="Average Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cohorts Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* At Risk (Below 75%) */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-700 uppercase border-b border-gray-100 pb-2 flex items-center gap-1.5 text-red-650">
            <FaExclamationTriangle />
            <span>Critical Watchlist (Below 75%)</span>
          </h3>

          <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
            {atRiskStudents.length > 0 ? (
              atRiskStudents.map((s) => (
                <div key={s.id} className="flex justify-between items-center p-3 bg-red-50 bg-opacity-70 border border-red-100 rounded-lg">
                  <div>
                    <span className="text-xs font-bold text-gray-800">{s.name}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Roll {s.rollNo} • Class {s.class}</span>
                  </div>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-150">
                    <FaArrowDown className="text-[10px]" />
                    <span>{s.rate}%</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-gray-400 font-semibold flex flex-col justify-center items-center gap-2 h-full">
                <FaInfoCircle className="text-lg" />
                <span>No students below the 75% critical threshold.</span>
              </div>
            )}
          </div>
        </div>

        {/* Star Students (Above 95%) */}
        <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-700 uppercase border-b border-gray-100 pb-2 flex items-center gap-1.5 text-green-700">
            <FaAward />
            <span>Star Attendance (Above 95%)</span>
          </h3>

          <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
            {starStudents.length > 0 ? (
              starStudents.map((s) => (
                <div key={s.id} className="flex justify-between items-center p-3 bg-green-50 bg-opacity-70 border border-green-100 rounded-lg">
                  <div>
                    <span className="text-xs font-bold text-gray-800">{s.name}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Roll {s.rollNo} • Class {s.class}</span>
                  </div>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-150">
                    <FaArrowUp className="text-[10px]" />
                    <span>{s.rate}%</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-xs text-gray-400 font-semibold flex flex-col justify-center items-center gap-2 h-full">
                <FaInfoCircle className="text-lg" />
                <span>No students currently above the 95% perfect rate.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI-Ready Section (Coming Soon) */}
      <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase border-b border-gray-100 pb-2 flex items-center gap-2">
          <FaBrain className="text-primary text-lg" />
          <span>AI Predictive Analytics Preview</span>
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Risk Prediction */}
          <div className="p-4 border border-dashed border-gray-300 rounded-xl relative overflow-hidden bg-gray-50 flex flex-col justify-between h-40">
            <div>
              <h4 className="text-sm font-bold text-gray-750">Absenteeism Risk</h4>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Uses historical check-in distributions to flags students who are highly likely to skip classes in the next week.
              </p>
            </div>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-50 border border-amber-150 text-amber-700 rounded-full w-fit uppercase scale-90">
              Coming Soon
            </span>
          </div>

          {/* Face Check */}
          <div className="p-4 border border-dashed border-gray-300 rounded-xl relative overflow-hidden bg-gray-50 flex flex-col justify-between h-40">
            <div>
              <h4 className="text-sm font-bold text-gray-750">Face Recognition</h4>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Integrates Face-API.js models to run biometric validation checks on group photos captured inside the classroom.
              </p>
            </div>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-50 border border-amber-150 text-amber-700 rounded-full w-fit uppercase scale-90">
              Coming Soon
            </span>
          </div>

          {/* Gemini Insights */}
          <div className="p-4 border border-dashed border-gray-300 rounded-xl relative overflow-hidden bg-gray-50 flex flex-col justify-between h-40">
            <div>
              <h4 className="text-sm font-bold text-gray-750">Gemini Pro Insights</h4>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Automatically summaries school-wide patterns to output recommendations for mid-day meals and parent counseling.
              </p>
            </div>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-50 border border-amber-150 text-amber-700 rounded-full w-fit uppercase scale-90">
              Coming Soon
            </span>
          </div>

          {/* Dropout Prediction */}
          <div className="p-4 border border-dashed border-gray-300 rounded-xl relative overflow-hidden bg-gray-50 flex flex-col justify-between h-40">
            <div>
              <h4 className="text-sm font-bold text-gray-750">Dropout Risk Analyzer</h4>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Alerts central education ministries if students show critical signs of dropping out of the curriculum.
              </p>
            </div>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-50 border border-amber-150 text-amber-700 rounded-full w-fit uppercase scale-90">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
