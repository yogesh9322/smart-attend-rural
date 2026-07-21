import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { FaSchool, FaLock, FaEnvelope, FaSpinner } from 'react-icons/fa';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { loginUser, loginWithGoogle, isAuthenticated, loading: authLoading, error: authError } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLocalLoading(true);
    const result = await loginUser(email, password);
    setLocalLoading(false);

    if (result.success) {
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }
      setSuccessMsg('Welcome back!');
      setTimeout(() => navigate('/'), 400);
    } else {
      setError(result.error || 'Invalid credentials.');
    }
  };

  // Google Login Handler
  const handleGoogleSuccess = async (tokenResponse) => {
    setGoogleLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const credential = tokenResponse.access_token || tokenResponse.id_token || tokenResponse.code;
      const res = await loginWithGoogle(credential);

      if (res.success) {
        setSuccessMsg(`Welcome back, ${res.user?.name || 'User'}!`);
        setTimeout(() => navigate('/'), 500);
      } else {
        setError(res.error || 'This Google account is not registered with SmartAttend Rural. Please contact your School Administrator.');
      }
    } catch (err) {
      console.error(err);
      setError('Authentication failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleLoginTrigger = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: (errorResponse) => {
      console.warn('Google Sign-In Error:', errorResponse);
      setError('Google Sign-In requires a valid Client ID from Google Cloud Console. Please add your GOOGLE_CLIENT_ID to .env.');
      setGoogleLoading(false);
    },
  });

  const isLoading = authLoading || localLoading || googleLoading;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Left panel: form area */}
      <div className="flex flex-col justify-center flex-1 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-white dark:bg-gray-800 shadow-2xl z-10">
        <div className="w-full max-w-sm mx-auto lg:w-96">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center justify-center p-3.5 bg-green-50 dark:bg-green-900/30 rounded-2xl border border-green-100 dark:border-green-800 text-primary dark:text-green-400 mb-5">
              <FaSchool className="text-3xl" />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              SmartAttend Rural
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
              AI-Powered Attendance Management for Rural Schools
            </p>
          </div>

          <div className="mt-8">
            <div className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Success Banner */}
                {successMsg && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold animate-pulse">
                    {successMsg}
                  </div>
                )}

                {/* Error Banner */}
                {(error || authError) && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold leading-snug">
                    {error || authError}
                  </div>
                )}

                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Email Address
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
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white dark:bg-gray-700 placeholder-gray-400 sm:text-sm font-medium"
                      placeholder="Enter school email"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                      <FaLock />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white dark:bg-gray-700 placeholder-gray-400 sm:text-sm font-medium"
                      placeholder="Enter secret password"
                    />
                  </div>
                </div>

                {/* Checkbox Options */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4.5 h-4.5 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Remember Me
                    </label>
                  </div>

                  <div className="text-xs font-semibold">
                    <a 
                      href="#" 
                      className="text-secondary hover:text-secondary-dark cursor-pointer" 
                      onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}
                    >
                      Forgot password?
                    </a>
                  </div>
                </div>

                {/* Sign In Button */}
                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex justify-center w-full px-4 py-3.5 text-sm font-bold text-white bg-primary hover:bg-primary-dark border border-transparent rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all duration-150 cursor-pointer"
                  >
                    {localLoading ? (
                      <span className="flex items-center gap-2">
                        <FaSpinner className="animate-spin text-lg" />
                        <span>Logging in...</span>
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs font-semibold uppercase">
                    <span className="bg-white dark:bg-gray-800 px-3 text-gray-400">Or continue with</span>
                  </div>
                </div>

                {/* Continue with Google Button */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleLoading(true);
                      googleLoginTrigger();
                    }}
                    disabled={isLoading}
                    className="flex items-center justify-center w-full px-4 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 transition-all duration-150 cursor-pointer active:scale-[0.99]"
                  >
                    {googleLoading ? (
                      <span className="flex items-center gap-2">
                        <FaSpinner className="animate-spin text-lg text-primary" />
                        <span>Signing in with Google...</span>
                      </span>
                    ) : (
                      <>
                        <GoogleIcon />
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: Graphic illustration panel (hidden on tablets/mobiles) */}
      <div className="hidden lg:block relative flex-1 bg-gradient-to-tr from-primary to-green-900">
        <div className="absolute inset-0 flex flex-col justify-center px-12 text-white bg-green-950 bg-opacity-40">
          <div className="max-w-md">
            <h3 className="text-4xl font-extrabold leading-tight">
              Digitizing Rural Classrooms
            </h3>
            <p className="mt-4 text-base text-green-150 leading-relaxed font-medium">
              SmartAttend helps schools streamline daily attendance records, notifies parents instantly when children are absent, and works offline during electricity or network grid cuts.
            </p>
            <div className="mt-8 flex gap-6 text-sm font-semibold">
              <div className="flex flex-col">
                <span className="text-2xl font-bold">10 min</span>
                <span className="text-green-200 text-xs">Saved Daily</span>
              </div>
              <div className="w-px bg-green-800" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold">100%</span>
                <span className="text-green-200 text-xs">Offline Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
