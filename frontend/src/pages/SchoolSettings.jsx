import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSchoolSettings, updateSchoolSettings } from '../services/api';
import {
  FaSchool,
  FaSave,
  FaSpinner,
  FaInfoCircle,
  FaPlus,
  FaTrash,
  FaTrashAlt,
  FaCalendarAlt,
  FaCalendarDay,
  FaRegCalendarCheck
} from 'react-icons/fa';

const SchoolSettings = () => {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Settings State Fields
  const [schoolName, setSchoolName] = useState('Smart Rural Model School');
  const [principalName, setPrincipalName] = useState('Principal Sharma');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [address, setAddress] = useState('Main Road Village');
  const [district, setDistrict] = useState('Pune');
  const [state, setState] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('411001');
  const [contact, setContact] = useState('9876543210');
  const [email, setEmail] = useState('contact@ruralschool.in');
  const [website, setWebsite] = useState('www.ruralschool.in');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  
  // Timing / Working Days
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('15:30');
  const [weeklyOffs, setWeeklyOffs] = useState([0]); // Default Sunday
  const [language, setLanguage] = useState('English');

  // Notifications Toggles
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [allowMultipleAttendance, setAllowMultipleAttendance] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [offlineSyncEnabled, setOfflineSyncEnabled] = useState(true);
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [aiPredictiveEnabled, setAiPredictiveEnabled] = useState(true);

  // Holidays Array
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDesc, setHolidayDesc] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSchoolSettings();
      if (data.success && data.data) {
        const s = data.data;
        setSchoolName(s.schoolName || 'Smart Rural Model School');
        setStartTime(s.startTime || '09:00');
        setEndTime(s.endTime || '15:30');
        setWeeklyOffs(s.weeklyOffs || [0]);
        setHolidays(s.holidays || []);
        
        // Populate fallback fields from model if saved (or mock defaults)
        setPrincipalName(s.principalName || 'Principal Sharma');
        setAddress(s.schoolAddress || 'Main Road Village');
        setDistrict(s.district || 'Pune');
        setState(s.state || 'Maharashtra');
        setPinCode(s.pinCode || '411001');
        setContact(s.schoolContact || '9876543210');
        setEmail(s.schoolEmail || 'contact@ruralschool.in');
        setWebsite(s.schoolWebsite || 'www.ruralschool.in');
        setAcademicYear(s.academicYear || '2026-2027');
        setLanguage(s.language || 'English');
        
        setSmsEnabled(s.smsEnabled !== false);
        setEmailEnabled(!!s.emailEnabled);
        setAllowMultipleAttendance(s.allowMultipleAttendance !== false);
        setPushEnabled(!!s.pushEnabled);
        setOfflineSyncEnabled(s.offlineSyncEnabled !== false);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error retrieving configurations.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleWeeklyOffToggle = (day) => {
    if (weeklyOffs.includes(day)) {
      setWeeklyOffs(weeklyOffs.filter((d) => d !== day));
    } else {
      setWeeklyOffs([...weeklyOffs, day]);
    }
  };

  const handleAddHoliday = (e) => {
    e.preventDefault();
    if (!holidayDate || !holidayDesc) return;

    const newHoliday = {
      date: new Date(holidayDate),
      description: holidayDesc,
    };

    setHolidays([...holidays, newHoliday]);
    setHolidayDate('');
    setHolidayDesc('');
  };

  const handleRemoveHoliday = (idx) => {
    setHolidays(holidays.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setMessage({ text: '', type: '' });

    const token = localStorage.getItem('token');
    const payload = {
      schoolName,
      principalName,
      schoolAddress: address,
      district,
      state,
      pinCode,
      schoolContact: contact,
      schoolEmail: email,
      schoolWebsite: website,
      academicYear,
      startTime,
      endTime,
      weeklyOffs,
      language,
      smsEnabled,
      emailEnabled,
      allowMultipleAttendance,
      pushEnabled,
      offlineSyncEnabled,
      holidays,
    };

    try {
      const data = await updateSchoolSettings(payload);
      if (data.success) {
        setMessage({ text: 'School configurations saved successfully!', type: 'success' });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      } else {
        throw new Error(data.message || 'Saving configurations failed.');
      }
    } catch (err) {
      setMessage({ text: err.message || 'Error processing request.', type: 'error' });
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const days = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t('settings.title')}</h2>
        <p className="text-sm text-gray-500 font-medium">
          {t('settings.subtitle')}
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border text-sm font-semibold ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* General Metadata Column */}
          <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm space-y-4 lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase border-b border-gray-100 pb-2">{t('settings.schoolName') === 'विद्यालय का नाम' ? 'सामान्य विन्यास' : 'General Configurations'}</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.schoolName')}</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.principalName')}</label>
                <input
                  type="text"
                  required
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.schoolAddress') || 'Village/Street Address'}</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.pincode')}</label>
                <input
                  type="text"
                  required
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.district')}</label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.state')}</label>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.contact')}</label>
                <input
                  type="text"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.email')}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('classes.academicYear')}</label>
                <input
                  type="text"
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Timing and Working Days Panel */}
          <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm space-y-4 lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-700 uppercase border-b border-gray-100 pb-2">{t('settings.startTime') === 'प्रारंभ समय' ? 'घंटे और समय' : 'Hours & Timing'}</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.startTime')}</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.endTime')}</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('settings.language')}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white shadow-sm"
              >
                <option value="English">English</option>
                <option value="Marathi">Marathi</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>

            {/* Weekly off */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('settings.weeklyOff')}</label>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => {
                  const isActive = weeklyOffs.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => handleWeeklyOffToggle(d.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        isActive ? 'bg-primary text-white border-primary' : 'bg-white text-gray-400 border-gray-250 hover:bg-gray-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Messaging toggles and holiday tables */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Notification toggles */}
          <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm space-y-4 lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-700 uppercase border-b border-gray-100 pb-2">{t('settings.smsNotification') === 'एसएमएस अधिसूचना' ? 'अभिभावक चेतावनी प्रणाली' : 'Parent Alert System'}</h3>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.smsAlerts')}</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.emailAlerts')}</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={(e) => setPushEnabled(e.target.checked)}
                  className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.pushAlerts')}</span>
              </label>

              <div className="border-t border-gray-100 pt-3 space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={offlineSyncEnabled}
                    onChange={(e) => setOfflineSyncEnabled(e.target.checked)}
                    className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.offlineSync')}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allowMultipleAttendance}
                    onChange={(e) => setAllowMultipleAttendance(e.target.checked)}
                    className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.schoolName') === 'विद्यालय का नाम' ? 'दैनिक एकाधिक उपस्थिति जांच की अनुमति दें' : 'Allow Multiple Daily Attendance Checks'}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={ocrEnabled}
                    onChange={(e) => setOcrEnabled(e.target.checked)}
                    className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.schoolName') === 'विद्यालय का नाम' ? 'एआई ओसीआर स्कैनर सक्रिय' : 'AI OCR Scanner Active'}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.schoolName') === 'विद्यालय का नाम' ? 'वॉयस असिस्टेंट सक्रिय' : 'Voice Assistants Active'}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={aiPredictiveEnabled}
                    onChange={(e) => setAiPredictiveEnabled(e.target.checked)}
                    className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-xs font-bold text-gray-700 uppercase">{t('settings.schoolName') === 'विद्यालय का नाम' ? 'अनुमानात्मक जोखिम इंजन सक्रिय' : 'Predictive Risk Engine Active'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Academic Holidays Calendar Card */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-4 lg:col-span-2 flex flex-col min-h-[350px]">
            {/* Card Header Bar */}
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-sm">
                  <FaCalendarAlt />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    {t('settings.holidays') || 'Academic Holidays Calendar'}
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">{t('settings.schoolName') === 'विद्यालय का नाम' ? 'वार्षिक आधिकारिक स्कूल छुट्टियों और त्योहारों को कॉन्फ़िगर करें' : 'Configure annual official school breaks and festival holidays'}</p>
                </div>
              </div>

              {holidays.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-[#2E7D32] dark:bg-emerald-950 dark:text-green-400 border border-emerald-200 dark:border-emerald-800">
                  {holidays.length} {holidays.length === 1 ? (t('settings.schoolName') === 'विद्यालय का नाम' ? 'छुट्टी' : 'Holiday') : (t('settings.schoolName') === 'विद्यालय का नाम' ? 'छुट्टियां' : 'Holidays')}
                </span>
              )}
            </div>

            {/* Form Inputs */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-gray-50/80 dark:bg-gray-750 p-3 rounded-xl border border-gray-200/80 dark:border-gray-700">
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="w-full sm:w-44 py-2 px-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
              />
              <input
                type="text"
                placeholder={t('settings.schoolName') === 'विद्यालय का नाम' ? 'छुट्टी का विवरण (उदा. दिवाली त्योहार)' : 'Holiday Description'}
                value={holidayDesc}
                onChange={(e) => setHolidayDesc(e.target.value)}
                className="w-full flex-1 py-2 px-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
              />
              <button
                type="button"
                onClick={handleAddHoliday}
                disabled={!holidayDate || !holidayDesc}
                className="w-full sm:w-auto px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <FaPlus className="text-xs" />
                <span>{t('settings.schoolName') === 'विद्यालय का नाम' ? 'छुट्टी जोड़ें' : 'Add Holiday'}</span>
              </button>
            </div>

            {/* List Display */}
            <div className="flex-1 overflow-y-auto mt-1 space-y-2.5 pr-1 font-sans scrollbar-none">
              {holidays.length > 0 ? (
                holidays.map((h, i) => {
                  const dateObj = new Date(h.date);
                  const formattedDate = dateObj.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-xs">
                          <FaRegCalendarCheck />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white capitalize block">
                            {h.description}
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                            <FaCalendarDay className="text-[9px] text-[#2E7D32]" />
                            <span>{formattedDate}</span>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveHoliday(i)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg transition cursor-pointer"
                        title="Remove Holiday"
                      >
                        <FaTrashAlt className="text-[10px]" />
                        <span>{t('settings.schoolName') === 'विद्यालय का नाम' ? 'हटाएं' : 'Remove'}</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-xs text-gray-400 font-semibold flex flex-col justify-center items-center gap-2">
                  <FaInfoCircle className="text-2xl text-gray-300 dark:text-gray-600" />
                  <span>{t('settings.schoolName') === 'विद्यालय का नाम' ? 'अभी तक कोई शैक्षणिक छुट्टी नहीं जोड़ी गई है।' : 'No academic holidays added yet.'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Save Settings toolbar */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-150 pt-4">
          <button
            type="submit"
            disabled={saveLoading}
            className="flex items-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer transition-colors"
          >
            {saveLoading ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>{t('common.loading')}</span>
              </>
            ) : (
              <>
                <FaSave />
                <span>{t('settings.saveSettings')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SchoolSettings;
