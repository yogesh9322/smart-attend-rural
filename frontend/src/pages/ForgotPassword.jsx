import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../services/api';
import { FaSchool, FaEnvelope, FaArrowLeft, FaCheckCircle, FaSpinner } from 'react-icons/fa';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Please provide your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res.success) {
        setMessage(res.message || 'A reset link has been dispatched to your email address.');
      } else {
        setError(res.message || 'Failed to dispatch password reset link.');
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
              {t('forgot_password.title')}
            </h2>
            <p className="mt-2 text-sm text-gray-500 font-medium leading-relaxed">
              {t('forgot_password.subtitle')}
            </p>
          </div>

          <div className="mt-8">
            {message ? (
              <div className="space-y-6 text-center">
                <div className="flex justify-center text-green-600 text-5xl">
                  <FaCheckCircle />
                </div>
                <div className="p-4 rounded-xl bg-green-50 border border-green-150 text-green-800 text-xs font-bold leading-relaxed">
                  {message}
                </div>
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3.5 text-sm font-bold text-[#2E7D32] hover:text-[#1B5E20] transition-colors cursor-pointer"
                >
                  <FaArrowLeft />
                  <span>{t('forgot_password.backToLogin')}</span>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error Banner */}
                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-150 text-red-700 text-sm font-semibold">
                    {error}
                  </div>
                )}

                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                    {t('login.emailLabel')}
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <FaEnvelope />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent text-gray-900 placeholder-gray-400 sm:text-sm font-medium"
                      placeholder={t('login.emailPlaceholder')}
                    />
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
                    t('forgot_password.sendInstructions')
                  )}
                </button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2E7D32] hover:underline animate-pulse"
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

export default ForgotPassword;
