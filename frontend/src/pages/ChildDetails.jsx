import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getStudentDetails, getAttendanceReport } from '../services/api';
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaFileAlt,
  FaPaperPlane,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaUsers,
  FaEnvelope,
  FaPhoneAlt,
  FaHeartbeat
} from 'react-icons/fa';

const ChildDetails = () => {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [attendanceRate, setAttendanceRate] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const studentRes = await getStudentDetails(id);
        const attendanceRes = await getAttendanceReport({ studentId: id });

        if (studentRes.success) {
          setStudent(studentRes.data);
        } else {
          setError(studentRes.message || 'Failed to fetch student details.');
        }

        if (attendanceRes.success) {
          const records = attendanceRes.data;
          const total = records.length;
          const presents = records.filter(r => r.status === 'Present').length;
          const lates = records.filter(r => r.status === 'Late').length;
          setAttendanceRate(total > 0 ? Math.round(((presents + lates) / total) * 100) : 100);
        }
      } catch (err) {
        console.error(err);
        setError('Error loading student profile data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <Link to="/my-children" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E7D32] hover:underline">
          <FaArrowLeft />
          <span>Back to Children</span>
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center font-bold">
          {error || 'Student profile not found.'}
        </div>
      </div>
    );
  }

  const teacher = student.classId?.classTeacherId;

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="no-print">
        <Link
          to="/my-children"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E7D32] hover:underline"
        >
          <FaArrowLeft />
          <span>Back to Children</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar Card & Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-md text-center">
            <div className="w-24 h-24 rounded-3xl bg-green-50 text-[#2E7D32] border border-green-100 flex items-center justify-center text-3xl font-black mx-auto mb-4">
              {student.name.charAt(0)}
            </div>
            <h3 className="text-xl font-extrabold text-gray-800">{student.name}</h3>
            <p className="text-xs text-gray-400 font-bold uppercase mt-1">
              Roll No: {student.rollNo} • Class {student.classId?.grade}-{student.classId?.section}
            </p>

            <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Attendance Score</span>
                <span className={attendanceRate < 75 ? 'text-red-600 font-extrabold' : 'text-[#2E7D32] font-black'}>
                  {attendanceRate}%
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden border border-gray-50">
                <div
                  style={{ width: `${attendanceRate}%` }}
                  className={`h-full rounded-full ${
                    attendanceRate < 75 ? 'bg-red-600' : 'bg-[#2E7D32]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm space-y-3 no-print">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Student Shortcuts</h4>
            <button
              onClick={() => navigate('/attendance/calendar')}
              className="flex items-center gap-3 w-full p-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-2xl text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              <FaCalendarAlt className="text-green-700" />
              <span>View Attendance Calendar</span>
            </button>
            <button
              onClick={() => navigate('/leave-request')}
              className="flex items-center gap-3 w-full p-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-2xl text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              <FaPaperPlane className="text-amber-700" />
              <span>Apply for Leave</span>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-3 w-full p-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-2xl text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              <FaFileAlt className="text-blue-700" />
              <span>Download Progress Sheet</span>
            </button>
          </div>
        </div>

        {/* Right Column: Profiles sheets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal details sheet */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
              <FaUserGraduate className="text-green-700" />
              <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">Academic Profile</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-gray-700">
              <div>
                <span className="text-[10px] text-gray-450 uppercase block">Admission Number</span>
                <span className="text-gray-900 font-bold">{student.admissionNo}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-450 uppercase block">Gender</span>
                <span className="text-gray-900 font-bold">{student.gender}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-450 uppercase block">Date of Birth</span>
                <span className="text-gray-900 font-bold">{student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FaHeartbeat className="text-red-500" />
                <div>
                  <span className="text-[10px] text-gray-450 uppercase block">Blood Group</span>
                  <span className="text-gray-900 font-bold">{student.bloodGroup || 'O+'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher details sheet */}
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
              <FaChalkboardTeacher className="text-green-700" />
              <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">Class Teacher Contacts</h3>
            </div>
            {teacher ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-extrabold text-gray-800">{teacher.name}</h4>
                  <p className="text-[10px] text-gray-450 font-bold uppercase mt-0.5">Assigned Class Teacher</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-gray-700">
                  <a
                    href={`tel:${teacher.phone}`}
                    className="flex items-center gap-2.5 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-2xl transition cursor-pointer"
                  >
                    <FaPhoneAlt className="text-green-700" />
                    <div>
                      <span className="text-[9px] text-gray-450 uppercase block">Mobile Phone</span>
                      <span className="text-gray-900 font-bold">{teacher.phone || 'N/A'}</span>
                    </div>
                  </a>
                  <a
                    href={`mailto:${teacher.email}`}
                    className="flex items-center gap-2.5 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-2xl transition cursor-pointer"
                  >
                    <FaEnvelope className="text-blue-700" />
                    <div>
                      <span className="text-[9px] text-gray-450 uppercase block">Email Address</span>
                      <span className="text-gray-900 font-bold">{teacher.email || 'N/A'}</span>
                    </div>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-bold italic py-2">
                No class teacher currently assigned to this classroom grade.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildDetails;
