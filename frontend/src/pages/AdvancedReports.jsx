import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getClasses,
  getStudents,
  getAttendanceReport,
  getLeaveRequests,
  downloadAttendanceExport,
  getSchoolSettings,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  generateAttendanceHistoryPDF,
  generateLeaveReportPDF,
  getApprovalDetails,
  formatApprovalDateTime,
} from '../utils/pdfGenerator';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  FaFileAlt,
  FaFilePdf,
  FaFileExcel,
  FaSpinner,
  FaFilter,
  FaSearch,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaUserCheck,
  FaUserTimes,
  FaClock,
  FaCalendarCheck,
  FaPercent,
} from 'react-icons/fa';

const getFirstDayOfMonthStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

const AdvancedReports = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  // Report Type: teacher only has student, class, leave (no school overall)
  const [reportType, setReportType] = useState('class'); // 'class' | 'student' | 'leave' | 'school'
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolSettings, setSchoolSettings] = useState(null);

  // Filter States
  const [classFilter, setClassFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [startDate, setStartDate] = useState(getFirstDayOfMonthStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  // Report Execution & Results
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState('');

  // Export State
  const [exportingExcel, setExportingExcel] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');
  const [exportError, setExportError] = useState('');

  // Fallback if teacher previously had school selected
  useEffect(() => {
    if (isTeacher && reportType === 'school') {
      setReportType('class');
    }
  }, [isTeacher, reportType]);

  const formatClassLabel = useCallback((c) => {
    if (!c) return 'N/A';
    const g = String(c.grade || '').trim();
    const normGrade = g.toLowerCase().startsWith('grade')
      ? `Grade ${g.replace(/^grade\s*/i, '').trim()}`
      : `Grade ${g}`;
    return `${normGrade}-${c.section || ''}`;
  }, []);

  // Fetch classes & school configurations on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [classesRes, settingsRes] = await Promise.allSettled([
          getClasses(),
          getSchoolSettings(),
        ]);

        if (classesRes.status === 'fulfilled' && classesRes.value?.success) {
          const list = classesRes.value.data || [];
          setClasses(list);
          if (list.length > 0) {
            setClassFilter(list[0]._id);
          }
        }

        if (settingsRes.status === 'fulfilled' && settingsRes.value?.success) {
          setSchoolSettings(settingsRes.value.data || null);
        }
      } catch (err) {
        console.error('Error fetching initial report data:', err);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch students when classFilter changes
  useEffect(() => {
    const fetchStudentsList = async () => {
      if (!classFilter || classFilter === 'ALL') {
        setStudents([]);
        setStudentFilter('');
        return;
      }
      try {
        const res = await getStudents({ classId: classFilter });
        if (res.success) {
          const sList = res.data || [];
          setStudents(sList);
          if (sList.length > 0) {
            setStudentFilter(sList[0]._id);
          } else {
            setStudentFilter('');
          }
        }
      } catch (err) {
        console.error('Error fetching students list:', err);
      }
    };
    fetchStudentsList();
  }, [classFilter]);

  // Selected entities for labels
  const activeClass = useMemo(() => {
    if (classFilter === 'ALL') return null;
    return classes.find((c) => c._id === classFilter) || null;
  }, [classes, classFilter]);

  const activeStudent = useMemo(() => {
    return students.find((s) => s._id === studentFilter) || null;
  }, [students, studentFilter]);

  const classLabel = activeClass ? formatClassLabel(activeClass) : 'All Assigned Classes';

  // Primary Generator Action
  const handleGenerateReport = useCallback(async () => {
    setError('');
    setExportError('');
    setExportSuccess('');
    setHasGenerated(true);
    setLoading(true);

    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (reportType === 'student') {
        if (!studentFilter) {
          setRecords([]);
          setLoading(false);
          return;
        }
        params.studentId = studentFilter;
        if (classFilter && classFilter !== 'ALL') params.classId = classFilter;
        const res = await getAttendanceReport(params);
        setRecords(res.success ? res.data || [] : []);
      } else if (reportType === 'class') {
        if (!classFilter || classFilter === 'ALL') {
          setRecords([]);
          setLoading(false);
          return;
        }
        params.classId = classFilter;
        const res = await getAttendanceReport(params);
        setRecords(res.success ? res.data || [] : []);
      } else if (reportType === 'school') {
        // School-wide overall report (Admin only)
        const res = await getAttendanceReport(params);
        setRecords(res.success ? res.data || [] : []);
      } else if (reportType === 'leave') {
        const [leaveRes, attRes] = await Promise.all([
          getLeaveRequests(),
          getAttendanceReport(params),
        ]);

        let combinedLeaves = leaveRes.success ? [...(leaveRes.data || [])] : [];

        // Also incorporate daily roll call records explicitly marked as Leave/Excused
        if (attRes.success && Array.isArray(attRes.data)) {
          const leaveAttRecords = attRes.data.filter(
            (a) => a.status === 'Leave' || a.status === 'Excused'
          );
          for (const att of leaveAttRecords) {
            const attStudentId = att.studentId?._id || att.studentId;
            const attDate = new Date(att.date);
            const alreadyCovered = combinedLeaves.some((l) => {
              const lStudentId = l.studentId?._id || l.studentId;
              if (String(lStudentId) !== String(attStudentId)) return false;
              const f = new Date(l.fromDate);
              f.setHours(0, 0, 0, 0);
              const tDate = new Date(l.toDate);
              tDate.setHours(23, 59, 59, 999);
              return attDate >= f && attDate <= tDate;
            });

            if (!alreadyCovered) {
              combinedLeaves.push({
                _id: `att-leave-${att._id}`,
                studentId: {
                  ...(typeof att.studentId === 'object' ? att.studentId : { _id: att.studentId }),
                  classId: att.classId || att.studentId?.classId,
                },
                fromDate: att.date,
                toDate: att.date,
                status: 'Approved',
                reason: att.remarks || 'Marked On Leave in Attendance Register',
                remarks: att.remarks || 'Recorded by Class Teacher',
              });
            }
          }
        }

        // Filter by class if specific class selected
        if (classFilter && classFilter !== 'ALL') {
          combinedLeaves = combinedLeaves.filter((l) => {
            const cId = l.studentId?.classId?._id || l.studentId?.classId;
            return String(cId) === String(classFilter);
          });
        }

        // Date range filter
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          combinedLeaves = combinedLeaves.filter((l) => new Date(l.toDate || l.fromDate) >= sDate);
        }
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          combinedLeaves = combinedLeaves.filter((l) => new Date(l.fromDate) <= eDate);
        }

        setRecords(combinedLeaves);
      }
    } catch (err) {
      console.error('Error generating report preview:', err);
      setError(err.response?.data?.message || 'Failed to generate report preview.');
    } finally {
      setLoading(false);
    }
  }, [reportType, classFilter, studentFilter, startDate, endDate]);

  // Automatically generate preview once initial classes are loaded
  const [initialGenerated, setInitialGenerated] = useState(false);
  useEffect(() => {
    if (!initialGenerated && classes.length > 0 && classFilter) {
      setInitialGenerated(true);
      handleGenerateReport();
    }
  }, [classes, classFilter, initialGenerated, handleGenerateReport]);

  // Statistics calculation for the generated preview
  const metaStats = useMemo(() => {
    if (records.length === 0) {
      return { present: 0, absent: 0, late: 0, leave: 0, total: 0, rate: 0 };
    }

    if (reportType === 'leave') {
      const total = records.length;
      const approved = records.filter((r) => r.status === 'Approved').length;
      const pending = records.filter((r) => r.status === 'Pending').length;
      const rejected = records.filter((r) => r.status === 'Rejected').length;
      return {
        present: approved,
        absent: rejected,
        late: pending,
        leave: total,
        total,
        rate: total > 0 ? Math.round((approved / total) * 100) : 0,
      };
    }

    const total = records.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    for (const r of records) {
      if (r.status === 'Present') present++;
      else if (r.status === 'Absent') absent++;
      else if (r.status === 'Late') late++;
      else if (r.status === 'Leave' || r.status === 'Excused') leave++;
    }

    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { present, absent, late, leave, total, rate };
  }, [records, reportType]);

  // Export Excel (.xlsx) Action
  const handleExportExcel = async () => {
    if (records.length === 0) return;
    setExportError('');
    setExportSuccess('');
    setExportingExcel(true);

    try {
      if (reportType === 'class' || reportType === 'student') {
        const params = {
          classId: classFilter,
          startDate,
          endDate,
          format: 'xlsx',
        };
        if (reportType === 'student' && studentFilter) {
          params.studentId = studentFilter;
        }

        const response = await downloadAttendanceExport(params);
        let filename = `${reportType === 'student' ? (activeStudent?.name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_') : classLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}_Attendance_Report_${startDate || 'Start'}_to_${endDate || 'End'}.xlsx`;

        const disposition = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename="?([^";]+)"?/);
          if (match && match[1]) filename = match[1];
        }

        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setExportSuccess('Excel workbook (.xlsx) downloaded successfully.');
        setTimeout(() => setExportSuccess(''), 4000);
      } else if (reportType === 'leave') {
        const schoolName = schoolSettings?.schoolName || 'Smart Rural Model School';
        const rangeText = `${startDate || 'Beginning'} to ${endDate || 'Current'}`;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SmartAttend Rural';
        workbook.lastModifiedBy = user?.name || (isAdmin ? 'Admin' : 'Class Teacher');
        workbook.created = new Date();
        workbook.modified = new Date();

        const sheet = workbook.addWorksheet('Leave Requests', {
          views: [{ state: 'normal' }],
          pageSetup: {
            orientation: 'landscape',
            paperSize: 9, // A4
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
            printTitlesRow: '10:10',
          },
        });

        const borderThin = {
          top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
          left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
          right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        };

        const totalCols = 10;
        const endColLetter = 'J';

        // 1. School Name Header
        sheet.mergeCells(`A1:${endColLetter}1`);
        const row1 = sheet.getCell('A1');
        row1.value = schoolName.toUpperCase();
        row1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E4620' } };
        row1.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 28;

        // 2. Report Subtitle
        sheet.mergeCells(`A2:${endColLetter}2`);
        const row2 = sheet.getCell('A2');
        row2.value = 'STUDENT LEAVE REQUEST REPORT';
        row2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF333333' } };
        row2.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(2).height = 22;

        // Row 3: Spacing
        sheet.getRow(3).height = 8;

        // 3. Metadata Rows
        sheet.getCell('A4').value = 'Scope:';
        sheet.getCell('B4').value = classLabel;
        sheet.getCell('F4').value = 'Period:';
        sheet.getCell('G4').value = rangeText;

        sheet.getCell('A5').value = 'Generated By:';
        sheet.getCell('B5').value = user?.name || (isAdmin ? 'Admin' : 'Class Teacher');
        sheet.getCell('F5').value = 'Generated On:';
        sheet.getCell('G5').value = new Date().toLocaleString();

        ['A4', 'F4', 'A5', 'F5'].forEach((cellKey) => {
          const cell = sheet.getCell(cellKey);
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF555555' } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });
        ['B4', 'G4', 'B5', 'G5'].forEach((cellKey) => {
          const cell = sheet.getCell(cellKey);
          cell.font = { name: 'Calibri', size: 10, bold: cellKey === 'B4', color: { argb: 'FF111111' } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });

        sheet.getRow(4).height = 20;
        sheet.getRow(5).height = 20;
        sheet.getRow(6).height = 8; // Spacing

        // 4. Summary Statistics Section
        const summaryHeaders = ['Approval Rate', 'Approved', 'Rejected', 'Pending', 'Total Requests'];
        const summaryValues = [`${metaStats.rate}%`, metaStats.present, metaStats.absent, metaStats.late, metaStats.total];

        sheet.getRow(7).height = 22;
        sheet.getRow(8).height = 24;

        summaryHeaders.forEach((hdr, sIdx) => {
          const colIdx = sIdx + 1;
          const hCell = sheet.getRow(7).getCell(colIdx);
          hCell.value = hdr;
          hCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF444444' } };
          hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          hCell.alignment = { horizontal: 'center', vertical: 'middle' };
          hCell.border = borderThin;

          const vCell = sheet.getRow(8).getCell(colIdx);
          vCell.value = summaryValues[sIdx];
          vCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: sIdx === 0 ? 'FF1E4620' : 'FF111111' } };
          vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          vCell.alignment = { horizontal: 'center', vertical: 'middle' };
          vCell.border = borderThin;
        });

        sheet.getRow(9).height = 10; // Spacing

        // 5. Leave Table Column Headers
        const leaveHeaders = [
          'Sr. No.',
          'Student Name',
          'Class / Section',
          'From Date',
          'To Date',
          'Status',
          'Approved By',
          'Approval Date',
          'Reason',
          'Remarks',
        ];

        sheet.getRow(10).height = 26;
        leaveHeaders.forEach((colName, idx) => {
          const cell = sheet.getRow(10).getCell(idx + 1);
          cell.value = colName;
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
          cell.alignment = {
            horizontal: [1, 2, 6, 8, 9].includes(idx) ? 'left' : 'center',
            vertical: 'middle',
            wrapText: true,
          };
          cell.border = borderThin;
        });

        // 6. Data Rows
        let currentRowIdx = 11;
        if (records.length > 0) {
          records.forEach((rec, idx) => {
            const row = sheet.getRow(currentRowIdx);
            row.height = 22;

            const isOdd = idx % 2 === 1;
            const rowBgColor = isOdd ? 'FFF6FAF6' : 'FFFFFFFF';

            const { approvedBy, approvalDate } = getApprovalDetails(rec);

            const rowValues = [
              idx + 1,
              rec.studentId?.name || 'N/A',
              rec.studentId?.classId ? formatClassLabel(rec.studentId.classId) : classLabel,
              rec.fromDate ? new Date(rec.fromDate).toLocaleDateString('en-GB') : 'N/A',
              rec.toDate ? new Date(rec.toDate).toLocaleDateString('en-GB') : 'N/A',
              rec.status || 'Pending',
              approvedBy,
              approvalDate,
              rec.reason || 'N/A',
              rec.remarks || 'None',
            ];

            rowValues.forEach((val, colIdx) => {
              const cell = row.getCell(colIdx + 1);
              cell.value = val;
              cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF222222' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
              cell.border = borderThin;
              cell.alignment = {
                horizontal: [1, 2, 6, 8, 9].includes(colIdx) ? 'left' : 'center',
                vertical: 'middle',
                wrapText: true,
              };
            });

            currentRowIdx++;
          });
        } else {
          sheet.mergeCells(`A${currentRowIdx}:${endColLetter}${currentRowIdx}`);
          const emptyCell = sheet.getCell(`A${currentRowIdx}`);
          emptyCell.value = 'No leave records found for the selected period';
          emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF777777' } };
          emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
          emptyCell.border = borderThin;
          sheet.getRow(currentRowIdx).height = 28;
          currentRowIdx++;
        }

        // Set suitable Column Widths
        sheet.getColumn(1).width = 10;  // Sr. No.
        sheet.getColumn(2).width = 24;  // Student Name
        sheet.getColumn(3).width = 18;  // Class / Section
        sheet.getColumn(4).width = 15;  // From Date
        sheet.getColumn(5).width = 15;  // To Date
        sheet.getColumn(6).width = 14;  // Status
        sheet.getColumn(7).width = 22;  // Approved By
        sheet.getColumn(8).width = 24;  // Approval Date
        sheet.getColumn(9).width = 30;  // Reason
        sheet.getColumn(10).width = 24; // Remarks

        sheet.autoFilter = {
          from: { row: 10, column: 1 },
          to: { row: Math.max(11, currentRowIdx - 1), column: totalCols },
        };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Leave_Request_Report_${startDate || 'Start'}_to_${endDate || 'End'}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setExportSuccess('Leave Request Excel workbook (.xlsx) downloaded successfully.');
        setTimeout(() => setExportSuccess(''), 4000);
      } else {
        // School overall report (Admin)
        const schoolName = schoolSettings?.schoolName || 'Smart Rural Model School';
        const wsData = [
          [schoolName.toUpperCase()],
          ['SCHOOL OVERALL ATTENDANCE REPORT'],
          [`Period: ${startDate || 'Beginning'} to ${endDate || 'Current'}`],
          [`Generated By: ${user?.name || 'Admin'}`, `Generated On: ${new Date().toLocaleString()}`],
          [],
          ['Total Marked', 'Present', 'Absent', 'Late', 'On Leave', 'Attendance %'],
          [metaStats.total, metaStats.present, metaStats.absent, metaStats.late, metaStats.leave, `${metaStats.rate}%`],
          [],
          ['Sr. No.', 'Roll No.', 'Student Name', 'Date', 'Status', 'Remarks'],
        ];

        records.forEach((rec, idx) => {
          wsData.push([
            idx + 1,
            rec.studentId?.rollNo || 'N/A',
            rec.studentId?.name || 'N/A',
            rec.date ? new Date(rec.date).toLocaleDateString() : 'N/A',
            rec.status || 'N/A',
            rec.remarks || '-',
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'School Report');
        XLSX.writeFile(wb, `School_Overall_Report_${startDate || 'Start'}_to_${endDate || 'End'}.xlsx`);

        setExportSuccess('School overall Excel report (.xlsx) downloaded successfully.');
        setTimeout(() => setExportSuccess(''), 4000);
      }
    } catch (err) {
      console.error('Excel Export error:', err);
      setExportError(err.response?.data?.message || 'Failed to download Excel report.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Export PDF Action
  const handleExportPDF = async () => {
    if (records.length === 0) return;
    setExportError('');
    setExportSuccess('');
    setGeneratingPdf(true);

    try {
      const rangeLabel = `${startDate || 'Beginning'} to ${endDate || 'Current'}`;
      const schoolName = schoolSettings?.schoolName || 'Smart Rural Model School';
      const schoolLogo = schoolSettings?.schoolLogo || '';
      const teacherName = user?.name || 'Class Teacher';

      if (reportType === 'leave') {
        generateLeaveReportPDF(records, rangeLabel, schoolName);
        setExportSuccess('Leave Request PDF report downloaded successfully.');
        setTimeout(() => setExportSuccess(''), 4000);
        return;
      }

      const activeLabel = reportType === 'student'
        ? `${activeStudent?.name || 'Student'} (${classLabel})`
        : classLabel;

      const filename = `${activeLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}_Attendance_Report_${startDate || 'Start'}_to_${endDate || 'End'}.pdf`;

      await generateAttendanceHistoryPDF({
        schoolName,
        schoolLogo,
        classLabel: activeLabel,
        periodLabel: rangeLabel,
        teacherName,
        summary: {
          totalStudents: reportType === 'student' ? 1 : (students.length || metaStats.total),
          totalMarked: metaStats.total,
          present: metaStats.present,
          absent: metaStats.absent,
          late: metaStats.late,
          leave: metaStats.leave,
          rate: metaStats.rate,
        },
        records,
        filename,
      });

      setExportSuccess('PDF report generated and downloaded successfully.');
      setTimeout(() => setExportSuccess(''), 4000);
    } catch (err) {
      console.error('PDF generation error:', err);
      setExportError('Failed to generate PDF report. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
          <FaFileAlt className="text-[#2E7D32]" />
          <span>{t('reports.title', 'Attendance Reports')}</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-normal mt-0.5">
          {t(
            'reports.subtitle',
            'Generate formal summaries, analytics, and documents for classes and students.'
          )}
        </p>
      </div>

      {/* 2. Report Configuration Filter Panel */}
      <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl p-5 shadow-xs no-print space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <FaFilter className="text-xs text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            {t('reports.reportCategory', 'Report Configuration Filters')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Report Type Selector */}
          <div>
            <label
              htmlFor="reportType"
              className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5"
            >
              {t('reports.reportCategory', 'Report Type')}
            </label>
            <select
              id="reportType"
              value={reportType}
              onChange={(e) => {
                const nextType = e.target.value;
                setReportType(nextType);
                if (nextType === 'leave') {
                  setClassFilter('ALL');
                } else if (classFilter === 'ALL' && classes.length > 0) {
                  setClassFilter(classes[0]._id);
                }
              }}
              className="block w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="class">{t('reports.classReport', 'Class Attendance Report')}</option>
              <option value="student">{t('reports.studentReport', 'Student Attendance Report')}</option>
              {isAdmin && (
                <option value="school">{t('reports.schoolReport', 'School Overall Report')}</option>
              )}
              <option value="leave">{t('reports.leaveReport', 'Leave Request Report')}</option>
            </select>
          </div>

          {/* Conditional Class Filter */}
          {reportType !== 'school' && (
            <div>
              <label
                htmlFor="classSelect"
                className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5"
              >
                {t('classes.selectClass', 'Class / Section')}
              </label>
              <select
                id="classSelect"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="block w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
              >
                {reportType === 'leave' && (
                  <option value="ALL">{t('reports.allAssignedClasses', 'All Assigned Classes')}</option>
                )}
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {formatClassLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional Student Filter */}
          {reportType === 'student' && (
            <div>
              <label
                htmlFor="studentSelect"
                className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5"
              >
                {t('students.selectParent') === 'अभिभावक चुनें' ? 'छात्र चुनें' : 'Select Student'}
              </label>
              <select
                id="studentSelect"
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                disabled={students.length === 0}
                className="block w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer disabled:opacity-50"
              >
                {students.length === 0 ? (
                  <option value="">No students in class</option>
                ) : (
                  students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (Roll No. {s.rollNo || 'N/A'})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Date Range: Start Date */}
          <div>
            <label
              htmlFor="startDate"
              className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5"
            >
              {t('reports.startDate', 'Start Date')}
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Date Range: End Date */}
          <div>
            <label
              htmlFor="endDate"
              className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5"
            >
              {t('reports.endDate', 'End Date')}
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Generate Button Row */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <button
            onClick={handleGenerateReport}
            disabled={loading || (reportType === 'student' && !studentFilter)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition cursor-pointer"
          >
            {loading ? <FaSpinner className="animate-spin text-xs" /> : <FaSearch className="text-xs" />}
            <span>{t('reports.generate', 'Generate Report Preview')}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {exportSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-2xl flex items-center gap-2 no-print">
          <FaCheckCircle className="text-emerald-600 shrink-0" />
          <span>{exportSuccess}</span>
        </div>
      )}
      {exportError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-2xl flex items-center gap-2 no-print">
          <FaTimesCircle className="text-rose-600 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-2xl flex items-center gap-2 no-print">
          <FaTimesCircle className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Report Preview Section */}
      {hasGenerated && (
        <div className="space-y-6">
          {/* Preview Section Header & Export Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3 no-print">
            <div>
              <h3 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span>{t('reports.reportPreview', 'Report Preview')}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300">
                  {reportType === 'student' && activeStudent
                    ? `${activeStudent.name} (${classLabel})`
                    : reportType === 'leave'
                    ? 'Leave Requests'
                    : classLabel}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Period: {startDate || 'Beginning'} to {endDate || 'Current'} • {metaStats.total} records found
              </p>
            </div>

            {/* Export Buttons: ONLY displayed when valid report preview exists with records */}
            {!loading && records.length > 0 && (
              <div className="flex items-center gap-2.5">
                {/* Export Excel (.xlsx) */}
                <button
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                  title="Download formatted Excel workbook (.xlsx)"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {exportingExcel ? (
                    <FaSpinner className="animate-spin text-xs" />
                  ) : (
                    <FaFileExcel className="text-sm" />
                  )}
                  <span>{exportingExcel ? 'Exporting...' : t('reports.downloadExcel', 'Export Excel')}</span>
                </button>

                {/* Export PDF */}
                <button
                  onClick={handleExportPDF}
                  disabled={generatingPdf}
                  title="Download formatted PDF document"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 disabled:opacity-50 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                >
                  {generatingPdf ? (
                    <FaSpinner className="animate-spin text-xs" />
                  ) : (
                    <FaFilePdf className="text-sm text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{generatingPdf ? 'Generating...' : t('reports.downloadPdf', 'Export PDF')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Summary KPI Cards Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {reportType === 'leave' ? (
              <>
                <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-slate-400 dark:text-gray-400 uppercase font-bold tracking-wider block">
                    Total Requests
                  </span>
                  <span className="text-xl font-bold text-gray-800 dark:text-white mt-1 block">
                    {metaStats.total}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-wider block">
                    Approved
                  </span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 block">
                    {metaStats.present}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-rose-100 dark:border-rose-900/40 bg-rose-50/20 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold tracking-wider block">
                    Rejected
                  </span>
                  <span className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1 block">
                    {metaStats.absent}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900/40 bg-amber-50/20 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-wider block">
                    Pending
                  </span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1 block">
                    {metaStats.late}
                  </span>
                </div>
                <div className="col-span-2 bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-slate-400 dark:text-gray-400 uppercase font-bold tracking-wider block">
                    Approval Rate
                  </span>
                  <span className="text-xl font-bold text-[#2E7D32] dark:text-emerald-400 mt-1 block">
                    {metaStats.rate}%
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-slate-400 dark:text-gray-400 uppercase font-bold tracking-wider block">
                    Total Records
                  </span>
                  <span className="text-xl font-bold text-gray-800 dark:text-white mt-1 block">
                    {metaStats.total}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-wider block">
                    Present
                  </span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 block">
                    {metaStats.present}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-rose-100 dark:border-rose-900/40 bg-rose-50/20 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold tracking-wider block">
                    Absent
                  </span>
                  <span className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1 block">
                    {metaStats.absent}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900/40 bg-amber-50/20 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-wider block">
                    Late
                  </span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1 block">
                    {metaStats.late}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-900/40 bg-sky-50/20 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-sky-700 dark:text-sky-400 uppercase font-bold tracking-wider block">
                    On Leave
                  </span>
                  <span className="text-xl font-bold text-sky-700 dark:text-sky-400 mt-1 block">
                    {metaStats.leave}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 p-4 rounded-2xl text-center shadow-2xs">
                  <span className="text-[10px] text-slate-400 dark:text-gray-400 uppercase font-bold tracking-wider block">
                    Attendance Rate
                  </span>
                  <span className="text-xl font-bold text-[#2E7D32] dark:text-emerald-400 mt-1 block">
                    {metaStats.rate}%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Student-Level Details Table */}
          {loading ? (
            <div className="p-12 bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl shadow-xs text-center flex flex-col items-center justify-center gap-2">
              <FaSpinner className="animate-spin text-2xl text-[#2E7D32]" />
              <span className="text-xs font-semibold text-gray-500">Generating report preview...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="p-10 bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl shadow-xs text-center">
              <FaInfoCircle className="text-3xl text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {reportType === 'leave'
                  ? 'No Leave Records Found'
                  : t('students.noRecords', 'No Attendance Records Found')}
              </h4>
              <p className="text-xs text-gray-400 font-normal mt-1 max-w-md mx-auto">
                No records match the selected report type and date period. Adjust your filter criteria and click &quot;Generate Report Preview&quot;.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-700 text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-gray-750 text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-5 py-3.5 w-14 text-center">Sr. No.</th>
                      {reportType === 'leave' ? (
                        <>
                          <th className="px-5 py-3.5">Student Name</th>
                          <th className="px-5 py-3.5">Class / Section</th>
                          <th className="px-5 py-3.5">From Date</th>
                          <th className="px-5 py-3.5">To Date</th>
                          <th className="px-5 py-3.5 text-center">Status</th>
                          <th className="px-5 py-3.5">Reason</th>
                          <th className="px-5 py-3.5">Remarks</th>
                        </>
                      ) : (
                        <>
                          <th className="px-5 py-3.5 text-center">Roll No.</th>
                          <th className="px-5 py-3.5">Student Name</th>
                          <th className="px-5 py-3.5">Class / Section</th>
                          <th className="px-5 py-3.5 text-center">Date</th>
                          <th className="px-5 py-3.5 text-center">Status</th>
                          <th className="px-5 py-3.5">Remarks</th>
                          <th className="px-5 py-3.5">Marked By</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-xs font-medium text-slate-700 dark:text-gray-200">
                    {records.map((rec, idx) => (
                      <tr
                        key={rec._id || idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-gray-750/50 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        {reportType === 'leave' ? (
                          <>
                            <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">
                              {rec.studentId?.name || 'N/A'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400">
                              {rec.studentId?.classId ? formatClassLabel(rec.studentId.classId) : classLabel}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400 font-mono text-[11px]">
                              {rec.fromDate ? new Date(rec.fromDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400 font-mono text-[11px]">
                              {rec.toDate ? new Date(rec.toDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  rec.status === 'Approved'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
                                    : rec.status === 'Rejected'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300'
                                }`}
                              >
                                {rec.status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-gray-300">
                              {rec.reason || 'N/A'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-400 italic">
                              {rec.remarks || '—'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3.5 text-center font-bold text-slate-700 dark:text-gray-200">
                              {rec.studentId?.rollNo || 'N/A'}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">
                              {rec.studentId?.name || 'Unknown Student'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400">
                              {rec.classId
                                ? formatClassLabel(rec.classId)
                                : rec.studentId?.classId
                                ? formatClassLabel(rec.studentId.classId)
                                : classLabel}
                            </td>
                            <td className="px-5 py-3.5 text-center text-slate-500 dark:text-gray-400 font-mono text-[11px]">
                              {rec.date ? new Date(rec.date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  rec.status === 'Present'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
                                    : rec.status === 'Absent'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
                                    : rec.status === 'Late'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300'
                                    : 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800/60 dark:text-sky-300'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400 italic">
                              {rec.remarks || '—'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400">
                              {rec.markedBy?.name || 'Class Teacher'}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedReports;
