import React, { useState, useEffect } from 'react';
import { getSchoolEvents, createSchoolEvent, updateSchoolEvent, deleteSchoolEvent } from '../services/api';
import { FaCalendarPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaSpinner, FaClipboardList, FaGlassCheers, FaUserFriends, FaCalendarAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const EventsManagement = () => {
  const { t } = useTranslation('common');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('Event');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await getSchoolEvents();
      if (res.success) {
        setEvents(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!title || !description || !date || !type) {
      setError('Please fill in all fields.');
      return;
    }

    setFormLoading(true);
    try {
      let res;
      if (editingEvent) {
        res = await updateSchoolEvent(editingEvent._id, { title, description, date, type });
      } else {
        res = await createSchoolEvent({ title, description, date, type });
      }

      if (res.success) {
        setMessage(editingEvent ? 'Event updated successfully.' : 'Event created successfully.');
        setTitle('');
        setDescription('');
        setDate('');
        setType('Event');
        setEditingEvent(null);
        fetchEvents();
      } else {
        setError(res.message || 'Action failed.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditClick = (event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    setDate(new Date(event.date).toISOString().split('T')[0]);
    setType(event.type);
  };

  const handleDeleteClick = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this event? This will remove it from the calendar.');
    if (!confirmDelete) return;

    try {
      const res = await deleteSchoolEvent(id);
      if (res.success) {
        setMessage('Event deleted successfully.');
        fetchEvents();
      } else {
        setError(res.message || 'Delete failed.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setDate('');
    setType('Event');
  };

  const getEventBadgeClass = (type) => {
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
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          <FaCalendarPlus className="text-[#2E7D32]" />
          <span>{t('nav.calendar') === 'कैलेंडर' ? 'स्कूल के कार्यक्रम प्रबंधित करें' : 'Manage School Events'}</span>
        </h2>
        <p className="text-sm text-gray-500 font-semibold">
          {t('nav.calendar') === 'कैलेंडर' ? 'कैलेंडर की छुट्टियां, माता-पिता की बैठकें और परीक्षा समयसीमा बनाएं, संपादित करें या हटाएं।' : 'Create, edit, or remove calendar holidays, parent meetings, and exam timelines.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Event Creator Form */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-md">
            <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2">
              <FaCalendarPlus className="text-[#2E7D32] text-sm" />
              <span>{editingEvent ? (t('settings.schoolName') === 'विद्यालय का नाम' ? 'कार्यक्रम विवरण संपादित करें' : 'Edit Event Details') : (t('settings.schoolName') === 'विद्यालय का नाम' ? 'नया कार्यक्रम बनाएं' : 'Create New Event')}</span>
            </h3>

            {message && (
              <div className="p-3.5 mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold leading-relaxed">
                {message}
              </div>
            )}

            {error && (
              <div className="p-3.5 mb-4 rounded-xl bg-red-50 border border-red-150 text-red-700 text-xs font-bold leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Event Title */}
              <div>
                <label htmlFor="title" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {t('notices.noticeTitle')}
                </label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Sports Day Meet..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Event Type */}
              <div>
                <label htmlFor="type" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {t('notices.category')}
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Event">{t('nav.calendar') === 'कैलेंडर' ? 'सामान्य कार्यक्रम' : 'General Event'}</option>
                  <option value="Holiday">{t('settings.holidays') === 'छुट्टियां' ? 'स्कूल की छुट्टी' : 'School Holiday'}</option>
                  <option value="Exam">{t('notices.category') === 'श्रेणी' ? 'परीक्षा अनुसूची' : 'Examination Schedule'}</option>
                  <option value="Meeting">{t('notices.category') === 'श्रेणी' ? 'अभिभावक-शिक्षक बैठक' : 'Parent-Teacher Meeting'}</option>
                </select>
              </div>

              {/* Event Date */}
              <div>
                <label htmlFor="date" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {t('reports.date')}
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {t('notices.description')}
                </label>
                <textarea
                  id="description"
                  rows="4"
                  placeholder="Details and location coordinates..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow hover:shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? t('common.loading') : editingEvent ? t('notices.updateNotice') : t('notices.publishNotice')}
                </button>
                {editingEvent && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Events Table/List */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm">
            <h3 className="text-xs font-extrabold text-gray-450 uppercase tracking-wider mb-4 border-b border-gray-100 pb-3">
              {t('nav.calendar') === 'कैलेंडर' ? 'प्रकाशित कार्यक्रमों की सूची' : 'Published Events Directories'}
            </h3>

            {loading ? (
              <div className="text-center py-12">
                <FaSpinner className="animate-spin text-3xl text-primary mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-bold">Querying directory logs...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <FaCalendarAlt className="mx-auto text-3xl text-gray-300 mb-2" />
                <p className="text-xs text-gray-400 font-bold">
                  {t('nav.calendar') === 'कैलेंडर' ? 'कोई कार्यक्रम या अवकाश प्रकाशित नहीं किया गया है।' : 'No school events or holidays published yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-150 text-left">
                  <thead>
                    <tr className="bg-gray-50 bg-opacity-60 text-[10px] font-extrabold text-gray-450 uppercase tracking-widest">
                      <th className="px-4 py-3">{t('notices.category')}</th>
                      <th className="px-4 py-3">{t('notices.noticeTitle')}</th>
                      <th className="px-4 py-3">{t('reports.date')}</th>
                      <th className="px-4 py-3">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-750">
                    {events.map((ev) => (
                      <tr key={ev._id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[9px] font-extrabold uppercase tracking-wider ${getEventBadgeClass(ev.type)}`}>
                            {ev.type === 'Holiday' ? t('settings.holidays') : ev.type === 'Exam' ? t('notices.category') : ev.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <h4 className="font-extrabold text-gray-800">{ev.title}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{ev.description}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(ev.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditClick(ev)}
                              className="p-2 text-blue-600 hover:bg-blue-50 border border-transparent rounded-xl transition cursor-pointer"
                              title="Edit Event"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(ev._id)}
                              className="p-2 text-red-600 hover:bg-red-50 border border-transparent rounded-xl transition cursor-pointer"
                              title="Delete Event"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventsManagement;
