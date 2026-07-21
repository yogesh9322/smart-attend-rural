import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import './i18n';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '659170779872-s0oev21csfbu07d2imlpsjcdcn2a3e2i.apps.googleusercontent.com';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
