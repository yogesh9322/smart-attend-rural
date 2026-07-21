import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAttendanceReport } from '../services/api';
import { FaChevronLeft, FaChevronRight, FaInfoCircle, FaCalendarCheck } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const AttendanceCalendar = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const children = user?.children || [];

  const [selectedChildId, setSelectedChildId] = useState(children[0]?._id || '');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const fetchAttendance = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      setLoading(true);
      // Fetch child's attendance list
      const res = await getAttendanceReport({ studentId: selectedChildId });
      if (res.success) {
        setAttendanceRecords(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const startDayIndex = getFirstDayOfMonth(year, month); // 0 (Sunday) to 6 (Saturday)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Find record matching a calendar day (date parameter matches UTC Midnight conversion)
  const getRecordForDay = (dayNum) => {
    const checkDateStr = new Date(year, month, dayNum).toISOString().split('T')[0];
    return attendanceRecords.find(
      (r) => new Date(r.date).toISOString().split('T')[0] === checkDateStr
    );
  };

  const calendarDays = [];
  // Fill leading empty padding cells
  for (let i = 0; i < startDayIndex; i++) {
    calendarDays.push(null);
  }
  // Fill calendar days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-green-500 border-green-600 text-white';
      case 'Absent': return 'bg-red-500 border-red-600 text-white';
      case 'Late': return 'bg-amber-500 border-amber-600 text-white';
      case 'Leave': return 'bg-blue-500 border-blue-600 text-white';
      default: return 'bg-gray-100 border-gray-200 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('nav.attendance_calendar')}</h2>
          <p className="text-sm text-gray-500 font-medium">
            {t('nav.attendance_calendar') === 'उपस्थिति कैलेंडर' ? 'मासिक समयरेखा पर दैनिक कक्षा चेक-इन स्थिति को ट्रैक करें।' : 'Track daily class check-in status on a monthly timeline.'}
          </p>
        </div>

        {/* Child Selector */}
        {children.length > 1 && (
          <div>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {children.map((child) => (
                <option key={child._id} value={child._id}>
                  {child.name} (Roll {child.rollNo})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Calendar container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Grid Card */}
        <div className="lg:col-span-2 bg-white border border-gray-150 rounded-3xl p-6 shadow-md">
          {/* Navigation Month Controls */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <h3 className="text-base font-extrabold text-gray-800 tracking-tight">
              {t(`months.${monthNames[month].toLowerCase()}`)} {year}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition cursor-pointer"
              >
                <FaChevronLeft className="text-xs text-gray-600" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition cursor-pointer"
              >
                <FaChevronRight className="text-xs text-gray-600" />
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {/* Week Labels */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d} className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest py-2">
                {t(`days.${d.toLowerCase()}`)}
              </span>
            ))}

            {/* Day Cells */}
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-14 bg-gray-50 bg-opacity-30 rounded-xl"></div>;
              }

              const record = getRecordForDay(day);
              const colorClass = getStatusColor(record?.status);

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => record && setSelectedDayDetail(record)}
                  className={`h-14 border rounded-xl flex flex-col justify-between p-1.5 transition-all duration-150 cursor-pointer ${
                    record ? 'hover:scale-[1.03] hover:shadow-md' : 'bg-white border-gray-100'
                  } ${record ? colorClass : 'bg-white border-gray-100'}`}
                >
                  <span className="text-xs font-bold self-start">{day}</span>
                  {record && (
                    <span className="text-[8px] font-extrabold uppercase tracking-wider bg-black bg-opacity-20 px-1 py-0.5 rounded self-end">
                      {record.status === 'Present' ? t('attendance.present') : record.status === 'Absent' ? t('attendance.absent') : record.status === 'Late' ? t('attendance.late') : record.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend instructions */}
          <div className="flex flex-wrap gap-4 justify-center mt-6 pt-4 border-t border-gray-100 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500"></span> {t('attendance.present')}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500"></span> {t('attendance.absent')}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500"></span> {t('attendance.late')}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500"></span> {t('nav.leave_request') || 'Leave'}</span>
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="lg:col-span-1 bg-white border border-gray-150 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-4">{t('dashboard_extra.dayLogDetails')}</h3>
          {selectedDayDetail ? (
            <div className="space-y-4 animate-fade-in">
              <div>
                <span className="text-[10px] text-gray-450 uppercase block">{t('reports.date')}</span>
                <span className="text-xs font-bold text-gray-800">
                  {new Date(selectedDayDetail.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-450 uppercase block">{t('reports.status')}</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    selectedDayDetail.status === 'Present'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : selectedDayDetail.status === 'Absent'
                      ? 'bg-red-50 border-red-150 text-red-700'
                      : 'bg-amber-50 border-amber-250 text-amber-800'
                  }`}
                >
                  {selectedDayDetail.status === 'Present' ? t('attendance.present') : selectedDayDetail.status === 'Absent' ? t('attendance.absent') : selectedDayDetail.status === 'Late' ? t('attendance.late') : selectedDayDetail.status}
                </span>
              </div>

              {selectedDayDetail.markedBy && (
                <div>
                  <span className="text-[10px] text-gray-450 uppercase block">{t('classes.teacher')}</span>
                  <span className="text-xs font-bold text-gray-800">{selectedDayDetail.markedBy.name}</span>
                </div>
              )}

              <div>
                <span className="text-[10px] text-gray-450 uppercase block">{t('dashboard_extra.remarks')}</span>
                <p className="text-xs text-gray-500 font-semibold italic mt-0.5">
                  "{selectedDayDetail.remarks || 'No remarks added by teacher.'}"
                </p>
              </div>

              <div>
                <span className="text-[10px] text-gray-450 uppercase block">{t('dashboard_extra.aiVerification')}</span>
                <span className="text-xs font-bold text-gray-850">
                  {selectedDayDetail.aiVerified ? '🟢 ' + t('dashboard_extra.faceIdVerified') : '⚪ ' + t('dashboard_extra.standardCheckIn')}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FaInfoCircle className="mx-auto text-4xl text-gray-300 mb-3" />
              <p className="text-xs text-gray-400 font-bold">
                {t('dashboard_extra.clickCellInstructions')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendar;
