import React, { useState, useEffect, useCallback } from 'react';
import { getSchoolEvents, getLeaveRequests, getStudents } from '../services/api';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import socket from '../services/socket';

const SchoolCalendar = () => {
  const { t } = useTranslation('common');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [studentsMap, setStudentsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('month'); // month, week, day
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dayEventsModal, setDayEventsModal] = useState(null); // { date: Date, items: [...] }

  const fetchCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsRes, leavesRes, studentsRes] = await Promise.all([
        getSchoolEvents(),
        getLeaveRequests(),
        getStudents().catch(() => ({ success: false }))
      ]);
      if (eventsRes.success) setEvents(eventsRes.data || []);
      if (leavesRes.success) setLeaves(leavesRes.data || []);
      if (studentsRes?.success && studentsRes?.data) {
        const map = {};
        studentsRes.data.forEach((s) => {
          if (s && s._id) map[s._id] = s.name;
        });
        setStudentsMap(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendarData();

    // Listen for real-time schedule updates via Socket.IO
    socket.on('event_created', fetchCalendarData);
    socket.on('event_updated', fetchCalendarData);
    socket.on('event_deleted', fetchCalendarData);
    socket.on('leave_updated', fetchCalendarData);

    return () => {
      socket.off('event_created', fetchCalendarData);
      socket.off('event_updated', fetchCalendarData);
      socket.off('event_deleted', fetchCalendarData);
      socket.off('leave_updated', fetchCalendarData);
    };
  }, [fetchCalendarData]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrev = () => {
    if (activeView === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (activeView === 'week') {
      const newD = new Date(currentDate);
      newD.setDate(newD.getDate() - 7);
      setCurrentDate(newD);
    } else {
      const newD = new Date(currentDate);
      newD.setDate(newD.getDate() - 1);
      setCurrentDate(newD);
    }
  };

  const handleNext = () => {
    if (activeView === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (activeView === 'week') {
      const newD = new Date(currentDate);
      newD.setDate(newD.getDate() + 7);
      setCurrentDate(newD);
    } else {
      const newD = new Date(currentDate);
      newD.setDate(newD.getDate() + 1);
      setCurrentDate(newD);
    }
  };

  // Filter items matching a specific date (UTC date comparison)
  const getItemsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = events.filter((e) => {
      if (!e.date) return false;
      return new Date(e.date).toISOString().split('T')[0] === dateStr;
    });
    const dayLeaves = leaves.filter((l) => {
      if (!l.fromDate || !l.toDate) return false;
      const from = new Date(l.fromDate).toISOString().split('T')[0];
      const to = new Date(l.toDate).toISOString().split('T')[0];
      return dateStr >= from && dateStr <= to && (l.status === 'Approved' || !l.status);
    });
    return { dayEvents, dayLeaves };
  };

  const getStudentName = (lv) => {
    if (!lv) return '';
    if (lv.studentId?.name) return lv.studentId.name;
    const sId = typeof lv.studentId === 'object' ? lv.studentId?._id : lv.studentId;
    if (sId && studentsMap[sId]) return studentsMap[sId];
    if (lv.studentName) return lv.studentName;
    if (typeof lv.studentId === 'string' && studentsMap[lv.studentId]) return studentsMap[lv.studentId];
    const mapValues = Object.values(studentsMap);
    if (mapValues.length > 0 && mapValues[0]) return mapValues[0];
    return '';
  };

  // ERP Friendly Date Formatter
  const formatDate = (d) => {
    if (!d) return '';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthStr = dateObj.toLocaleDateString('en-GB', { month: 'short' });
    const yearNum = dateObj.getFullYear();
    return `${day} ${monthStr} ${yearNum}`;
  };

  const formatDateRange = (from, to) => {
    if (!from) return '';
    const fStr = formatDate(from);
    if (!to || new Date(from).toDateString() === new Date(to).toDateString()) {
      return fStr;
    }
    const tStr = formatDate(to);
    return `${fStr} – ${tStr}`;
  };

  const calculateDays = (from, to) => {
    if (!from || !to) return '1 Day';
    const f = new Date(from);
    const t = new Date(to);
    const diffTime = Math.abs(t - f);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? '1 Day' : `${diffDays} Days`;
  };

  // Event Styling & Labels
  const getEventStyle = (type = '') => {
    const t = (type || '').toLowerCase();
    if (t.includes('holiday')) {
      return {
        bg: 'bg-red-50 text-red-800 border-l-4 border-l-red-500 dark:bg-red-950/40 dark:text-red-200 border-y border-r border-red-200 dark:border-red-800',
        badge: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
        label: 'School Holiday'
      };
    }
    if (t.includes('exam')) {
      return {
        bg: 'bg-purple-50 text-purple-800 border-l-4 border-l-purple-500 dark:bg-purple-950/40 dark:text-purple-200 border-y border-r border-purple-200 dark:border-purple-800',
        badge: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
        label: 'Annual Examination'
      };
    }
    if (t.includes('meet')) {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-l-4 border-l-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200 border-y border-r border-emerald-200 dark:border-emerald-800',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        label: 'Meeting'
      };
    }
    if (t.includes('sport')) {
      return {
        bg: 'bg-amber-50 text-amber-800 border-l-4 border-l-amber-500 dark:bg-amber-950/40 dark:text-amber-200 border-y border-r border-amber-200 dark:border-amber-800',
        badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        label: 'Sports Day'
      };
    }
    if (t.includes('leave')) {
      return {
        bg: 'bg-blue-50 text-blue-800 border-l-4 border-l-blue-500 dark:bg-blue-950/40 dark:text-blue-200 border-y border-r border-blue-200 dark:border-blue-800',
        badge: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
        label: 'Approved Leave'
      };
    }
    return {
      bg: 'bg-gray-100 text-gray-800 border-l-4 border-l-gray-500 dark:bg-gray-700 dark:text-gray-200 border-y border-r border-gray-200 dark:border-gray-600',
      badge: 'bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
      label: type || 'School Function'
    };
  };

  // MONTH VIEW CALCULATION
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const startDayIndex = getFirstDayOfMonth(year, month);

  const monthCells = [];
  for (let i = 0; i < startDayIndex; i++) {
    monthCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    monthCells.push(new Date(year, month, d));
  }

  // WEEK VIEW CALCULATION
  const getWeekDays = (start) => {
    const week = [];
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(start);
    monday.setDate(diff);
    for (let i = 0; i < 7; i++) {
      const wDate = new Date(monday);
      wDate.setDate(monday.getDate() + i);
      week.push(wDate);
    }
    return week;
  };
  const weekDays = getWeekDays(new Date(currentDate));

  return (
    <div className="space-y-4">
      {/* Page Header & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FaCalendarAlt className="text-[#2E7D32]" />
            <span>{t('nav.calendar') === 'कैलेंडर' ? 'स्कूल कैलेंडर और अनुसूचियां' : 'School Calendar & Schedules'}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            {t('nav.calendar') === 'कैलेंडर' ? 'स्कूल के कार्यक्रम, परीक्षा, छुट्टियां और छात्र छुट्टी रिकॉर्ड देखें।' : 'View school events, exams, holidays, and student leave records.'}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-2xs space-x-1 shrink-0">
          {['month', 'week', 'day'].map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-3 py-1 text-xs font-bold rounded transition cursor-pointer uppercase tracking-wider ${
                activeView === v
                  ? 'bg-[#2E7D32] text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Legend Bar (ERP Minimalist Style, NO emojis) */}
      <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Event Types:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          <span>{t('settings.holidays') === 'छुट्टियां' ? 'छुट्टी' : 'Holiday'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
          <span>{t('notices.category') === 'श्रेणी' ? 'परीक्षा' : 'Exam'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          <span>{t('notices.category') === 'श्रेणी' ? 'बैठक' : 'Meeting'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>{t('notices.category') === 'श्रेणी' ? 'खेल' : 'Sports'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span>{t('nav.leave_request') || 'Leave'}</span>
        </span>
      </div>

      {/* Main Grid & Details Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar Grid Container */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-2xs">
          {/* Controls Header */}
          <div className="flex items-center justify-between mb-3 border-b border-gray-150 dark:border-gray-700 pb-2.5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {activeView === 'month' && `${t('months.' + monthNames[month].toLowerCase())} ${year}`}
              {activeView === 'week' && `Week of ${formatDate(weekDays[0])}`}
              {activeView === 'day' && formatDate(currentDate)}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrev}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-md transition cursor-pointer text-gray-600 dark:text-gray-300"
              >
                <FaChevronLeft className="text-xs" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-md transition cursor-pointer text-gray-600 dark:text-gray-300"
              >
                <FaChevronRight className="text-xs" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-gray-400 font-semibold">
              Loading calendar entries...
            </div>
          ) : (
            <>
              {/* MONTH VIEW GRID */}
              {activeView === 'month' && (
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold">
                  {/* Weekday headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => t('days.' + day.toLowerCase())).map((d) => (
                    <span key={d} className="text-[10px] font-bold text-gray-400 uppercase py-1">
                      {d}
                    </span>
                  ))}

                  {/* Monthly grid cell slots */}
                  {monthCells.map((cell, idx) => {
                    if (cell === null) {
                      return <div key={`empty-${idx}`} className="min-h-[85px] bg-gray-50/40 dark:bg-gray-750/30 rounded-lg border border-dashed border-gray-150 dark:border-gray-700/50"></div>;
                    }

                    const { dayEvents, dayLeaves } = getItemsForDate(cell);
                    const isToday = cell.toDateString() === new Date().toDateString();
                    const isSelected = selectedDate && cell.toDateString() === selectedDate.toDateString();

                    const combinedItems = [
                      ...dayEvents.map(e => ({ type: 'event', details: e, title: e.title, eventType: e.type })),
                      ...dayLeaves.map(l => ({ type: 'leave', details: l, title: getStudentName(l) ? `Leave: ${getStudentName(l)}` : 'Student Leave', eventType: 'Leave' }))
                    ];

                    const firstItem = combinedItems[0];
                    const remainingCount = combinedItems.length - 1;

                    return (
                      <div
                        key={`cell-${idx}`}
                        onClick={() => {
                          setSelectedDate(cell);
                          if (firstItem) {
                            setSelectedEvent(firstItem);
                          }
                        }}
                        className={`min-h-[85px] p-1.5 rounded-lg flex flex-col justify-between transition text-left cursor-pointer ${
                          isSelected
                            ? 'border-2 border-[#2E7D32] dark:border-green-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : isToday
                            ? 'border-2 border-emerald-400 dark:border-green-600 bg-emerald-50/20'
                            : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            isToday ? 'bg-[#2E7D32] text-white' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {cell.getDate()}
                          </span>
                        </div>

                        {/* First Event Chip & View +X More Link */}
                        <div className="space-y-1 flex-1 overflow-hidden">
                          {firstItem && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(cell);
                                setSelectedEvent(firstItem);
                              }}
                              className={`w-full text-[11px] font-semibold px-2 py-1 rounded transition truncate cursor-pointer ${getEventStyle(firstItem.eventType).bg}`}
                              title={firstItem.title}
                            >
                              <span className="truncate leading-tight block">{firstItem.title}</span>
                            </div>
                          )}

                          {remainingCount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(cell);
                                setDayEventsModal({ date: cell, items: combinedItems });
                              }}
                              className="text-[10px] font-bold text-[#2E7D32] dark:text-green-400 hover:underline cursor-pointer block mt-0.5"
                            >
                              View +{remainingCount} More
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* WEEK VIEW GRID */}
              {activeView === 'week' && (
                <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 text-left">
                  {weekDays.map((wDay) => {
                    const { dayEvents, dayLeaves } = getItemsForDate(wDay);
                    const isToday = wDay.toDateString() === new Date().toDateString();
                    const isSelected = selectedDate && wDay.toDateString() === selectedDate.toDateString();

                    const combined = [
                      ...dayEvents.map(e => ({ type: 'event', details: e, title: e.title, eventType: e.type })),
                      ...dayLeaves.map(l => ({ type: 'leave', details: l, title: getStudentName(l) ? `Leave: ${getStudentName(l)}` : 'Student Leave', eventType: 'Leave' }))
                    ];

                    return (
                      <div
                        key={wDay.toDateString()}
                        onClick={() => {
                          setSelectedDate(wDay);
                          if (combined[0]) setSelectedEvent(combined[0]);
                        }}
                        className={`rounded-lg p-2 min-h-[240px] space-y-2 cursor-pointer ${
                          isSelected
                            ? 'border-2 border-[#2E7D32] bg-emerald-50/20'
                            : isToday
                            ? 'border-2 border-emerald-400 bg-emerald-50/10'
                            : 'border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750/50'
                        }`}
                      >
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-1">
                          <span className="text-[10px] font-bold text-[#2E7D32] dark:text-green-400 uppercase block">
                            {wDay.toLocaleDateString(undefined, { weekday: 'short' })}
                          </span>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                            {wDay.getDate()}
                          </h4>
                        </div>

                        <div className="space-y-1.5">
                          {combined.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(wDay);
                                setSelectedEvent(item);
                              }}
                              className={`p-1.5 rounded text-xs font-semibold cursor-pointer transition ${getEventStyle(item.eventType).bg}`}
                            >
                              <span className="text-[9px] font-bold uppercase block text-gray-500 dark:text-gray-400">{item.eventType}</span>
                              <span className="block truncate">{item.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* DAILY VIEW */}
              {activeView === 'day' && (
                <div className="space-y-3">
                  {(() => {
                    const { dayEvents, dayLeaves } = getItemsForDate(currentDate);
                    const combined = [
                      ...dayEvents.map(e => ({ type: 'event', details: e, title: e.title, eventType: e.type })),
                      ...dayLeaves.map(l => ({ type: 'leave', details: l, title: getStudentName(l) ? `Leave: ${getStudentName(l)}` : 'Student Leave', eventType: 'Leave' }))
                    ];

                    if (combined.length === 0) {
                      return (
                        <div className="p-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-400">
                          No events scheduled for this date.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {combined.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedEvent(item)}
                            className={`p-3 rounded-lg cursor-pointer flex items-center justify-between ${getEventStyle(item.eventType).bg}`}
                          >
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                                {item.eventType}
                              </span>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</h4>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {/* Event Information Details Panel */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-150 dark:border-gray-700">
            Event Information
          </h3>

          {selectedEvent ? (
            <div className="space-y-3">
              {/* Event Type Badge */}
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Event Type</span>
                <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded border ${
                  selectedEvent.type === 'leave'
                    ? selectedEvent.details.status === 'Approved'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : selectedEvent.details.status === 'Rejected'
                      ? 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                    : getEventStyle(selectedEvent.eventType || selectedEvent.details.type).badge
                }`}>
                  {selectedEvent.type === 'leave'
                    ? `${selectedEvent.details.status || 'Approved'} Leave`
                    : getEventStyle(selectedEvent.eventType || selectedEvent.details.type).label}
                </span>
              </div>

              {/* Title / Holiday Name / Exam Name */}
              {selectedEvent.type === 'event' && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">
                    {selectedEvent.eventType === 'Holiday' || selectedEvent.details.type === 'Holiday'
                      ? 'Holiday Name'
                      : selectedEvent.eventType === 'Exam' || selectedEvent.details.type === 'Exam'
                      ? 'Exam Name'
                      : 'Title'}
                  </span>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedEvent.title || selectedEvent.details.title}
                  </h4>
                </div>
              )}

              {/* Leave Specific Fields */}
              {selectedEvent.type === 'leave' && (
                <>
                  {/* Student Name */}
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Student Name</span>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {getStudentName(selectedEvent.details)}
                    </h4>
                  </div>

                  {/* Class / Section */}
                  {(selectedEvent.details.studentId?.classId?.grade || selectedEvent.details.studentId?.classId?.section) && (
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Class / Section</span>
                      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        Grade {selectedEvent.details.studentId.classId.grade} {selectedEvent.details.studentId.classId.section ? `- ${selectedEvent.details.studentId.classId.section}` : ''}
                      </h4>
                    </div>
                  )}

                  {/* Admission / Roll Number */}
                  {(selectedEvent.details.studentId?.rollNo || selectedEvent.details.studentId?.admissionNo) && (
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Roll / Admission No</span>
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {selectedEvent.details.studentId.rollNo ? `Roll No: ${selectedEvent.details.studentId.rollNo}` : `Adm No: ${selectedEvent.details.studentId.admissionNo}`}
                      </h4>
                    </div>
                  )}

                  {/* Parent Name */}
                  {selectedEvent.details.parentId?.name && (
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Parent Name</span>
                      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {selectedEvent.details.parentId.name}
                      </h4>
                    </div>
                  )}

                  {/* Leave Start & End Date */}
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Leave Duration</span>
                    <strong className="text-xs text-gray-900 dark:text-white font-bold block">
                      {formatDate(selectedEvent.details.fromDate)} – {formatDate(selectedEvent.details.toDate)}
                    </strong>
                  </div>

                  {/* Total Days */}
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Total Leave Days</span>
                    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
                      {calculateDays(selectedEvent.details.fromDate, selectedEvent.details.toDate)}
                    </span>
                  </div>

                  {/* Approved By */}
                  {selectedEvent.details.approvedBy?.name && (
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{t('dashboard_extra.reviewedBy')}</span>
                      <h4 className="text-xs font-semibold text-emerald-700 dark:text-green-400">
                        {selectedEvent.details.approvedBy.name} ({selectedEvent.details.approvedBy.role || 'Admin'})
                      </h4>
                    </div>
                  )}
                </>
              )}

              {/* Event Specific Date */}
              {selectedEvent.type === 'event' && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{t('reports.date')}</span>
                  <strong className="text-xs text-gray-900 dark:text-white font-bold block">
                    {formatDate(selectedEvent.details.date)}
                  </strong>
                </div>
              )}

              {/* Class Name for Exams if present */}
              {selectedEvent.type === 'event' && (selectedEvent.details.className || selectedEvent.details.classId?.grade) && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{t('nav.classes')}</span>
                  <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {selectedEvent.details.className || `Grade ${selectedEvent.details.classId?.grade}-${selectedEvent.details.classId?.section || ''}`}
                  </h4>
                </div>
              )}

              {/* Read-only Description or Reason Card */}
              {(selectedEvent.details.description || selectedEvent.details.reason) && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    {selectedEvent.type === 'leave' ? t('dashboard_extra.leaveReason') : t('notices.description')}
                  </span>
                  <div className="p-3 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-200 font-medium leading-relaxed">
                    {selectedEvent.details.description || selectedEvent.details.reason}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-xs font-medium text-gray-400 leading-relaxed">
              {t('dashboard_extra.clickCellInstructions') === 'उपस्थिति विवरण देखने के लिए किसी भी रंगीन कैलेंडर सेल पर क्लिक करें।' ? 'विवरण देखने के लिए कैलेंडर से एक कार्यक्रम चुनें।' : 'Select an event from the calendar to view details.'}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Event Popup Modal */}
      {dayEventsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {t('notices.allNotices') === 'सभी सूचनाएं' ? 'कार्यक्रम की सूची' : 'Schedules for'} {formatDate(dayEventsModal.date)}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  {dayEventsModal.items.length} {t('notices.allNotices') === 'सभी सूचनाएं' ? 'इस तिथि के लिए कार्यक्रम। पूर्ण जानकारी देखने के लिए किसी आइटम का चयन करें।' : 'events logged for this date.'}
                </p>
              </div>
              <button
                onClick={() => setDayEventsModal(null)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {dayEventsModal.items.map((item, idx) => {
                const style = getEventStyle(item.eventType);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(dayEventsModal.date);
                      setSelectedEvent(item);
                      setDayEventsModal(null);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition border flex items-center justify-between ${style.bg} hover:shadow-xs`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded border mb-1 ${style.badge}`}>
                        {style.label}
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(dayEventsModal.date);
                        setSelectedEvent(item);
                        setDayEventsModal(null);
                      }}
                      className="px-2.5 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-[10px] font-bold transition shrink-0 cursor-pointer"
                    >
                      {t('students.viewFullProfile')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolCalendar;
