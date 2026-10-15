import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getStudents, getClasses, getParentsList, getParentDetails, createParent, updateParent, deleteParent, linkChildToParent, unlinkChildFromParent, toggleParentStatus, resetParentPassword } from '../services/api';
import {
  FaUserPlus,
  FaSearch,
  FaTimes,
  FaSpinner,
  FaEllipsisV,
  FaEye,
  FaEyeSlash,
  FaEdit,
  FaKey,
  FaPowerOff,
  FaTrashAlt,
  FaLink,
  FaUnlink,
  FaUserCircle,
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa';

const ParentManagement = () => {
  const { t } = useTranslation('common');
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const [villageFilter, setVillageFilter] = useState('All');
  const [childrenFilter, setChildrenFilter] = useState('All');

  // Menu Dropdown State
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Modals Controls
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');

  // Link Child Field
  const [selectedStudentId, setSelectedStudentId] = useState('');
  // Reset Password Field
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // Fetch all parents
  const fetchParents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getParentsList();
      if (data.success) {
        setParents(data.data);
        setError('');
      } else {
        throw new Error(data.message || 'Failed to load parents.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading parent database.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch students for linking
  const fetchStudentsList = useCallback(async () => {
    try {
      const res = await getStudents();
      if (res.success) {
        setStudents(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch classes list for class filter dropdown
  const fetchClassesList = useCallback(async () => {
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
    fetchParents();
    fetchStudentsList();
    fetchClassesList();
  }, [fetchParents, fetchStudentsList, fetchClassesList]);

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
    setSelectedParent(null);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setPhone('');
    setOccupation('');
    setVillage('');
    setAddress('');
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
  const openEditModal = (p) => {
    setSelectedParent(p);
    setName(p.name || '');
    setEmail(p.email || '');
    setPhone(p.phone || '');
    setOccupation(p.occupation || '');
    setVillage(p.village || '');
    setAddress(p.address || '');
    setError('');
    setActiveMenuId(null);
    setIsEditModalOpen(true);
  };

  // Open View Modal
  const openViewModal = (p) => {
    setSelectedParent(p);
    setActiveMenuId(null);
    setIsViewModalOpen(true);
  };

  // Open Link Modal
  const openLinkModal = (p) => {
    setSelectedParent(p);
    setSelectedStudentId('');
    setError('');
    setActiveMenuId(null);
    setIsLinkModalOpen(true);
  };

  // Open Reset Password Modal
  const openResetPasswordModal = (p) => {
    setSelectedParent(p);
    setNewPassword('');
    setShowResetPassword(false);
    setError('');
    setActiveMenuId(null);
    setIsResetPasswordModalOpen(true);
  };

  // Handle Add Parent Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      const data = await createParent({
        name,
        email,
        password: password || 'password123',
        phone,
        occupation,
        village,
        address
      });

      if (data.success) {
        setIsAddModalOpen(false);
        setSuccessMsg(`Parent account created for ${name}`);
        fetchParents();
      } else {
        throw new Error(data.message || 'Action failed.');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message || 'Error processing request.';
      setError(serverMsg);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Edit Parent Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParent) return;
    setFormLoading(true);
    setError('');

    try {
      const data = await updateParent(selectedParent._id, {
        name,
        email,
        phone,
        occupation,
        village,
        address
      });

      if (data.success) {
        setIsEditModalOpen(false);
        setSuccessMsg(`Parent profile updated for ${name}`);
        fetchParents();
      } else {
        throw new Error(data.message || 'Update failed.');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message || 'Error updating profile.';
      setError(serverMsg);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Link Child Submit
  const handleLinkChild = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedParent) return;

    setFormLoading(true);

    try {
      const data = await linkChildToParent(selectedParent._id, selectedStudentId);

      if (data.success) {
        setSuccessMsg('Child linked successfully');
        setSelectedStudentId('');
        fetchParents();
        // Update selectedParent reference
        const updatedParentData = await getParentDetails(selectedParent._id);
        if (updatedParentData.success) {
          setSelectedParent(updatedParentData.data);
        }
      } else {
        throw new Error(data.message || 'Linking failed.');
      }
    } catch (err) {
      setError(err.message || 'Error linking child.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Unlink Child
  const handleUnlinkChild = async (studentId, studentName) => {
    if (!selectedParent) return;
    if (!window.confirm(`Unlink ${studentName} from ${selectedParent.name}?`)) return;

    setFormLoading(true);

    try {
      const data = await unlinkChildFromParent(selectedParent._id, studentId);

      if (data.success) {
        setSuccessMsg(`Unlinked ${studentName} successfully`);
        fetchParents();
        // Refresh selectedParent inside modal
        const updatedParentData = await getParentDetails(selectedParent._id);
        if (updatedParentData.success) {
          setSelectedParent(updatedParentData.data);
        }
      } else {
        throw new Error(data.message || 'Unlinking failed.');
      }
    } catch (err) {
      setError(err.message || 'Error unlinking child.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Toggle Account Status
  const handleToggleStatus = async (parent) => {
    setActiveMenuId(null);
    try {
      const data = await toggleParentStatus(parent._id);

      if (data.success) {
        const isNowActive = data.data.isActive !== false && data.data.status !== 'Deactivated';
        setSuccessMsg(`Parent account for ${parent.name} is now ${isNowActive ? 'Active' : 'Deactivated'}`);
        fetchParents();
      } else {
        throw new Error(data.message || 'Status toggle failed.');
      }
    } catch (err) {
      setError(err.message || 'Error updating status.');
    }
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParent || !newPassword) return;
    setFormLoading(true);
    setError('');

    try {
      const data = await resetParentPassword(selectedParent._id, { newPassword });

      if (data.success) {
        setIsResetPasswordModalOpen(false);
        setSuccessMsg(`Password reset successfully for ${selectedParent.name}`);
      } else {
        throw new Error(data.message || 'Password reset failed.');
      }
    } catch (err) {
      setError(err.message || 'Error resetting password.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Delete Parent (Direct Delete)
  const handleDeleteParent = async (parent) => {
    setActiveMenuId(null);
    if (!window.confirm(`Are you sure you want to delete parent "${parent.name}"?`)) return;

    try {
      const data = await deleteParent(parent._id);
      if (data.success) {
        setSuccessMsg(`Parent ${parent.name} deleted successfully.`);
        fetchParents();
      } else {
        throw new Error(data.message || 'Delete failed.');
      }
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  };

  // Extract unique villages list
  const uniqueVillages = Array.from(new Set(parents.map(p => p.village).filter(Boolean)));

  // Multi-Filter Logic
  const filteredParents = parents.filter((p) => {
    // 1. Search Query
    const matchesSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery));

    // 2. Account Status Filter
    const isParentActive = p.isActive !== false && p.status !== 'Deactivated';
    const isPending = p.status === 'Pending Verification';
    const matchesStatus =
      statusFilter === 'All' ? true :
      statusFilter === 'Active' ? isParentActive :
      statusFilter === 'Pending' ? isPending :
      !isParentActive;

    // 3. Class Filter
    const matchesClass =
      classFilter === 'All' ? true :
      p.children && p.children.some(child => {
        const clsId = child.classId?._id || child.classId;
        return clsId === classFilter;
      });

    // 4. Village Filter
    const matchesVillage =
      villageFilter === 'All' ? true :
      p.village?.toLowerCase() === villageFilter.toLowerCase();

    // 5. Children Count Filter
    const childCount = p.children ? p.children.length : 0;
    const matchesChildren =
      childrenFilter === 'All' ? true :
      childrenFilter === 'None' ? childCount === 0 :
      childrenFilter === '1' ? childCount === 1 :
      childCount >= 2;

    return matchesSearch && matchesStatus && matchesClass && matchesVillage && matchesChildren;
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
            <FaUserCircle className="text-[#2E7D32]" />
            <span>{t('parents.title')}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
            {t('parents.subtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-colors cursor-pointer"
        >
          <FaUserPlus />
          <span>{t('parents.addParent')}</span>
        </button>
      </div>

      {/* Multi-Filter Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Field */}
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <FaSearch className="text-xs" />
            </div>
            <input
              type="text"
              placeholder="Search by parent name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-650 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold text-gray-800 dark:text-white"
            />
          </div>

          {/* Status Selector */}
          <div className="w-full sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Deactivated">Deactivated</option>
            </select>
          </div>

          {/* Class Filter */}
          <div className="w-full sm:w-44">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="All">All Classes</option>
              {classList.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.grade}-{cls.section}
                </option>
              ))}
            </select>
          </div>

          {/* Village Filter */}
          <div className="w-full sm:w-44">
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="All">All Villages</option>
              {uniqueVillages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Children Count Filter */}
          <div className="w-full sm:w-44">
            <select
              value={childrenFilter}
              onChange={(e) => setChildrenFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="All">All Children</option>
              <option value="1">1 Child</option>
              <option value="2+">2+ Children</option>
              <option value="None">No Children Linked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Parents Clean ERP Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[35vh] bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-8">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#2E7D32]"></div>
          <span className="text-xs font-semibold text-gray-400 mt-3">Loading parents directory...</span>
        </div>
      ) : filteredParents.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50/70 dark:bg-gray-750">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">PARENT INFO</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">OCCUPATION & VILLAGE</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">LINKED CHILDREN</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                  <th className="px-6 py-3.5 text-center text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-150 dark:divide-gray-700">
                {filteredParents.map((p) => {
                  const isParentActive = p.isActive !== false && p.status !== 'Deactivated';
                  const hasChildren = p.children && p.children.length > 0;

                  return (
                    <tr key={p._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/40 transition">
                      {/* Parent Info - Clickable Name opens View Profile */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openViewModal(p)}
                            title="Click to view detailed profile"
                            className="group flex items-center gap-3 text-left cursor-pointer focus:outline-none"
                          >
                            {p.photo ? (
                              <img
                                src={p.photo}
                                alt={p.name}
                                className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-xs group-hover:border-[#2E7D32] transition"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-sm shadow-xs group-hover:scale-105 transition">
                                {p.name ? p.name.charAt(0).toUpperCase() : 'P'}
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#2E7D32] dark:group-hover:text-green-400 transition flex items-center gap-1">
                                <span>{p.name}</span>
                              </div>
                              <div className="text-xs text-gray-400 font-medium">
                                {p.email} • {p.phone || 'No phone'}
                              </div>
                            </div>
                          </button>
                        </div>
                      </td>

                      {/* Occupation & Village */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{p.occupation || 'N/A'}</div>
                        <div className="text-xs text-gray-400 font-medium mt-0.5">{p.village || 'N/A'}</div>
                      </td>

                      {/* Linked Children Badges - Clean text without icon sign */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {hasChildren ? (
                            p.children.map((child) => (
                              <span
                                key={child._id}
                                title={`Roll: ${child.rollNo || child.rollNumber || 'N/A'} | Class: ${child.classId?.grade ? `${child.classId.grade}-${child.classId.section}` : 'Unassigned'}`}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600"
                              >
                                <span>{child.name}</span>
                                {child.classId?.grade && (
                                  <span className="text-[10px] text-gray-400 font-medium ml-1">({child.classId.grade}-{child.classId.section})</span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 font-normal italic">No Children Linked</span>
                          )}
                        </div>
                      </td>

                      {/* Account Status Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                            isParentActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isParentActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          <span>{isParentActive ? 'Active' : 'Deactivated'}</span>
                        </span>
                      </td>

                      {/* Actions Menu (3-dot ⋮) */}
                      <td className="px-6 py-4 whitespace-nowrap text-center relative">
                        <div className="inline-block text-left" ref={activeMenuId === p._id ? menuRef : null}>
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === p._id ? null : p._id)}
                            title="Actions Menu"
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 transition cursor-pointer"
                          >
                            <FaEllipsisV className="text-xs" />
                          </button>

                          {/* Floating Action Dropdown Menu */}
                          {activeMenuId === p._id && (
                            <div className="absolute right-6 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 divide-y divide-gray-100 dark:divide-gray-800 text-left">
                              <div className="py-1">
                                {/* View Profile */}
                                <button
                                  onClick={() => openViewModal(p)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                                >
                                  <FaEye className="text-blue-500" />
                                  <span>View Profile</span>
                                </button>

                                {/* Edit Parent */}
                                <button
                                  onClick={() => openEditModal(p)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                                >
                                  <FaEdit className="text-amber-500" />
                                  <span>Edit Parent</span>
                                </button>

                                {/* Link / Unlink Child */}
                                <button
                                  onClick={() => openLinkModal(p)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                                >
                                  <FaLink className="text-teal-500" />
                                  <span>Link / Unlink Child</span>
                                </button>

                                {/* Reset Password */}
                                <button
                                  onClick={() => openResetPasswordModal(p)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                                >
                                  <FaKey className="text-purple-500" />
                                  <span>Reset Password</span>
                                </button>
                              </div>

                              <div className="py-1">
                                {/* Activate / Deactivate */}
                                <button
                                  onClick={() => handleToggleStatus(p)}
                                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer ${
                                    isParentActive ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  <FaPowerOff />
                                  <span>{isParentActive ? 'Deactivate Account' : 'Activate Account'}</span>
                                </button>

                                {/* Delete Parent - Always Available */}
                                <button
                                  onClick={() => handleDeleteParent(p)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                                >
                                  <FaTrashAlt />
                                  <span>Delete Parent</span>
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
          <FaUserCircle className="mx-auto text-4xl text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No parent records found</p>
          <p className="text-xs text-gray-400 mt-1">Try matching search terms or filters.</p>
        </div>
      )}

      {/* 1. ADD PARENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-[#2E7D32] text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaUserPlus />
                <span>Add New Parent Account</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Parent Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. Sanjay Pawar"
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
                    placeholder="parent@email.com"
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
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Password *</label>
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
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. Farmer, Merchant"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Village</label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. Khed"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Full Postal Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  placeholder="Street, house number, landmarks..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Parent Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT PARENT MODAL */}
      {isEditModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-amber-600 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaEdit />
                <span>Edit Parent: {selectedParent.name}</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Parent Full Name *</label>
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
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Occupation</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Village</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Full Postal Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VIEW PARENT PROFILE MODAL */}
      {isViewModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2E7D32]">Parent Profile</span>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer">
                <FaTimes />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              {selectedParent.photo ? (
                <img
                  src={selectedParent.photo}
                  alt={selectedParent.name}
                  className="w-14 h-14 rounded-full object-cover border border-gray-200 shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-xl shadow-sm">
                  {selectedParent.name ? selectedParent.name.charAt(0).toUpperCase() : 'P'}
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedParent.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 font-semibold">{selectedParent.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    selectedParent.isActive !== false && selectedParent.status !== 'Deactivated'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {selectedParent.isActive !== false && selectedParent.status !== 'Deactivated' ? 'Active Account' : 'Deactivated'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-gray-700 dark:text-gray-300 font-medium">
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Mobile Phone</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">{selectedParent.phone || 'N/A'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Occupation</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">{selectedParent.occupation || 'N/A'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Village</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">{selectedParent.village || 'N/A'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Address</span>
                <span className="font-bold text-gray-800 dark:text-white text-xs mt-0.5 block">{selectedParent.address || 'N/A'}</span>
              </div>
            </div>

            {/* Linked Children */}
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white mb-2">
                Linked Children ({selectedParent.children ? selectedParent.children.length : 0})
              </h4>
              <div className="space-y-2">
                {selectedParent.children && selectedParent.children.length > 0 ? (
                  selectedParent.children.map(child => (
                    <div key={child._id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#2E7D32] flex items-center justify-center font-bold text-xs">
                          {child.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block text-xs">{child.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium">Roll: {child.rollNo || child.rollNumber || 'N/A'} | Class: {child.classId?.grade ? `${child.classId.grade}-${child.classId.section}` : 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-gray-400 italic block">No children linked to this parent</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LINK / UNLINK CHILD MODAL */}
      {isLinkModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaLink className="text-teal-600" />
                <span>Manage Linked Children: {selectedParent.name}</span>
              </h3>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer">
                <FaTimes />
              </button>
            </div>

            {/* Currently Linked Children */}
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white mb-2">Currently Linked Children</h4>
              {selectedParent.children && selectedParent.children.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedParent.children.map((child) => (
                    <div key={child._id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 dark:text-gray-200">{child.name}</span>
                        {child.classId?.grade && (
                          <span className="text-[10px] text-gray-400 font-semibold">({child.classId.grade}-{child.classId.section})</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnlinkChild(child._id, child.name)}
                        disabled={formLoading}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-bold border border-red-200 transition cursor-pointer"
                      >
                        <FaUnlink className="inline mr-1" /> Unlink
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic">No children linked yet.</p>
              )}
            </div>

            {/* Link New Student Form */}
            <form onSubmit={handleLinkChild} className="pt-3 border-t border-gray-150 dark:border-gray-700 space-y-3">
              <h4 className="font-bold text-gray-800 dark:text-white">Link New Student</h4>
              <div>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                >
                  <option value="">Select a student to link...</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} (Roll: {s.rollNo || s.rollNumber || 'N/A'}, Class: {s.classId?.grade ? `${s.classId.grade}-${s.classId.section}` : 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !selectedStudentId}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Linking...' : 'Link Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-purple-700 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaKey />
                <span>Reset Password: {selectedParent.name}</span>
              </h3>
              <button onClick={() => setIsResetPasswordModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4 text-xs">
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
                    tabIndex={-1}
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none cursor-pointer"
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
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

export default ParentManagement;
