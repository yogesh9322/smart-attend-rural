import React, { useState, useEffect, useCallback } from 'react';
import { getClasses, getAttendanceReport } from '../services/api';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaFilePdf, FaFileExcel, FaPrint, FaCalendarAlt, FaUser, FaSpinner } from 'react-icons/fa';

const AttendanceHistory = () => {
  const { t } = useTranslation('common');
  const [classes, setClasses] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const classesRes = await getClasses();
        if (classesRes.success) {
          setClasses(classesRes.data);
          if (classesRes.data.length > 0) {
            setClassFilter(classesRes.data[0]._id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMetadata();
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!classFilter) return;
    try {
      setLoading(true);
      setError('');
      const params = { classId: classFilter };
      
      if (dateFilter) {
        params.startDate = dateFilter;
        params.endDate = dateFilter;
      }
      
      const res = await getAttendanceReport(params);
      if (res.success) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [classFilter, dateFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Client-side local filtering (name/rollNo, status)
  const filteredRecords = records.filter((rec) => {
    const studentName = rec.studentId?.name || '';
    const studentRoll = rec.studentId?.rollNo || '';

    const matchesSearch = searchQuery
      ? studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        studentRoll.includes(searchQuery)
      : true;
      
    const matchesStatus = statusFilter ? rec.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  // Export CSV Helper
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = ['Roll No', 'Student Name', 'Date', 'Status', 'Remarks', 'AI Verified'];
    const rows = filteredRecords.map((r) => [
      r.studentId?.rollNo || 'N/A',
      r.studentId?.name || 'N/A',
      new Date(r.date).toLocaleDateString(),
      r.status,
      r.remarks || '',
      r.aiVerified ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Excel Dummy Mock
  const handleExportExcel = () => {
    handleExportCSV(); // Fallback to CSV format for simple download
  };

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('nav.history')}</h2>
          <p className="text-sm text-gray-500 font-medium">
            {t('nav.history') === 'उपस्थिति इतिहास' ? 'कक्षा रोल कॉल रिकॉर्ड खोजें, फ़िल्टर करें और निर्यात करें।' : 'Search, filter, and export classroom roll call records.'}
          </p>
        </div>
        
        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
          >
            <FaFileExcel />
            <span>{t('reports.downloadExcel')}</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
          >
            <FaPrint />
            <span>{t('reports.downloadPdf') === 'पीडीएफ रिपोर्ट डाउनलोड करें' ? 'प्रिंट करें' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm space-y-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Class Select */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">{t('nav.classes')}</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t('classes.selectClass')}</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.grade} - {cls.section}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">{t('reports.date') || 'Specific Date'}</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">{t('reports.status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t('dashboard_extra.allStatuses')}</option>
              <option value="Present">{t('attendance.present')}</option>
              <option value="Absent">{t('attendance.absent')}</option>
              <option value="Late">{t('attendance.late')}</option>
              <option value="Leave">{t('nav.leave_request') || 'Leave'}</option>
            </select>
          </div>

          {/* Student Search */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">{t('common.search')} {t('nav.students')}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <FaSearch className="text-xs" />
              </span>
              <input
                type="text"
                placeholder={t('students.searchPlaceholder') || "Name or Roll No..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Print Layout / Records list */}
      <div className="bg-white border border-gray-150 rounded-3xl overflow-hidden shadow-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 bg-opacity-30">
          <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">
            {t('nav.history')} ({filteredRecords.length})
          </h3>
          {dateFilter && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500">
              <FaCalendarAlt />
              {new Date(dateFilter).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <FaSpinner className="animate-spin text-4xl text-[#2E7D32] mx-auto mb-3" />
            <span className="text-xs text-gray-400 font-bold">{t('common.loading')}</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-655 font-bold text-sm">{error}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16">
            <FaUser className="mx-auto text-4xl text-gray-300 mb-3" />
            <h4 className="text-sm font-bold text-gray-600">{t('students.noRecords')}</h4>
            <p className="text-xs text-gray-400 mt-1">{t('students.noRecords')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-150 text-left">
              <thead>
                <tr className="bg-gray-50 bg-opacity-60 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-3.5">{t('students.rollNo')}</th>
                  <th className="px-6 py-3.5">{t('common.name')}</th>
                  <th className="px-6 py-3.5">{t('reports.date')}</th>
                  <th className="px-6 py-3.5">{t('reports.status')}</th>
                  <th className="px-6 py-3.5">{t('dashboard_extra.aiCheck')}</th>
                  <th className="px-6 py-3.5">{t('dashboard_extra.remarks')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
                {filteredRecords.map((rec) => (
                  <tr key={rec._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{rec.studentId?.rollNo || 'N/A'}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      {rec.studentId?.name || 'Unknown Student'}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(rec.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide border ${
                          rec.status === 'Present'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : rec.status === 'Absent'
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : rec.status === 'Late'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-sky-50 border-sky-200 text-sky-700'
                        }`}
                      >
                        {rec.status === 'Present' ? t('attendance.present') : rec.status === 'Absent' ? t('attendance.absent') : rec.status === 'Late' ? t('attendance.late') : rec.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {rec.aiVerified ? (
                        <span className="text-green-600 font-bold flex items-center gap-1">
                          ✔ {t('dashboard_extra.verified')}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-medium">{t('dashboard_extra.standard')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 italic font-medium max-w-[150px] truncate">
                      {rec.remarks || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceHistory;
