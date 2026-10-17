import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check if user explicitly toggled theme previously
    const userTheme = localStorage.getItem('smartattend_user_theme');
    if (userTheme === 'dark' || userTheme === 'light') {
      return userTheme;
    }
    // Clear legacy system auto-detected theme if present
    try {
      localStorage.removeItem('theme');
    } catch (e) {}
    // Always default to 'light' across all devices (signature green & clean light appearance)
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('smartattend_user_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('smartattend_user_theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
