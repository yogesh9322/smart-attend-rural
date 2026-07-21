import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getClasses, getStudents, getAttendanceReport, markAttendance, getSchoolSettings } from '../services/api';
import { saveOfflineAttendance, hasOfflineAttendance } from '../services/db';
import { useOfflineSync } from '../hooks/useOfflineSync';
import {
  FaCheck,
  FaTimes,
  FaClock,
  FaSave,
  FaSpinner,
  FaChevronLeft,
  FaWifi,
  FaRegCheckCircle,
  FaExclamationCircle,
  FaInfoCircle
} from 'react-icons/fa';

const MarkAttendance = () => {
  const { t } = useTranslation('common');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('classId') || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({}); // studentId -> { status, remarks }
  
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const { isOnline, updatePendingCount } = useOfflineSync();

  // Load teacher classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await getClasses();
        if (res.success && res.data.length > 0) {
          setClasses(res.data);
          if (!selectedClassId) {
            setSelectedClassId(res.data[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load class directories:', err);
      }
    };
    fetchClasses();
  }, [selectedClassId]);

  // Load students & attendance logs for selected class and date
  const loadClassAttendance = useCallback(async () => {
    if (!selectedClassId) return;

    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      // 1. Fetch class students
      const studentsRes = await getStudents({ classId: selectedClassId });
      
      if (studentsRes.success) {
        const studentList = studentsRes.data;
        setStudents(studentList);

        // Initialize records (defaulting to Present)
        const initialRecords = {};
        studentList.forEach((s) => {
          initialRecords[s._id] = { status: 'Present', remarks: '' };
        });

        // 2. Fetch existing logs from backend (if online)
        let existingLogs = [];
        if (navigator.onLine) {
          const logsRes = await getAttendanceReport({
            classId: selectedClassId,
            startDate: date,
            endDate: date,
          });
          if (logsRes.success && logsRes.data.length > 0) {
            existingLogs = logsRes.data;
          }
        }

        // Fetch school settings to check allowMultipleAttendance rule
        let multipleAllowed = true;
        try {
          const settingsRes = await getSchoolSettings();
          if (settingsRes.success && settingsRes.data) {
            multipleAllowed = settingsRes.data.allowMultipleAttendance !== false;
          }
        } catch (settingsErr) {
          console.error('Failed to load settings:', settingsErr);
        }
        setAllowMultiple(multipleAllowed);

        // Apply existing records
        existingLogs.forEach((log) => {
          if (initialRecords[log.studentId?._id]) {
            initialRecords[log.studentId._id] = {
              status: log.status,
              remarks: log.remarks || '',
            };
          }
        });

        // Check if attendance already exists locally or online
        const hasOffline = await hasOfflineAttendance(selectedClassId, date);
        const submitted = (existingLogs.length > 0) || hasOffline;
        setAlreadySubmitted(submitted);

        setRecords(initialRecords);
      }
    } catch (err) {
      console.error('Failed to fetch class roster:', err);
      setMessage({ text: 'Error loading student list.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, date]);

  useEffect(() => {
    loadClassAttendance();
  }, [loadClassAttendance]);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message.text]);

  const handleStatusChange = (studentId, status) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleRemarksChange = (studentId, remarks) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks,
      },
    }));
  };

  // Bulk Actions
  const markAllStatus = (status) => {
    const updated = { ...records };
    students.forEach((s) => {
      updated[s._id] = { ...updated[s._id], status };
    });
    setRecords(updated);
  };

  // Submit attendance
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClassId || students.length === 0) return;

    setSubmitLoading(true);
    setMessage({ text: '', type: '' });

    // Format records array for API
    const formattedRecords = Object.entries(records).map(([studentId, data]) => ({
      studentId,
      status: data.status,
      remarks: data.remarks,
      syncMode: navigator.onLine ? 'online' : 'offline',
    }));

    try {
      if (navigator.onLine) {
        // Submit directly to server
        const res = await markAttendance({
          classId: selectedClassId,
          date,
          records: formattedRecords,
        });

        if (res.success) {
          setMessage({ text: 'Attendance recorded successfully online!', type: 'success' });
          setTimeout(() => navigate('/'), 1500);
        } else {
          throw new Error(res.message || 'Server failed to save attendance');
        }
      } else {
        // Save to IndexedDB
        await saveOfflineAttendance(selectedClassId, date, formattedRecords);
        await updatePendingCount();
        setMessage({
          text: 'Offline mode active. Attendance saved locally and will auto-sync once network connection is restored.',
          type: 'success',
        });
        setTimeout(() => navigate('/'), 2500);
      }
    } catch (err) {
      console.error('Attendance submission error:', err);
      setMessage({
        text: err.response?.data?.message || err.message || 'Failed to submit attendance.',
        type: 'error',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Calculate live counters
  const totalCount = students.length;
  const presentCount = Object.values(records).filter((r) => r.status === 'Present').length;
  const absentCount = Object.values(records).filter((r) => r.status === 'Absent').length;
  const lateCount = Object.values(records).filter((r) => r.status === 'Late').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDate = date !== todayStr;
  const isSubmissionDisabled = (alreadySubmitted && !allowMultiple) || isPastDate;

  return (
    <div className="space-y-6">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-500 hover:text-gray-700 bg-white rounded-lg border border-gray-200 cursor-pointer"
        >
          <FaChevronLeft />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('attendance.title')}</h2>
          <p className="text-sm text-gray-500 font-medium">
            {t('attendance.subtitle')}
          </p>
        </div>
      </div>

      {/* Select class and date toolbar */}
      <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
            {t('classes.grade')}
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="block w-full py-2.5 px-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold text-gray-700"
          >
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.grade} - {cls.section}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
            Date
          </label>
          <input
            type="date"
            max={new Date().toISOString().split('T')[0]}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold text-gray-700"
          />
        </div>

        <div className="flex items-end self-end h-full">
          {!isOnline && (
            <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
              <FaWifi />
              <span>{t('attendance.offlineMode')}</span>
            </span>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {message.text && (
        <div className={`p-4 rounded-xl border text-sm font-semibold ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {isPastDate && (
        <div className="p-4 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 text-sm font-semibold flex items-center gap-2">
          <FaInfoCircle className="text-lg" />
          <span>{t('attendance.viewingLogs', { date })}</span>
        </div>
      )}

      {alreadySubmitted && !allowMultiple && !isPastDate && (
        <div className="p-4 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 text-sm font-semibold flex items-center gap-2">
          <FaExclamationCircle className="text-lg animate-pulse" />
          <span>{t('attendance.alreadyRecorded')}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : students.length > 0 ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Summary and Bulk Actions Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Live Counters */}
            <div className="flex items-center gap-4 text-sm font-bold text-gray-600">
              <span>{t('dashboard_extra.total') || 'Total'}: {totalCount}</span>
              <span className="text-green-700">{t('attendance.present')}: {presentCount}</span>
              <span className="text-red-600">{t('attendance.absent')}: {absentCount}</span>
              <span className="text-amber-600">{t('attendance.late')}: {lateCount}</span>
            </div>

            {/* Bulk set buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSubmissionDisabled}
                onClick={() => !isSubmissionDisabled && markAllStatus('Present')}
                className="px-3 py-1.5 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 border border-green-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {t('attendance.markAllPresent')}
              </button>
              <button
                type="button"
                disabled={isSubmissionDisabled}
                onClick={() => !isSubmissionDisabled && markAllStatus('Absent')}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {t('attendance.markAllAbsent')}
              </button>
            </div>
          </div>

          {/* Student attendance list */}
          <div className="bg-white rounded-xl border border-gray-150 shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-150">
              {students.map((student) => {
                const sRecord = records[student._id] || { status: 'Present', remarks: '' };
                return (
                  <li
                    key={student._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4"
                  >
                    {/* Left: Student meta */}
                    <div className="flex items-center gap-3 w-full sm:w-64 flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-500">
                        {student.rollNo}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">{student.name}</h4>
                        <p className="text-xs text-gray-400">{t('students.rollNo')}: {student.rollNo} | {t('students.admissionNo')}: {student.admissionNo}</p>
                      </div>
                    </div>

                    {/* Middle: Remarks */}
                    <div className="flex-1 max-w-xs">
                      <input
                        type="text"
                        placeholder={t('common.optional') === 'रद्द करें' ? 'टिप्पणी (वैकल्पिक)' : t('common.optional') === 'रद्द करा' ? 'शेरा (पर्यायी)' : 'Add remarks (optional)'}
                        value={sRecord.remarks}
                        disabled={isSubmissionDisabled}
                        onChange={(e) => handleRemarksChange(student._id, e.target.value)}
                        className="w-full text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary text-gray-700 disabled:opacity-60 disabled:bg-gray-50"
                      />
                    </div>

                    {/* Right: Touch statuses buttons */}
                    <div className="flex gap-2">
                      {/* Present button */}
                      <button
                        type="button"
                        disabled={isSubmissionDisabled}
                        onClick={() => !isSubmissionDisabled && handleStatusChange(student._id, 'Present')}
                        className={`flex items-center gap-1 px-4 py-2.5 rounded-lg text-xs font-bold border transition-colors ${
                          isSubmissionDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          sRecord.status === 'Present'
                            ? 'bg-green-600 text-white border-green-600 shadow-md'
                            : 'bg-white hover:bg-gray-50 text-gray-400 border-gray-200'
                        } ${isSubmissionDisabled && sRecord.status !== 'Present' ? 'opacity-40' : ''}`}
                      >
                        <FaCheck />
                        <span>P</span>
                      </button>

                      {/* Late button */}
                      <button
                        type="button"
                        disabled={isSubmissionDisabled}
                        onClick={() => !isSubmissionDisabled && handleStatusChange(student._id, 'Late')}
                        className={`flex items-center gap-1 px-4 py-2.5 rounded-lg text-xs font-bold border transition-colors ${
                          isSubmissionDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          sRecord.status === 'Late'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                            : 'bg-white hover:bg-gray-50 text-gray-400 border-gray-200'
                        } ${isSubmissionDisabled && sRecord.status !== 'Late' ? 'opacity-40' : ''}`}
                      >
                        <FaClock />
                        <span>L</span>
                      </button>

                      {/* Absent button */}
                      <button
                        type="button"
                        disabled={isSubmissionDisabled}
                        onClick={() => !isSubmissionDisabled && handleStatusChange(student._id, 'Absent')}
                        className={`flex items-center gap-1 px-4 py-2.5 rounded-lg text-xs font-bold border transition-colors ${
                          isSubmissionDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          sRecord.status === 'Absent'
                            ? 'bg-red-600 text-white border-red-600 shadow-md'
                            : 'bg-white hover:bg-gray-50 text-gray-400 border-gray-200'
                        } ${isSubmissionDisabled && sRecord.status !== 'Absent' ? 'opacity-40' : ''}`}
                      >
                        <FaTimes />
                        <span>A</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Submit Toolbar */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-3 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
            >
              {t('common.cancel')}
            </button>

            <button
              type="submit"
              disabled={submitLoading || isSubmissionDisabled}
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {submitLoading ? (
                <>
                  <FaSpinner className="animate-spin" />
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <FaSave />
                  <span>{t('attendance.submit')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-8 bg-white border border-gray-150 rounded-xl text-center shadow-sm">
          <FaRegCheckCircle className="text-4xl text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-700">{t('students.noRecords')}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {t('students.noRecords')}
          </p>
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;
