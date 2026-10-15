import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates and downloads a PDF attendance report for a Class/Section
 * @param {Object} schoolClass - Class details ({ grade, section })
 * @param {Array} students - List of students
 * @param {Array} attendanceRecords - Attendance logs
 * @param {String} rangeText - Date range text (e.g. "June 2026")
 */
export const generateClassReportPDF = (schoolClass = {}, students = [], attendanceRecords = [], rangeText = 'All Dates') => {
  try {
    const doc = new jsPDF();
    const gradeText = schoolClass?.grade || 'School';
    const sectionText = schoolClass?.section || 'Report';
    const title = `SmartAttend Rural - Attendance Report`;
    const subtitle = `Class: ${gradeText}-${sectionText} | Date Range: ${rangeText}`;
    const timestamp = `Generated on: ${new Date().toLocaleString()}`;

    // 1. Add Header Design
    doc.setFillColor(46, 125, 50); // Primary green color
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SMARTATTEND RURAL', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('AI-Powered Attendance Management for Rural Schools', 14, 22);

    // 2. Add Metainfo section
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 45);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 52);
    doc.setTextColor(120, 120, 120);
    doc.text(timestamp, 14, 58);

    // 3. Compile table rows
    const headers = [['Roll No', 'Admission No', 'Name', 'Present', 'Absent', 'Late', 'Percentage']];
    
    const tableData = (students.length > 0 ? students : [{ _id: 'all', rollNo: '-', admissionNo: '-', name: 'All Roster Records' }]).map((student) => {
      const studentRecords = attendanceRecords.filter((r) => {
        if (!r.studentId) return false;
        const sId = typeof r.studentId === 'object' ? r.studentId._id : r.studentId;
        return sId === student._id || student._id === 'all';
      });

      const totalDays = studentRecords.length;
      const presents = studentRecords.filter((r) => r.status === 'Present').length;
      const absents = studentRecords.filter((r) => r.status === 'Absent').length;
      const lates = studentRecords.filter((r) => r.status === 'Late').length;
      
      const netPresent = presents + lates;
      const rate = totalDays > 0 ? Math.round((netPresent / totalDays) * 100) : 100;

      return [
        student.rollNo || 'N/A',
        student.admissionNo || 'N/A',
        student.name || 'Unknown Student',
        presents,
        absents,
        lates,
        `${rate}%`,
      ];
    });

    // 4. Draw Table using jspdf-autotable v5 syntax
    autoTable(doc, {
      startY: 65,
      head: headers,
      body: tableData,
      headStyles: {
        fillColor: [46, 125, 50], // Primary Green
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [240, 248, 240], // Subtle green-gray stripes
      },
      margin: { top: 65, left: 14, right: 14 },
      theme: 'grid',
    });

    // 5. Save the PDF
    const filename = `Attendance_Report_${gradeText.replace(/\s+/g, '_')}_${sectionText.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error('PDF Generation Error:', err);
    alert('Could not generate PDF: ' + err.message);
  }
};

/**
 * Formats a timestamp into consistent 'DD/MM/YYYY, hh:mm A' format
 * @param {Date|String|Number} dateVal
 * @returns {String} formatted string or '—'
 */
export const formatApprovalDateTime = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  const hourStr = hours ? String(hours).padStart(2, '0') : '12';
  return `${day}/${month}/${year}, ${hourStr}:${minutes} ${ampm}`;
};

/**
 * Extracts and formats approval details for a leave record
 * @param {Object} rec
 * @returns {{ approvedBy: String, approvalDate: String }}
 */
export const getApprovalDetails = (rec) => {
  const isApproved = String(rec?.status || '').toLowerCase() === 'approved';
  if (!isApproved) {
    return {
      approvedBy: '—',
      approvalDate: '—',
    };
  }

  // Approved By: Name of administrator or authorized person who approved the leave request
  let approverName = '—';
  if (rec?.approvedBy) {
    if (typeof rec.approvedBy === 'object' && rec.approvedBy.name) {
      approverName = rec.approvedBy.name;
    } else if (typeof rec.approvedBy === 'string' && rec.approvedBy.trim()) {
      approverName = rec.approvedBy.trim();
    }
  }

  // Approval Date: Actual date & time when approved, or '—' if not recorded
  let approvalDateStr = '—';
  const rawDate = rec?.approvedAt || rec?.approvalDate;
  if (rawDate) {
    approvalDateStr = formatApprovalDateTime(rawDate);
  }

  return {
    approvedBy: approverName,
    approvalDate: approvalDateStr,
  };
};

/**
 * Generates and downloads a PDF Leave Request Report
 * @param {Array} leaveRecords - Leave request / leave attendance records
 * @param {String} rangeText - Date range text
 * @param {String} schoolName - Configured school name
 */
export const generateLeaveReportPDF = (leaveRecords = [], rangeText = 'All Dates', schoolName = 'Smart Rural Model School') => {
  try {
    const doc = new jsPDF();
    const title = 'SmartAttend Rural - Leave Request Report';
    const subtitle = `Date Range: ${rangeText} | Total Records: ${leaveRecords.length}`;
    const timestamp = `Generated on: ${new Date().toLocaleString()}`;

    doc.setFillColor(46, 125, 50);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text((schoolName || 'SMARTATTEND RURAL').toUpperCase(), 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('AI-Powered Attendance Management for Rural Schools', 14, 22);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 45);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 52);
    doc.setTextColor(120, 120, 120);
    doc.text(timestamp, 14, 58);

    const headers = [['Student Name', 'Class', 'From Date', 'To Date', 'Status', 'Approved By', 'Approval Date', 'Reason']];
    const tableData = leaveRecords.map((rec) => {
      const clsObj = rec.studentId?.classId;
      const classLabel = clsObj
        ? `${String(clsObj.grade || '').toLowerCase().startsWith('grade') ? clsObj.grade : `Grade ${clsObj.grade}`}-${clsObj.section}`
        : 'N/A';

      const { approvedBy, approvalDate } = getApprovalDetails(rec);

      return [
        rec.studentId?.name || 'N/A',
        classLabel,
        rec.fromDate ? new Date(rec.fromDate).toLocaleDateString('en-GB') : 'N/A',
        rec.toDate ? new Date(rec.toDate).toLocaleDateString('en-GB') : 'N/A',
        rec.status || 'Pending',
        approvedBy,
        approvalDate,
        rec.reason || 'N/A',
      ];
    });

    autoTable(doc, {
      startY: 65,
      head: headers,
      body: tableData,
      headStyles: {
        fillColor: [46, 125, 50],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [40, 40, 40],
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [240, 248, 240],
      },
      columnStyles: {
        0: { cellWidth: 26, halign: 'left' },   // Student Name
        1: { cellWidth: 18, halign: 'center' }, // Class
        2: { cellWidth: 19, halign: 'center' }, // From Date
        3: { cellWidth: 19, halign: 'center' }, // To Date
        4: { cellWidth: 18, halign: 'center' }, // Status
        5: { cellWidth: 24, halign: 'left' },   // Approved By
        6: { cellWidth: 28, halign: 'center' }, // Approval Date
        7: { cellWidth: 30, halign: 'left' },   // Reason
      },
      margin: { top: 65, left: 14, right: 14 },
      styles: {
        overflow: 'linebreak',
        cellPadding: 2,
      },
      theme: 'grid',
    });

    doc.save(`Leave_Request_Report_${Date.now()}.pdf`);
  } catch (err) {
    console.error('Leave PDF Generation Error:', err);
    alert('Could not generate Leave Report PDF: ' + err.message);
  }
};

/**
 * Generates and downloads an individual Student Report PDF
 * @param {Object} reportData - Structured report data from /attendance/student-report
 */
export const generateStudentReportPDF = (reportData) => {
  try {
    const {
      schoolName = 'SmartAttend Rural School',
      reportType = 'attendance',
      period = 'month',
      dateRange = {},
      student = {},
      stats = {},
      monthlyBreakdown = [],
      records = [],
      filename,
    } = reportData;

    const doc = new jsPDF();
    const docWidth = 210;

    // 1. Header Banner
    doc.setFillColor(46, 125, 50); // Primary green
    doc.rect(0, 0, docWidth, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text((schoolName || 'SMARTATTEND RURAL').toUpperCase(), 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('SmartAttend Rural Student Attendance & Academic Portal', 14, 22);
    doc.text(`Official Student Record | Powered by SmartAttend Rural`, 14, 28);

    // 2. Report Title & Meta
    const reportTypeTitle =
      reportType === 'monthly'
        ? 'Monthly Attendance Summary'
        : reportType === 'leave'
        ? 'Student Leave Request History'
        : 'Student Attendance Report';

    let currentY = 46;
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTypeTitle, 14, currentY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const rangeStr =
      dateRange?.start && dateRange?.end
        ? `${dateRange.start} to ${dateRange.end}`
        : period === 'month'
        ? 'Current Month'
        : period === 'year'
        ? 'Academic Year'
        : 'All Time';
    doc.text(`Report Period: ${rangeStr}  |  Generated: ${new Date().toLocaleString()}`, 14, currentY + 6);

    // 3. Student Details Card
    currentY += 14;
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(220, 225, 230);
    doc.roundedRect(14, currentY, docWidth - 28, 22, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);

    // Line 1: Name and Class
    doc.setFont('helvetica', 'bold');
    doc.text('Student Name:', 18, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(student.name || 'N/A', 46, currentY + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Class & Section:', 110, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(student.classLabel || 'N/A', 142, currentY + 8);

    // Line 2: Roll No and Admission No
    doc.setFont('helvetica', 'bold');
    doc.text('Roll Number:', 18, currentY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(student.rollNo ? String(student.rollNo) : 'N/A', 46, currentY + 16);

    doc.setFont('helvetica', 'bold');
    doc.text('Admission No:', 110, currentY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(student.admissionNo || 'N/A', 142, currentY + 16);

    // 4. Performance Summary Strip (for attendance and monthly reports)
    currentY += 28;
    if (reportType !== 'leave') {
      doc.setFillColor(238, 247, 238);
      doc.setDrawColor(200, 230, 201);
      doc.roundedRect(14, currentY, docWidth - 28, 16, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(46, 125, 50);
      doc.setFont('helvetica', 'bold');

      const colW = (docWidth - 28) / 5;
      const statsList = [
        { label: 'Total Marked', val: stats.totalRecords ?? 0 },
        { label: 'Present', val: stats.present ?? 0 },
        { label: 'Absent', val: stats.absent ?? 0 },
        { label: 'Late', val: stats.late ?? 0 },
        {
          label: 'Attendance %',
          val: stats.attendancePercentage !== null && stats.attendancePercentage !== undefined
            ? `${stats.attendancePercentage}%`
            : 'N/A',
        },
      ];

      statsList.forEach((st, idx) => {
        const xPos = 14 + idx * colW + colW / 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(90, 110, 90);
        doc.text(st.label, xPos, currentY + 6, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 70, 32);
        doc.text(String(st.val), xPos, currentY + 12, { align: 'center' });
      });

      currentY += 22;
    }

    // 5. Build Table according to report type
    let headers = [];
    let tableData = [];

    if (reportType === 'monthly') {
      headers = [['Month', 'Working Days', 'Present', 'Absent', 'Late', 'Percentage']];
      tableData = (monthlyBreakdown || []).map((mb) => [
        mb.monthName || mb.month,
        mb.total,
        mb.present,
        mb.absent,
        mb.late,
        mb.percentage !== null ? `${mb.percentage}%` : 'N/A',
      ]);
    } else if (reportType === 'leave') {
      headers = [['From Date', 'To Date', 'Days', 'Reason', 'Status']];
      tableData = (records || []).map((lr) => [
        lr.fromDate ? new Date(lr.fromDate).toLocaleDateString() : 'N/A',
        lr.toDate ? new Date(lr.toDate).toLocaleDateString() : 'N/A',
        lr.days || 1,
        lr.reason || 'N/A',
        lr.status || 'Pending',
      ]);
    } else {
      headers = [['Date', 'Status', 'Session', 'Remarks / Reason']];
      tableData = (records || []).map((rec) => {
        const dateStr = rec.date ? new Date(rec.date).toISOString().split('T')[0] : 'N/A';
        return [
          dateStr,
          rec.status || 'N/A',
          rec.session || 'Full Day',
          rec.remarks || rec.reason || '-',
        ];
      });
    }

    if (tableData.length === 0) {
      doc.setFillColor(254, 249, 195);
      doc.setDrawColor(253, 224, 71);
      doc.roundedRect(14, currentY, docWidth - 28, 18, 2, 2, 'FD');
      doc.setTextColor(133, 77, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'No attendance or leave records were found for this student during the selected period.',
        docWidth / 2,
        currentY + 11,
        { align: 'center' }
      );
    } else {
      autoTable(doc, {
        startY: currentY,
        head: headers,
        body: tableData,
        headStyles: {
          fillColor: [46, 125, 50],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 248],
        },
        margin: { top: 60, left: 14, right: 14 },
        theme: 'grid',
      });
    }

    // 6. Save PDF with sanitized filename
    const safeFilename = filename || `${(student.name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_')}_Report.pdf`;
    doc.save(safeFilename);
  } catch (err) {
    console.error('Student PDF Generation Error:', err);
    alert('Could not generate Student Report PDF: ' + err.message);
  }
};

