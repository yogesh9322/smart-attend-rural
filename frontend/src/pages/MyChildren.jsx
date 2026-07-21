import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAttendanceReport } from '../services/api';
import { FaGraduationCap, FaUser, FaClock, FaCalendarCheck } from 'react-icons/fa';

const MyChildren = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [childStats, setChildStats] = useState({});
  const navigate = useNavigate();

  const children = user?.children || [];

  useEffect(() => {
    const fetchChildrenStats = async () => {
      try {
        setLoading(true);
        const statsMap = {};
        const todayStr = new Date().toISOString().split('T')[0];

        for (const child of children) {
          const res = await getAttendanceReport({ studentId: child._id });
          if (res.success) {
            const records = res.data;
            const total = records.length;
            const presents = records.filter(r => r.status === 'Present').length;
            const lates = records.filter(r => r.status === 'Late').length;
            const rate = total > 0 ? Math.round(((presents + lates) / total) * 100) : 100;

            const todayRec = records.find(r => new Date(r.date).toISOString().split('T')[0] === todayStr);
            const todayStatus = todayRec ? todayRec.status : 'Not Marked';

            statsMap[child._id] = { rate, todayStatus };
          }
        }
        setChildStats(statsMap);
      } catch (err) {
        console.error('Failed to load children stats:', err);
      } finally {
        setLoading(false);
      }
    };

    if (children.length > 0) {
      fetchChildrenStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">My Children</h2>
        <p className="text-sm text-gray-500 font-medium">
          Manage profiles and check attendance reports for linked students.
        </p>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-150 rounded-3xl shadow-sm">
          <FaGraduationCap className="mx-auto text-5xl text-gray-300 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-gray-700">No Linked Children</h3>
          <p className="text-sm text-gray-400 mt-1">
            Please request the school registry admin to link student records to your parent account.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {children.map((child) => {
            const stats = childStats[child._id] || { rate: 100, todayStatus: 'Not Marked' };
            return (
              <div
                key={child._id}
                className="bg-white border border-gray-150 rounded-3xl p-6 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-green-50 text-[#2E7D32] border border-green-100 flex items-center justify-center text-lg font-extrabold">
                        {child.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-gray-800 tracking-tight">
                          {child.name}
                        </h3>
                        <p className="text-xs text-gray-400 font-bold uppercase mt-0.5">
                          Roll No: {child.rollNo} • Class {child.classId?.grade}-{child.classId?.section}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                        stats.todayStatus === 'Present'
                          ? 'bg-green-50 border-green-150 text-green-700'
                          : stats.todayStatus === 'Absent'
                          ? 'bg-red-50 border-red-150 text-red-700 animate-pulse'
                          : stats.todayStatus === 'Late'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      {stats.todayStatus === 'Present'
                        ? '🟢 Present'
                        : stats.todayStatus === 'Absent'
                        ? '🔴 Absent Today'
                        : stats.todayStatus === 'Late'
                        ? '🟠 Late Today'
                        : '⚪ Not Marked'}
                    </span>
                  </div>

                  {/* Attendance Percentage progress circle/bar */}
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <span>Attendance score</span>
                      <span className={stats.rate < 75 ? 'text-red-600 font-extrabold' : 'text-[#2E7D32] font-black'}>
                        {stats.rate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-50">
                      <div
                        style={{ width: `${stats.rate}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          stats.rate < 75 ? 'bg-red-600' : 'bg-[#2E7D32]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-gray-450 uppercase tracking-wider">
                    Admission: {child.admissionNo}
                  </span>
                  <button
                    onClick={() => navigate(`/child/${child._id}`)}
                    className="flex items-center gap-1 text-xs font-bold text-[#2E7D32] hover:underline cursor-pointer"
                  >
                    <span>View Child Details</span>
                    <FaUser className="text-[10px]" />
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

export default MyChildren;
