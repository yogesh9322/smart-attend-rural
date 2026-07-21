import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getStudents, getClasses, createStudent, updateStudent, deleteStudent, getStudentDetails, getAttendanceReport, getParentsAuthList } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FaUserPlus,
  FaSearch,
  FaEdit,
  FaTrashAlt,
  FaTimes,
  FaSpinner,
  FaUserCircle,
  FaEye
} from 'react-icons/fa';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : `http://${window.location.hostname}:5000`;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};

const StudentManagement = () => {
  const { t } = useTranslation('common');
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin';

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [classId, setClassId] = useState('');
  const [parentId, setParentId] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [status, setStatus] = useState('Active');

  // Student Profile Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentAttendanceSummary, setStudentAttendanceSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    pct: 100
  });

  const fetchRosters = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (classFilter) filters.classId = classFilter;
      if (searchQuery) filters.search = searchQuery;

      const res = await getStudents(filters);
      if (res.success) {
        setStudents(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Error loading student database.');
    } finally {
      setLoading(false);
    }
  }, [classFilter, searchQuery]);

  useEffect(() => {
    fetchRosters();
  }, [fetchRosters]);

  // Load auxiliary metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const classesRes = await getClasses();
        if (classesRes.success) {
          setClasses(classesRes.data);
        }
      } catch (err) {
        console.error('Error fetching standard metadata:', err);
      }
    };
    loadMetadata();
  }, []);

  // Fetch parent users list
  useEffect(() => {
    const fetchParents = async () => {
      try {
        const data = await getParentsAuthList();
        if (data.success) {
          setParents(data.data);
          if (data.data.length > 0 && !parentId) {
            setParentId(data.data[0]._id);
          }
        }
      } catch (error) {
        console.error('Error fetching parent list:', error);
      }
    };
    if (isAdmin && isModalOpen) {
      fetchParents();
    }
  }, [isModalOpen, isAdmin, parentId]);

  // Open Student Profile Drawer
  const openStudentDrawer = async (studentOrId) => {
    const studentObj = typeof studentOrId === 'object' ? studentOrId : students.find(s => s._id === studentOrId);
    const targetId = typeof studentOrId === 'string' ? studentOrId : studentOrId?._id;

    if (studentObj) {
      setSelectedStudent(studentObj);
    }
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      // 1. Fetch single student full profile if needed
      try {
        const sData = await getStudentDetails(targetId);
        if (sData.success && sData.data) {
          setSelectedStudent(sData.data);
        }
      } catch (sErr) {
        console.warn('Student details fetch warning:', sErr);
      }

      // 2. Fetch live attendance summary for this student
      try {
        const aData = await getAttendanceReport({ studentId: targetId });
        if (aData.success && Array.isArray(aData.data)) {
          const recs = aData.data;
          const present = recs.filter(r => r.status === 'Present').length;
          const absent = recs.filter(r => r.status === 'Absent').length;
          const late = recs.filter(r => r.status === 'Late').length;
          const leave = recs.filter(r => r.status === 'Leave' || r.status === 'Excused').length;
          const total = recs.length;
          const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

          setStudentAttendanceSummary({ present, absent, late, leave, pct, total, hasRecords: total > 0 });
        }
      } catch (aErr) {
        console.warn('Attendance summary fetch warning:', aErr);
      }
    } catch (err) {
      console.error('Drawer fetch error:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setName('');
    setRollNo('');
    setAdmissionNo('');
    setClassId(classes[0]?._id || '');
    setParentId(parents[0]?._id || '');
    setGender('Male');
    setDob('');
    setPhotoFile(null);
    setStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student._id);
    setName(student.name);
    setRollNo(student.rollNo);
    setAdmissionNo(student.admissionNo);
    setClassId(student.classId?._id || '');
    setParentId(student.parentId?._id || '');
    setGender(student.gender || 'Male');
    setDob(student.dob ? student.dob.split('T')[0] : '');
    setPhotoFile(null);
    setStatus(student.status || 'Active');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    if (!parentId || parentId === 'parent_seed_id_placeholder') {
      setError('Please select a valid parent contact.');
      setFormLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('rollNo', rollNo);
    formData.append('admissionNo', admissionNo);
    formData.append('classId', classId);
    formData.append('parentId', parentId);
    formData.append('gender', gender);
    if (dob) formData.append('dob', dob);
    if (photoFile) formData.append('photo', photoFile);
    formData.append('status', status);

    try {
      let res;
      if (editingStudent) {
        res = await updateStudent(editingStudent, formData);
      } else {
        res = await createStudent(formData);
      }

      if (res.success) {
        setIsModalOpen(false);
        fetchRosters();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error processing request.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you absolutely sure you want to delete this student record? This cannot be undone.')) return;

    try {
      const res = await deleteStudent(id);
      if (res.success) {
        fetchRosters();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete student.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Student Records</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            Showing <strong className="text-[#2E7D32] dark:text-green-400">{students.length}</strong> Students in school database.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <FaUserPlus />
            <span>Add Student</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs flex flex-col sm:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <FaSearch className="text-xs" />
          </div>
          <input
            type="text"
            placeholder="Search by Name or Roll Number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-medium bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Class Filter */}
        <div className="w-full sm:w-48">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-750 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs text-gray-700 dark:text-gray-200 font-semibold"
          >
            <option value="">{isAdmin ? 'All Classes' : 'All Assigned Classes'}</option>
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.grade} - {cls.section}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Student Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E7D32]"></div>
        </div>
      ) : students.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-150 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-850">
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Photo</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Roll Number</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Admission Number</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Student Name</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Class</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Parent Name</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mobile Number</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-150 dark:divide-gray-700">
                {students.map((student) => (
                  <tr key={student._id} className="hover:bg-gray-50/70 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div
                        onClick={() => openStudentDrawer(student)}
                        className="cursor-pointer inline-block"
                        title="Click to view profile"
                      >
                        {student.photoUrl ? (
                          <img
                            src={getMediaUrl(student.photoUrl)}
                            alt={student.name}
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-2xs hover:opacity-90"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-gray-700">
                            {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-bold text-gray-700 dark:text-gray-300">{student.rollNo}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-bold text-gray-700 dark:text-gray-300">{student.admissionNo}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <button
                        onClick={() => openStudentDrawer(student)}
                        className="text-xs font-bold text-gray-900 dark:text-white hover:text-[#2E7D32] dark:hover:text-green-400 hover:underline text-left cursor-pointer"
                      >
                        {student.name}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300 font-semibold">
                      {student.classId ? `${student.classId.grade} - ${student.classId.section}` : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {student.parentId ? student.parentId.name : <span className="text-gray-400 italic">Unlinked</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-gray-600 dark:text-gray-400">
                      {student.parentId?.phone || student.parentId?.phoneNumber || 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border ${
                        student.status === 'Inactive'
                          ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900'
                          : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span>{student.status || 'Active'}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-center text-xs font-medium space-x-1.5">
                      <button
                        onClick={() => openStudentDrawer(student)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-[#2E7D32] dark:text-green-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-[11px] font-bold cursor-pointer transition"
                        title="View Student Profile"
                      >
                        <FaEye className="text-[10px]" />
                        <span>View</span>
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(student)}
                            className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md cursor-pointer transition"
                            title="Edit Record"
                          >
                            <FaEdit className="text-xs" />
                          </button>
                          <button
                            onClick={() => handleDelete(student._id)}
                            className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 dark:hover:bg-gray-700 rounded-md cursor-pointer transition"
                            title="Delete Record"
                          >
                            <FaTrashAlt className="text-xs" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xs text-gray-400 text-xs font-medium">
          No student records found in database.
        </p>
      )}

      {/* STUDENT PROFILE QUICK VIEW DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col overflow-hidden border-l border-gray-200 dark:border-gray-800 animate-slideLeft">
            
            {/* Drawer Header Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-850">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Student Profile Quick View
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>

            {/* Drawer Body */}
            {drawerLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <FaSpinner className="animate-spin text-2xl text-[#2E7D32]" />
                <p className="text-xs font-semibold text-gray-400">Fetching live database records...</p>
              </div>
            ) : selectedStudent ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-left">
                
                {/* HEADER CARD */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-4">
                  {selectedStudent.photoUrl ? (
                    <img
                      src={getMediaUrl(selectedStudent.photoUrl)}
                      alt={selectedStudent.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#2E7D32] shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#2E7D32] flex items-center justify-center font-bold text-xl border-2 border-[#2E7D32] shrink-0">
                      {selectedStudent.name ? selectedStudent.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {selectedStudent.name}
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium space-y-0.5">
                      <p>Admission No: <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.admissionNo}</strong></p>
                      <p>Roll No: <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.rollNo}</strong></p>
                    </div>
                    <div className="pt-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedStudent.status === 'Inactive'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span>{selectedStudent.status || 'Active'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* STUDENT INFORMATION */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-850 space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-1.5 border-b border-gray-150 dark:border-gray-750">
                    Student Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Full Name</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.name}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Admission Number</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.admissionNo}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Roll Number</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.rollNo}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Class & Section</span>
                      <strong className="text-gray-800 dark:text-gray-200">
                        {selectedStudent.classId ? `${selectedStudent.classId.grade} - ${selectedStudent.classId.section}` : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Academic Year</span>
                      <strong className="text-gray-800 dark:text-gray-200">2025-2026</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Date of Birth</span>
                      <strong className="text-gray-800 dark:text-gray-200">
                        {selectedStudent.dob ? new Date(selectedStudent.dob).toLocaleDateString() : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Gender</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.gender || 'Male'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Blood Group</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.bloodGroup || 'O+'}</strong>
                    </div>
                  </div>
                </div>

                {/* PARENT INFORMATION */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-850 space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-1.5 border-b border-gray-150 dark:border-gray-750">
                    Parent Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Parent Name</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.parentId?.name || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Relationship</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.parentId?.relationship || 'Father'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Mobile Number</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.parentId?.phone || selectedStudent.parentId?.phoneNumber || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Alternate Mobile</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.parentId?.alternatePhone || 'N/A'}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Email Address</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.parentId?.email || 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                {/* SCHOOL INFORMATION */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-850 space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-1.5 border-b border-gray-150 dark:border-gray-750">
                    School Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">House</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.house || 'Tagore'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Bus Route</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.busRoute || 'Self / Walk'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Admission Date</span>
                      <strong className="text-gray-800 dark:text-gray-200">
                        {new Date(selectedStudent.createdAt || Date.now()).toLocaleDateString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Class Teacher</span>
                      <strong className="text-gray-800 dark:text-gray-200">
                        {selectedStudent.classId?.classTeacherId?.name || currentUser?.name || 'Ram Sanjay Pawar'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Account Status</span>
                      <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.status || 'Active'}</strong>
                    </div>
                  </div>
                </div>

                {/* QUICK ACTIONS BUTTONS */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                    }}
                    className="w-full py-2.5 px-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer transition text-center block"
                  >
                    View Full Profile
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setDrawerOpen(false);
                        navigate('/attendance/history');
                      }}
                      className="py-2 px-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 text-[11px] font-bold rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer text-center"
                    >
                      Attendance History
                    </button>
                    <button
                      onClick={() => {
                        setDrawerOpen(false);
                        navigate(currentUser?.role === 'parent' ? '/my-children' : '/students');
                      }}
                      className="py-2 px-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 text-[11px] font-bold rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer text-center"
                    >
                      Parent Details
                    </button>
                    <button
                      onClick={() => setDrawerOpen(false)}
                      className="py-2 px-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 text-[11px] font-bold rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer text-center"
                    >
                      Close
                    </button>
                  </div>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* Roster Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-600 bg-opacity-75 overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#2E7D32] text-white">
              <h3 className="text-base font-bold">
                {editingStudent ? t('students.editTitle') : t('students.addTitle')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:text-green-100 focus:outline-none cursor-pointer"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student Name */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Student Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* Admission number */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Admission Number
                  </label>
                  <input
                    type="text"
                    required
                    value={admissionNo}
                    onChange={(e) => setAdmissionNo(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* Roll Number */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    required
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* Class select */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Class & Section
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                  >
                    {classes.map((cls) => (
                      <option key={cls._id} value={cls._id}>
                        {cls.grade} - {cls.section}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parent select */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Parent Contact
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">-- Select Parent User --</option>
                    {parents.length > 0 ? (
                      parents.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.phone || p.email})
                        </option>
                      ))
                    ) : (
                      <option value="parent_seed_id_placeholder">Suresh Patel (Demo Parent)</option>
                    )}
                  </select>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* Status (Edit only) */}
                {editingStudent && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="block w-full py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-xs font-semibold bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Profile Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-[#2E7D32] hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-lg text-xs font-bold shadow-2xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {formLoading ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Student</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
