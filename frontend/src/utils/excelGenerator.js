import * as XLSX from 'xlsx';

/**
 * Generates and downloads an Excel sheet containing student profiles and attendance summaries
 * @param {Object} schoolClass - Class details ({ grade, section })
 * @param {Array} students - List of students
 * @param {Array} attendanceRecords - Attendance logs
 * @param {String} rangeText - Date range text
 */
export const generateClassReportExcel = (schoolClass, students, attendanceRecords, rangeText) => {
  // 1. Prepare row data for Excel
  const rows = students.map((student) => {
    const studentRecords = attendanceRecords.filter((r) => r.studentId?._id === student._id);
    const totalDays = studentRecords.length;
    const presents = studentRecords.filter((r) => r.status === 'Present').length;
    const absents = studentRecords.filter((r) => r.status === 'Absent').length;
    const lates = studentRecords.filter((r) => r.status === 'Late').length;
    
    const netPresent = presents + lates;
    const rate = totalDays > 0 ? Math.round((netPresent / totalDays) * 100) : 100;

    return {
      'Roll No': student.rollNo,
      'Admission No': student.admissionNo,
      'Student Name': student.name,
      'Gender': student.gender,
      'Parent Name': student.parentId?.name || 'N/A',
      'Parent Phone': student.parentId?.phone || 'N/A',
      'Total Days Checked': totalDays,
      'Present Count': presents,
      'Absent Count': absents,
      'Late Count': lates,
      'Attendance Rate (%)': rate,
    };
  });

  // 2. Convert JSON rows to sheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 3. Create a new workbook and append sheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Summary');

  // 4. Autofit column widths for clean visual rendering
  const maxProps = ['Roll No', 'Admission No', 'Student Name', 'Gender', 'Parent Name', 'Parent Phone', 'Total Days Checked', 'Present Count', 'Absent Count', 'Late Count', 'Attendance Rate (%)'];
  const wscols = maxProps.map(col => {
    let maxLen = col.length;
    rows.forEach(row => {
      const valStr = String(row[col] || '');
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    });
    return { wch: maxLen + 3 }; // Give padding
  });
  worksheet['!cols'] = wscols;

  // 5. Save/download file
  const filename = `Attendance_Report_${schoolClass.grade.replace(/\s+/g, '_')}_${schoolClass.section}_${rangeText.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
