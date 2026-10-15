import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ParentProfile from './ParentProfile';
import SecurityActivityModal from '../components/SecurityActivityModal';
import { getActivityLogs, uploadAvatar, updateProfile, changePassword } from '../services/api';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : `http://${window.location.hostname}:5000`;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};
import {
  FaUserCircle,
  FaKey,
  FaHistory,
  FaSpinner,
  FaInfoCircle,
  FaUpload,
  FaUser,
  FaMapMarkerAlt,
  FaChalkboardTeacher,
  FaShieldAlt,
  FaSignInAlt,
  FaUserPlus,
  FaUserMinus,
  FaEdit,
  FaClock,
  FaChevronDown,
  FaChevronUp,
  FaIdCard,
  FaLock,
  FaBuilding,
  FaPhoneAlt,
  FaCheckCircle,
  FaEye,
  FaEyeSlash,
  FaLaptop,
  FaNetworkWired,
  FaTimesCircle,
  FaFileCsv,
  FaSearch,
  FaFilter,
  FaTimes,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaDownload,
  FaUndoAlt,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';

const AdminProfile = () => {
  const { t } = useTranslation('common');
  const { user, refreshProfile } = useAuth();

  if (user?.role === 'parent') {
    return <ParentProfile />;
  }
  
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  const [passwordAccordionOpen, setPasswordAccordionOpen] = useState(false);
  
  // Base fields
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [photo, setPhoto] = useState(user?.photo || '');
  
  // Teacher-specific fields
  const [qualification, setQualification] = useState(user?.qualification || '');
  const [experience, setExperience] = useState(user?.experience || '');
  const [subject, setSubject] = useState(user?.subject || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '');

  // Parent-specific fields
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [village, setVillage] = useState(user?.village || '');
  const [address, setAddress] = useState(user?.address || '');

  // Password fields & Toggles
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState({ current: false, new: false, confirm: false });

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [passwordFormLoading, setPasswordFormLoading] = useState(false);
  const [showPasswordSuccessToast, setShowPasswordSuccessToast] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Activity Log Modal State
  const [showActivityModal, setShowActivityModal] = useState(false);

  // Password Validation Rules
  const validatePasswordRequirements = (pwd) => {
    return {
      minLength: pwd.length >= 8,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>_~\-+=]/.test(pwd),
    };
  };

  const getPasswordValidationErrors = () => {
    const errs = {};

    if (!currentPassword) {
      errs.currentPassword = 'Current password is required.';
    }

    if (!newPassword) {
      errs.newPassword = 'New password is required.';
    } else {
      const reqs = validatePasswordRequirements(newPassword);
      if (!reqs.minLength || !reqs.hasUpper || !reqs.hasLower || !reqs.hasNumber || !reqs.hasSpecial) {
        errs.newPassword = 'New password must be at least 8 characters with uppercase, lowercase, number, and special character.';
      } else if (currentPassword && newPassword === currentPassword) {
        errs.newPassword = 'New password cannot be the same as your current password.';
      }
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your new password.';
    } else if (newPassword && confirmPassword !== newPassword) {
      errs.confirmPassword = 'Confirm password does not match new password.';
    }

    return errs;
  };

  const passwordErrors = getPasswordValidationErrors();
  const isPasswordFormValid = Object.keys(passwordErrors).length === 0 && currentPassword && newPassword && confirmPassword;

  const handleClearPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordTouched({ current: false, new: false, confirm: false });
    setPasswordMsg({ text: '', type: '' });
  };

  // Device & Browser Detection
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    let os = 'OS';

    if (ua.includes('Win')) os = 'Windows OS';
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

  // Calculate profile completion percentage
  const calculateCompletion = () => {
    let filled = 0;
    let total = 6;
    if (name) filled++;
    if (email) filled++;
    if (phone) filled++;
    if (photo) filled++;
    if (qualification) filled++;
    if (subject) filled++;
    return Math.round((filled / total) * 100);
  };
  const completionPct = calculateCompletion();

  // Helper function for audit badge formatting
  const getAuditBadgeInfo = (action = '') => {
    const act = (action || '').toUpperCase();
    if (act.includes('FAILED')) {
      return {
        label: 'Failed Attempt',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dotClass: 'bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950',
        icon: <FaTimesCircle className="text-[10px]" />
      };
    }
    if (act.includes('LOGIN')) {
      return {
        label: 'System Login',
        badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        dotClass: 'bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-950',
        icon: <FaSignInAlt className="text-[10px]" />
      };
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('LINK')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dotClass: 'bg-[#2E7D32] ring-4 ring-emerald-100 dark:ring-emerald-950',
        icon: <FaUserPlus className="text-[10px]" />
      };
    }
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('UNLINK')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dotClass: 'bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950',
        icon: <FaUserMinus className="text-[10px]" />
      };
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('RESET') || act.includes('PASSWORD') || act.includes('STATUS')) {
      return {
        label: act.replace(/_/g, ' '),
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dotClass: 'bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950',
        icon: <FaEdit className="text-[10px]" />
      };
    }
    return {
      label: act.replace(/_/g, ' '),
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-750 dark:text-gray-300 border-gray-200 dark:border-gray-700',
      dotClass: 'bg-gray-400 ring-4 ring-gray-100 dark:ring-gray-800',
      icon: <FaShieldAlt className="text-[10px]" />
    };
  };

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setPhoto(user.photo || '');
      if (user.qualification !== undefined) setQualification(user.qualification || '');
      if (user.experience !== undefined) setExperience(user.experience || '');
      if (user.subject !== undefined) setSubject(user.subject || '');
      if (user.emergencyContact !== undefined) setEmergencyContact(user.emergencyContact || '');
      if (user.occupation !== undefined) setOccupation(user.occupation || '');
      if (user.village !== undefined) setVillage(user.village || '');
      if (user.address !== undefined) setAddress(user.address || '');
    }
  }, [user]);

  const fetchActivityLogs = async () => {
    try {
      setLogsLoading(true);
      const data = await getActivityLogs();
      if (data && data.success) {
        setLogs(data.data || []);
      }
    } catch (err) {
      console.log('Activity log fetch failed.');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const handleOpenActivityModal = () => {
    setShowActivityModal(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);

    try {
      const data = await uploadAvatar(formData);
      if (data.success) {
        setPhoto(data.url);
        setProfileMsg({ text: 'Photo uploaded! Click Save Changes to persist.', type: 'success' });
      } else {
        throw new Error(data.message || 'Photo upload failed');
      }
    } catch (err) {
      setProfileMsg({ text: err.message || 'Photo upload failed.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setProfileMsg({ text: '', type: '' });

    const updateBody = {
      name,
      email,
      phone,
      photo,
      qualification,
      experience,
      subject,
      emergencyContact,
      address,
      village,
      occupation
    };

    try {
      const data = await updateProfile(updateBody);
      if (data.success) {
        setProfileMsg({ text: 'Profile updated successfully.', type: 'success' });
        await refreshProfile();
        fetchActivityLogs();
      } else {
        throw new Error(data.message || 'Profile update failed.');
      }
    } catch (err) {
      setProfileMsg({ text: err.message || 'Profile update failed.', type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordFormValid) return;

    setPasswordFormLoading(true);
    setPasswordMsg({ text: '', type: '' });

    try {
      const data = await changePassword({ currentPassword, newPassword });
      if (data.success) {
        setPasswordMsg({ text: 'Password changed successfully! Next login requires your new password.', type: 'success' });
        setShowPasswordSuccessToast(true);
        handleClearPasswordForm();
        await refreshProfile();
        fetchActivityLogs();
        setTimeout(() => setShowPasswordSuccessToast(false), 5000);
      } else {
        throw new Error(data.message || 'Password update failed.');
      }
    } catch (err) {
      setPasswordMsg({ text: err.message || 'Password update failed.', type: 'error' });
    } finally {
      setPasswordFormLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Floating Success Confirmation Prompt Toast */}
      {showPasswordSuccessToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm bg-white dark:bg-gray-800 border-2 border-emerald-500 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 rounded-xl shrink-0">
            <FaCheckCircle className="text-xl" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">Password Updated</h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 font-semibold mt-0.5">
              Your password has been changed successfully. Please use your new credentials for future logins.
            </p>
          </div>
          <button
            onClick={() => setShowPasswordSuccessToast(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <FaTimesCircle className="text-base" />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('profile.title')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {t('profile.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Avatar & Photo, Teacher Info Summary, Profile Completion, Collapsible Password */}
        <div className="space-y-6 lg:col-span-1">
          {/* Profile Card & Photo Upload */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs text-center space-y-4">
            <div className="relative inline-block">
              {photo ? (
                <img
                  src={getMediaUrl(photo)}
                  alt={name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700 shadow-sm mx-auto"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 flex items-center justify-center border-4 border-gray-100 dark:border-gray-700 mx-auto">
                  <FaUserCircle className="text-6xl" />
                </div>
              )}
              <label
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 bg-[#2E7D32] hover:bg-[#1B5E20] text-white p-2 rounded-full shadow-sm cursor-pointer transition"
                title="Upload Photo"
              >
                {uploading ? <FaSpinner className="animate-spin text-xs" /> : <FaUpload className="text-xs" />}
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-2 border-t border-gray-150 dark:border-gray-700">
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{name}</h3>
              <span className="inline-block text-[10px] font-extrabold bg-emerald-50 text-[#2E7D32] dark:bg-emerald-950 dark:text-green-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider mt-1">
                {user?.role || 'Teacher'} Profile
              </span>
            </div>

            {/* Profile Completion Progress Bar */}
            <div className="pt-3 border-t border-gray-150 dark:border-gray-700 text-left space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-700 dark:text-gray-200">Profile Completion</span>
                <span className="text-[#2E7D32] dark:text-green-400">{completionPct}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#2E7D32] h-full rounded-full transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 font-medium leading-tight">
                {completionPct < 100
                  ? 'Complete your profile details to keep school records up to date.'
                  : 'Great job! Your profile information is complete.'}
              </p>
            </div>
          </div>

          {/* Change Password Form (ERP Production Ready) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setPasswordAccordionOpen(!passwordAccordionOpen)}
              className="w-full p-4 flex items-center justify-between text-xs font-bold text-gray-800 dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FaLock className="text-[#2E7D32] text-sm" />
                <span>{t('profile.changePassword') || 'Change Password'}</span>
              </div>
              {passwordAccordionOpen ? <FaChevronUp className="text-gray-400 text-xs" /> : <FaChevronDown className="text-gray-400 text-xs" />}
            </button>

            {passwordAccordionOpen && (
              <div className="p-4 pt-0 border-t border-gray-150 dark:border-gray-700 space-y-4 mt-3">
                {passwordMsg.text && (
                  <div className={`p-3 text-xs font-bold rounded-xl border flex items-center gap-2 ${
                    passwordMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  }`}>
                    {passwordMsg.type === 'success' ? <FaCheckCircle /> : <FaTimesCircle />}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  {/* Current Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      {t('profile.currentPassword') || 'Current Password'} *
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          setPasswordTouched(prev => ({ ...prev, current: true }));
                        }}
                        placeholder="Enter current password"
                        className="block w-full py-2 px-3 pr-9 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showCurrentPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                      </button>
                    </div>
                    {passwordTouched.current && passwordErrors.currentPassword && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                        {passwordErrors.currentPassword}
                      </p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      {t('profile.newPassword') || 'New Password'} *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setPasswordTouched(prev => ({ ...prev, new: true }));
                        }}
                        placeholder="Enter new password (8+ chars)"
                        className="block w-full py-2 px-3 pr-9 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showNewPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                      </button>
                    </div>
                    {passwordTouched.new && passwordErrors.newPassword && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                        {passwordErrors.newPassword}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      {t('profile.confirmPassword') || 'Confirm Password'} *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordTouched(prev => ({ ...prev, confirm: true }));
                        }}
                        placeholder="Re-enter new password"
                        className="block w-full py-2 px-3 pr-9 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
                      </button>
                    </div>
                    {passwordTouched.confirm && passwordErrors.confirmPassword && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                        {passwordErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons: Submit & Cancel */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={!isPasswordFormValid || passwordFormLoading}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        isPasswordFormValid && !passwordFormLoading
                          ? 'bg-[#2E7D32] hover:bg-[#1B5E20] text-white shadow-xs'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {passwordFormLoading ? (
                        <>
                          <FaSpinner className="animate-spin text-xs" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleClearPasswordForm}
                      disabled={passwordFormLoading}
                      className="px-3 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Update Details Forms & Security Information */}
        <div className="space-y-6 lg:col-span-2">
          {/* Update details form */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase border-b border-gray-150 dark:border-gray-700 pb-2">{t('profile.details')}</h3>
            {profileMsg.text && (
              <div className={`p-3 text-xs font-bold rounded-xl border flex items-center gap-2 ${
                profileMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              }`}>
                {profileMsg.type === 'success' && <FaCheckCircle />}
                <span>{profileMsg.text}</span>
              </div>
            )}
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-2">
                  🔒 Administrator Managed Information (Read-Only)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-medium">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block">Employee ID</span>
                    <strong className="text-gray-800 dark:text-gray-200">{user?.employeeId || 'TCH-2026-042'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block">Email Address</span>
                    <strong className="text-gray-800 dark:text-gray-200">{email}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block">Assigned Class(es)</span>
                    <strong className="text-gray-800 dark:text-gray-200">{user?.assignedClassNames || 'Grade 6-A'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block">System Role</span>
                    <strong className="text-gray-800 dark:text-gray-200 capitalize">{user?.role || 'Teacher'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block">School Designation</span>
                    <strong className="text-gray-800 dark:text-gray-200">{user?.schoolName || 'Smart Rural Model School'}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider block mb-3">
                  ✏️ Personal & Academic Details (Editable)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      {t('common.name')} <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      {t('common.phone')} <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                    />
                  </div>

                  {user?.role !== 'parent' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Academic Qualification <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={qualification}
                          onChange={(e) => setQualification(e.target.value)}
                          className="block w-full py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Teaching Subject <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="block w-full py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Teaching Experience <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          placeholder="e.g. 5 Years"
                          className="block w-full py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Emergency Contact (Optional)
                        </label>
                        <input
                          type="text"
                          value={emergencyContact}
                          onChange={(e) => setEmergencyContact(e.target.value)}
                          placeholder="e.g. +91 9876543210"
                          className="block w-full py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Residential Address (Optional)
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. Main Village Road, Sector 4"
                          className="block w-full py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] transition"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-150 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2 disabled:opacity-60"
                >
                  {formLoading ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Practical Security Information Card */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-[#2E7D32] dark:text-green-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-sm">
                  <FaShieldAlt />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    Security Information
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">System security & account access metadata</p>
                </div>
              </div>
            </div>

            {/* Practical Security Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50/80 dark:bg-gray-750 rounded-xl border border-gray-200/80 dark:border-gray-700 flex items-center gap-3">
                <FaClock className="text-[#2E7D32] dark:text-green-400 text-base shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Last Login</span>
                  <strong className="text-xs text-gray-800 dark:text-gray-200 font-semibold">
                    {user?.lastLogin ? new Date(user.lastLogin).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Today (Active)'}
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-gray-50/80 dark:bg-gray-750 rounded-xl border border-gray-200/80 dark:border-gray-700 flex items-center gap-3">
                <FaKey className="text-[#2E7D32] dark:text-green-400 text-base shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Last Password Changed</span>
                  <strong className="text-xs text-gray-800 dark:text-gray-200 font-semibold">
                    {user?.passwordChangedAt ? new Date(user.passwordChangedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not changed recently'}
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-gray-50/80 dark:bg-gray-750 rounded-xl border border-gray-200/80 dark:border-gray-700 flex items-center gap-3">
                <FaLaptop className="text-[#2E7D32] dark:text-green-400 text-base shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Current Device / Browser</span>
                  <strong className="text-xs text-gray-800 dark:text-gray-200 font-semibold">
                    {getDeviceInfo()}
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-gray-50/80 dark:bg-gray-750 rounded-xl border border-gray-200/80 dark:border-gray-700 flex items-center gap-3">
                <FaNetworkWired className="text-[#2E7D32] dark:text-green-400 text-base shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Last Login IP</span>
                  <strong className="text-xs text-gray-800 dark:text-gray-200 font-semibold">
                    127.0.0.1 (Local Session)
                  </strong>
                </div>
              </div>
            </div>

            {/* Recent Security Activity Stream */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Recent Security Activity
                </h4>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={handleOpenActivityModal}
                    className="text-xs font-semibold text-[#2E7D32] hover:text-emerald-700 dark:text-green-400 dark:hover:text-green-300 hover:underline flex items-center gap-1 transition-colors group cursor-pointer"
                    title="View full authorized activity and security logs"
                  >
                    <span>View All Activity</span>
                    <span className="text-[11px] transform group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                  </button>
                )}
              </div>

              {logsLoading ? (
                <div className="flex items-center gap-2 py-4 text-xs font-semibold text-gray-400">
                  <FaSpinner className="animate-spin text-[#2E7D32]" />
                  <span>Loading activity logs...</span>
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {logs.slice(0, 8).map((log) => {
                    const badgeInfo = getAuditBadgeInfo(log.action);
                    return (
                      <div key={log._id} className="p-2.5 bg-gray-50/80 dark:bg-gray-750 rounded-xl border border-gray-200/80 dark:border-gray-700 flex items-center justify-between text-xs hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className={`p-1 rounded-md text-[10px] font-bold shrink-0 ${badgeInfo.badgeClass}`}>
                            {badgeInfo.icon}
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{log.details}</span>
                        </div>
                        <span className="text-[10px] font-medium text-gray-400 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl text-center text-xs font-semibold text-gray-400 flex items-center justify-center gap-2">
                  <FaInfoCircle className="text-gray-300 dark:text-gray-500" />
                  <span>No recent security activity</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated System Security & Audit Activity Logs Modal */}
      <SecurityActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        user={user}
      />
    </div>
  );
};

export default AdminProfile;
