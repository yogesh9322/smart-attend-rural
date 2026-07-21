import React, { useState, useEffect, useCallback } from 'react';
import { getClasses, getStudents, getAttendanceReport, getLeaveRequests } from '../services/api';
import { useTranslation } from 'react-i18next';
import { generateClassReportPDF } from '../utils/pdfGenerator';
import { FaFileAlt, FaFilePdf, FaFileExcel, FaPrint, FaSpinner, FaFilter, FaSearch, FaSchool } from 'react-icons/fa';

const AdvancedReports = () => {
  const { t } = useTranslation('common');
  const [reportType, setReportType] = useState('student'); // student, class, school, leave
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Filter States
  const [classFilter, setClassFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metaStats, setMetaStats] = useState({ present: 0, absent: 0, late: 0, leave: 0, total: 0, rate: 100 });
  const [error, setError] = useState('');

  // Fetch classes on mount
  useEffect(() => {
    const fetchClassesList = async () => {
      try {
        const res = await getClasses();
        if (res.success) {
          setClasses(res.data);
          if (res.data.length > 0) {
            setClassFilter(res.data[0]._id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchClassesList();
  }, []);

  // Fetch students when class filter changes
  useEffect(() => {
    const fetchStudentsList = async () => {
      if (!classFilter) return;
      try {
        const res = await getStudents({ classId: classFilter });
        if (res.success) {
          setStudents(res.data);
          if (res.data.length > 0) {
            setStudentFilter(res.data[0]._id);
          } else {
            setStudentFilter('');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStudentsList();
  }, [classFilter]);

  // Fetch report data
  const handleGenerateReport = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (reportType === 'student') {
        if (!studentFilter) {
          setError('Please select a student.');
          setLoading(false);
          return;
        }
        params.studentId = studentFilter;
        const res = await getAttendanceReport(params);
        if (res.success) {
          setRecords(res.data);
        }
      } else if (reportType === 'class') {
        if (!classFilter) {
          setError('Please select a class.');
          setLoading(false);
          return;
        }
        params.classId = classFilter;
        const res = await getAttendanceReport(params);
        if (res.success) {
          setRecords(res.data);
        }
      } else if (reportType === 'school') {
        // Fetch overall school attendance report
        const res = await getAttendanceReport(params);
        if (res.success) {
          setRecords(res.data);
        }
      } else if (reportType === 'leave') {
        const res = await getLeaveRequests();
        if (res.success) {
          // Filter by date range locally
          let filtered = res.data;
          if (startDate) {
            filtered = filtered.filter(l => new Date(l.fromDate) >= new Date(startDate));
          }
          if (endDate) {
            filtered = filtered.filter(l => new Date(l.toDate) <= new Date(endDate));
          }
          setRecords(filtered);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch report records.');
    } finally {
      setLoading(false);
    }
  }, [reportType, classFilter, studentFilter, startDate, endDate]);

  // Calculate statistics whenever records change
  useEffect(() => {
    if (records.length === 0) {
      setMetaStats({ present: 0, absent: 0, late: 0, leave: 0, total: 0, rate: 100 });
      return;
    }

    if (reportType === 'leave') {
      const total = records.length;
      const approved = records.filter(r => r.status === 'Approved').length;
      const pending = records.filter(r => r.status === 'Pending').length;
      const rejected = records.filter(r => r.status === 'Rejected').length;
      setMetaStats({ present: approved, absent: rejected, late: pending, leave: 0, total, rate: total > 0 ? Math.round((approved / total) * 100) : 100 });
      return;
    }

    const total = records.length;
    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const late = records.filter(r => r.status === 'Late').length;
    const leave = records.filter(r => r.status === 'Leave').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

    setMetaStats({ present, absent, late, leave, total, rate });
  }, [records, reportType]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (records.length === 0) return;
    let headers = [];
    let rows = [];

    if (reportType === 'leave') {
      headers = ['Student Name', 'From Date', 'To Date', 'Reason', 'Status', 'Remarks'];
      rows = records.map(r => [
        r.studentId?.name || 'N/A',
        new Date(r.fromDate).toLocaleDateString(),
        new Date(r.toDate).toLocaleDateString(),
        r.reason || 'N/A',
        r.status,
        r.remarks || 'None'
      ]);
    } else {
      headers = ['Roll No', 'Student Name', 'Date', 'Status', 'Remarks', 'AI Check'];
      rows = records.map(r => [
        r.studentId?.rollNo || 'N/A',
        r.studentId?.name || 'N/A',
        new Date(r.date).toLocaleDateString(),
        r.status,
        r.remarks || 'None',
        r.aiVerified ? 'FaceID Verified' : 'Standard Check-In'
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `School_Report_${reportType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export
  const handleExportPDF = () => {
    if (records.length === 0) return;
    
    const activeClass = classes.find(c => c._id === classFilter) || { grade: 'Grade 6', section: 'A' };
    const activeStudent = students.find(s => s._id === studentFilter);

    if (reportType === 'student' && activeStudent) {
      generateClassReportPDF(
        activeClass,
        [activeStudent],
        records,
        `${startDate || 'Beginning'} - ${endDate || 'Current'}`
      );
    } else {
      generateClassReportPDF(
        activeClass,
        students.length > 0 ? students : records.map(r => r.studentId).filter(Boolean),
        records,
        `${startDate || 'Beginning'} - ${endDate || 'Current'}`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          <FaFileAlt className="text-[#2E7D32]" />
          <span>{t('reports.title')}</span>
        </h2>
        <p className="text-sm text-gray-500 font-semibold font-sans">
          {t('reports.subtitle')}
        </p>
      </div>

      {/* Reports Filter Form */}
      <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-md no-print">
        <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <FaFilter />
          <span>{t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'रिपोर्ट कॉन्फ़िगरेशन फ़िल्टर' : 'Report Configuration Filters'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Report Type */}
          <div>
            <label htmlFor="reportType" className="block text-xs font-bold text-gray-500 uppercase mb-1">
              {t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'रिपोर्ट श्रेणी' : 'Report Category'}
            </label>
            <select
              id="reportType"
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value);
                setRecords([]);
              }}
              className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="student">{t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'छात्र उपस्थिति रिपोर्ट' : 'Student Attendance Report'}</option>
              <option value="class">{t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'कक्षा उपस्थिति रिपोर्ट' : 'Class Attendance Report'}</option>
              <option value="school">{t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'स्कूल समग्र रिपोर्ट' : 'School Overall Report'}</option>
              <option value="leave">{t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'छुट्टी अनुरोध रिपोर्ट' : 'Leave Request Report'}</option>
            </select>
          </div>

          {/* Conditional Class filter */}
          {(reportType === 'student' || reportType === 'class') && (
            <div>
              <label htmlFor="class" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                {t('classes.selectClass')}
              </label>
              <select
                id="class"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    Grade {c.grade}-{c.section}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional Student filter */}
          {reportType === 'student' && (
            <div>
              <label htmlFor="student" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                {t('students.selectParent') === 'अभिभावक चुनें' ? 'छात्र चुनें' : 'Select Student'}
              </label>
              <select
                id="student"
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} (Roll {s.rollNo})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date range filters */}
          <div>
            <label htmlFor="start" className="block text-xs font-bold text-gray-500 uppercase mb-1">
              {t('reports.startDate')}
            </label>
            <input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="end" className="block text-xs font-bold text-gray-500 uppercase mb-1">
              {t('reports.endDate')}
            </label>
            <input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t border-gray-100 pt-4">
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow hover:shadow-md transition cursor-pointer"
          >
            <FaSearch />
            <span>{t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'रिपोर्ट पूर्वावलोकन उत्पन्न करें' : 'Generate Report Preview'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center font-bold text-xs no-print">
          {error}
        </div>
      )}

      {/* Report Preview */}
      {records.length > 0 && (
        <div className="space-y-6">
          {/* Export Panel controls */}
          <div className="flex items-center justify-between no-print border-b border-gray-150 pb-4">
            <h3 className="text-base font-extrabold text-gray-800">{t('reports.title') === 'उपस्थिति रिपोर्ट' ? 'रिपोर्ट पूर्वावलोकन' : 'Report Preview'}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <FaFileExcel />
                <span>{t('reports.downloadExcel')}</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <FaFilePdf />
                <span>{t('reports.downloadPdf')}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <FaPrint />
                <span>{t('reports.downloadPdf') === 'पीडीएफ रिपोर्ट डाउनलोड करें' ? 'रिपोर्ट प्रिंट करें' : 'Print Report'}</span>
              </button>
            </div>
          </div>

          {/* Stats summary boxes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="bg-white border border-gray-150 p-5 rounded-3xl shadow-sm text-center">
              <span className="text-[10px] text-gray-450 uppercase block font-extrabold tracking-wider">{t('dashboard_extra.overallRate')}</span>
              <span className="text-xl font-black text-gray-800 block mt-1">{metaStats.rate}%</span>
            </div>
            <div className="bg-white border border-gray-150 p-5 rounded-3xl shadow-sm text-center">
              <span className="text-[10px] text-gray-450 uppercase block font-extrabold tracking-wider">
                {reportType === 'leave' ? t('dashboard_extra.approved') : t('attendance.present')}
              </span>
              <span className="text-xl font-black text-green-700 block mt-1">{metaStats.present}</span>
            </div>
            <div className="bg-white border border-gray-150 p-5 rounded-3xl shadow-sm text-center">
              <span className="text-[10px] text-gray-450 uppercase block font-extrabold tracking-wider">
                {reportType === 'leave' ? t('dashboard_extra.rejected') : t('attendance.absent')}
              </span>
              <span className="text-xl font-black text-red-700 block mt-1">{metaStats.absent}</span>
            </div>
            <div className="bg-white border border-gray-150 p-5 rounded-3xl shadow-sm text-center">
              <span className="text-[10px] text-gray-450 uppercase block font-extrabold tracking-wider">
                {reportType === 'leave' ? t('dashboard_extra.pending') : t('dashboard_extra.totalDays')}
              </span>
              <span className="text-xl font-black text-gray-800 block mt-1">{metaStats.total}</span>
            </div>
          </div>

          {/* Print specific letterhead */}
          <div className="print-letterhead hidden">
            <div className="text-center pb-6 border-b-2 border-gray-300">
              <h1 className="text-2xl font-black text-gray-800">SmartAttend Rural Academy</h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">AI-Powered School ERP Reports Ledger</p>
            </div>
          </div>

          {/* Records list preview table */}
          <div className="bg-white border border-gray-150 rounded-3xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-150 text-left">
                <thead>
                  <tr className="bg-gray-50 bg-opacity-60 text-[10px] font-extrabold text-gray-450 uppercase tracking-widest">
                    {reportType === 'leave' ? (
                      <>
                        <th className="px-6 py-3.5">{t('common.name')}</th>
                        <th className="px-6 py-3.5">{t('dashboard_extra.from')}</th>
                        <th className="px-6 py-3.5">{t('dashboard_extra.to')}</th>
                        <th className="px-6 py-3.5">{t('reports.status')}</th>
                        <th className="px-6 py-3.5">{t('dashboard_extra.leaveReason')}</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-3.5">{t('students.rollNo')}</th>
                        <th className="px-6 py-3.5">{t('common.name')}</th>
                        <th className="px-6 py-3.5">{t('reports.date')}</th>
                        <th className="px-6 py-3.5">{t('reports.status')}</th>
                        <th className="px-6 py-3.5">{t('dashboard_extra.remarks')}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
                  {records.map((rec) => (
                    <tr key={rec._id} className="hover:bg-gray-50 transition-colors">
                      {reportType === 'leave' ? (
                        <>
                          <td className="px-6 py-4 font-bold text-gray-900">{rec.studentId?.name || 'N/A'}</td>
                          <td className="px-6 py-4 text-gray-500">{new Date(rec.fromDate).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-gray-500">{new Date(rec.toDate).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              rec.status === 'Approved' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-250 text-amber-800'
                            }`}>
                              {rec.status === 'Approved' ? t('dashboard_extra.approved') : rec.status === 'Rejected' ? t('dashboard_extra.rejected') : rec.status === 'Pending' ? t('dashboard_extra.pending') : rec.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-medium">{rec.reason}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-bold text-gray-900">{rec.studentId?.rollNo || 'N/A'}</td>
                          <td className="px-6 py-4 font-bold text-gray-800">{rec.studentId?.name || 'N/A'}</td>
                          <td className="px-6 py-4 text-gray-500">{new Date(rec.date).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              rec.status === 'Present' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-150 text-red-700'
                            }`}>
                              {rec.status === 'Present' ? t('attendance.present') : rec.status === 'Absent' ? t('attendance.absent') : rec.status === 'Late' ? t('attendance.late') : rec.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 italic font-medium">{rec.remarks || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedReports;
