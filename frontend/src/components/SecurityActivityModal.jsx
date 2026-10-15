import React, { useState, useEffect, useCallback } from 'react';
import ExcelJS from 'exceljs';
import {
  FaShieldAlt,
  FaFileExcel,
  FaTimes,
  FaSearch,
  FaSpinner,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaSignInAlt,
  FaUserPlus,
  FaUserMinus,
  FaEdit,
  FaTimesCircle
} from 'react-icons/fa';
import { getActivityLogs, getSchoolSettings } from '../services/api';

const SecurityActivityModal = ({ isOpen, onClose, user }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activityType, setActivityType] = useState('');
  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [schoolName, setSchoolName] = useState('Smart Rural Model School');

  // Fetch school settings once for export header
  useEffect(() => {
    let isMounted = true;
    getSchoolSettings()
      .then((res) => {
        if (isMounted && res?.data?.schoolName) {
          setSchoolName(res.data.schoolName);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard Escape listener and body scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Main fetch function
  const fetchLogs = useCallback(
    async (targetPage = page, targetLimit = limit, filterOverrides = {}) => {
      if (!isOpen) return;
      try {
        setLoading(true);
        const params = {
          page: targetPage,
          limit: targetLimit,
          search: filterOverrides.search !== undefined ? filterOverrides.search : debouncedSearch,
          role: filterOverrides.role !== undefined ? filterOverrides.role : role,
          action: filterOverrides.action !== undefined ? filterOverrides.action : activityType,
          startDate: filterOverrides.startDate !== undefined ? filterOverrides.startDate : startDate,
          endDate: filterOverrides.endDate !== undefined ? filterOverrides.endDate : endDate,
        };

        const res = await getActivityLogs(params);
        if (res && res.success) {
          setLogs(res.data || []);
          if (res.pagination) {
            setPagination(res.pagination);
            setPage(res.pagination.page);
          }
        }
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
      } finally {
        setLoading(false);
      }
    },
    [isOpen, page, limit, debouncedSearch, role, activityType, startDate, endDate]
  );

  // Automatic filtering whenever any filter changes
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchLogs(1, limit);
    }
  }, [isOpen, debouncedSearch, activityType, role, startDate, endDate, limit]);

  // Reset all filters in one click
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setActivityType('');
    setRole('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    fetchLogs(1, limit, {
      search: '',
      role: '',
      action: '',
      startDate: '',
      endDate: '',
    });
  };

  // Helper for audit badge formatting
  const getAuditBadgeInfo = (action = '') => {
    const act = (action || '').toUpperCase();
    if (act.includes('FAILED')) {
      return {
        label: 'Failed Attempt',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        icon: <FaTimesCircle className="text-[10px]" />
      };
    }
    if (act.includes('LOGIN')) {
      return {
        label: 'System Login',
        badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        icon: <FaSignInAlt className="text-[10px]" />
      };
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('LINK')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: <FaUserPlus className="text-[10px]" />
      };
    }
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('UNLINK')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        icon: <FaUserMinus className="text-[10px]" />
      };
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('RESET') || act.includes('PASSWORD') || act.includes('STATUS')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        icon: <FaEdit className="text-[10px]" />
      };
    }
    return {
      label: act.replace(/_/g, ' '),
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-750 dark:text-gray-300 border-gray-200 dark:border-gray-700',
      icon: <FaShieldAlt className="text-[10px]" />
    };
  };

  // Export Excel (.xlsx) with professional dark-green header styling matching teacher report
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const params = {
        search: debouncedSearch,
        role,
        action: activityType,
        startDate,
        endDate,
        all: true,
      };

      const res = await getActivityLogs(params);
      const dataToExport = res?.success ? (res.data || []) : [];

      if (dataToExport.length === 0) {
        alert('No activity logs match the selected filters to export.');
        setIsExportingExcel(false);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SmartAttend Rural';
      workbook.lastModifiedBy = user?.name || 'Administrator';
      workbook.created = new Date();
      workbook.modified = new Date();

      const sheet = workbook.addWorksheet('Security Audit Report', {
        views: [{ state: 'normal' }],
        pageSetup: {
          orientation: 'landscape',
          paperSize: 9, // A4
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
          printTitlesRow: '8:8',
        },
      });

      const borderThin = {
        top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      };

      // 1. School Header Row
      sheet.mergeCells('A1:G1');
      const row1 = sheet.getCell('A1');
      row1.value = (schoolName || 'SMART RURAL MODEL SCHOOL').toUpperCase();
      row1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E4620' } };
      row1.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 28;

      // 2. Report Subtitle Row
      sheet.mergeCells('A2:G2');
      const row2 = sheet.getCell('A2');
      row2.value = 'SYSTEM SECURITY & AUDIT ACTIVITY REPORT (ADMIN PORTAL)';
      row2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF333333' } };
      row2.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(2).height = 22;

      // Row 3: Spacing
      sheet.getRow(3).height = 8;

      // 3. Metadata Table (Rows 4-6)
      const dateRangeLabel = startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
        ? `From ${startDate}`
        : endDate
        ? `Up to ${endDate}`
        : 'All Historical Dates';

      const filterSummary = [
        role ? `Role: ${role.toUpperCase()}` : null,
        activityType ? `Activity: ${activityType}` : null,
        debouncedSearch ? `Search: "${debouncedSearch}"` : null,
      ].filter(Boolean).join(' | ') || 'All Audit Types & Roles';

      sheet.getCell('A4').value = 'Admin Name:';
      sheet.getCell('B4').value = user?.name || 'Administrator';
      sheet.getCell('E4').value = 'Date Range:';
      sheet.getCell('F4').value = dateRangeLabel;

      sheet.getCell('A5').value = 'Admin Email:';
      sheet.getCell('B5').value = user?.email || 'N/A';
      sheet.getCell('E5').value = 'Generated On:';
      sheet.getCell('F5').value = new Date().toLocaleString();

      sheet.getCell('A6').value = 'Active Filters:';
      sheet.getCell('B6').value = filterSummary;
      sheet.getCell('E6').value = 'Total Records:';
      sheet.getCell('F6').value = dataToExport.length;

      ['A4', 'E4', 'A5', 'E5', 'A6', 'E6'].forEach((cellKey) => {
        const cell = sheet.getCell(cellKey);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF555555' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
      ['B4', 'F4', 'B5', 'F5', 'B6', 'F6'].forEach((cellKey) => {
        const cell = sheet.getCell(cellKey);
        cell.font = { name: 'Calibri', size: 10, bold: cellKey === 'B4' || cellKey === 'F6', color: { argb: 'FF111111' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });

      sheet.getRow(4).height = 20;
      sheet.getRow(5).height = 20;
      sheet.getRow(6).height = 20;

      // Row 7: Spacing
      sheet.getRow(7).height = 8;

      // 4. Detail Table Headers (Row 8)
      const headers = [
        'TIMESTAMP',
        'USER / ACTOR',
        'EMAIL',
        'ROLE',
        'ACTION / ACTIVITY TYPE',
        'TARGET RECORD & DETAILS',
        'IP ADDRESS',
      ];

      const headerRow = sheet.getRow(8);
      headerRow.height = 26;

      headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E4620' }, // Dark green header matching teacher attendance report
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: idx === 0 || idx === 3 || idx === 4 || idx === 6 ? 'center' : 'left',
        };
        cell.border = borderThin;
      });

      // 5. Data Rows (Row 9+)
      dataToExport.forEach((log, index) => {
        const rowNum = 9 + index;
        const row = sheet.getRow(rowNum);
        row.height = 22;

        const isEven = index % 2 === 1;
        const rowBgArgb = isEven ? 'FFF4F8F4' : 'FFFFFFFF'; // Light green-gray tint for alternating row shading

        const isFailed = (log.action || '').toUpperCase().includes('FAILED');
        const userName = log.userId?.name || (isFailed ? 'Unauthenticated' : 'System');
        const userEmail = log.userId?.email || 'N/A';
        const userRole = log.userId?.role
          ? (log.userId.role.charAt(0).toUpperCase() + log.userId.role.slice(1))
          : (isFailed ? 'N/A' : 'System');
        const timestamp = new Date(log.createdAt).toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        const rowValues = [
          timestamp,
          userName,
          userEmail,
          userRole,
          log.action || '',
          log.details || '',
          log.ipAddress || 'unknown',
        ];

        rowValues.forEach((val, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = val;
          cell.font = {
            name: 'Calibri',
            size: 9.5,
            bold: colIdx === 1 || colIdx === 3,
            color: { argb: 'FF1F2937' },
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowBgArgb },
          };
          cell.border = borderThin;
          cell.alignment = {
            vertical: 'middle',
            horizontal: colIdx === 0 || colIdx === 3 || colIdx === 4 || colIdx === 6 ? 'center' : 'left',
            wrapText: colIdx === 5,
          };
        });
      });

      // 6. Set Suitable Column Widths
      sheet.columns = [
        { key: 'timestamp', width: 22 },
        { key: 'user', width: 22 },
        { key: 'email', width: 28 },
        { key: 'role', width: 14 },
        { key: 'action', width: 24 },
        { key: 'details', width: 50 },
        { key: 'ip', width: 18 },
      ];

      // 7. Write to buffer & trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `SmartAttend_Security_Audit_Report_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      alert('Failed to generate Excel report. Please try again.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-850 rounded-2xl border border-gray-200 dark:border-gray-750 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-150 dark:border-gray-750 flex flex-wrap items-center justify-between gap-3 bg-gray-50/60 dark:bg-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-base shadow-xs">
              <FaShieldAlt />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  Security & Audit Activity Logs
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#2E7D32] dark:bg-emerald-950 dark:text-green-300 border border-emerald-200 dark:border-emerald-800">
                  Authorized Admin Only
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Complete authenticated trail of security events, administrative modifications, and user access records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel || logs.length === 0}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#2E7D32] hover:bg-emerald-700 text-white shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Download formatted Excel workbook (.xlsx)"
            >
              {isExportingExcel ? (
                <>
                  <FaSpinner className="animate-spin text-xs" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FaFileExcel className="text-sm" />
                  <span>Export Excel</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl hover:bg-gray-150 dark:hover:bg-gray-750 transition-colors cursor-pointer"
              title="Close modal"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>

        {/* Filter Section: Automatic filtering without Filter button */}
        <div className="p-4 bg-gray-50/70 dark:bg-gray-800/70 border-b border-gray-150 dark:border-gray-750">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
            {/* Search Input */}
            <div className="lg:col-span-4 relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user, email, action, details, IP..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32]"
              />
            </div>

            {/* Activity Type Dropdown */}
            <div className="lg:col-span-3">
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32]"
              >
                <option value="">All Activity Types</option>
                <option value="CATEGORY:LOGIN">All Logins (Success/Failed)</option>
                <option value="LOGIN">Successful Login</option>
                <option value="FAILED_LOGIN">Failed Login Attempt</option>
                <option value="GOOGLE_LOGIN">Google Login</option>
                <option value="CATEGORY:USER">User Management (Create/Update/Delete)</option>
                <option value="CREATE_USER">Create User</option>
                <option value="CREATE_STUDENT">Create Student</option>
                <option value="CATEGORY:SECURITY">Password & Status Changes</option>
                <option value="CHANGE_PASSWORD">Password Change</option>
                <option value="PASSWORD_RESET_ADMIN">Admin Password Reset</option>
                <option value="STATUS_CHANGE">Status Toggle</option>
                <option value="UPDATE_PROFILE">Profile Update</option>
                <option value="CATEGORY:NOTIFICATION">Notifications & Notices</option>
                <option value="CATEGORY:SETTINGS">School Settings</option>
              </select>
            </div>

            {/* Role Dropdown */}
            <div className="lg:col-span-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32]"
              >
                <option value="">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
              </select>
            </div>

            {/* Date Range Start & End */}
            <div className="lg:col-span-3 flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Start Date"
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32]"
              />
              <span className="text-gray-400 text-xs font-semibold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="End Date"
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32]"
              />
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-2">
              <FaSpinner className="animate-spin text-2xl text-[#2E7D32]" />
              <span className="text-xs font-semibold">Updating security audit records...</span>
            </div>
          ) : logs.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Timestamp</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">User</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Role</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Action Type</th>
                  <th className="py-2.5 px-3 min-w-[240px]">Target Record & Details</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {logs.map((log) => {
                  const badgeInfo = getAuditBadgeInfo(log.action);
                  const isFailed = (log.action || '').toUpperCase().includes('FAILED');
                  const userName = log.userId?.name || (isFailed ? 'Unauthenticated' : 'System');
                  const userEmail = log.userId?.email || 'N/A';
                  const userRole = log.userId?.role || (isFailed ? 'guest' : 'system');

                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap text-gray-500 dark:text-gray-400 font-medium text-[11px]">
                        <div>{new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}</div>
                        <div className="text-[10px] text-gray-400">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-900 dark:text-white leading-tight">{userName}</div>
                        {userEmail !== 'N/A' && (
                          <div className="text-[10px] text-gray-400 font-medium">{userEmail}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            userRole === 'admin'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : userRole === 'teacher'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : userRole === 'parent'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {userRole}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeInfo.badgeClass}`}>
                          {badgeInfo.icon}
                          <span>{badgeInfo.label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                        {log.details}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          {log.ipAddress || 'unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 p-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                <FaInfoCircle className="text-xl text-gray-400" />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">No activity logs found</span>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                No security or audit events match your selected filters. Try adjusting your search query or reset filters.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-3 px-3 py-1 text-xs font-semibold text-[#2E7D32] hover:underline cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>

        {/* Modal Pagination Footer */}
        <div className="px-5 py-3 border-t border-gray-150 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 font-medium text-[11px]">
            <span>
              Showing{' '}
              <strong className="text-gray-800 dark:text-gray-200">
                {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-gray-800 dark:text-gray-200">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of{' '}
              <strong className="text-gray-800 dark:text-gray-200">{pagination.total}</strong> events
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-gray-400">Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value, 10);
                  setLimit(newLimit);
                  setPage(1);
                }}
                className="px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#2E7D32]"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
              >
                <FaChevronLeft className="text-[10px]" />
              </button>

              <span className="px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.pages}
              </span>

              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((prev) => Math.min(prev + 1, pagination.pages))}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
              >
                <FaChevronRight className="text-[10px]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityActivityModal;
