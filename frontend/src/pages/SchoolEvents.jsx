import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getSchoolEvents } from '../services/api';
import socket from '../services/socket';
import {
  FaCalendarAlt,
  FaUserFriends,
  FaClipboardList,
  FaGlassCheers,
  FaSpinner,
  FaMapMarkerAlt,
  FaClock,
  FaSearch,
  FaHistory
} from 'react-icons/fa';

const SchoolEvents = () => {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past' | 'all'

  const lang = i18n.language || 'en';
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-US';

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getSchoolEvents();
      if (res.success) {
        setEvents(res.data || []);
      } else {
        setError('Failed to load school events calendar.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load school events calendar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();

    socket.on('event_created', fetchEvents);
    socket.on('event_updated', fetchEvents);
    socket.on('event_deleted', fetchEvents);

    return () => {
      socket.off('event_created', fetchEvents);
      socket.off('event_updated', fetchEvents);
      socket.off('event_deleted', fetchEvents);
    };
  }, [fetchEvents]);

  // Subtle category badges and styling matching SmartAttend design system
  const getEventTheme = (type) => {
    switch (type) {
      case 'Holiday':
        return {
          icon: <FaGlassCheers className="text-xs" />,
          badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-[#3b1212]/60 dark:text-rose-300 dark:border-rose-800/60',
          dateAccent: 'text-rose-600 dark:text-rose-400',
          label: t('events_page.categoryHoliday', { defaultValue: 'Holiday' }),
        };
      case 'Exam':
        return {
          icon: <FaClipboardList className="text-xs" />,
          badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-[#2e1065]/60 dark:text-purple-300 dark:border-purple-800/60',
          dateAccent: 'text-purple-600 dark:text-purple-400',
          label: t('events_page.categoryExam', { defaultValue: 'Examination' }),
        };
      case 'Meeting':
        return {
          icon: <FaUserFriends className="text-xs" />,
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#062c1d] dark:text-emerald-300 dark:border-emerald-800/60',
          dateAccent: 'text-emerald-600 dark:text-emerald-400',
          label: 'Meeting',
        };
      default:
        return {
          icon: <FaCalendarAlt className="text-xs" />,
          badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-[#0f2342] dark:text-blue-300 dark:border-blue-800/60',
          dateAccent: 'text-blue-600 dark:text-blue-400',
          label: type || 'Activity',
        };
    }
  };

  // Format date helper: "15 Oct 2026"
  const formatReadableDate = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.toLocaleDateString(locale, { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Extract time if specified on the date
  const formatEventTime = (event) => {
    if (event.time) return event.time;
    const d = new Date(event.date);
    if (!isNaN(d.getTime()) && (d.getHours() !== 0 || d.getMinutes() !== 0)) {
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
    return null;
  };

  // Filter events by search query and category
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        (ev.title && ev.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.description && ev.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.location && ev.location.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === 'ALL' || ev.type === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  // Separate upcoming and past events using today's school-local boundary
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];
    const past = [];

    filteredEvents.forEach((ev) => {
      const evDate = new Date(ev.date);
      evDate.setHours(23, 59, 59, 999);
      if (evDate >= today) {
        upcoming.push(ev);
      } else {
        past.push(ev);
      }
    });

    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    past.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [filteredEvents]);

  // Render a compact, professional event row
  const renderEventCard = (event, isUpcoming) => {
    const d = new Date(event.date);
    const dayNum = !isNaN(d.getTime()) ? d.getDate() : '--';
    const monthStr = !isNaN(d.getTime()) ? d.toLocaleDateString(locale, { month: 'short' }) : '';
    const yearNum = !isNaN(d.getTime()) ? d.getFullYear() : '';
    const timeStr = formatEventTime(event);
    const locationStr = event.location || event.venue || 'School Campus';
    const theme = getEventTheme(event.type);

    return (
      <div
        key={event._id}
        className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-4 sm:p-4.5 shadow-2xs hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-4"
      >
        {/* Left: Compact Date Block */}
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-xl border border-slate-200 dark:border-[#263247] bg-slate-50 dark:bg-[#182235] flex flex-col items-center justify-center shrink-0 text-center">
            <span className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider ${theme.dateAccent}`}>
              {monthStr}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#F8FAFC] leading-none my-0.5">
              {dayNum}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-[#94A3B8]">
              {yearNum}
            </span>
          </div>

          {/* Category Badge & Status for mobile view (stacked next to date) */}
          <div className="flex flex-col gap-1 sm:hidden flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${theme.badge}`}>
                {theme.icon}
                <span>{theme.label}</span>
              </span>
              {isUpcoming ? (
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-[#062c1d] border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.2 rounded-md">
                  Upcoming
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-[#94A3B8]">
                  Completed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Event Title, Description, and Metadata */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-lg sm:text-[19px] font-semibold text-slate-900 dark:text-[#F8FAFC] leading-snug">
            {event.title}
          </h3>

          {event.description && (
            <p className="text-[14px] sm:text-[15px] text-slate-600 dark:text-[#CBD5E1] font-normal leading-relaxed line-clamp-2">
              {event.description}
            </p>
          )}

          <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-[13px] text-slate-500 dark:text-[#94A3B8] font-normal">
            <span className="inline-flex items-center gap-1.5">
              <FaCalendarAlt className="text-slate-400 text-xs shrink-0" />
              <span>{formatReadableDate(event.date)}</span>
            </span>

            {timeStr && (
              <span className="inline-flex items-center gap-1.5">
                <FaClock className="text-slate-400 text-xs shrink-0" />
                <span>{timeStr}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5">
              <FaMapMarkerAlt className="text-slate-400 text-xs shrink-0" />
              <span>{locationStr}</span>
            </span>
          </div>
        </div>

        {/* Right: Category badge on desktop */}
        <div className="hidden sm:flex flex-col items-end justify-between self-stretch shrink-0 gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${theme.badge}`}>
            {theme.icon}
            <span>{theme.label}</span>
          </span>
          {isUpcoming ? (
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-[#062c1d] border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md">
              Upcoming
            </span>
          ) : (
            <span className="text-[11px] font-normal text-slate-400 dark:text-[#94A3B8]">
              Completed
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="space-y-6 font-sans text-slate-800 dark:text-[#F8FAFC] pb-24 sm:pb-28 max-w-5xl mx-auto"
      style={{ fontFamily: 'Inter, "Noto Sans Devanagari", system-ui, -apple-system, sans-serif' }}
    >
      {/* 1. Header with Typography (28-32px) */}
      <div className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] lg:text-[30px] font-semibold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
              {t('events_page.title', { defaultValue: 'School Events & Calendar' })}
            </h1>
            <p className="text-sm sm:text-[15px] text-slate-500 dark:text-[#94A3B8] font-normal mt-1 leading-relaxed">
              {t('events_page.subtitle', { defaultValue: 'View upcoming school activities, academic holidays, and examination schedules.' })}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="px-3 py-1 bg-emerald-50 dark:bg-[#062c1d] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-medium">
              {upcomingEvents.length} {upcomingEvents.length === 1 ? 'Upcoming Event' : 'Upcoming Events'}
            </span>
          </div>
        </div>

        {/* Controls: Search, Category Filters, and Tab Navigation */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#263247] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs: Upcoming / Past / All */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-[#182235] border border-slate-200 dark:border-[#263247] rounded-xl self-start">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-white dark:bg-[#151E2E] text-slate-900 dark:text-[#F8FAFC] shadow-2xs'
                  : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Upcoming ({upcomingEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'past'
                  ? 'bg-white dark:bg-[#151E2E] text-slate-900 dark:text-[#F8FAFC] shadow-2xs'
                  : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Past ({pastEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#151E2E] text-slate-900 dark:text-[#F8FAFC] shadow-2xs'
                  : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Events ({filteredEvents.length})
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2.5 flex-1 md:max-w-md">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('events_page.searchEvents', { defaultValue: 'Search events...' })}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#182235] border border-slate-200 dark:border-[#263247] rounded-xl text-xs text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#182235] border border-slate-200 dark:border-[#263247] rounded-xl text-xs text-slate-700 dark:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">{t('events_page.categoryAll', { defaultValue: 'All Categories' })}</option>
              <option value="Holiday">{t('events_page.categoryHoliday', { defaultValue: 'Holiday' })}</option>
              <option value="Exam">{t('events_page.categoryExam', { defaultValue: 'Examination' })}</option>
              <option value="Meeting">Meeting</option>
              <option value="Event">Activities & Events</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Main Content Body */}
      {loading ? (
        <div className="text-center py-16 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl shadow-2xs">
          <FaSpinner className="animate-spin text-3xl text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
          <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal">{t('common.loading', { defaultValue: 'Loading events...' })}</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-[#3b1212]/60 dark:text-rose-300 dark:border-rose-800/60 rounded-2xl text-center text-xs font-medium shadow-2xs">
          {error}
        </div>
      ) : filteredEvents.length === 0 ? (
        /* Empty State */
        <div className="text-center py-14 px-4 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl shadow-2xs space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#182235] text-slate-400 dark:text-[#94A3B8] flex items-center justify-center mx-auto mb-2">
            <FaCalendarAlt className="text-xl" />
          </div>
          <h4 className="text-base font-semibold text-slate-800 dark:text-[#F8FAFC]">
            {t('events_page.noEventsFound', { defaultValue: 'No school events found.' })}
          </h4>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'ALL'
              ? 'No events match your current filter criteria. Try adjusting your search.'
              : 'School announcements and upcoming calendar dates will appear here once scheduled.'}
          </p>
        </div>
      ) : (
        /* Events Listing */
        <div className="space-y-6">
          {/* Active Tab: Upcoming */}
          {activeTab === 'upcoming' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                  <span>Upcoming Events</span>
                  <span className="text-xs font-normal text-slate-400 dark:text-[#94A3B8]">
                    ({upcomingEvents.length})
                  </span>
                </h2>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="py-10 text-center bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl shadow-2xs">
                  <p className="text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
                    No upcoming events scheduled at this moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((ev) => renderEventCard(ev, true))}
                </div>
              )}
            </div>
          )}

          {/* Active Tab: Past */}
          {activeTab === 'past' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                  <FaHistory className="text-slate-400 text-sm" />
                  <span>Past Events</span>
                  <span className="text-xs font-normal text-slate-400 dark:text-[#94A3B8]">
                    ({pastEvents.length})
                  </span>
                </h2>
              </div>

              {pastEvents.length === 0 ? (
                <div className="py-10 text-center bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl shadow-2xs">
                  <p className="text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
                    No past events recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 opacity-90">
                  {pastEvents.map((ev) => renderEventCard(ev, false))}
                </div>
              )}
            </div>
          )}

          {/* Active Tab: All (Separated sections) */}
          {activeTab === 'all' && (
            <div className="space-y-6">
              {/* Upcoming Events Section */}
              {upcomingEvents.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2 pb-1">
                    <span>Upcoming Events</span>
                    <span className="text-xs font-normal text-slate-400 dark:text-[#94A3B8]">
                      ({upcomingEvents.length})
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {upcomingEvents.map((ev) => renderEventCard(ev, true))}
                  </div>
                </div>
              )}

              {/* Past Events Section */}
              {pastEvents.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h2 className="text-base font-semibold text-slate-700 dark:text-[#CBD5E1] flex items-center gap-2 pb-1 border-t border-slate-200 dark:border-[#263247] pt-4">
                    <FaHistory className="text-slate-400 text-sm" />
                    <span>Past Events</span>
                    <span className="text-xs font-normal text-slate-400 dark:text-[#94A3B8]">
                      ({pastEvents.length})
                    </span>
                  </h2>
                  <div className="space-y-3 opacity-85">
                    {pastEvents.map((ev) => renderEventCard(ev, false))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolEvents;
