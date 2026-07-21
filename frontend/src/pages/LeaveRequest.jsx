import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLeaveRequests, createLeaveRequest, updateLeaveStatus } from '../services/api';
import AIOCRLeaveUpload from '../components/AI/AIOCRLeaveUpload';
import { FaPaperPlane, FaCheckCircle, FaExclamationCircle, FaTimesCircle, FaCalendarAlt, FaFileAlt, FaCheck, FaTimes, FaEye } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const LeaveRequest = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const children = user?.children || [];

  const [selectedChildId, setSelectedChildId] = useState(children[0]?._id || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [remarksMap, setRemarksMap] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState(null);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLeaveRequests();
      if (res.success) {
        setLeaves(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const getStudentName = (leave) => {
    if (!leave) return '';
    if (leave.studentId?.name) return leave.studentId.name;
    const sId = typeof leave.studentId === 'object' ? leave.studentId?._id : leave.studentId;
    const matchedChild = children.find(c => c._id === sId || c._id === leave.studentId);
    if (matchedChild?.name) return matchedChild.name;
    if (children[0]?.name) return children[0].name;
    return leave.studentName || 'Student';
  };

  const formatDate = (d) => {
    if (!d) return '';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthStr = dateObj.toLocaleDateString('en-GB', { month: 'short' });
    const yearNum = dateObj.getFullYear();
    return `${day} ${monthStr} ${yearNum}`;
  };

  const calculateDays = (from, to) => {
    if (!from || !to) return '1 Day';
    const f = new Date(from);
    const toD = new Date(to);
    const diffTime = Math.abs(toD - f);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? '1 ' + t('dashboard_extra.day') : `${diffDays} ${t('dashboard_extra.days')}`;
  };

  const handleStatusUpdate = async (id, status) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    setError('');
    setMessage('');
    try {
      const remarks = remarksMap[id] || '';
      const res = await updateLeaveStatus(id, { status, remarks });
      if (res.success) {
        setMessage('Leave request status updated successfully.');
        fetchLeaves();
      } else {
        setError(res.message || 'Failed to update leave request status.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error updating leave request status.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleOCRExtracted = (data) => {
    if (data.leaveDates) {
      const dates = data.leaveDates.split(' to ');
      if (dates[0]) setFromDate(dates[0]);
      if (dates[1]) setToDate(dates[1]);
    }
    if (data.reason) {
      setReason(data.reason);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!selectedChildId || !fromDate || !toDate || !reason) {
      setError('Please fill in all fields.');
      return;
    }

    setFormLoading(true);
    try {
      const res = await createLeaveRequest({
        studentId: selectedChildId,
        fromDate,
        toDate,
        reason
      });

      if (res.success) {
        setMessage('Leave request submitted successfully.');
        setReason('');
        setFromDate('');
        setToDate('');
        fetchLeaves(); // Reload history list
      } else {
        setError(res.message || 'Failed to submit request.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong.');
    } finally {
      setFormLoading(false);
    }
  };

  const isStaff = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {isStaff ? t('dashboard_extra.reviewLeaves') : t('dashboard_extra.applyLeave')}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
          {isStaff ? t('dashboard_extra.reviewLeavesSubtitle') : t('dashboard_extra.applyLeaveSubtitle')}
        </p>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold leading-relaxed">
          {message}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold leading-relaxed">
          {error}
        </div>
      )}

      {isStaff ? (
        /* STAFF / TEACHER VIEW */
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-2xs">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-150 dark:border-gray-700">
            {t('dashboard_extra.leaveHistory')}
          </h3>

          {loading ? (
            <p className="text-xs text-gray-400 font-semibold text-center py-10">{t('common.loading')}</p>
          ) : leaves.length === 0 ? (
            <div className="text-center py-12">
              <FaFileAlt className="mx-auto text-2xl text-gray-300 mb-2" />
              <p className="text-xs text-gray-400 font-semibold">{t('dashboard_extra.noStudentRequests')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaves.map((leave) => (
                <div
                  key={leave._id}
                  className="border border-gray-200 dark:border-gray-700 p-3.5 rounded-xl bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition flex flex-col justify-between space-y-3"
                >
                  {/* Summary Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                        {getStudentName(leave)}
                      </h4>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block mt-0.5">
                        {formatDate(leave.fromDate)} – {formatDate(leave.toDate)}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                        leave.status === 'Approved'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : leave.status === 'Rejected'
                          ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {leave.status === 'Approved' ? t('dashboard_extra.approved') : leave.status === 'Rejected' ? t('dashboard_extra.rejected') : t('dashboard_extra.pending')}
                    </span>
                  </div>

                  {/* Truncated Short Reason */}
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium line-clamp-2 leading-relaxed">
                    {leave.reason}
                  </p>

                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2 text-[10px] text-gray-400">
                    <span>{t('dashboard_extra.appliedOn')}: {formatDate(leave.createdAt || leave.fromDate)}</span>
                    <button
                      onClick={() => setSelectedLeaveDetails(leave)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#2E7D32] dark:text-green-400 hover:underline cursor-pointer"
                    >
                      <FaEye className="text-[10px]" />
                      <span>{t('students.viewFullProfile') || 'View Details'}</span>
                    </button>
                  </div>

                  {/* Teacher Action Controls for Pending Leaves */}
                  {leave.status === 'Pending' && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                      <input
                        type="text"
                        placeholder={t('dashboard_extra.remarksPlaceholder')}
                        value={remarksMap[leave._id] || ''}
                        onChange={(e) =>
                          setRemarksMap((prev) => ({ ...prev, [leave._id]: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusUpdate(leave._id, 'Approved')}
                          disabled={actionLoading[leave._id]}
                          className="flex-1 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(leave._id, 'Rejected')}
                          disabled={actionLoading[leave._id]}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* PARENT VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Apply Form Left Column */}
          <div className="lg:col-span-1 space-y-5">
            <AIOCRLeaveUpload onExtracted={handleOCRExtracted} />

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-2xs">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-150 dark:border-gray-700 flex items-center gap-1.5">
                <FaPaperPlane className="text-[#2E7D32]" />
                <span>{t('dashboard_extra.leaveFormTitle')}</span>
              </h3>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Child Select */}
                <div>
                  <label htmlFor="child" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    {t('parents.linkChild') || 'Select Child'}
                  </label>
                  <select
                    id="child"
                    value={selectedChildId}
                    onChange={(e) => setSelectedChildId(e.target.value)}
                    className="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  >
                    {children.map((child) => (
                      <option key={child._id} value={child._id}>
                        {child.name} (Roll {child.rollNo || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Inputs */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="from" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      {t('dashboard_extra.from')}
                    </label>
                    <input
                      id="from"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="block w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="to" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      {t('dashboard_extra.to')}
                    </label>
                    <input
                      id="to"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="block w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Reason Textarea */}
                <div>
                  <label htmlFor="reason" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    {t('dashboard_extra.leaveReason')}
                  </label>
                  <textarea
                    id="reason"
                    rows="3"
                    placeholder={t('dashboard_extra.reasonPlaceholder')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? t('common.loading') : t('dashboard_extra.submitRequest')}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: {t('dashboard_extra.leaveHistory')} (Renamed & Compact Summary Cards) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-2xs">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-150 dark:border-gray-700">
                Leave History
              </h3>

              {loading ? (
                <p className="text-xs text-gray-400 font-semibold text-center py-10">{t('common.loading')}</p>
              ) : leaves.length === 0 ? (
                <div className="text-center py-12">
                  <FaFileAlt className="mx-auto text-2xl text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400 font-semibold">{t('dashboard_extra.noLeavesFiled')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {leaves.map((leave) => (
                    <div
                      key={leave._id}
                      className="border border-gray-200 dark:border-gray-700 p-3.5 rounded-xl bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition flex flex-col justify-between space-y-2.5"
                    >
                      {/* Compact Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                            {getStudentName(leave)}
                          </h4>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block mt-0.5">
                            {formatDate(leave.fromDate)} – {formatDate(leave.toDate)}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                            leave.status === 'Approved'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : leave.status === 'Rejected'
                              ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                              : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {leave.status === 'Approved' ? t('dashboard_extra.approved') : leave.status === 'Rejected' ? t('dashboard_extra.rejected') : t('dashboard_extra.pending')}
                        </span>
                      </div>

                      {/* Truncated Short Reason */}
                      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium line-clamp-2 leading-relaxed">
                        {leave.reason}
                      </p>

                      {/* Card Footer with View Details Button */}
                      <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2 text-[10px] text-gray-400">
                        <span>{t('dashboard_extra.appliedOn')}: {formatDate(leave.createdAt || leave.fromDate)}</span>
                        <button
                          onClick={() => setSelectedLeaveDetails(leave)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#2E7D32] dark:text-green-400 hover:underline cursor-pointer"
                        >
                          <FaEye className="text-[10px]" />
                          <span>{t('students.viewFullProfile') || 'View Details'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leave Details Modal Popup */}
      {selectedLeaveDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {t('dashboard_extra.leaveDetails')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  {t('dashboard_extra.applicationId')}: #{selectedLeaveDetails._id.slice(-6).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLeaveDetails(null)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
              >
                <FaTimes className="text-base" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('reports.status')}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                    selectedLeaveDetails.status === 'Approved'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : selectedLeaveDetails.status === 'Rejected'
                      ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {selectedLeaveDetails.status === 'Approved' ? (
                    <FaCheckCircle className="text-xs" />
                  ) : selectedLeaveDetails.status === 'Rejected' ? (
                    <FaTimesCircle className="text-xs" />
                  ) : (
                    <FaExclamationCircle className="text-xs" />
                  )}
                  <span>{selectedLeaveDetails.status === 'Approved' ? t('dashboard_extra.approved') : selectedLeaveDetails.status === 'Rejected' ? t('dashboard_extra.rejected') : t('dashboard_extra.pending')}</span>
                </span>
              </div>

              {/* Student & Class Details */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">{t('common.name')}</span>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    {getStudentName(selectedLeaveDetails)}
                  </h4>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">{t('classes.title')}</span>
                  <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {selectedLeaveDetails.studentId?.classId?.grade
                      ? `Grade ${selectedLeaveDetails.studentId.classId.grade} ${selectedLeaveDetails.studentId.classId.section || ''}`
                      : 'Assigned Class'}
                  </h4>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">{t('parents.title')}</span>
                  <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {selectedLeaveDetails.parentId?.name || user?.name || 'Parent'}
                  </h4>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">{t('dashboard_extra.totalDuration')}</span>
                  <h4 className="text-xs font-bold text-[#2E7D32] dark:text-green-400">
                    {calculateDays(selectedLeaveDetails.fromDate, selectedLeaveDetails.toDate)}
                  </h4>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{t('dashboard_extra.leaveStartDate')}</span>
                  <strong className="text-xs text-gray-800 dark:text-gray-200 font-semibold block">
                    {formatDate(selectedLeaveDetails.fromDate)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{t('dashboard_extra.leaveEndDate')}</span>
                  <strong className="text-xs text-gray-800 dark:text-gray-200 font-semibold block">
                    {formatDate(selectedLeaveDetails.toDate)}
                  </strong>
                </div>
              </div>

              {/* Full Reason */}
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('dashboard_extra.leaveReason')}</span>
                <div className="p-3 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-200 font-medium leading-relaxed">
                  {selectedLeaveDetails.reason}
                </div>
              </div>

              {/* Supporting Medical Certificate */}
              {(selectedLeaveDetails.medicalCertificateUrl || selectedLeaveDetails.documentUrl) && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('dashboard_extra.supportingCertificate')}</span>
                  <a
                    href={selectedLeaveDetails.medicalCertificateUrl || selectedLeaveDetails.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <FaFileAlt className="text-xs" />
                    <span>{t('dashboard_extra.viewCertificate')}</span>
                  </a>
                </div>
              )}

              {/* Audit Details */}
              <div className="border-t border-gray-150 dark:border-gray-700 pt-3 grid grid-cols-2 gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                <div>
                  <span className="font-semibold block text-[10px] uppercase text-gray-400">{t('dashboard_extra.appliedOn')}</span>
                  <span>{formatDate(selectedLeaveDetails.createdAt || selectedLeaveDetails.fromDate)}</span>
                </div>
                <div>
                  <span className="font-semibold block text-[10px] uppercase text-gray-400">{t('dashboard_extra.lastUpdated')}</span>
                  <span>{formatDate(selectedLeaveDetails.updatedAt || selectedLeaveDetails.createdAt)}</span>
                </div>
              </div>

              {/* Reviewer Remarks */}
              {selectedLeaveDetails.approvedBy && (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-green-300 uppercase block">
                    {t('dashboard_extra.reviewedBy')}: {selectedLeaveDetails.approvedBy.name} ({selectedLeaveDetails.approvedBy.role || 'Teacher/Admin'})
                  </span>
                  {selectedLeaveDetails.remarks && (
                    <p className="text-gray-700 dark:text-gray-300 font-medium">
                      "{selectedLeaveDetails.remarks}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequest;
