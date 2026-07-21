import React, { useState, useEffect } from 'react';
import { getSchoolEvents } from '../services/api';
import { FaCalendarAlt, FaUserFriends, FaClipboardList, FaGlassCheers, FaSpinner, FaMapMarkerAlt } from 'react-icons/fa';

const SchoolEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await getSchoolEvents();
        if (res.success) {
          setEvents(res.data);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load school events calendar.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const getEventIcon = (type) => {
    switch (type) {
      case 'Holiday': return <FaGlassCheers className="text-red-650" />;
      case 'Exam': return <FaClipboardList className="text-purple-650" />;
      case 'Meeting': return <FaUserFriends className="text-emerald-655" />;
      default: return <FaCalendarAlt className="text-amber-655" />;
    }
  };

  const getEventTheme = (type) => {
    switch (type) {
      case 'Holiday': return 'bg-red-50 border-red-150 text-red-700';
      case 'Exam': return 'bg-purple-50 border-purple-150 text-purple-700';
      case 'Meeting': return 'bg-emerald-50 border-emerald-150 text-emerald-700';
      default: return 'bg-amber-50 border-amber-200 text-amber-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">School Calendar Events</h2>
        <p className="text-sm text-gray-500 font-medium">
          Check upcoming parent-teacher meetings, holidays, and examination schedules.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <FaSpinner className="animate-spin text-4xl text-[#2E7D32] mx-auto mb-3" />
          <span className="text-xs text-gray-400 font-bold">Querying calendar schedules...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center font-bold text-xs">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-150 rounded-3xl shadow-sm">
          <FaCalendarAlt className="mx-auto text-4xl text-gray-300 mb-2" />
          <p className="text-xs text-gray-400 font-bold">No school events scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {events.map((event) => (
            <div
              key={event._id}
              className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-start gap-4"
            >
              {/* Event icon badge */}
              <span className={`p-3.5 rounded-2xl border flex items-center justify-center text-xl shrink-0 ${getEventTheme(event.type).split(' ').slice(0, 2).join(' ')}`}>
                {getEventIcon(event.type)}
              </span>

              {/* Event details */}
              <div className="space-y-1 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-base font-extrabold text-gray-850">
                    {event.title}
                  </h3>
                  <span className={`self-start text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getEventTheme(event.type)}`}>
                    {event.type}
                  </span>
                </div>
                
                <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                  {event.description}
                </p>

                <div className="pt-2 flex flex-wrap gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <FaCalendarAlt />
                    {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <FaMapMarkerAlt />
                    School Main Hall
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchoolEvents;
