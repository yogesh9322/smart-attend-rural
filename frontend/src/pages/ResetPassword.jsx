import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../services/api';
import { FaSchool, FaLock, FaCheckCircle, FaSpinner, FaArrowLeft, FaEye, FaEyeSlash } from 'react-icons/fa';

const ResetPassword = () => {
  const { t } = useTranslation();
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      if (res.success) {
        setMessage(res.message || 'Your password has been successfully reset.');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(res.message || 'Failed to reset password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-150 p-8 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-3.5 bg-green-50 rounded-2xl border border-green-150 text-[#2E7D32] mb-5">
              <FaSchool className="text-3xl" />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {t('reset_password.title')}
            </h2>
            <p className="mt-2 text-sm text-gray-500 font-medium leading-relaxed">
              {t('reset_password.subtitle')}
            </p>
          </div>

          <div className="mt-8">
            {message ? (
              <div className="space-y-6 text-center animate-fade-in">
                <div className="flex justify-center text-green-600 text-5xl">
                  <FaCheckCircle className="animate-bounce" />
                </div>
                <div className="p-4 rounded-xl bg-green-50 border border-green-150 text-green-800 text-xs font-bold leading-relaxed">
                  {message}
                </div>
                <p className="text-xs text-gray-400 font-semibold">
                  Redirecting you to the Login screen in a few seconds...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error Banner */}
                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-150 text-red-700 text-sm font-semibold">
                    {error}
                  </div>
                )}

                {/* New Password Input */}
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                    New Password
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <FaLock />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent text-gray-900 placeholder-gray-400 sm:text-sm font-medium"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                      tabIndex="-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FaEyeSlash className="text-base text-gray-500" /> : <FaEye className="text-base text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                    Confirm New Password
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <FaLock />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent text-gray-900 placeholder-gray-400 sm:text-sm font-medium"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                      tabIndex="-1"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <FaEyeSlash className="text-base text-gray-500" /> : <FaEye className="text-base text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex justify-center w-full px-4 py-3.5 text-sm font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] border border-transparent rounded-lg shadow-md hover:shadow-lg focus:outline-none disabled:opacity-50 transition-all duration-150 cursor-pointer"
                >
                  {loading ? (
                    <FaSpinner className="animate-spin text-xl" />
                  ) : (
                    t('reset_password.resetButton')
                  )}
                </button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-[#2E7D32]"
                  >
                    <FaArrowLeft className="text-[10px]" />
                    <span>{t('forgot_password.backToLogin')}</span>
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
