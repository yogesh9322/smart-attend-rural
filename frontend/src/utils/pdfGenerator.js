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
