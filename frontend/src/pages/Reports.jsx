import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getClasses, getStudents, getAttendanceReport, getSchoolSettings } from '../services/api';
import { generateClassReportPDF } from '../utils/pdfGenerator';
import { generateClassReportExcel } from '../utils/excelGenerator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import {
  FaFilter,
  FaFilePdf,
  FaFileExcel,
  FaSpinner,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarDay
} from 'react-icons/fa';

// Date helper utilities (ensuring local timezone accuracy without UTC shift)
const getTodayDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLast7DaysStartStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6); // Today + previous 6 days = 7 calendar days
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getThisMonthStartStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

const Reports = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isParent = user?.role === 'parent';

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  // Date presets state (default to 'today' as required)
  const [activePreset, setActivePreset] = useState('today');
  const [startDate, setStartDate] = useState(getTodayDateStr);
  const [endDate, setEndDate] = useState(getTodayDateStr);

  // Parent child selector state: 'all' or specific student ID
  const [selectedChildId, setSelectedChildId] = useState('all');

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [exportError, setExportError] = useState('');

  // Ref to track latest request ID and prevent stale responses
  const currentRequestIdRef = useRef(0);

  // Load school settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await getSchoolSettings();
        if (res.success && res.data) {
          setSchoolSettings(res.data);
        }
      } catch (err) {
        console.error('Failed to load school settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Load classes on mount (for non-parent accounts)
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

  // Handle Preset Change (immediately updates dates which triggers automatic fetch)
  const handlePresetChange = (presetId) => {
    setActivePreset(presetId);
    setError('');

    if (presetId === 'today') {
      const today = getTodayDateStr();
      setStartDate(today);
      setEndDate(today);
    } else if (presetId === 'yesterday') {
      const yest = getYesterdayDateStr();
      setStartDate(yest);
      setEndDate(yest);
    } else if (presetId === 'last7') {
      setStartDate(getLast7DaysStartStr());
      setEndDate(getTodayDateStr());
    } else if (presetId === 'thisMonth') {
      setStartDate(getThisMonthStartStr());
      setEndDate(getTodayDateStr());
    } else if (presetId === 'custom') {
      // Keep current start/end dates for customization
    }
  };

  // Determine whether single date mode is active (Today, Yesterday, or custom single date)
  const isSingleMode = activePreset === 'today' || activePreset === 'yesterday' || activePreset === 'customSingle';

  const handleSingleDateChange = (val) => {
    setStartDate(val);
    setEndDate(val);
    setError('');
    const today = getTodayDateStr();
    const yest = getYesterdayDateStr();
    if (val === today) {
      setActivePreset('today');
    } else if (val === yest) {
      setActivePreset('yesterday');
    } else {
      setActivePreset('customSingle');
    }
  };

  // Determine active students for parent or teacher
  const parentChildren = useMemo(() => {
    return user?.children || [];
  }, [user]);

  const activeStudents = useMemo(() => {
    if (isParent) {
      if (selectedChildId === 'all' || !selectedChildId) {
        return parentChildren;
      }
      return parentChildren.filter((c) => String(c._id || c) === String(selectedChildId));
    }
    return students;
  }, [isParent, parentChildren, selectedChildId, students]);

  // Automatic filter effect: triggers immediately on preset, child, or valid date changes
  useEffect(() => {
    if (!startDate || !endDate) return;

    const todayStr = getTodayDateStr();
    if (startDate > endDate) {
      setError('Start date cannot be later than end date.');
      return;
    }
    if (startDate > todayStr || endDate > todayStr) {
      setError('Future dates cannot be selected.');
      return;
    }

    setError('');
    const requestId = ++currentRequestIdRef.current;
    let isCancelled = false;

    const runFetch = async () => {
      setLoading(true);
      try {
        if (isParent) {
          setStudents(parentChildren);
          const targetChildren = (selectedChildId === 'all' || !selectedChildId)
            ? parentChildren
            : parentChildren.filter((c) => String(c._id || c) === String(selectedChildId));

          const logs = [];
          for (const child of targetChildren) {
            const childId = child._id || child;
            if (!childId) continue;
            const res = await getAttendanceReport({
              studentId: childId,
              startDate,
              endDate,
            });
            if (res.success && Array.isArray(res.data)) {
              logs.push(...res.data);
            }
          }

          if (!isCancelled && requestId === currentRequestIdRef.current) {
            setAttendance(logs);
            setLoading(false);
          }
        } else if (selectedClassId) {
          const [studentsRes, attendanceRes] = await Promise.all([
            getStudents({ classId: selectedClassId }),
            getAttendanceReport({
              classId: selectedClassId,
              startDate,
              endDate,
            }),
          ]);

          if (!isCancelled && requestId === currentRequestIdRef.current) {
            if (studentsRes.success) setStudents(studentsRes.data);
            if (attendanceRes.success) setAttendance(attendanceRes.data);
            setLoading(false);
          }
        } else {
          if (!isCancelled && requestId === currentRequestIdRef.current) {
            setLoading(false);
          }
        }
      } catch (err) {
        if (!isCancelled && requestId === currentRequestIdRef.current) {
          console.error('Attendance fetch error:', err);
          setError('Failed to load attendance records.');
          setLoading(false);
        }
      }
    };

    runFetch();

    return () => {
      isCancelled = true;
    };
  }, [isParent, parentChildren, selectedChildId, selectedClassId, startDate, endDate]);

  const isSingleDay = startDate === endDate;

  // Compile calculations for listing and exports
  const compiledRows = activeStudents.map((student) => {
    const studentRecords = attendance.filter((r) => {
      const sId = r.studentId?._id || r.studentId;
      return String(sId) === String(student._id || student);
    });
    const totalDays = studentRecords.length;
    const presents = studentRecords.filter((r) => r.status === 'Present').length;
    const absents = studentRecords.filter((r) => r.status === 'Absent').length;
    const lates = studentRecords.filter((r) => r.status === 'Late').length;
    const leaves = studentRecords.filter((r) => r.status === 'Leave' || r.status === 'On Leave').length;
    
    // Net present includes Present and Late; unmarked days are not counted as absent
    const netPresent = presents + lates;
    const rate = totalDays > 0 ? Math.round((netPresent / totalDays) * 100) : 0;

    // For single-day mode: find the exact record for the selected date
    let singleDayStatus = 'Not Marked';
    let singleDayRemarks = '-';
    if (isSingleDay) {
      const dayRec = studentRecords.find((r) => {
        const rDate = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
        return rDate === startDate;
      });
      if (dayRec) {
        singleDayStatus = dayRec.status || 'Present';
        singleDayRemarks = dayRec.remarks || '-';
      }
    }

    return {
      student,
      totalDays,
      presents,
      absents,
      lates,
      leaves,
      rate,
      singleDayStatus,
      singleDayRemarks,
    };
  });

  // Summary KPI metrics
  const summaryMetrics = useMemo(() => {
    let totalMarkedDays = 0;
    let totalPresents = 0;
    let totalAbsents = 0;
    let totalLates = 0;
    let totalLeaves = 0;

    compiledRows.forEach((r) => {
      totalMarkedDays += r.totalDays;
      totalPresents += r.presents;
      totalAbsents += r.absents;
      totalLates += r.lates;
      totalLeaves += (r.leaves || 0);
    });

    const netPresent = totalPresents + totalLates;
    const overallRate = totalMarkedDays > 0 ? Math.round((netPresent / totalMarkedDays) * 100) : 0;

    return {
      totalChildren: activeStudents.length,
      totalMarkedDays,
      totalPresents,
      totalAbsents,
      totalLates,
      totalLeaves,
      overallRate,
    };
  }, [compiledRows, activeStudents]);

  // Export PDF Handler
  const handleExportPDF = async () => {
    setExportError('');
    setExportSuccess('');
    setExportingPdf(true);

    try {
      const schoolName = schoolSettings?.schoolName || 'Smart Rural Model School';
      const schoolLogo = schoolSettings?.schoolLogo || '';
      const rangeText = isSingleDay ? startDate : `${startDate} to ${endDate}`;

      if (isParent) {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const docWidth = doc.internal.pageSize.getWidth() || 210;

        // 1. School Header Banner
        doc.setFillColor(46, 125, 50); // Primary green (#2E7D32)
        doc.rect(0, 0, docWidth, 32, 'F');

        let logoLoaded = false;
        if (schoolLogo && typeof window !== 'undefined') {
          try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            await new Promise((resolve) => {
              img.onload = () => {
                try {
                  doc.addImage(img, 'PNG', 14, 4, 24, 24);
                  logoLoaded = true;
                } catch {
                  logoLoaded = false;
                }
                resolve();
              };
              img.onerror = () => resolve();
              img.src = schoolLogo;
            });
          } catch {
            logoLoaded = false;
          }
        }

        const textX = logoLoaded ? 44 : 14;

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(schoolName.toUpperCase(), textX, 13);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text('SmartAttend Rural • AI-Powered Attendance Management for Rural Schools', textX, 19);
        doc.text('Student Attendance Report (Parent Portal)', textX, 25);

        // 2. Metadata Information Box
        let currentY = 40;
        doc.setTextColor(33, 33, 33);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Attendance History Report', 14, currentY);

        currentY += 4;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, currentY, docWidth - 28, 20, 2, 2, 'FD');

        doc.setFontSize(8.5);
        doc.setTextColor(70, 70, 70);

        // Left Column: Parent Details
        doc.setFont('helvetica', 'bold');
        doc.text('Parent Name:', 18, currentY + 7);
        doc.setFont('helvetica', 'normal');
        doc.text(String(user?.name || 'Parent'), 44, currentY + 7);

        doc.setFont('helvetica', 'bold');
        doc.text('Contact No:', 18, currentY + 14);
        doc.setFont('helvetica', 'normal');
        doc.text(String(user?.phone || user?.phoneNumber || 'N/A'), 44, currentY + 14);

        // Right Column: Period & Generation Date
        doc.setFont('helvetica', 'bold');
        doc.text('Period / Date:', 115, currentY + 7);
        doc.setFont('helvetica', 'normal');
        doc.text(rangeText, 140, currentY + 7);

        doc.setFont('helvetica', 'bold');
        doc.text('Generated On:', 115, currentY + 14);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toLocaleString(), 140, currentY + 14);

        currentY += 26;

        // 3. Attendance Summary Cards Strip
        const boxWidth = (docWidth - 28 - 20) / 5;
        const metrics = [
          { label: 'Children', val: String(summaryMetrics.totalChildren), color: [71, 85, 105] },
          { label: 'Marked Days', val: String(summaryMetrics.totalMarkedDays), color: [30, 41, 59] },
          { label: 'Present', val: String(summaryMetrics.totalPresents), color: [46, 125, 50] },
          { label: 'Absent', val: String(summaryMetrics.totalAbsents), color: [198, 40, 40] },
          { label: 'Attendance %', val: `${summaryMetrics.overallRate}%`, color: [46, 125, 50] },
        ];

        metrics.forEach((m, idx) => {
          const xPos = 14 + idx * (boxWidth + 5);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(xPos, currentY, boxWidth, 14, 1.5, 1.5, 'FD');

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(m.label, xPos + boxWidth / 2, currentY + 5, { align: 'center' });

          doc.setFontSize(10.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(m.color[0], m.color[1], m.color[2]);
          doc.text(m.val, xPos + boxWidth / 2, currentY + 11, { align: 'center' });
        });

        currentY += 20;

        // 4. Student Table
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 33, 33);
        doc.text(
          isSingleDay
            ? `Daily Attendance Records (${startDate})`
            : 'Child Attendance Summary',
          14,
          currentY - 2
        );

        let headers = [];
        let tableRows = [];

        if (isSingleDay) {
          headers = [['Sr.', 'Roll No', 'Admission No', 'Student Name', 'Class', 'Attendance Date', 'Status', 'Remarks']];
          if (compiledRows.length > 0) {
            tableRows = compiledRows.map((r, idx) => [
              idx + 1,
              r.student.rollNo || '-',
              r.student.admissionNo || '-',
              r.student.name || 'Student',
              `${r.student.classId?.grade || 'Grade'}-${r.student.classId?.section || 'A'}`,
              startDate,
              r.singleDayStatus,
              r.singleDayRemarks,
            ]);
          } else {
            tableRows = [['-', '-', '-', 'No student records found', '-', startDate, 'Not Marked', '-']];
          }
        } else {
          headers = [['Sr.', 'Roll No', 'Admission No', 'Student Name', 'Class', 'Marked Days', 'Present', 'Absent', 'Late', 'Rate %']];
          if (compiledRows.length > 0) {
            tableRows = compiledRows.map((r, idx) => [
              idx + 1,
              r.student.rollNo || '-',
              r.student.admissionNo || '-',
              r.student.name || 'Student',
              `${r.student.classId?.grade || 'Grade'}-${r.student.classId?.section || 'A'}`,
              r.totalDays,
              r.presents,
              r.absents,
              r.lates,
              `${r.rate}%`,
            ]);
          } else {
            tableRows = [['-', '-', '-', 'No student records found for the selected date range', '-', '0', '0', '0', '0', '0%']];
          }
        }

        autoTable(doc, {
          startY: currentY,
          head: headers,
          body: tableRows,
          headStyles: {
            fillColor: [46, 125, 50],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'center',
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [50, 50, 50],
            halign: 'center',
          },
          columnStyles: {
            3: { halign: 'left' },
          },
          alternateRowStyles: {
            fillColor: [248, 250, 248],
          },
          margin: { left: 14, right: 14 },
          theme: 'grid',
        });

        // 5. Page Numbers in footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7.5);
          doc.setTextColor(140, 140, 140);
          doc.setFont('helvetica', 'normal');
          doc.text(
            'SmartAttend Rural • Official Student Attendance Report (Parent Portal)',
            14,
            290
          );
          doc.text(
            `Page ${i} of ${pageCount}`,
            docWidth - 14,
            290,
            { align: 'right' }
          );
        }

        const childName = (activeStudents.length === 1 && activeStudents[0]?.name)
          ? activeStudents[0].name.replace(/[^a-zA-Z0-9_-]/g, '_')
          : 'Children';
        const filename = `Attendance_Report_${childName}_${startDate}_to_${endDate}.pdf`;
        doc.save(filename);
      } else {
        const selectedClass = classes.find((c) => c._id === selectedClassId) || { grade: 'Grade', section: 'Section' };
        generateClassReportPDF(selectedClass, students, attendance, rangeText);
      }

      setExportSuccess('PDF Attendance Report downloaded successfully.');
      setTimeout(() => setExportSuccess(''), 4000);
    } catch (err) {
      console.error('PDF Export Error:', err);
      setExportError('Failed to generate PDF report: ' + (err.message || 'Unknown error'));
      setTimeout(() => setExportError(''), 5000);
    } finally {
      setExportingPdf(false);
    }
  };

  // Export Excel Handler
  const handleExportExcel = async () => {
    setExportError('');
    setExportSuccess('');
    setExportingExcel(true);

    try {
      const schoolName = schoolSettings?.schoolName || 'Smart Rural Model School';
      const rangeText = isSingleDay ? startDate : `${startDate} to ${endDate}`;

      if (isParent) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SmartAttend Rural';
        workbook.lastModifiedBy = user?.name || 'Parent';
        workbook.created = new Date();
        workbook.modified = new Date();

        const sheet = workbook.addWorksheet('Attendance Summary', {
          views: [{ state: 'normal' }], // Avoid freezing rows 1-11 so school name and summary are not duplicated or pinned while scrolling
          pageSetup: {
            orientation: 'landscape',
            paperSize: 9, // A4
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
            printTitlesRow: '12:12', // Repeats ONLY the student table column headers on subsequent printed pages, not the school name or summary
          },
        });

        const borderThin = {
          top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
          left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
          right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        };

        const totalCols = isSingleDay ? 8 : 11;
        const endColLetter = isSingleDay ? 'H' : 'K';

        // 1. School Name (Merged across appropriate columns)
        sheet.mergeCells(`A1:${endColLetter}1`);
        const row1 = sheet.getCell('A1');
        row1.value = schoolName.toUpperCase();
        row1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E4620' } };
        row1.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 28;

        // 2. Report Subtitle (Merged across columns)
        sheet.mergeCells(`A2:${endColLetter}2`);
        const row2 = sheet.getCell('A2');
        row2.value = 'STUDENT ATTENDANCE REPORT (PARENT PORTAL)';
        row2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF333333' } };
        row2.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(2).height = 22;

        // Row 3: Spacing
        sheet.getRow(3).height = 8;

        // 3. Parent Details, Date Range, Contact, and Generated Date/Time
        sheet.getCell('A4').value = 'Parent Name:';
        sheet.getCell('B4').value = user?.name || 'Parent';
        sheet.getCell('F4').value = 'Date Range:';
        sheet.getCell('G4').value = rangeText;

        sheet.getCell('A5').value = 'Contact:';
        sheet.getCell('B5').value = user?.phone || user?.phoneNumber || 'N/A';
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

        // 4. SUMMARY STATISTICS Section Header
        sheet.getCell('A7').value = 'SUMMARY STATISTICS';
        sheet.getCell('A7').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E4620' } };
        sheet.getCell('A7').alignment = { horizontal: 'left', vertical: 'middle' };
        sheet.getRow(7).height = 22;

        // 5. Summary Columns
        const summaryHeaders = [
          'Total Children',
          'Total Marked Days',
          'Present Count',
          'Absent Count',
          'Late Count',
          'On Leave Count',
          'Overall Attendance Rate',
        ];
        const summaryValues = [
          summaryMetrics.totalChildren,
          summaryMetrics.totalMarkedDays,
          summaryMetrics.totalPresents,
          summaryMetrics.totalAbsents,
          summaryMetrics.totalLates,
          summaryMetrics.totalLeaves,
          `${summaryMetrics.overallRate}%`,
        ];

        sheet.getRow(8).height = 24;
        sheet.getRow(9).height = 26;

        summaryHeaders.forEach((hdr, idx) => {
          const colIdx = idx + 1; // Col A through G
          const hCell = sheet.getRow(8).getCell(colIdx);
          hCell.value = hdr;
          hCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF444444' } };
          hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          hCell.alignment = { horizontal: 'center', vertical: 'middle' };
          hCell.border = borderThin;

          const vCell = sheet.getRow(9).getCell(colIdx);
          vCell.value = summaryValues[idx];
          vCell.font = {
            name: 'Calibri',
            size: 12,
            bold: true,
            color: { argb: idx === 6 ? 'FF1E4620' : 'FF111111' },
          };
          vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          vCell.alignment = { horizontal: 'center', vertical: 'middle' };
          vCell.border = borderThin;
        });

        // Row 10: Spacing
        sheet.getRow(10).height = 10;

        // 6. STUDENT ATTENDANCE BREAKDOWN Section Header
        sheet.getCell('A11').value = 'STUDENT ATTENDANCE BREAKDOWN';
        sheet.getCell('A11').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E4620' } };
        sheet.getCell('A11').alignment = { horizontal: 'left', vertical: 'middle' };
        sheet.getRow(11).height = 22;

        // 7. Detail-Table Column Headers
        let detailColumns = [];
        if (isSingleDay) {
          detailColumns = [
            'Sr. No.',
            'Roll No',
            'Admission No',
            'Student Name',
            'Class & Section',
            'Attendance Date',
            'Status',
            'Remarks',
          ];
        } else {
          detailColumns = [
            'Sr. No.',
            'Roll No',
            'Admission No',
            'Student Name',
            'Class & Section',
            'Marked Days',
            'Present',
            'Absent',
            'Late',
            'On Leave',
            'Attendance Rate (%)',
          ];
        }

        sheet.getRow(12).height = 26;
        detailColumns.forEach((colName, idx) => {
          const cell = sheet.getRow(12).getCell(idx + 1);
          cell.value = colName;
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
          cell.alignment = {
            horizontal: idx === 3 ? 'left' : 'center',
            vertical: 'middle',
          };
          cell.border = borderThin;
        });

        // Data Rows
        let currentRowIdx = 13;
        if (compiledRows.length > 0) {
          compiledRows.forEach((r, idx) => {
            const row = sheet.getRow(currentRowIdx);
            row.height = 22;

            const isOdd = idx % 2 === 1;
            const rowBgColor = isOdd ? 'FFF6FAF6' : 'FFFFFFFF';

            let values = [];
            if (isSingleDay) {
              values = [
                idx + 1,
                r.student.rollNo || '-',
                r.student.admissionNo || '-',
                r.student.name || 'Student',
                `${r.student.classId?.grade || 'Grade'}-${r.student.classId?.section || 'A'}`,
                startDate,
                r.singleDayStatus,
                r.singleDayRemarks,
              ];
            } else {
              values = [
                idx + 1,
                r.student.rollNo || '-',
                r.student.admissionNo || '-',
                r.student.name || 'Student',
                `${r.student.classId?.grade || 'Grade'}-${r.student.classId?.section || 'A'}`,
                r.totalDays,
                r.presents,
                r.absents,
                r.lates,
                r.leaves || 0,
                `${r.rate}%`,
              ];
            }

            values.forEach((val, colIdx) => {
              const cell = row.getCell(colIdx + 1);
              cell.value = val;
              cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF222222' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
              cell.border = borderThin;
              cell.alignment = {
                horizontal: colIdx === 3 ? 'left' : 'center',
                vertical: 'middle',
              };

              // Highlight statuses
              if (isSingleDay) {
                if (colIdx === 6) {
                  cell.font = { name: 'Calibri', size: 10, bold: true };
                  if (val === 'Present') {
                    cell.font.color = { argb: 'FF1B5E20' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
                  } else if (val === 'Absent') {
                    cell.font.color = { argb: 'FFB71C1C' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
                  } else if (val === 'Late') {
                    cell.font.color = { argb: 'FFB78103' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
                  } else {
                    cell.font.color = { argb: 'FF555555' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                  }
                }
              } else {
                if (colIdx === 6) {
                  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1B5E20' } };
                } else if (colIdx === 7 && r.absents > 0) {
                  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB71C1C' } };
                } else if (colIdx === 8 && r.lates > 0) {
                  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB78103' } };
                } else if (colIdx === 10) {
                  cell.font = {
                    name: 'Calibri',
                    size: 10,
                    bold: true,
                    color: { argb: r.rate >= 75 ? 'FF1E4620' : 'FFB71C1C' },
                  };
                }
              }
            });

            currentRowIdx++;
          });
        } else {
          sheet.mergeCells(`A${currentRowIdx}:${endColLetter}${currentRowIdx}`);
          const emptyCell = sheet.getCell(`A${currentRowIdx}`);
          emptyCell.value = 'No student records found for the selected date range';
          emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF777777' } };
          emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
          emptyCell.border = borderThin;
          sheet.getRow(currentRowIdx).height = 28;
          currentRowIdx++;
        }

        // Set suitable Column Widths to prevent clipped labels and cell overflow
        sheet.getColumn(1).width = 15;  // Sr. No. & Total Children
        sheet.getColumn(2).width = 18;  // Roll No & Total Marked Days
        sheet.getColumn(3).width = 18;  // Admission No & Present Count
        sheet.getColumn(4).width = 30;  // Student Name & Absent Count
        sheet.getColumn(5).width = 18;  // Class & Section & Late Count
        sheet.getColumn(6).width = isSingleDay ? 18 : 16;  // Attendance Date / Marked Days
        sheet.getColumn(7).width = isSingleDay ? 16 : 24;  // Status / Present & Overall Rate
        sheet.getColumn(8).width = isSingleDay ? 24 : 14;  // Remarks / Absent
        if (!isSingleDay) {
          sheet.getColumn(9).width = 14;  // Late
          sheet.getColumn(10).width = 14; // On Leave
          sheet.getColumn(11).width = 22; // Attendance Rate (%)
        }

        // AutoFilter on the detail-table header
        sheet.autoFilter = {
          from: { row: 12, column: 1 },
          to: { row: Math.max(13, currentRowIdx - 1), column: totalCols },
        };

        const childName = (activeStudents.length === 1 && activeStudents[0]?.name)
          ? activeStudents[0].name.replace(/[^a-zA-Z0-9_-]/g, '_')
          : 'Children';
        const filename = `Attendance_Report_${childName}_${startDate}_to_${endDate}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
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
      } else {
        const selectedClass = classes.find((c) => c._id === selectedClassId) || { grade: 'Grade', section: 'Section' };
        generateClassReportExcel(selectedClass, students, attendance, rangeText);
      }

      setExportSuccess('Excel Attendance Report (.xlsx) downloaded successfully.');
      setTimeout(() => setExportSuccess(''), 4000);
    } catch (err) {
      console.error('Excel Export Error:', err);
      setExportError('Failed to generate Excel report: ' + (err.message || 'Unknown error'));
      setTimeout(() => setExportError(''), 5000);
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('reports.title', 'Attendance Reports')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {t('reports.subtitle', 'Generate and export student and class attendance summaries.')}
        </p>
      </div>

      {/* Query Filters Bar */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm space-y-4 w-full">
        {/* Row 1: Quick Date Filters */}
        <div className="pb-3 border-b border-gray-150 dark:border-gray-700">
          <label className="block text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-2">
            Quick Date Filters
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => {
              const isActive = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2E7D32] text-white shadow-xs ring-2 ring-[#2E7D32]/25'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-650 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Child selector and Date field(s) */}
        <div className={`grid grid-cols-1 ${isSingleMode ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 pt-1`}>
          {/* Column 1: Child (or Class for non-parent) */}
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              {isParent ? 'Child' : t('classes.selectClass', 'Class')}
            </label>
            {isParent ? (
              parentChildren.length > 1 ? (
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="block w-full h-10 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-2xs"
                >
                  <option value="all">All Children ({parentChildren.length})</option>
                  {parentChildren.map((c) => (
                    <option key={c._id || c} value={c._id || c}>
                      {c.name} ({c.classId?.grade || 'Grade'}-{c.classId?.section || 'A'})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  disabled
                  value="all"
                  className="block w-full h-10 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-750 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-2xs cursor-not-allowed"
                >
                  <option value="all">
                    {parentChildren[0]?.name ? `${parentChildren[0].name} (${parentChildren[0].classId?.grade || 'Grade'}-${parentChildren[0].classId?.section || 'A'})` : 'Child'}
                  </option>
                </select>
              )
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="block w-full h-10 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-2xs"
              >
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.grade} - {cls.section}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* If single day mode (Today, Yesterday, etc.): ONLY ONE Date field */}
          {isSingleMode ? (
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                {t('reports.date', 'Date')}
              </label>
              <input
                type="date"
                value={startDate}
                max={getTodayDateStr()}
                onChange={(e) => handleSingleDateChange(e.target.value)}
                className="block w-full h-10 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 shadow-2xs"
              />
            </div>
          ) : (
            <>
              {/* Column 2: Start Date */}
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  {t('reports.startDate', 'Start Date')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  max={getTodayDateStr()}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="block w-full h-10 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 shadow-2xs"
                />
              </div>

              {/* Column 3: End Date */}
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  {t('reports.endDate', 'End Date')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  max={getTodayDateStr()}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="block w-full h-10 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 shadow-2xs"
                />
              </div>
            </>
          )}
        </div>

        {/* Row 3: Export Actions grouped on the right */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 w-full pt-3 border-t border-gray-150 dark:border-gray-700">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={loading || exportingPdf}
              title="Download formatted PDF attendance report"
              className="flex-1 sm:flex-none h-10 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-xs transition-colors cursor-pointer border border-rose-700 flex items-center justify-center gap-2"
            >
              {exportingPdf ? (
                <FaSpinner className="animate-spin text-sm" />
              ) : (
                <FaFilePdf className="text-sm" />
              )}
              <span>{exportingPdf ? 'Exporting...' : t('reports.downloadPdf', 'Export PDF')}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || exportingExcel}
              title="Download formatted Excel attendance workbook (.xlsx)"
              className="flex-1 sm:flex-none h-10 px-4 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-xs transition-colors cursor-pointer border border-[#2E7D32] flex items-center justify-center gap-2"
            >
              {exportingExcel ? (
                <FaSpinner className="animate-spin text-sm" />
              ) : (
                <FaFileExcel className="text-sm" />
              )}
              <span>{exportingExcel ? 'Exporting...' : t('reports.downloadExcel', 'Export Excel')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success notification banner */}
      {exportSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
          <FaCheckCircle className="text-emerald-600 shrink-0 text-sm" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* Export error notification banner */}
      {exportError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
          <FaTimesCircle className="text-rose-600 shrink-0 text-sm" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Validation/Fetch error banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm font-semibold flex items-center gap-2">
          <FaTimesCircle className="text-red-600 shrink-0 text-base" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section with Loading Indicator */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl p-8 shadow-xs">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E7D32] mb-3"></div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Loading attendance data...</p>
        </div>
      ) : (
        <>
          {/* Attendance Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-4 rounded-xl shadow-xs text-center">
              <div className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase">
                {isParent ? 'Children' : 'Students'}
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {summaryMetrics.totalChildren}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-4 rounded-xl shadow-xs text-center">
              <div className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase">
                Marked Days
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {summaryMetrics.totalMarkedDays}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-4 rounded-xl shadow-xs text-center">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                Present
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {summaryMetrics.totalPresents}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-4 rounded-xl shadow-xs text-center">
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">
                Absent
              </div>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">
                {summaryMetrics.totalAbsents}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-4 rounded-xl shadow-xs text-center">
              <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">
                Late
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
                {summaryMetrics.totalLates}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 p-4 rounded-xl shadow-xs text-center">
              <div className="text-xs font-bold text-[#2E7D32] dark:text-green-400 uppercase">
                Attendance Rate
              </div>
              <div className="text-2xl font-bold text-[#2E7D32] dark:text-green-400 mt-1">
                {summaryMetrics.overallRate}%
              </div>
            </div>
          </div>

          {/* Report Table display */}
          {compiledRows.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    {isSingleDay ? (
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('students.rollNo', 'Roll Number')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('common.name', 'Student Name')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('nav.classes', 'Class')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          Attendance Date
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          Remarks
                        </th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('students.rollNo', 'Roll Number')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('common.name', 'Student Name')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('nav.classes', 'Class')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('dashboard_extra.totalDays', 'Total Marked Days')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('attendance.present', 'Present')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('attendance.absent', 'Absent')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('attendance.late', 'Late')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 dark:text-gray-300 uppercase tracking-wider">
                          {t('dashboard_extra.overallRate', 'Attendance Rate')}
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-150 dark:divide-gray-700">
                    {compiledRows.map(({ student, totalDays, presents, absents, lates, rate, singleDayStatus, singleDayRemarks }) => (
                      <tr key={student._id || student}>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {student.rollNo || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                            {student.name || 'Student'}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {t('students.admissionNo', 'Admission No')}: {student.admissionNo || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap">
                          {student.classId?.grade || 'Grade'}-{student.classId?.section || 'A'}
                        </td>
                        {isSingleDay ? (
                          <>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {startDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${
                                  singleDayStatus === 'Present'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                    : singleDayStatus === 'Absent'
                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                    : singleDayStatus === 'Late'
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                    : singleDayStatus === 'Leave' || singleDayStatus === 'On Leave'
                                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                    : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                                }`}
                              >
                                {singleDayStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {singleDayRemarks}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {totalDays}
                            </td>
                            <td className="px-6 py-4 text-sm text-green-700 dark:text-green-400 font-bold whitespace-nowrap">
                              {presents}
                            </td>
                            <td className="px-6 py-4 text-sm text-red-650 dark:text-red-400 font-bold whitespace-nowrap">
                              {absents}
                            </td>
                            <td className="px-6 py-4 text-sm text-amber-700 dark:text-amber-400 font-bold whitespace-nowrap">
                              {lates}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold border ${
                                  rate >= 85
                                    ? 'bg-green-50 dark:bg-green-950/40 border-green-150 dark:border-green-800 text-green-700 dark:text-green-300'
                                    : rate >= 75
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-150 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                    : 'bg-red-50 dark:bg-red-950/40 border-red-150 dark:border-red-800 text-red-700 dark:text-red-300'
                                }`}
                              >
                                {rate}%
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl shadow-sm text-center">
              <FaInfoCircle className="text-4xl text-gray-300 dark:text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">
                {t('students.noRecords', 'No student records found.')}
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
                {t('students.noRecords', 'No student records found for the selected child and period.')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
