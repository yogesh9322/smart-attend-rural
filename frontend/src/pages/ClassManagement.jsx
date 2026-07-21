import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getClasses, createClass, getStudents, getTeachersList, updateClass, assignClassTeacher, transferStudents, archiveClass } from '../services/api';
import {
  FaSchool,
  FaPlus,
  FaTimes,
  FaEdit,
  FaSpinner,
  FaChalkboardTeacher,
  FaSearch,
  FaEllipsisV,
  FaEye,
  FaExchangeAlt,
  FaArchive,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUserGraduate,
  FaDoorOpen,
  FaCalendarAlt,
  FaUsers
} from 'react-icons/fa';

const ClassManagement = () => {
  const { t } = useTranslation('common');
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [academicYearFilter, setAcademicYearFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active'); // Default show active
  const [teacherFilter, setTeacherFilter] = useState('All');

  // Menu Dropdown Control
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Modals Controls
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [isAssignTeacherModalOpen, setIsAssignTeacherModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const [selectedClass, setSelectedClass] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('A');
  const [roomNo, setRoomNo] = useState('');
  const [maxStudents, setMaxStudents] = useState(40);
  const [classTeacherId, setClassTeacherId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');

  // Transfer Field
  const [targetClassId, setTargetClassId] = useState('');

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

  // Fetch all classes list
  const fetchClassesList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getClasses();
      if (res.success) {
        setClasses(res.data);
      } else {
        throw new Error(res.message || 'Failed to load classes.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading classrooms database.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch teachers list
  const fetchTeachersList = useCallback(async () => {
    try {
      const data = await getTeachersList();
      if (data.success) {
        setTeachers(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch all students list
  const fetchStudentsList = useCallback(async () => {
    try {
      const res = await getStudents();
      if (res.success) {
        setAllStudents(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchClassesList();
    fetchTeachersList();
    fetchStudentsList();
  }, [fetchClassesList, fetchTeachersList, fetchStudentsList]);

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
  const openAddModal = () => {
    setSelectedClass(null);
    setGrade('');
    setSection('A');
    setRoomNo('');
    setMaxStudents(40);
    setClassTeacherId(teachers[0]?._id || '');
    setAcademicYear('2026-2027');
    setError('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (c) => {
    setSelectedClass(c);
    setGrade(c.grade || '');
    setSection(c.section || 'A');
    setRoomNo(c.roomNo || '');
    setMaxStudents(c.maxStudents || 40);
    setClassTeacherId(c.classTeacherId?._id || c.classTeacherId || '');
    setAcademicYear(c.academicYear || '2026-2027');
    setError('');
    setActiveMenuId(null);
    setIsEditModalOpen(true);
  };

  // Open Overview Modal
  const openOverviewModal = (c) => {
    setSelectedClass(c);
    setActiveMenuId(null);
    setIsOverviewModalOpen(true);
  };

  // Open Assign Teacher Modal
  const openAssignTeacherModal = (c) => {
    setSelectedClass(c);
    setClassTeacherId(c.classTeacherId?._id || c.classTeacherId || '');
    setError('');
    setActiveMenuId(null);
    setIsAssignTeacherModalOpen(true);
  };

  // Open Transfer Modal
  const openTransferModal = (c) => {
    setSelectedClass(c);
    setTargetClassId('');
    setError('');
    setActiveMenuId(null);
    setIsTransferModalOpen(true);
  };

  // Create Class Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      const res = await createClass({
        grade,
        section,
        roomNo,
        maxStudents: Number(maxStudents) || 40,
        classTeacherId,
        academicYear
      });

      if (res.success) {
        setIsAddModalOpen(false);
        setSuccessMsg(`Class standard ${grade}-${section} created successfully`);
        fetchClassesList();
      } else {
        throw new Error(res.message || 'Creation failed.');
      }
    } catch (err) {
      setError(err.message || 'Error creating class.');
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Class Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass) return;
    setFormLoading(true);
    setError('');

    try {
      const data = await updateClass(selectedClass._id, {
        grade,
        section,
        roomNo,
        maxStudents: Number(maxStudents) || 40,
        classTeacherId,
        academicYear
      });

      if (data.success) {
        setIsEditModalOpen(false);
        setSuccessMsg(`Class ${grade}-${section} updated successfully`);
        fetchClassesList();
      } else {
        throw new Error(data.message || 'Update failed.');
      }
    } catch (err) {
      setError(err.message || 'Error updating class.');
    } finally {
      setFormLoading(false);
    }
  };

  // Assign Teacher Submit
  const handleAssignTeacherSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !classTeacherId) return;
    setFormLoading(true);
    setError('');

    try {
      const data = await assignClassTeacher(selectedClass._id, classTeacherId);

      if (data.success) {
        setIsAssignTeacherModalOpen(false);
        setSuccessMsg(data.message || 'Teacher assigned successfully');
        fetchClassesList();
      } else {
        throw new Error(data.message || 'Teacher assignment failed.');
      }
    } catch (err) {
      setError(err.message || 'Error assigning teacher.');
    } finally {
      setFormLoading(false);
    }
  };

  // Transfer Students Submit
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !targetClassId) return;
    setFormLoading(true);
    setError('');

    try {
      const data = await transferStudents(selectedClass._id, targetClassId);

      if (data.success) {
        setIsTransferModalOpen(false);
        setSuccessMsg(data.message || 'Students transferred successfully');
        fetchClassesList();
        fetchStudentsList();
      } else {
        throw new Error(data.message || 'Transfer failed.');
      }
    } catch (err) {
      setError(err.message || 'Error transferring students.');
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle Archive Status
  const handleToggleArchive = async (cls) => {
    setActiveMenuId(null);
    const actionStr = cls.isArchived || cls.status === 'Archived' ? 'reactivate' : 'archive';
    if (!window.confirm(`Are you sure you want to ${actionStr} Grade ${cls.grade}-${cls.section}?`)) return;

    try {
      const data = await archiveClass(cls._id);

      if (data.success) {
        setSuccessMsg(data.message || `Class ${actionStr}d successfully`);
        fetchClassesList();
      } else {
        throw new Error(data.message || 'Archive toggle failed.');
      }
    } catch (err) {
      setError(err.message || 'Error updating archive status.');
    }
  };

  // Extract unique options for filter selectors
  const uniqueGrades = Array.from(new Set(classes.map(c => c.grade).filter(Boolean)));
  const uniqueAcademicYears = Array.from(new Set(classes.map(c => c.academicYear).filter(Boolean)));

  // Multi-Filter Logic
  const filteredClasses = classes.filter((c) => {
    const isArchived = c.isArchived || c.status === 'Archived';

    // 1. Search Query
    const matchesSearch =
      c.grade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.section?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.roomNo && c.roomNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.classTeacherId?.name && c.classTeacherId.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Grade Filter
    const matchesGrade = gradeFilter === 'All' ? true : c.grade === gradeFilter;

    // 3. {t('classes.academicYear')} Filter
    const matchesYear = academicYearFilter === 'All' ? true : c.academicYear === academicYearFilter;

    // 4. Status Filter
    const matchesStatus =
      statusFilter === 'All' ? true :
      statusFilter === 'Active' ? !isArchived :
      isArchived;

    // 5. Class Teacher Filter
    const matchesTeacher =
      teacherFilter === 'All' ? true :
      teacherFilter === 'Unassigned' ? !c.classTeacherId :
      c.classTeacherId?._id === teacherFilter;

    return matchesSearch && matchesGrade && matchesYear && matchesStatus && matchesTeacher;
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
            <FaSchool className="text-[#2E7D32]" />
            <span>{t('classes.title')}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
            {t('classes.subtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-colors cursor-pointer"
        >
          <FaPlus />
          <span>{t('classes.createClass')}</span>
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
              placeholder={t('classes.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-650 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold text-gray-800 dark:text-white"
            />
          </div>

          {/* Grade Selector */}
          <div className="w-full sm:w-40">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="All">{t('classes.allGrades')}</option>
              {uniqueGrades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Academic Year Selector */}
          <div className="w-full sm:w-44">
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="All">{t('classes.allAcademicYears')}</option>
              {uniqueAcademicYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-36">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="Active">{t('classes.activeClasses')}</option>
              <option value="Archived">{t('classes.archived')}</option>
              <option value="All">{t('classes.allClasses')}</option>
            </select>
          </div>

          {/* Class Teacher Filter */}
          <div className="w-full sm:w-44">
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-650 rounded-xl bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
            >
              <option value="All">{t('classes.allTeachers')}</option>
              <option value="Unassigned">{t('classes.unassignedOnly')}</option>
              {teachers.map(t => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Class Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[35vh] bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-8">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#2E7D32]"></div>
          <span className="text-xs font-semibold text-gray-400 mt-3">{t('common.loading')}</span>
        </div>
      ) : filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const studentCount = cls.studentCount || 0;
            const maxCap = cls.maxStudents || 40;
            const percentFilled = Math.min(100, Math.round((studentCount / maxCap) * 100));
            const isArchived = cls.isArchived || cls.status === 'Archived';

            // Enrollment Progress Bar Color
            const progressColorClass =
              percentFilled >= 100 ? 'bg-red-500' :
              percentFilled >= 85 ? 'bg-amber-500' :
              'bg-[#2E7D32]';

            return (
              <div
                key={cls._id}
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between relative cursor-pointer"
                onClick={() => openOverviewModal(cls)}
              >
                <div>
                  {/* Card Header: Grade & Status + 3-Dot Menu */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-black text-sm">
                        <FaSchool />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-[#2E7D32] dark:group-hover:text-green-400 transition">
                          {cls.grade} - {cls.section}
                        </h3>
                        <span className="text-[11px] text-gray-400 font-medium block">
                          {t('classes.academicYear')}: {cls.academicYear || '2026-2027'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {/* Status Pill */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        isArchived ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isArchived ? t('classes.archived') : t('common.active')}
                      </span>

                      {/* 3-Dot Menu Button */}
                      <div className="relative" ref={activeMenuId === cls._id ? menuRef : null}>
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === cls._id ? null : cls._id)}
                          title="Actions Menu"
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-white transition cursor-pointer"
                        >
                          <FaEllipsisV className="text-xs" />
                        </button>

                        {/* Floating Action Menu Dropdown */}
                        {activeMenuId === cls._id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 divide-y divide-gray-100 dark:divide-gray-800 text-left">
                            <div className="py-1">
                              <button
                                onClick={() => openOverviewModal(cls)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                              >
                                <FaEye className="text-blue-500" />
                                <span>{t('students.viewFullProfile') || 'View Details'}</span>
                              </button>

                              <button
                                onClick={() => openAssignTeacherModal(cls)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                              >
                                <FaChalkboardTeacher className="text-teal-500" />
                                <span>{t('classes.teacher') || 'Assign Teacher'}</span>
                              </button>

                              <button
                                onClick={() => openTransferModal(cls)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                              >
                                <FaExchangeAlt className="text-purple-500" />
                                <span>{t('classes.transferStudents')}</span>
                              </button>

                              <button
                                onClick={() => openEditModal(cls)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                              >
                                <FaEdit className="text-amber-500" />
                                <span>{t('classes.editTitle') || 'Edit Class'}</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => handleToggleArchive(cls)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                              >
                                <FaArchive className="text-red-500" />
                                <span>{isArchived ? t('classes.reactivateClass') : t('classes.archiveClass')}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Key Metrics */}
                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 font-medium pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <FaChalkboardTeacher /> {t('classes.teacher')}:
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {cls.classTeacherId?.name || 'Unassigned'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <FaDoorOpen /> {t('classes.location') || 'Room Location'}:
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {t('classes.room') || 'Room'} {cls.roomNo || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enrollment Progress Bar & Count */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <FaUsers className="text-[#2E7D32]" /> {t('classes.maxStudents') || 'Enrollment Capacity'}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {studentCount} / {maxCap} {t('nav.students')}
                    </span>
                  </div>

                  {/* Small Enrollment Progress Bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-[#2E7D32] transition-all duration-300 ${progressColorClass}`}
                      style={{ width: `${percentFilled}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-2xl shadow-xs text-gray-400">
          <FaSchool className="mx-auto text-4xl text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('classes.noRecords')}</p>
          <p className="text-xs text-gray-400 mt-1">Try matching search terms or create a new class.</p>
        </div>
      )}

      {/* 1. CREATE CLASS MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-[#2E7D32] text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaPlus />
                <span>{t('classes.addTitle')}</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">{t('classes.grade')} *</label>
                  <input
                    type="text"
                    required
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. Grade 6"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">{t('classes.section') || 'Section'} *</label>
                  <input
                    type="text"
                    required
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">{t('classes.room') || 'Room Number'}</label>
                  <input
                    type="text"
                    value={roomNo}
                    onChange={(e) => setRoomNo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g. 102"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">{t('classes.maxStudents') || 'Max Capacity'}</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={maxStudents}
                    onChange={(e) => setMaxStudents(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">{t('classes.teacher')} *</label>
                <select
                  required
                  value={classTeacherId}
                  onChange={(e) => setClassTeacherId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                >
                  <option value="">{t('classes.teacher') === 'वर्ग शिक्षक' ? 'शिक्षक चुनें...' : 'Select class teacher...'}</option>
                  {teachers.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.subject || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  placeholder="e.g. 2026-2027"
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
                  {formLoading ? t('common.loading') : t('classes.saveClass')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT CLASS MODAL */}
      {isEditModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-amber-600 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaEdit />
                <span>{t('classes.editTitle')}: {selectedClass.grade}-{selectedClass.section}</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Grade / Standard *</label>
                  <input
                    type="text"
                    required
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Section *</label>
                  <input
                    type="text"
                    required
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={roomNo}
                    onChange={(e) => setRoomNo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={maxStudents}
                    onChange={(e) => setMaxStudents(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Assigned Class Teacher *</label>
                <select
                  required
                  value={classTeacherId}
                  onChange={(e) => setClassTeacherId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                >
                  <option value="">Select class teacher...</option>
                  {teachers.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.subject || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
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
                  {formLoading ? t('common.loading') : t('classes.saveClass')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DETAILED CLASS OVERVIEW MODAL */}
      {isOverviewModalOpen && selectedClass && (() => {
        const classStudents = allStudents.filter(s => {
          const cId = s.classId?._id || s.classId;
          return cId === selectedClass._id;
        });
        const maxCap = selectedClass.maxStudents || 40;
        const count = classStudents.length;
        const percentFilled = Math.min(100, Math.round((count / maxCap) * 100));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 p-6 space-y-5 text-xs">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-lg">
                    <FaSchool />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {t('classes.title')}: {selectedClass.grade} - {selectedClass.section}
                    </h3>
                    <p className="text-gray-400 text-xs font-semibold">
                      {t('classes.room') || 'Room'} {selectedClass.roomNo || 'N/A'} • {t('classes.academicYear')}: {selectedClass.academicYear || '2026-2027'}
                    </p>
                  </div>
                </div>

                <button onClick={() => setIsOverviewModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer">
                  <FaTimes />
                </button>
              </div>

              {/* Class Teacher & Capacity Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Teacher Card */}
                <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Class Teacher</span>
                  <div className="flex items-center gap-3">
                    {selectedClass.classTeacherId?.photo ? (
                      <img src={selectedClass.classTeacherId.photo} alt="Teacher" className="w-10 h-10 rounded-full object-cover border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#2E7D32] flex items-center justify-center font-bold">
                        <FaChalkboardTeacher />
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white block text-sm">
                        {selectedClass.classTeacherId?.name || 'Unassigned'}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {selectedClass.classTeacherId?.email || 'No email'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Capacity Card */}
                <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('classes.maxStudents') || 'Enrollment Roster Status'}</span>
                  <div className="flex justify-between items-center text-sm font-extrabold text-gray-900 dark:text-white mt-1">
                    <span>{count} / {maxCap} {t('nav.students')}</span>
                    <span className="text-xs text-[#2E7D32]">{percentFilled}% Filled</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2 overflow-hidden">
                    <div className="h-[#2E7D32] transition-all" style={{ width: `${percentFilled}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Enrolled Students Roster List */}
              <div>
                <h4 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center justify-between">
                  <span>{t('classes.transferStudents') === 'विद्यार्थ्यांचे स्थलांतर करा' ? 'नोंदणीकृत विद्यार्थी' : 'Enrolled Student Roster'} ({classStudents.length})</span>
                </h4>

                {classStudents.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                      <thead className="bg-gray-100 dark:bg-gray-700 font-bold text-gray-600 dark:text-gray-300">
                        <tr>
                          <th className="px-4 py-2 text-left">{t('students.rollNo')}</th>
                          <th className="px-4 py-2 text-left">{t('common.name')}</th>
                          <th className="px-4 py-2 text-left">{t('students.gender')}</th>
                          <th className="px-4 py-2 text-left">{t('parents.title')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                        {classStudents.map((st) => (
                          <tr key={st._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-2 font-bold text-[#2E7D32]">{st.rollNo || st.rollNumber || 'N/A'}</td>
                            <td className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200">{st.name}</td>
                            <td className="px-4 py-2 text-gray-500 capitalize">{st.gender || 'N/A'}</td>
                            <td className="px-4 py-2 text-gray-500">{st.parentId?.name || 'Unlinked'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center bg-gray-50 dark:bg-gray-750 border border-gray-200 rounded-xl text-gray-400 italic">
                    {t('classes.noStudents')}
                  </div>
                )}
              </div>

              {/* Action Toolbar Inside Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-700">
                <button
                  onClick={() => { setIsOverviewModalOpen(false); openAssignTeacherModal(selectedClass); }}
                  className="px-3.5 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-xl font-bold transition cursor-pointer"
                >
                  Assign Teacher
                </button>
                <button
                  onClick={() => { setIsOverviewModalOpen(false); openTransferModal(selectedClass); }}
                  className="px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl font-bold transition cursor-pointer"
                >
                  Transfer Students
                </button>
                <button
                  onClick={() => { setIsOverviewModalOpen(false); openEditModal(selectedClass); }}
                  className="px-3.5 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl font-bold transition cursor-pointer"
                >
                  Edit Class
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. ASSIGN TEACHER MODAL */}
      {isAssignTeacherModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-teal-700 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaChalkboardTeacher />
                <span>{t('classes.teacher') || 'Assign Teacher'}: Grade {selectedClass.grade}-{selectedClass.section}</span>
              </h3>
              <button onClick={() => setIsAssignTeacherModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAssignTeacherSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">{t('classes.teacher')} *</label>
                <select
                  required
                  value={classTeacherId}
                  onChange={(e) => setClassTeacherId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                >
                  <option value="">{t('classes.teacher') === 'वर्ग शिक्षक' ? 'शिक्षक चुनें...' : 'Select teacher...'}</option>
                  {teachers.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.subject || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsAssignTeacherModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? t('common.loading') : t('classes.teacher')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. TRANSFER STUDENTS MODAL */}
      {isTransferModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 bg-purple-700 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaExchangeAlt />
                <span>{t('classes.transferStudents')} from Grade {selectedClass.grade}-{selectedClass.section}</span>
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-white hover:text-gray-200 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">{t('classes.transferStudents') === 'विद्यार्थ्यांचे स्थलांतर करा' ? 'लक्ष्य वर्ग' : 'Target Destination Class'} *</label>
                <select
                  required
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold"
                >
                  <option value="">{t('classes.transferStudents') === 'विद्यार्थ्यांचे स्थलांतर करा' ? 'लक्ष्य वर्ग निवडा...' : 'Select destination class...'}</option>
                  {classes
                    .filter(c => c._id !== selectedClass._id)
                    .map(c => (
                      <option key={c._id} value={c._id}>
                        Grade {c.grade}-{c.section} ({c.studentCount || 0}/{c.maxStudents || 40} {t('classes.transferStudents') === 'विद्यार्थ्यांचे स्थलांतर करा' ? 'नोंदणीकृत' : 'Enrolled'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-xl text-[11px] font-medium text-amber-800 dark:text-amber-300">
                ⚠️ {t('classes.transferStudents') === 'विद्यार्थ्यांचे स्थलांतर करा' ? 'या वर्गातील सर्व विद्यार्थ्यांना निवडलेल्या वर्गात हलवले जाईल.' : 'All students currently in this class will be moved to the selected destination class.'}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !targetClassId}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? t('common.loading') : t('classes.transferStudents')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