/**
 * Generates and downloads an Attendance History Report PDF for a class and period
 * @param {Object} options
 */
export const generateAttendanceHistoryPDF = async ({
  schoolName = 'Smart Rural Model School',
  schoolLogo = '',
  classLabel = 'Class',
  periodLabel = '',
  teacherName = 'Teacher',
  summary = {},
  records = [],
  filename,
}) => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const docWidth = doc.internal.pageSize.getWidth() || 210;
    const docHeight = doc.internal.pageSize.getHeight() || 297;

    // 1. Header Banner
    doc.setFillColor(46, 125, 50); // Primary green
    doc.rect(0, 0, docWidth, 34, 'F');

    // Attempt to safely load logo if present
    let logoLoaded = false;
    if (schoolLogo && typeof window !== 'undefined') {
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        await new Promise((resolve) => {
          img.onload = () => {
            try {
              doc.addImage(img, 'PNG', 14, 5, 24, 24);
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
    doc.text((schoolName || 'SMART RURAL MODEL SCHOOL').toUpperCase(), textX, 14);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('SmartAttend Rural • AI-Powered Attendance Management for Rural Schools', textX, 21);
    doc.text('Official Classroom Attendance History Record', textX, 27);

    // 2. Title & Metadata Box
    let currentY = 44;
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance History Report', 14, currentY);

    currentY += 5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, docWidth - 28, 20, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);

    // Metadata Left Column
    doc.setFont('helvetica', 'bold');
    doc.text('Class & Section:', 18, currentY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(String(classLabel || 'N/A'), 48, currentY + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Teacher Name:', 18, currentY + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(String(teacherName || 'Class Teacher'), 48, currentY + 15);

    // Metadata Right Column
    doc.setFont('helvetica', 'bold');
    doc.text('Attendance Period:', 112, currentY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(String(periodLabel || 'All Dates'), 144, currentY + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Report Generated:', 112, currentY + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString(), 144, currentY + 15);

    // 3. Attendance Summary Metrics Strip
    currentY += 26;
    doc.setFillColor(240, 248, 240);
    doc.setDrawColor(200, 230, 201);
    doc.roundedRect(14, currentY, docWidth - 28, 16, 2, 2, 'FD');

    const colW = (docWidth - 28) / 6;
    const statsList = [
      { label: 'Total Students', val: summary.totalStudents ?? summary.totalMarked ?? 0 },
      { label: 'Present', val: summary.present ?? 0 },
      { label: 'Absent', val: summary.absent ?? 0 },
      { label: 'Late', val: summary.late ?? 0 },
      { label: 'On Leave', val: summary.leave ?? 0 },
      {
        label: 'Attendance %',
        val: summary.rate !== undefined && summary.rate !== null ? `${summary.rate}%` : '0%',
      },
    ];

    statsList.forEach((st, idx) => {
      const xPos = 14 + idx * colW + colW / 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 95, 70);
      doc.text(st.label, xPos, currentY + 6, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(46, 125, 50);
      doc.text(String(st.val), xPos, currentY + 12, { align: 'center' });
    });

    currentY += 22;

    // 4. Student Attendance Table
    const headers = [['Sr. No.', 'Roll No.', 'Student Name', 'Date', 'Status', 'Remarks', 'Marked By']];
    const tableData = (records || []).map((rec, idx) => {
      const roll = rec.studentId?.rollNo || 'N/A';
      const name = rec.studentId?.name || 'Unknown Student';
      const dateStr = rec.date ? new Date(rec.date).toLocaleDateString() : 'N/A';
      const status = rec.status || 'N/A';
      const remarks = rec.remarks || '—';
      const markedBy = rec.markedBy?.name || 'Class Teacher';
      return [idx + 1, roll, name, dateStr, status, remarks, markedBy];
    });

    if (tableData.length === 0) {
      doc.setFillColor(254, 249, 195);
      doc.setDrawColor(253, 224, 71);
      doc.roundedRect(14, currentY, docWidth - 28, 16, 2, 2, 'FD');
      doc.setTextColor(133, 77, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'No attendance records found matching the selected class and date filters.',
        docWidth / 2,
        currentY + 10,
        { align: 'center' }
      );
    } else {
      autoTable(doc, {
        startY: currentY,
        head: headers,
        body: tableData,
        showHead: 'everyPage',
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
          lineColor: [220, 225, 230],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 18 },
          2: { halign: 'left', cellWidth: 44 },
          3: { halign: 'center', cellWidth: 24 },
          4: { halign: 'center', cellWidth: 22 },
          5: { halign: 'left', cellWidth: 36 },
          6: { halign: 'left', cellWidth: 24 },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 248],
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 4) {
            const status = String(data.cell.raw).trim();
            if (status === 'Present') {
              data.cell.styles.fillColor = [232, 245, 233];
              data.cell.styles.textColor = [27, 94, 32];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'Absent') {
              data.cell.styles.fillColor = [255, 235, 238];
              data.cell.styles.textColor = [183, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'Late') {
              data.cell.styles.fillColor = [255, 248, 225];
              data.cell.styles.textColor = [183, 129, 3];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'Leave' || status === 'Excused') {
              data.cell.styles.fillColor = [227, 242, 253];
              data.cell.styles.textColor = [13, 71, 161];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { top: 20, bottom: 18, left: 14, right: 14 },
        theme: 'grid',
      });
    }

    // 5. Page Numbers & Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${i} of ${totalPages}`, docWidth - 14, docHeight - 8, { align: 'right' });
      doc.text(`${schoolName} • Attendance History Report`, 14, docHeight - 8);
    }

    // 6. Save PDF with sanitized filename
    const safeFilename = filename || `${(classLabel || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_')}_Attendance_History_Report.pdf`;
    doc.save(safeFilename);
  } catch (err) {
    console.error('Attendance History PDF Generation Error:', err);
    throw err;
  }
};



