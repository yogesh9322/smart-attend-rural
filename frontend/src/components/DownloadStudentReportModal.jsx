import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  FileText,
  Calendar,
  User,
  Download,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { getStudentReportData, downloadStudentReportCSV } from '../services/api';
import { generateStudentReportPDF } from '../utils/pdfGenerator';

const DownloadStudentReportModal = ({
  isOpen,
  onClose,
  children = [],
  initialChildId = null,
}) => {
  const { t } = useTranslation();

  const [selectedChildId, setSelectedChildId] = useState(
    initialChildId || (children.length > 0 ? children[0]._id : '')
  );
  const [reportType, setReportType] = useState('attendance'); // 'attendance', 'monthly', 'leave'
  const [period, setPeriod] = useState('month'); // 'month', 'year', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState('pdf'); // 'pdf', 'csv'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Sync initial child if changed
  React.useEffect(() => {
    if (initialChildId) {
      setSelectedChildId(initialChildId);
    } else if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0]._id);
    }
  }, [initialChildId, children]);

  if (!isOpen) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedChildId) {
      setErrorMessage('Please select a student.');
      return;
    }

    if (period === 'custom') {
      if (!startDate || !endDate) {
        setErrorMessage('Please specify both start date and end date for custom date range.');
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        setErrorMessage('Start date cannot be after end date.');
        return;
      }
    }

    try {
      setLoading(true);

      const params = {
        studentId: selectedChildId,
        reportType,
        period,
        ...(period === 'custom' ? { startDate, endDate } : {}),
      };

      if (format === 'csv') {
        const response = await downloadStudentReportCSV(params);
        
        // Extract filename from Content-Disposition if present
        let filename = `Student_${reportType}_Report.csv`;
        const disposition = response.headers['content-disposition'];
        if (disposition && disposition.indexOf('filename=') !== -1) {
          const match = disposition.match(/filename="?([^";]+)"?/);
          if (match && match[1]) filename = match[1];
        }

        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setSuccessMessage('CSV report downloaded successfully.');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // PDF format
        const reportData = await getStudentReportData(params);
        if (!reportData || !reportData.success) {
          throw new Error(reportData?.message || 'Failed to retrieve report data.');
        }

        generateStudentReportPDF(reportData);

        if (reportData.records?.length === 0 && (!reportData.monthlyBreakdown || reportData.monthlyBreakdown.length === 0)) {
          setSuccessMessage('Report generated. (Note: No attendance records found for this period)');
        } else {
          setSuccessMessage('PDF report generated successfully.');
        }

        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Report generation error:', err);
      const msg = err.response?.data?.message || err.message || 'Could not generate student report.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedChildObj = children.find((c) => c._id === selectedChildId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col font-sans transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-[#263247] bg-slate-50/50 dark:bg-[#182235]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-[#062c1d] text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
                Download Student Report
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                Export verified attendance and leave records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#263247] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-[#3b1212] border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-[#062c1d] border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Student Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] mb-1.5">
              Select Student <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#182235] border border-slate-200 dark:border-[#263247] rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-[#F8FAFC] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              >
                {children.map((child) => {
                  const classGrade = child.classId?.grade ? `Grade ${String(child.classId.grade).replace(/^grade\s+/i, '')}` : '';
                  const classSec = child.classId?.section ? `-${child.classId.section}` : '';
                  const classTag = classGrade ? ` (${classGrade}${classSec})` : '';
                  return (
                    <option key={child._id} value={child._id}>
                      {child.name} {classTag}
                    </option>
                  );
                })}
              </select>
            </div>
            {selectedChildObj && (
              <p className="text-[11px] text-slate-400 dark:text-[#94A3B8] mt-1">
                Roll No: {selectedChildObj.rollNo || 'N/A'} • Admission No: {selectedChildObj.admissionNo || 'N/A'}
              </p>
            )}
          </div>

          {/* 2. Report Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] mb-1.5">
              Report Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'attendance', label: 'Attendance', desc: 'Daily log' },
                { id: 'monthly', label: 'Monthly Summary', desc: 'Percentages' },
                { id: 'leave', label: 'Leave History', desc: 'All requests' },
              ].map((tOption) => {
                const isSelected = reportType === tOption.id;
                return (
                  <button
                    type="button"
                    key={tOption.id}
                    onClick={() => setReportType(tOption.id)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-[#062c1d] border-emerald-500 text-emerald-950 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'bg-slate-50/60 dark:bg-[#182235] border-slate-200 dark:border-[#263247] text-slate-700 dark:text-[#CBD5E1] hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs">{tOption.label}</div>
                    <div className="text-[10px] text-slate-400 dark:text-[#94A3B8] font-normal">
                      {tOption.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Period Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] mb-1.5">
              Period <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'month', label: 'Current Month' },
                { id: 'year', label: 'Academic Year' },
                { id: 'custom', label: 'Custom Range' },
              ].map((pOption) => {
                const isSelected = period === pOption.id;
                return (
                  <button
                    type="button"
                    key={pOption.id}
                    onClick={() => setPeriod(pOption.id)}
                    className={`py-2 px-2.5 rounded-xl border text-center text-xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-[#062c1d] border-emerald-500 text-emerald-950 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'bg-slate-50/60 dark:bg-[#182235] border-slate-200 dark:border-[#263247] text-slate-700 dark:text-[#CBD5E1] hover:border-slate-300'
                    }`}
                  >
                    {pOption.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Range Pickers */}
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#182235] border border-slate-200 dark:border-[#263247]">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-[#CBD5E1] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-lg text-xs text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-[#CBD5E1] mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-[#263247] rounded-lg text-xs text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 4. Format Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] mb-1.5">
              Export Format
            </label>
            <div className="flex items-center gap-3">
              <label
                onClick={() => setFormat('pdf')}
                className={`flex-1 flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  format === 'pdf'
                    ? 'bg-rose-50/70 dark:bg-[#3b1212] border-rose-500 text-rose-950 dark:text-rose-300 font-semibold'
                    : 'bg-slate-50/60 dark:bg-[#182235] border-slate-200 dark:border-[#263247] text-slate-700 dark:text-[#CBD5E1]'
                }`}
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span className="text-xs">PDF Document</span>
              </label>

              <label
                onClick={() => setFormat('csv')}
                className={`flex-1 flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  format === 'csv'
                    ? 'bg-emerald-50/70 dark:bg-[#062c1d] border-emerald-500 text-emerald-950 dark:text-emerald-300 font-semibold'
                    : 'bg-slate-50/60 dark:bg-[#182235] border-slate-200 dark:border-[#263247] text-slate-700 dark:text-[#CBD5E1]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="text-xs">CSV Spreadsheet</span>
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-150 dark:border-[#263247]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#263247] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DownloadStudentReportModal;
