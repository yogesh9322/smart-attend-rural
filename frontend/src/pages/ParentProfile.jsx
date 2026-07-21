import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, changePassword, getActivityLogs, uploadAvatar } from '../services/api';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : `http://${window.location.hostname}:5000`;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};
import {
  FaUser,
  FaShieldAlt,
  FaKey,
  FaHistory,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaCamera,
  FaArrowRight,
  FaCheckCircle,
  FaExclamationCircle,
  FaTimes,
  FaLaptop,
  FaMapMarkerAlt,
  FaUpload,
  FaTrashAlt,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';

const ParentProfile = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  // Personal Information State (Editable)
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || user?.phoneNumber || '');
  const [alternatePhone, setAlternatePhone] = useState(user?.alternatePhone || user?.emergencyContact || '');
  const [address, setAddress] = useState(user?.address || '');
  const [village, setVillage] = useState(user?.village || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || 'Gujarat');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [language, setLanguage] = useState(user?.language || 'English');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [photo, setPhoto] = useState(user?.photo || '');

  // Status & Feedback Messages
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  const [lastUpdatedTime, setLastUpdatedTime] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Photo Options & Lightbox Modals
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);
  const [viewPhotoOpen, setViewPhotoOpen] = useState(false);

  // Password Form State
  const [passwordAccordionOpen, setPasswordAccordionOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleCancelPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMsg({ text: '', type: '' });
    setPasswordAccordionOpen(false);
  };

  // Activity Logs State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Helper functions
  const formatLastUpdated = (dateInput) => {
    if (!dateInput) return '';
    const dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) return '';

    const isToday = dateObj.toDateString() === new Date().toDateString();
    const timeStr = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) {
      return `Today • ${timeStr}`;
    }
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = dateObj.toLocaleDateString('en-GB', { month: 'short' });
    const year = dateObj.getFullYear();
    return `${day} ${month} ${year} • ${timeStr}`;
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return 'N/A';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthStr = dateObj.toLocaleDateString('en-GB', { month: 'short' });
    const yearNum = dateObj.getFullYear();
    return `${day} ${monthStr} ${yearNum}`;
  };

  const formatDateTime = (d) => {
    if (!d) return 'Never';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return 'Never';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthStr = dateObj.toLocaleDateString('en-GB', { month: 'short' });
    const yearNum = dateObj.getFullYear();
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day} ${monthStr} ${yearNum} • ${timeStr}`;
  };

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    let os = 'OS';

    if (ua.includes('Win')) os = 'Windows 11';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('like Mac')) os = 'iOS';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    return `${browser} on ${os}`;
  };

  // Auto-dismiss profileMsg banner after 5 seconds
  useEffect(() => {
    if (profileMsg.text) {
      const timer = setTimeout(() => {
        setProfileMsg({ text: '', type: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [profileMsg]);

  // Auto-dismiss passwordMsg banner after 5 seconds
  useEffect(() => {
    if (passwordMsg.text) {
      const timer = setTimeout(() => {
        setPasswordMsg({ text: '', type: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [passwordMsg]);

  // Sync user state on load/change
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || user.phoneNumber || '');
      setAlternatePhone(user.alternatePhone || user.emergencyContact || '');
      setAddress(user.address || '');
      setVillage(user.village || '');
      setCity(user.city || '');
      setState(user.state || 'Gujarat');
      setPincode(user.pincode || '');
      setLanguage(user.language || 'English');
      setOccupation(user.occupation || '');
      setPhoto(user.photo || '');
      if (user.updatedAt) {
        setLastUpdatedTime(formatLastUpdated(user.updatedAt));
      }
    }
  }, [user]);

  // Fetch real activity logs
  useEffect(() => {
    const fetchActivityLogs = async () => {
      try {
        setLogsLoading(true);
        const data = await getActivityLogs();
        if (data.success) {
          setLogs(data.data || []);
        }
      } catch (err) {
        console.error('Activity logs fetch error:', err);
      } finally {
        setLogsLoading(false);
      }
    };
    fetchActivityLogs();
  }, []);

  // Password Requirements Validation
  const pwdReqs = {
    minLength: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_~\-+=]/.test(newPassword),
    differentFromCurrent: !newPassword || !currentPassword || newPassword !== currentPassword,
  };

  const allReqsMet = Object.values(pwdReqs).every(Boolean);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const isPasswordFormValid = currentPassword && allReqsMet && passwordsMatch;

  // Calculate Password Strength
  const getPasswordStrength = () => {
    if (!newPassword) return { score: 0, label: '', color: 'bg-gray-200' };
    const passedCount = Object.values(pwdReqs).filter(Boolean).length;
    if (passedCount <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (passedCount <= 4) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-600' };
  };
  const pwdStrength = getPasswordStrength();

  // Save Personal Information
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });
    setSavingProfile(true);

    try {
      const payload = {
        name,
        email,
        phone,
        alternatePhone,
        address,
        village,
        city,
        state,
        pincode,
        language,
        occupation,
        photo
      };

      const res = await updateProfile(payload);
      if (res.success) {
        if (res.data) {
          setName(res.data.name || name);
          setEmail(res.data.email || email);
          setPhone(res.data.phone || res.data.phoneNumber || phone);
          setAlternatePhone(res.data.alternatePhone || alternatePhone);
          setAddress(res.data.address || address);
          setVillage(res.data.village || village);
          setCity(res.data.city || city);
          setState(res.data.state || state);
          setPincode(res.data.pincode || pincode);
          setLanguage(res.data.language || language);
          setOccupation(res.data.occupation || occupation);
        }
        await refreshProfile();
        const nowStamp = res.data?.updatedAt || new Date().toISOString();
        setLastUpdatedTime(formatLastUpdated(nowStamp));
        setProfileMsg({ text: 'Profile updated successfully.', type: 'success' });
      } else {
        setProfileMsg({ text: res.message || 'Failed to update profile.', type: 'error' });
      }
    } catch (err) {
      setProfileMsg({ text: err.response?.data?.message || err.message || 'Error updating profile.', type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password Handler
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (currentPassword && newPassword && currentPassword === newPassword) {
      setPasswordMsg({ text: 'New password cannot be the same as your current password.', type: 'error' });
      return;
    }
    if (!isPasswordFormValid) return;
    setPasswordMsg({ text: '', type: '' });
    setSavingPassword(true);

    try {
      const res = await changePassword({ currentPassword, newPassword });
      if (res.success) {
        setProfileMsg({ text: 'Password updated successfully.', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordAccordionOpen(false);
        await refreshProfile();
      } else {
        setPasswordMsg({ text: res.message || 'Failed to change password.', type: 'error' });
      }
    } catch (err) {
      setPasswordMsg({ text: err.response?.data?.message || err.message || 'Current password incorrect or update failed.', type: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  // Profile Photo Upload
  const handlePhotoFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    setPhotoOptionsOpen(false);
    setProfileMsg({ text: '', type: '' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await uploadAvatar(formData);

      if (data.success && data.url) {
        setPhoto(data.url);
        await updateProfile({ photo: data.url });
        await refreshProfile();
        setProfileMsg({ text: 'Profile photo updated successfully.', type: 'success' });
      } else {
        setProfileMsg({ text: 'Failed to upload photo.', type: 'error' });
      }
    } catch (err) {
      setProfileMsg({ text: 'Error uploading profile photo.', type: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Remove Photo
  const handleRemovePhoto = async () => {
    setPhotoOptionsOpen(false);
    setUploadingPhoto(true);
    try {
      setPhoto('');
      await updateProfile({ photo: '' });
      await refreshProfile();
      setProfileMsg({ text: 'Profile photo removed successfully.', type: 'success' });
    } catch (err) {
      setProfileMsg({ text: 'Failed to remove photo.', type: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const childrenCount = user?.children?.length || 1;

  const formatLogTitle = (log) => {
    const act = (log?.action || '').toUpperCase();
    const det = log?.details || '';

    if (act.includes('LOGIN')) return 'Logged in to parent portal';
    if (act.includes('UPDATE_PROFILE') || det.includes('Profile details updated')) return 'Profile information updated';
    if (act.includes('CHANGE_PASSWORD') || det.includes('Password changed')) return 'Password changed successfully';
    if (act.includes('PHOTO') || det.includes('photo')) return 'Profile photo updated';
    if (act.includes('LEAVE') || det.includes('leave')) return 'Submitted student leave request';

    return det || act.replace(/_/g, ' ') || 'Account Activity';
  };

  const getDisplayLogs = () => {
    let list = [];
    if (logs && logs.length > 0) {
      list = [...logs];
    } else {
      // Fallback to real database account timestamps if no audit logs recorded yet
      if (user?.lastLogin) {
        list.push({
          _id: 'log-login',
          action: 'LOGIN',
          details: 'Logged in to parent portal',
          createdAt: user.lastLogin
        });
      }
      if (user?.updatedAt && user?.createdAt && new Date(user.updatedAt).getTime() > new Date(user.createdAt).getTime() + 60000) {
        list.push({
          _id: 'log-update',
          action: 'UPDATE_PROFILE',
          details: 'Profile information updated',
          createdAt: user.updatedAt
        });
      }
      if (user?.createdAt) {
        list.push({
          _id: 'log-created',
          action: 'ACCOUNT_CREATED',
          details: 'Parent account activated',
          createdAt: user.createdAt
        });
      }
    }

    // Sort strictly in descending chronological order (newest first)
    return list.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  };

  const displayLogsList = getDisplayLogs();

  return (
    <div className="space-y-6">
      {/* FLOATING TOP-RIGHT TOAST NOTIFICATION */}
      {(profileMsg.text || passwordMsg.text) && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border ${
          (profileMsg.type || passwordMsg.type) === 'success'
            ? 'border-emerald-500 shadow-emerald-500/10'
            : 'border-red-500 shadow-red-500/10'
        } shadow-xl rounded-xl transition-all duration-300 animate-fadeIn`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            (profileMsg.type || passwordMsg.type) === 'success'
              ? 'bg-emerald-100 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400'
              : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
          }`}>
            {(profileMsg.type || passwordMsg.type) === 'success' ? (
              <FaCheckCircle className="text-base" />
            ) : (
              <FaExclamationCircle className="text-base" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
              {profileMsg.text || passwordMsg.text}
            </p>
            {lastUpdatedTime && (profileMsg.type || passwordMsg.type) === 'success' && (
              <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                Last Updated: {lastUpdatedTime}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setProfileMsg({ text: '', type: '' });
              setPasswordMsg({ text: '', type: '' });
            }}
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FaUser className="text-[#2E7D32]" />
          <span>Parent Profile & Settings</span>
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
          Manage your parent account, contact details, security preferences, and view account logs.
        </p>
      </div>

      {/* SECTION 1: PARENT PROFILE CARD */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* Avatar with click menu */}
            <div className="relative group cursor-pointer" onClick={() => setPhotoOptionsOpen(true)}>
              {photo ? (
                <img
                  src={getMediaUrl(photo)}
                  alt={user?.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#2E7D32]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#2E7D32] flex items-center justify-center font-bold text-xl border-2 border-[#2E7D32]">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <FaCamera className="text-white text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{user?.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Parent Account
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                  Active
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Relationship: <span className="font-semibold text-gray-800 dark:text-gray-200">{user?.relationship || 'Father'}</span>
              </p>
            </div>
          </div>

          {/* Linked Students Info Card (Navigates to My Children) */}
          <div className="w-full sm:w-auto bg-gray-50 dark:bg-gray-750 p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Linked Students</span>
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Total Linked Students: <strong className="text-[#2E7D32] dark:text-green-400">{childrenCount}</strong>
              </span>
              <button
                onClick={() => navigate('/my-children')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2E7D32] dark:text-green-400 hover:underline cursor-pointer"
              >
                <span>View My Children</span>
                <FaArrowRight className="text-[10px]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (Sections 2 & 3: School Info & Personal Info) */}
        <div className="lg:col-span-2 space-y-5">
          {/* SECTION 2: SCHOOL INFORMATION (READ ONLY) */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="border-b border-gray-150 dark:border-gray-700 pb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                School Information
              </h3>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                Read Only
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Parent ID</span>
                <strong className="text-xs font-bold text-gray-800 dark:text-gray-200 block font-mono">
                  {user?.parentIdCode || `PRNT-${user?._id?.slice(-6)?.toUpperCase() || '1042'}`}
                </strong>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Registered Email</span>
                <strong className="text-xs font-semibold text-gray-800 dark:text-gray-200 block truncate">
                  {user?.email}
                </strong>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">School Name</span>
                <strong className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">
                  SmartAttend Rural Academy
                </strong>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Parent Relationship</span>
                <strong className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">
                  {user?.relationship || 'Father'}
                </strong>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Account Status</span>
                <span className="inline-block text-[11px] font-bold text-emerald-700 dark:text-green-400">
                  Active
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Account Created Date</span>
                <strong className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">
                  {formatDate(user?.createdAt)}
                </strong>
              </div>
            </div>
          </div>

          {/* SECTION 3: PERSONAL INFORMATION (EDITABLE) */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-150 dark:border-gray-700">
              Personal Information
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Parent Name */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Parent Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  />
                </div>

                {/* Alternate Mobile Number */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Alternate Mobile Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Secondary contact number"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  />
                </div>

                {/* Preferred Language */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Preferred Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  >
                    <option value="English">English</option>
                    <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                  </select>
                </div>

                {/* Occupation */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Occupation (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Agriculture / Teacher / Business"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Address details */}
              <div className="space-y-3 pt-2 border-t border-gray-150 dark:border-gray-700">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    placeholder="House No., Street Name, Landmark"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Village / City
                    </label>
                    <input
                      type="text"
                      value={city || village}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setVillage(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 380001"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Save Changes Button */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? 'Saving Changes...' : 'Save Changes'}
                </button>

                {lastUpdatedTime && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    Last Updated: {lastUpdatedTime}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (Sections 4, 5, 6: Password, Security & Activity) */}
        <div className="lg:col-span-1 space-y-5">
          {/* SECTION 4: CHANGE PASSWORD (ACCORDION) */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xs overflow-hidden transition-all duration-300">
            {/* Header Accordion Toggle */}
            <button
              type="button"
              onClick={() => {
                if (passwordAccordionOpen) {
                  handleCancelPassword();
                } else {
                  setPasswordAccordionOpen(true);
                }
              }}
              className="w-full p-4 flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-750 transition"
            >
              <div className="flex items-center gap-2">
                <FaKey className="text-[#2E7D32]" />
                <span>Change Password</span>
              </div>
              {passwordAccordionOpen ? (
                <FaChevronUp className="text-gray-400 text-xs" />
              ) : (
                <FaChevronDown className="text-gray-400 text-xs" />
              )}
            </button>

            {/* Collapsible Body */}
            {passwordAccordionOpen && (
              <div className="p-4 pt-1 border-t border-gray-150 dark:border-gray-700 space-y-4 animate-fadeIn">
                {passwordMsg.text && (
                  <div className={`p-3 rounded-lg text-xs font-semibold leading-relaxed border ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                  }`}>
                    {passwordMsg.text}
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                  {/* Current Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 pr-9 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showCurrentPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 pr-9 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showNewPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-gray-400 uppercase">Strength</span>
                        <span className={pwdStrength.score === 3 ? 'text-emerald-600' : pwdStrength.score === 2 ? 'text-amber-600' : 'text-red-500'}>
                          {pwdStrength.label}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${pwdStrength.color}`}
                          style={{ width: pwdStrength.score === 1 ? '33%' : pwdStrength.score === 2 ? '66%' : pwdStrength.score === 3 ? '100%' : '0%' }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 pr-9 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                      </button>
                    </div>
                  </div>

                  {/* Requirement Checklist */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1 text-[11px]">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Password Requirements:</span>
                    <div className={`flex items-center gap-1.5 ${pwdReqs.minLength ? 'text-emerald-700 dark:text-green-400' : 'text-gray-400'}`}>
                      <FaCheckCircle className="text-[10px]" />
                      <span>Minimum 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdReqs.hasUpper ? 'text-emerald-700 dark:text-green-400' : 'text-gray-400'}`}>
                      <FaCheckCircle className="text-[10px]" />
                      <span>One uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdReqs.hasLower ? 'text-emerald-700 dark:text-green-400' : 'text-gray-400'}`}>
                      <FaCheckCircle className="text-[10px]" />
                      <span>One lowercase letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdReqs.hasNumber ? 'text-emerald-700 dark:text-green-400' : 'text-gray-400'}`}>
                      <FaCheckCircle className="text-[10px]" />
                      <span>One number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdReqs.hasSpecial ? 'text-emerald-700 dark:text-green-400' : 'text-gray-400'}`}>
                      <FaCheckCircle className="text-[10px]" />
                      <span>One special character</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdReqs.differentFromCurrent ? 'text-emerald-700 dark:text-green-400' : 'text-red-500 font-semibold'}`}>
                      <FaCheckCircle className="text-[10px]" />
                      <span>Must differ from current password</span>
                    </div>
                  </div>

                  {/* Action Buttons: Cancel & Update */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelPassword}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-750 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isPasswordFormValid || savingPassword}
                      className="px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* SECTION 5: SECURITY INFORMATION */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-150 dark:border-gray-700 flex items-center gap-2">
              <FaShieldAlt className="text-[#2E7D32]" />
              <span>Security Information</span>
            </h3>

            <div className="divide-y divide-gray-100 dark:divide-gray-750 text-xs">
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">
                  Last Login
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-right">
                  {formatDateTime(user?.lastLogin)}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">
                  Current Device
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-right">
                  {getDeviceInfo()}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">
                  Password Changed
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-right">
                  {user?.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : 'Never'}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">
                  Login Location
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-right">
                  Gujarat, India
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 6: RECENT ACCOUNT ACTIVITY */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-2xs space-y-3.5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-150 dark:border-gray-700 flex items-center gap-1.5">
              <FaHistory className="text-[#2E7D32]" />
              <span>Recent Account Activity</span>
            </h3>

            {logsLoading ? (
              <p className="text-xs text-gray-400 font-medium text-center py-4">Loading activity timeline...</p>
            ) : displayLogsList.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium text-center py-4">No recent activity recorded.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {displayLogsList.slice(0, 5).map((log, idx) => (
                  <div key={log._id || idx} className="flex items-start gap-2.5 text-xs border-b border-gray-100 dark:border-gray-750 pb-2 last:border-0">
                    <span className="w-2 h-2 rounded-full bg-[#2E7D32] mt-1 shrink-0"></span>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-gray-800 dark:text-gray-200 block truncate">
                        {formatLogTitle(log)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium block">
                        {formatDateTime(log.timestamp || log.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 7: PROFILE PHOTO MODAL */}
      {photoOptionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-xs w-full p-5 space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-2.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Profile Photo Options</h3>
              <button
                onClick={() => setPhotoOptionsOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            <div className="space-y-2">
              {photo && (
                <button
                  onClick={() => {
                    setPhotoOptionsOpen(false);
                    setViewPhotoOpen(true);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-750 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                >
                  <FaEye className="text-xs" />
                  <span>View Photo</span>
                </button>
              )}

              <label className="w-full px-3 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer">
                <FaUpload className="text-xs" />
                <span>Upload New Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
              </label>

              {photo && (
                <button
                  onClick={handleRemovePhoto}
                  className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                >
                  <FaTrashAlt className="text-xs" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW PHOTO LIGHTBOX MODAL */}
      {viewPhotoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 max-w-sm w-full space-y-3 relative">
            <button
              onClick={() => setViewPhotoOpen(false)}
              className="absolute top-2 right-2 p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-200 transition cursor-pointer"
            >
              <FaTimes className="text-sm" />
            </button>
            <img src={getMediaUrl(photo)} alt={user?.name} className="w-full h-auto max-h-80 rounded-lg object-cover" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentProfile;
