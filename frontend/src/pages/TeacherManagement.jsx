import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getTeachersList, getClasses, registerTeacher, updateTeacher, resetTeacherPassword, toggleTeacherStatus, deleteTeacher } from '../services/api';
import {
  FaUserPlus,
  FaSearch,
  FaTimes,
  FaChalkboardTeacher,
  FaEllipsisV,
  FaEye,
  FaEyeSlash,
  FaEdit,
  FaKey,
  FaPowerOff,
  FaTrashAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSchool
} from 'react-icons/fa';

const TeacherManagement = () => {
  const { t } = useTranslation('common');
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [teachers, setTeachers] = useState([]);
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Menu Dropdown State
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Modals Controls
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');
  const [subject, setSubject] = useState('');
  const [experience, setExperience] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);

  // Reset Password Field
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all teachers
  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTeachersList();
      if (data.success) {
        setTeachers(data.data);
      } else {
        throw new Error(data.message || 'Failed to load teachers.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading teacher database.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch classes list for assignment selection
  const fetchClasses = useCallback(async () => {
    try {
      const data = await getClasses();
      if (data.success) {
        setClassList(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch class list', err);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchTeachers();
      fetchClasses();
    }
  }, [isAdmin, fetchTeachers, fetchClasses]);

  // Toast auto-clear
  useEffect(() => {
    if (successMsg || error) {
      const timer = setTimeout(() => {
        setSuccessMsg('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg, error]);

  // Open Add Modal
  const openAddModal = useCallback(() => {
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setQualification('');
    setSubject('');
    setExperience('');
    setSelectedClasses([]);
    setError('');
    setIsAddModalOpen(true);
  }, []);

  // Auto-open Add modal if navigated with ?action=add
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add') {
      openAddModal();
    }
  }, [openAddModal]);

  // Open Edit Modal
  const openEditModal = (teacher) => {
    setSelectedTeacher(teacher);
    setName(teacher.name || '');
    setEmail(teacher.email || '');
    setPhone(teacher.phone || '');
    setQualification(teacher.qualification || '');
    setSubject(teacher.subject || '');
    setExperience(teacher.experience || '');
    setSelectedClasses(teacher.assignedClasses ? teacher.assignedClasses.map(c => c._id || c) : []);
    setError('');
    setActiveMenuId(null);
    setIsEditModalOpen(true);
  };

  // Open View Profile Modal
  const openViewModal = (teacher) => {
    setSelectedTeacher(teacher);
    setActiveMenuId(null);
    setIsViewModalOpen(true);
  };

  // Open Reset Password Modal
  const openResetPasswordModal = (teacher) => {
    setSelectedTeacher(teacher);
    setNewPassword('');
    setError('');
    setActiveMenuId(null);
    setIsResetPasswordModalOpen(true);
  };

  // Create Teacher
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      const data = await registerTeacher({
        name,
        email,
        password,
        phone,
        qualification,
        subject,
        experience,
        assignedClasses: selectedClasses,
        role: 'teacher'
      });

      if (data.success) {
        setIsAddModalOpen(false);
        setSuccessMsg(`Teacher account created for ${name}`);
        fetchTeachers();
      } else {
        throw new Error(data.message || 'Registration failed.');
      }
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message || err.message || 'Error processing request.';
      setError(serverMsg);
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Teacher
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    setFormLoading(true);
    setError('');

    try {
      const data = await updateTeacher(selectedTeacher._id, {
        name,
        email,
        phone,
        qualification,
        subject,
        experience,
        assignedClasses: selectedClasses,
      });

      if (data.success) {
        setIsEditModalOpen(false);
        setSuccessMsg(`Teacher details updated for ${name}`);
        fetchTeachers();
      } else {
        throw new Error(data.message || 'Update failed.');
      }
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message || err.message || 'Error updating teacher.';
      setError(serverMsg);
    } finally {
      setFormLoading(false);
    }
  };

  // Reset Password Submit
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeacher || !newPassword) return;
    setFormLoading(true);
    setError('');

    try {
      const data = await resetTeacherPassword(selectedTeacher._id, { newPassword });

      if (data.success) {
        setIsResetPasswordModalOpen(false);
        setSuccessMsg(`Password reset successfully for ${selectedTeacher.name}`);
      } else {
        throw new Error(data.message || 'Password reset failed.');
      }
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message || err.message || 'Error resetting password.';
      setError(serverMsg);
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle Activate / Deactivate
  const handleToggleStatus = async (teacher) => {
    setActiveMenuId(null);
    try {
      const data = await toggleTeacherStatus(teacher._id);

      if (data.success) {
        const isNowActive = data.data.isActive !== false && data.data.status !== 'Deactivated';
        setSuccessMsg(`Teacher account for ${teacher.name} is now ${isNowActive ? 'Active' : 'Deactivated'}`);
        fetchTeachers();
      } else {
        throw new Error(data.message || 'Status toggle failed.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error updating account status.');
    }
  };

  // Delete Teacher
  const handleDeleteTeacher = async (teacher) => {
    setActiveMenuId(null);
    if (!window.confirm(`Are you sure you want to delete teacher "${teacher.name}"?`)) return;

    try {
      const data = await deleteTeacher(teacher._id);

      if (data.success) {
        setSuccessMsg(`Teacher ${teacher.name} deleted successfully.`);
        fetchTeachers();
      } else {
        throw new Error(data.message || 'Delete failed.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error deleting teacher.');
    }
  };

  // Checkbox Handler for class selection
  const handleClassCheckbox = (classId) => {
    setSelectedClasses(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  // Filtered teachers
  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSearch =
      teacher.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (teacher.phone && teacher.phone.includes(searchQuery));

    const isTeacherActive = teacher.isActive !== false && teacher.status !== 'Deactivated';
    const matchesStatus =
      statusFilter === 'All' ? true :
      statusFilter === 'Active' ? isTeacherActive :
      !isTeacherActive;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <FaCheckCircle className="text-emerald-600" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-800"><FaTimes /></button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <FaExclamationTriangle className="text-red-600" />
            {error}
          </span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-800"><FaTimes /></button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FaChalkboardTeacher className="text-[#2E7D32]" />
            <span>Teacher Management</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
            Manage school faculty, class assignments, credentials, and ERP account access.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-colors cursor-pointer"
          >
            <FaUserPlus />
            <span>Add New Teacher</span>
          </button>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
            <FaSearch className="text-xs" />
          </div>
          <input
            type="text"
            placeholder="Search by teacher name, email, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-650 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold text-gray-800 dark:text-white"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-750 p-1 rounded-xl w-full sm:w-auto">
          {['All', 'Active', 'Deactivated'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === tab
                  ? 'bg-white dark:bg-gray-800 text-[#2E7D32] shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab === 'All' ? `All (${teachers.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Teachers Clean ERP Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[35vh] bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-8">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#2E7D32]"></div>
          <span className="text-xs font-semibold text-gray-400 mt-3">Loading teacher database...</span>
        </div>
      ) : filteredTeachers.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50/70 dark:bg-gray-750">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">TEACHER INFO</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">EMAIL & PHONE</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">ASSIGNED CLASSES</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                  <th className="px-6 py-3.5 text-center text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-150 dark:divide-gray-700">
                {filteredTeachers.map((teacher) => {
                  const isTeacherActive = teacher.isActive !== false && teacher.status !== 'Deactivated';

                  return (
                    <tr key={teacher._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/40 transition">
                      {/* Teacher Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {teacher.photo ? (
                            <img
                              src={teacher.photo}
                              alt={teacher.name}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-sm shadow-xs">
                              {teacher.name ? teacher.name.charAt(0).toUpperCase() : 'T'}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              {teacher.name}
                            </div>
                            <div className="text-xs text-gray-400 font-medium">
                              {teacher.subject || teacher.qualification || 'Faculty Member'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email & Phone */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{teacher.email}</div>
                        <div className="text-xs text-gray-400 font-medium mt-0.5">{teacher.phone || 'No phone'}</div>
                      </td>

                      {/* Assigned Classes - Clean & Neat Badges */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {teacher.assignedClasses && teacher.assignedClasses.length > 0 ? (
                            teacher.assignedClasses.map((cls) => (
                              <span
                                key={cls._id || cls}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600"
                              >
                                {cls.grade && cls.section ? `${cls.grade}-${cls.section}` : 'Class'}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 font-normal italic">None Assigned</span>
                          )}
                        </div>
                      </td>

                      {/* Status - Clean Dot Pill Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                            isTeacherActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isTeacherActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          <span>{isTeacherActive ? 'Active' : 'Deactivated'}</span>
                        </span>
                      </td>

                      {/* Actions Menu (3-dot ⋮) */}
                      <td className="px-6 py-4 whitespace-nowrap text-center relative">
                        <div className="inline-block text-left" ref={activeMenuId === teacher._id ? menuRef : null}>
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === teacher._id ? null : teacher._id)}
                            title="Actions Menu"
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 transition cursor-pointer"
                          >
                            <FaEllipsisV className="text-xs" />
                          </button>

                          {/* Floating Action Menu Dropdown */}
                          {activeMenuId === teacher._id && (
                            <div className="absolute right-6 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 divide-y divide-gray-100 dark:divide-gray-800 text-left">
                              <div className="py-1">
                                <button
                                  onClick={() => openViewModal(teacher)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                                >
                                  <FaEye className="text-blue-500" />
                                  <span>View Profile</span>
                                </button>

                                <button
                                  onClick={() => openEditModal(teacher)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                                >
                                  <FaEdit className="text-amber-500" />
                                  <span>Edit Teacher</span>
                                </button>

                                <button
                                  onClick={() => openResetPasswordModal(teacher)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                                >
                                  <FaKey className="text-purple-500" />
                                  <span>Reset Password</span>
                                </button>
                              </div>

                              <div className="py-1">
                                <button
                                  onClick={() => handleToggleStatus(teacher)}
                                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer ${
                                    isTeacherActive ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  <FaPowerOff />
                                  <span>{isTeacherActive ? 'Deactivate Account' : 'Activate Account'}</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteTeacher(teacher)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                                >
                                  <FaTrashAlt />
                                  <span>Delete Teacher</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-2xl shadow-xs text-gray-400">
          <FaChalkboardTeacher className="mx-auto text-4xl text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No teacher records found</p>
          <p className="text-xs text-gray-400 mt-1">Try matching search terms or add a new teacher.</p>
        </div>
      )}

      {/* 1. ADD TEACHER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-[#2E7D32] text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaUserPlus />
                <span>Add New Teacher</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between shadow-xs">
                  <span className="flex items-center gap-2">
                    <FaExclamationTriangle className="text-red-600 shrink-0" />
                    <span>{error}</span>
                  </span>
                  <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-800">
                    <FaTimes />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="teacher@school.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Login Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                      placeholder="Min 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      tabIndex="-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FaEyeSlash className="text-base" /> : <FaEye className="text-base" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. M.Sc, B.Ed"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Primary Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. Mathematics"
                  />
                </div>
              </div>

              {/* Class Selection Checkboxes */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">Assign Classes</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl">
                  {classList.map((cls) => (
                    <label key={cls._id} className="flex items-center gap-2 p-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer text-gray-800 dark:text-gray-200 font-bold">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls._id)}
                        onChange={() => handleClassCheckbox(cls._id)}
                        className="rounded text-[#2E7D32] focus:ring-[#2E7D32]"
                      />
                      <span>{cls.grade}-{cls.section}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT TEACHER MODAL */}
      {isEditModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-amber-600 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaEdit />
                <span>Edit Teacher: {selectedTeacher.name}</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between shadow-xs">
                  <span className="flex items-center gap-2">
                    <FaExclamationTriangle className="text-red-600 shrink-0" />
                    <span>{error}</span>
                  </span>
                  <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-800">
                    <FaTimes />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Primary Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                />
              </div>

              {/* Class Selection Checkboxes */}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">Assign Classes</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl">
                  {classList.map((cls) => (
                    <label key={cls._id} className="flex items-center gap-2 p-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer text-gray-800 dark:text-gray-200 font-bold">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls._id)}
                        onChange={() => handleClassCheckbox(cls._id)}
                        className="rounded text-[#2E7D32] focus:ring-[#2E7D32]"
                      />
                      <span>{cls.grade}-{cls.section}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Updating...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VIEW TEACHER PROFILE MODAL */}
      {isViewModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2E7D32]">Teacher Profile</span>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer">
                <FaTimes />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              {selectedTeacher.photo ? (
                <img
                  src={selectedTeacher.photo}
                  alt={selectedTeacher.name}
                  className="w-14 h-14 rounded-full object-cover border border-gray-200 shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-xl shadow-sm">
                  {selectedTeacher.name ? selectedTeacher.name.charAt(0).toUpperCase() : 'T'}
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedTeacher.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 font-semibold">{selectedTeacher.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    selectedTeacher.isActive !== false && selectedTeacher.status !== 'Deactivated'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {selectedTeacher.isActive !== false && selectedTeacher.status !== 'Deactivated' ? 'Active Account' : 'Deactivated'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-gray-700 dark:text-gray-300 font-medium">
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Mobile Phone</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">{selectedTeacher.phone || 'N/A'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Qualification</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">{selectedTeacher.qualification || 'N/A'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Primary Subject</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">{selectedTeacher.subject || 'Faculty'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Joining Date</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">
                  {new Date(selectedTeacher.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Assigned Classes */}
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-1.5">
                <FaSchool className="text-[#2E7D32]" />
                <span>Assigned Classes</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedTeacher.assignedClasses && selectedTeacher.assignedClasses.length > 0 ? (
                  selectedTeacher.assignedClasses.map(cls => (
                    <span key={cls._id || cls} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                      {cls.grade && cls.section ? `${cls.grade}-${cls.section}` : 'Class'}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 italic">No classes currently assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-purple-700 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaKey />
                <span>Reset Password: {selectedTeacher.name}</span>
              </h3>
              <button onClick={() => setIsResetPasswordModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between shadow-xs">
                  <span className="flex items-center gap-2">
                    <FaExclamationTriangle className="text-red-600 shrink-0" />
                    <span>{error}</span>
                  </span>
                  <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-800">
                    <FaTimes />
                  </button>
                </div>
              )}
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">New Password *</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="Enter new password (min 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    tabIndex="-1"
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? <FaEyeSlash className="text-base" /> : <FaEye className="text-base" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Resetting...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherManagement;
