import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getClasses, getAttendanceReport } from '../services/api';
import socket from '../services/socket';
import {
  FaClock,
  FaChalkboard,
  FaCalendarCheck,
  FaCheckCircle,
  FaHourglassHalf,
  FaMapMarkerAlt,
  FaEye,
  FaCalendarDay,
  FaSpinner
} from 'react-icons/fa';

const Timetable = () => {
  const { t, i18n } = useTranslation('common');
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [markedClassIds, setMarkedClassIds] = useState(new Set());

  const isHi = i18n.language === 'hi';
  const isMr = i18n.language === 'mr';

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // Live refresh every 15 seconds
    return () => clearInterval(timer);
  }, []);

  const fetchTeacherScheduleData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      // Fetch assigned classes
      const classData = await getClasses();
      if (classData.success) {
        setAssignedClasses(classData.data || []);
      }

      // Fetch today's marked attendance
      const todayStr = new Date().toISOString().split('T')[0];
      const attData = await getAttendanceReport({ date: todayStr });
      if (attData.success && Array.isArray(attData.data)) {
        const markedIds = new Set(attData.data.map(r => r.classId?._id || r.classId));
        setMarkedClassIds(markedIds);
      }
    } catch (err) {
      console.error('Failed to load teacher schedule data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherScheduleData();

    socket.on('attendance_updated', () => fetchTeacherScheduleData(true));
    return () => {
      socket.off('attendance_updated');
    };
  }, [user]);

  // Determine current day of week
  const dayOfWeek = currentTime.toLocaleDateString(undefined, { weekday: 'long' });
  const isWeekend = dayOfWeek === 'Sunday';

  // Master schedule slots for school day
  const basePeriods = [
    {
      id: 'p1',
      period: 'Period 1',
      timeStart: '09:00',
      timeEnd: '10:00',
      slotIndex: 0
    },
    {
      id: 'p2',
      period: 'Period 2',
      timeStart: '10:00',
      timeEnd: '11:00',
      slotIndex: 1
    },
    {
      id: 'recess',
      period: 'Recess',
      subject: 'Recess',
      timeStart: '11:00',
      timeEnd: '11:15',
      isBreak: true,
      breakType: 'recess'
    },
    {
      id: 'p3',
      period: 'Period 3',
      timeStart: '11:15',
      timeEnd: '12:15',
      slotIndex: 2
    },
    {
      id: 'lunch',
      period: 'Lunch',
      subject: 'Lunch Break',
      timeStart: '12:15',
      timeEnd: '13:15',
      isBreak: true,
      breakType: 'lunch'
    },
    {
      id: 'p4',
      period: 'Period 4',
      timeStart: '13:15',
      timeEnd: '14:15',
      slotIndex: 3
    },
    {
      id: 'p5',
      period: 'Period 5',
      timeStart: '14:15',
      timeEnd: '15:15',
      slotIndex: 4
    }
  ];

  // Map teacher's assigned classes to slots dynamically
  const teacherSchedule = basePeriods.map((slot) => {
    if (slot.isBreak) return slot;

    // Assign assigned class to period if available
    const assignedClass = assignedClasses[slot.slotIndex % Math.max(1, assignedClasses.length)];
    const hasAssignedClass = assignedClasses.length > 0 && slot.slotIndex < Math.max(2, assignedClasses.length * 2);

    if (hasAssignedClass && assignedClass) {
      const isMarked = markedClassIds.has(assignedClass._id);
      return {
        ...slot,
        subject: user?.subject || (assignedClass.grade.includes('6') ? 'English Language' : 'Mathematics'),
        grade: `${assignedClass.grade}-${assignedClass.section}`,
        room: assignedClass.roomNo ? `Room ${assignedClass.roomNo}` : 'Main Classroom',
        classId: assignedClass._id,
        isMarked,
        isTeachingPeriod: true
      };
    }

    // Free Period slot
    return {
      ...slot,
      subject: isMr ? 'फ्री तासीका' : isHi ? 'खाली अवधि' : (t('calendar_schedules.freePeriod') || 'Free Period'),
      isFreePeriod: true
    };
  });

  const parseToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const currentTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Active item
  const activeItem = !isWeekend ? teacherSchedule.find(
    (item) => currentTotalMinutes >= parseToMinutes(item.timeStart) && currentTotalMinutes < parseToMinutes(item.timeEnd)
  ) : null;

  // Class statistics
  const teachingPeriods = teacherSchedule.filter((s) => s.isTeachingPeriod);
  const completedClasses = !isWeekend ? teachingPeriods.filter((s) => parseToMinutes(s.timeEnd) <= currentTotalMinutes).length : 0;
  const remainingClasses = !isWeekend ? teachingPeriods.length - completedClasses : 0;

  // Format Date String
  const formattedTodayDate = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Header: Date & Active Period */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#2E7D32] dark:text-green-400 uppercase tracking-wider mb-1">
            <FaCalendarDay />
            <span>{formattedTodayDate}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
            {t('nav.timetable')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            {isMr ? 'शिक्षक वेळापत्रक:' : isHi ? 'शिक्षक कार्यक्रम:' : 'Teacher schedule for'} <strong className="text-gray-800 dark:text-gray-200">{user?.name || 'Teacher'}</strong>
          </p>
        </div>

        {/* Current Period Banner */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-sm font-bold">
            <FaClock />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase block">{isMr ? 'सध्याचा तास' : isHi ? 'वर्तमान अवधि' : 'Current Period'}</span>
            <span className="text-xs font-bold text-gray-900 dark:text-white block mt-0.5">
              {isWeekend
                ? (isMr ? 'रविवार • शाळा बंद' : isHi ? 'रविवार • स्कूल बंद' : 'Sunday • School Closed')
                : activeItem
                ? activeItem.isBreak
                  ? activeItem.subject
                  : activeItem.isFreePeriod
                  ? (isMr ? 'फ्री तासीका' : isHi ? 'खाली अवधि' : 'Free Period')
                  : `${activeItem.period}: ${activeItem.subject} (${activeItem.grade})`
                : (isMr ? 'सध्या कोणताही तास सुरू नाही' : isHi ? 'कोई सक्रिय कक्षा अवधि नहीं' : 'No Active Class Period')}
            </span>
          </div>
        </div>
      </div>

      {/* Top Summary Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold text-base">
            <FaChalkboard />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">{isMr ? 'आजचे एकूण तास' : isHi ? 'आज की कुल कक्षाएं' : 'Total Classes Today'}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">
              {isWeekend ? '0' : `${teachingPeriods.length} ${isMr ? 'नियुक्त' : isHi ? 'सौंपी गई' : 'Assigned'}`}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-base">
            <FaCheckCircle />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">{isMr ? 'पूर्ण झालेले तास' : isHi ? 'पूरी हुई कक्षाएं' : 'Completed Classes'}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">
              {isWeekend ? '0' : `${completedClasses} ${isMr ? 'पूर्ण' : isHi ? 'पूर्ण' : 'Completed'}`}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center font-bold text-base">
            <FaHourglassHalf />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">{isMr ? 'उरलेले तास' : isHi ? 'शेष कक्षाएं' : 'Remaining Classes'}</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white block mt-0.5">
              {isWeekend ? '0' : `${remainingClasses} ${isMr ? 'बाकी' : isHi ? 'शेष' : 'Remaining'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl border border-gray-200 dark:border-gray-700 text-center space-y-3">
          <FaSpinner className="animate-spin text-2xl text-[#2E7D32] mx-auto" />
          <span className="text-xs font-semibold text-gray-400 block">{t('common.loading')}</span>
        </div>
      ) : isWeekend || teachingPeriods.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl border border-gray-200 dark:border-gray-700 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-xl font-bold">
            <FaCalendarCheck />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {isMr ? 'आज तुमच्यासाठी कोणताही तास नियोजित नाही.' : isHi ? 'आज आपकी कोई निर्धारित कक्षा नहीं है।' : 'You have no scheduled classes today.'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
            {isWeekend
              ? (isMr ? 'रविवारच्या सुट्टीचा आनंद घ्या! रविवारी शाळा बंद असते.' : isHi ? 'सप्ताहांत का आनंद लें! रविवार को स्कूल बंद रहता है।' : 'Enjoy your weekend! School is closed on Sundays.')
              : (isMr ? 'आज तुमच्यासाठी कोणतेही तास नियुक्त केलेले नाहीत.' : isHi ? 'आज आपके लिए कोई निर्धारित कक्षा अवधि नहीं है।' : 'You have no assigned class periods scheduled for today.')}
          </p>
        </div>
      ) : (
        /* Timetable Period Entries List */
        <div className="space-y-3 font-sans">
          {teacherSchedule.map((item) => {
            const startMin = parseToMinutes(item.timeStart);
            const endMin = parseToMinutes(item.timeEnd);
            const isActive = !isWeekend && currentTotalMinutes >= startMin && currentTotalMinutes < endMin;
            const isCompleted = !isWeekend && currentTotalMinutes >= endMin;

            // Render Non-Teaching Breaks (Lunch / Recess)
            if (item.isBreak) {
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-gray-100/80 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400 w-24">
                      {item.timeStart} - {item.timeEnd}
                    </span>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {item.breakType === 'lunch' ? (isMr ? 'जेवणाची सुट्टी' : isHi ? 'लंच ब्रेक' : 'Lunch Break') : (isMr ? 'मध्यांतर' : isHi ? 'मध्यांतर' : 'Recess')}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Break
                  </span>
                </div>
              );
            }

            // Render Free Period
            if (item.isFreePeriod) {
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-28 border-r border-gray-200 dark:border-gray-700 pr-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">{isMr ? 'तास' : isHi ? 'अवधि' : 'Period'} {item.period.slice(-1)}</span>
                      <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300 block">{item.timeStart} - {item.timeEnd}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                      {isMr ? 'फ्री तासीका' : isHi ? 'खाली अवधि' : 'Free Period'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {isMr ? 'फ्री तासीका' : isHi ? 'खाली अवधि' : 'Free Period'}
                  </span>
                </div>
              );
            }

            // Render Teaching Period
            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isActive
                    ? 'bg-[#E8F5E9] dark:bg-emerald-950/40 border border-[#2E7D32]/40 border-l-4 border-l-[#2E7D32] shadow-xs'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Period Time & Subject Info */}
                <div className="flex items-center gap-4">
                  <div className="w-28 border-r border-gray-200 dark:border-gray-700 pr-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">
                      {isMr ? 'तास' : isHi ? 'अवधि' : 'Period'} {item.period.slice(-1)}
                    </span>
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white block mt-0.5">
                      {item.timeStart} - {item.timeEnd}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {item.subject}
                    </h4>

                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                      <span>{item.grade}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <FaMapMarkerAlt className="text-gray-400 text-xs" />
                        <span>{item.room}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badges & Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-gray-200 dark:border-gray-700">
                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border ${
                      isActive
                        ? 'bg-emerald-100 text-[#2E7D32] dark:bg-emerald-900/60 dark:text-green-300 border-emerald-300 dark:border-emerald-700'
                        : isCompleted
                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {isActive ? (isMr ? 'सध्याचा तास' : isHi ? 'वर्तमान कक्षा' : 'Current Class') : isCompleted ? (isMr ? 'पूर्ण' : isHi ? 'पूर्ण' : 'Completed') : (isMr ? 'पुढील तास' : isHi ? 'आगामी' : 'Upcoming')}
                  </span>

                  {/* Context-Aware Action Button for Active / Current Class */}
                  {isActive && (
                    item.isMarked ? (
                      <Link
                        to={`/attendance/mark?classId=${item.classId}`}
                        className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <FaEye className="text-xs" />
                        <span>{isMr ? 'उपस्थिती पहा' : isHi ? 'उपस्थिति देखें' : 'View Attendance'}</span>
                      </Link>
                    ) : (
                      <Link
                        to={`/attendance/mark?classId=${item.classId}`}
                        className="px-3.5 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <FaCalendarCheck className="text-xs" />
                        <span>{isMr ? 'उपस्थिती नोंदवा' : isHi ? 'उपस्थिति दर्ज करें' : 'Take Attendance'}</span>
                      </Link>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Timetable;
