import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as loginApi, googleLoginApi, getProfile } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hydrate user session on mount if token exists
  useEffect(() => {
    const bootstrapAsync = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await getProfile();
          if (res.success) {
            setUser(res.data);
          } else {
            localStorage.removeItem('token');
          }
        } catch (err) {
          console.error('Failed to load profile on bootstrap:', err.message);
          localStorage.removeItem('token');
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
        localStorage.setItem('token', res.token);
        const profileRes = await getProfile();
        const fullUser = profileRes.success ? profileRes.data : res.user;
        setUser(fullUser);
        setLoading(false);
        return { success: true, role: fullUser.role };
      }
      throw new Error(res.message || 'Login failed');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Something went wrong';
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
        localStorage.setItem('token', res.token);
        const profileRes = await getProfile();
        const fullUser = profileRes.success ? profileRes.data : res.user;
        setUser(fullUser);
        setLoading(false);
        return { success: true, role: fullUser.role, user: fullUser };
      }
      throw new Error(res.message || 'Google Login failed');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Google Sign-In failed.';
      setError(errMsg);
      setLoading(false);
      return { success: false, error: errMsg };
    }
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const res = await getProfile();
      if (res.success) {
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
