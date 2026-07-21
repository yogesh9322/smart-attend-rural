import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getClasses, getStudents, getAttendanceReport } from '../services/api';
import { generateClassReportPDF } from '../utils/pdfGenerator';
import { generateClassReportExcel } from '../utils/excelGenerator';
import {
  FaFilter,
  FaFilePdf,
  FaFileExcel,
  FaCalendarAlt,
  FaSpinner,
  FaInfoCircle
} from 'react-icons/fa';

const Reports = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  // Date range filters (default to current month)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load classes on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await getClasses();
        if (res.success && res.data.length > 0) {
          setClasses(res.data);
          setSelectedClassId(res.data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load class list:', err);
      }
    };
    if (!isParent) {
      fetchMetadata();
    }
  }, [isParent]);

  const handleFetchReport = useCallback(async () => {
    setError('');

    // For parent accounts, we pull stats for all their children
    if (isParent) {
      setLoading(true);
      try {
        const parentChildren = user?.children || [];
        setStudents(parentChildren);

        // Fetch logs for all children
        const logs = [];
        for (const child of parentChildren) {
          const res = await getAttendanceReport({
            studentId: child._id,
            startDate,
            endDate,
          });
          if (res.success) {
            logs.push(...res.data);
          }
        }
        setAttendance(logs);
      } catch (err) {
        console.error(err);
        setError('Failed to load attendance records.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedClassId) return;

    setLoading(true);
    try {
      // 1. Fetch class students
      const studentsRes = await getStudents({ classId: selectedClassId });
      
      // 2. Fetch class attendance records
      const attendanceRes = await getAttendanceReport({
        classId: selectedClassId,
        startDate,
        endDate,
      });

      if (studentsRes.success && attendanceRes.success) {
        setStudents(studentsRes.data);
        setAttendance(attendanceRes.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch attendance reports.');
    } finally {
      setLoading(false);
    }
  }, [isParent, selectedClassId, startDate, endDate, user]);

  useEffect(() => {
    // If not parent and selectedClassId changes, auto fetch.
    // If parent, user loads, auto fetch.
    if (isParent && user) {
      handleFetchReport();
    } else if (selectedClassId) {
      handleFetchReport();
    }
  }, [selectedClassId, isParent, user, handleFetchReport]);

  // Export handlers
  const handleExportPDF = () => {
    if (students.length === 0) return;

    const rangeText = `${new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} to ${new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    if (isParent) {
      // PDF for parent's children
      generateClassReportPDF(
        { grade: 'Linked', section: 'Children' },
        students,
        attendance,
        rangeText
      );
    } else {
      const selectedClass = classes.find((c) => c._id === selectedClassId);
      generateClassReportPDF(
        selectedClass || { grade: 'Grade', section: 'Section' },
        students,
        attendance,
        rangeText
      );
    }
  };

  const handleExportExcel = () => {
    if (students.length === 0) return;

    const rangeText = `${new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} to ${new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    if (isParent) {
      generateClassReportExcel(
        { grade: 'Linked', section: 'Children' },
        students,
        attendance,
        rangeText
      );
    } else {
      const selectedClass = classes.find((c) => c._id === selectedClassId);
      generateClassReportExcel(
        selectedClass || { grade: 'Grade', section: 'Section' },
        students,
        attendance,
        rangeText
      );
    }
  };

  // Compile calculations for listing
  const compiledRows = students.map((student) => {
    const studentRecords = attendance.filter((r) => r.studentId?._id === student._id);
    const totalDays = studentRecords.length;
    const presents = studentRecords.filter((r) => r.status === 'Present').length;
    const absents = studentRecords.filter((r) => r.status === 'Absent').length;
    const lates = studentRecords.filter((r) => r.status === 'Late').length;
    
    const netPresent = presents + lates;
    const rate = totalDays > 0 ? Math.round((netPresent / totalDays) * 100) : 100;

    return {
      student,
      totalDays,
      presents,
      absents,
      lates,
      rate,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t('reports.title')}</h2>
        <p className="text-sm text-gray-500 font-medium">
          {t('reports.subtitle')}
        </p>
      </div>

      {/* Query Filters Bar */}
      <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm flex flex-col md:flex-row md:flex-wrap gap-4 items-end w-full">
        {/* Class Selection (hidden if Parent) */}
        {!isParent && (
          <div className="w-full md:w-56">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              {t('classes.selectClass')}
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
        )}

        {/* Start Date */}
        <div className="w-full md:w-44">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
            {t('reports.startDate')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold text-gray-600"
          />
        </div>

        {/* End Date */}
        <div className="w-full md:w-44">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
            {t('reports.endDate')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold text-gray-600"
          />
        </div>

        {/* Filter button */}
        <button
          onClick={handleFetchReport}
          className="w-full md:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 bg-secondary hover:bg-secondary-dark text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
        >
          <FaFilter />
          <span>{t('reports.submit') || 'Apply Filter'}</span>
        </button>

        {/* Export utilities (shown if students exist) */}
        {students.length > 0 && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={handleExportPDF}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer border border-red-700"
            >
              <FaFilePdf />
              <span>{t('reports.downloadPdf')}</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer border border-green-800"
            >
              <FaFileExcel />
              <span>{t('reports.downloadExcel')}</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Report Table display */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : compiledRows.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-150 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('students.rollNo')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('common.name')}</th>
                  {isParent && <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('nav.classes')}</th>}
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard_extra.totalDays')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('attendance.present')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('attendance.absent')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('attendance.late')}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard_extra.overallRate')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-150">
                {compiledRows.map(({ student, totalDays, presents, absents, lates, rate }) => (
                  <tr key={student._id}>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{student.rollNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-800">{student.name}</div>
                      <div className="text-[10px] text-gray-400">{t('students.admissionNo')}: {student.admissionNo}</div>
                    </td>
                    {isParent && (
                      <td className="px-6 py-4 text-sm text-gray-600 font-semibold whitespace-nowrap">
                        {student.classId?.grade || 'Grade'}-{student.classId?.section || 'A'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{totalDays}</td>
                    <td className="px-6 py-4 text-sm text-green-700 font-bold whitespace-nowrap">{presents}</td>
                    <td className="px-6 py-4 text-sm text-red-650 font-bold whitespace-nowrap">{absents}</td>
                    <td className="px-6 py-4 text-sm text-amber-700 font-bold whitespace-nowrap">{lates}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold border ${
                        rate >= 85
                          ? 'bg-green-50 border-green-150 text-green-700'
                          : rate >= 75
                          ? 'bg-amber-50 border-amber-150 text-amber-700'
                          : 'bg-red-50 border-red-150 text-red-700'
                      }`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-white border border-gray-150 rounded-xl shadow-sm text-center">
          <FaInfoCircle className="text-4xl text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-700">{t('students.noRecords')}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {t('students.noRecords')}
          </p>
        </div>
      )}
    </div>
  );
};

export default Reports;
