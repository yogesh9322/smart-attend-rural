import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getAttendanceReport } from '../services/api';
import { FaGraduationCap, FaChevronRight } from 'react-icons/fa';

const MyChildren = () => {
  const { t } = useTranslation();
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

  const formatGradeStr = (classObj) => {
    if (!classObj || !classObj.grade) return 'Student';
    const cleanGrade = String(classObj.grade).replace(/^grade\s+/i, '').trim();
    const section = classObj.section ? `-${classObj.section}` : '';
    return `Grade ${cleanGrade}${section}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 sm:space-y-7 font-sans text-slate-800 dark:text-[#F8FAFC]"
      style={{ fontFamily: 'Inter, "Noto Sans Devanagari", system-ui, -apple-system, sans-serif' }}
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-[#F8FAFC]">
          {t('my_children.title')}
        </h1>
        <p className="text-sm sm:text-base font-normal text-slate-500 dark:text-[#94A3B8] mt-1.5 leading-relaxed">
          {t('my_children.subtitle')}
        </p>
      </div>

      {children.length === 0 ? (
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-10 text-center max-w-md mx-auto shadow-2xs">
          <FaGraduationCap className="mx-auto text-4xl text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-[#F8FAFC]">
            {t('my_children.noChildrenLinked')}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {children.map((child) => {
            const stats = childStats[child._id] || { rate: 100, todayStatus: 'Not Marked' };
            const initial = child.name ? child.name.charAt(0).toUpperCase() : 'C';
            const gradeDisplay = formatGradeStr(child.classId);

            return (
              <div
                key={child._id}
                className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between space-y-5"
              >
                <div>
                  {/* Top row: Avatar + Name/Roll/Grade + Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50 dark:bg-[#062c1d] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-xl font-semibold shrink-0 shadow-2xs">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC] truncate leading-snug">
                          {child.name}
                        </h2>
                        <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-[#94A3B8] mt-0.5 truncate">
                          {t('my_children.rollNo')} {child.rollNo || 'N/A'} • {gradeDisplay}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap ${
                        stats.todayStatus === 'Present'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#062c1d] dark:text-emerald-300 dark:border-emerald-800/60'
                          : stats.todayStatus === 'Absent'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-[#3b1212] dark:text-red-300 dark:border-red-800/60'
                          : stats.todayStatus === 'Late'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-[#36200d] dark:text-amber-300 dark:border-amber-800/60'
                          : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#182235] dark:text-[#CBD5E1] dark:border-[#263247]'
                      }`}
                    >
                      {stats.todayStatus === 'Present'
                        ? t('attendance.present')
                        : stats.todayStatus === 'Absent'
                        ? t('attendance.absent')
                        : stats.todayStatus === 'Late'
                        ? t('attendance.late')
                        : t('teacher_dashboard.pending')}
                    </span>
                  </div>

                  {/* Attendance Rate Section */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium text-slate-600 dark:text-[#CBD5E1]">
                        {t('parent_dashboard.attendanceRate')}
                      </span>
                      <span className="text-xl font-semibold text-slate-900 dark:text-[#F8FAFC]">
                        {stats.rate}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-[#263247] h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${stats.rate}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          stats.rate < 50
                            ? 'bg-red-500 dark:bg-red-400'
                            : stats.rate < 75
                            ? 'bg-amber-500 dark:bg-amber-400'
                            : 'bg-emerald-600 dark:bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer row: Admission No. & View Action */}
                <div className="pt-4 border-t border-slate-150 dark:border-[#263247] flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500 dark:text-[#94A3B8]">
                    {t('my_children.admissionNo')} {child.admissionNo || 'N/A'}
                  </span>
                  <button
                    onClick={() => navigate(`/child/${child._id}`)}
                    className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{t('my_children.viewProfile')}</span>
                    <FaChevronRight className="text-[10px]" />
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
