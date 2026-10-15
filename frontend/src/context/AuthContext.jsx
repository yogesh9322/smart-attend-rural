import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  login as loginApi,
  googleLoginApi,
  getProfile,
  setTabAuthContext,
  clearTabAuthContext,
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('smartattend_user') || localStorage.getItem('smartattend_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync active React user state into api.js tab context immediately
  if (user) {
    const existingToken = sessionStorage.getItem('token') || localStorage.getItem('token');
    setTabAuthContext(existingToken, user);
  }

  useEffect(() => {
    if (user) {
      const existingToken = sessionStorage.getItem('token') || localStorage.getItem('token');
      setTabAuthContext(existingToken, user);
    }
  }, [user]);

  // Hydrate user session on mount if token or cached user exists
  useEffect(() => {
    const bootstrapAsync = async () => {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const cachedUserRaw = sessionStorage.getItem('smartattend_user') || localStorage.getItem('smartattend_user');

      if (token || cachedUserRaw) {
        try {
          const res = await getProfile();
          if (res.success && res.data) {
            setUser(res.data);
            setTabAuthContext(token, res.data);
          }
        } catch (err) {
          console.error('Failed to load profile on bootstrap:', err.message);
          // Do not wipe localStorage token on transient network/restart errors
          // If cachedUserRaw exists, keep user session alive
          if (cachedUserRaw && !user) {
            try {
              setUser(JSON.parse(cachedUserRaw));
            } catch {}
          }
        }
      }
      setLoading(false);
    };

    bootstrapAsync();
  }, []);

  const loginUser = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await loginApi(email, password);
      if (res.success) {
        const fullUser = res.user;
        setTabAuthContext(res.token, fullUser);
        setUser(fullUser);
        setLoading(false);
        // Refresh profile non-blockingly in background
        getProfile().then(pRes => {
          if (pRes?.success) {
            setUser(pRes.data);
            setTabAuthContext(res.token, pRes.data);
          }
        }).catch(() => {});
        return { success: true, role: fullUser.role, user: fullUser };
      }
      throw new Error(res.message || 'Login failed');
    } catch (err) {
      let errMsg = err.response?.data?.message || err.message || 'Something went wrong';
      if (errMsg === 'Network Error' || !err.response) {
        errMsg = 'Network Error: Unable to reach the server. Please verify your internet connection or check if the backend server is running.';
      }
      setError(errMsg);
      setLoading(false);
      return { success: false, error: errMsg };
    }
  };

  const loginWithGoogle = async (credential) => {
    setError(null);
    setLoading(true);
    try {
      const res = await googleLoginApi(credential);
      if (res.success) {
        const fullUser = res.user;
        setTabAuthContext(res.token, fullUser);
        setUser(fullUser);
        setLoading(false);
        // Refresh profile non-blockingly in background
        getProfile().then(pRes => {
          if (pRes?.success) {
            setUser(pRes.data);
            setTabAuthContext(res.token, pRes.data);
          }
        }).catch(() => {});
        return { success: true, role: fullUser.role, user: fullUser };
      }
      throw new Error(res.message || 'Google Login failed');
    } catch (err) {
      let errMsg = err.response?.data?.message || err.message || 'Google Sign-In failed.';
      if (errMsg === 'Network Error' || !err.response) {
        errMsg = 'Network Error: Unable to reach the server. Please verify your internet connection or check if the backend server is running.';
      }
      setError(errMsg);
      setLoading(false);
      return { success: false, error: errMsg };
    }
  };

  const logoutUser = () => {
    clearTabAuthContext();
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const res = await getProfile();
      if (res.success) {
        const existingToken = sessionStorage.getItem('token') || localStorage.getItem('token');
        setTabAuthContext(existingToken, res.data);
        setUser(res.data);
        return { success: true, data: res.data };
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err.message);
    }
    return { success: false };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginUser,
        loginWithGoogle,
        logoutUser,
        refreshProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
