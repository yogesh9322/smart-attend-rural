import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';

// Pages
import Login from '../pages/Login';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import LandingPage from '../pages/LandingPage';
import AdminDashboard from '../pages/AdminDashboard';
import TeacherDashboard from '../pages/TeacherDashboard';
import ParentDashboard from '../pages/ParentDashboard';
import MarkAttendance from '../pages/MarkAttendance';
import StudentManagement from '../pages/StudentManagement';
import TeacherManagement from '../pages/TeacherManagement';
import ParentManagement from '../pages/ParentManagement';
import ClassManagement from '../pages/ClassManagement';
import SchoolSettings from '../pages/SchoolSettings';
import AdminProfile from '../pages/AdminProfile';
import Analytics from '../pages/Analytics';
import Reports from '../pages/Reports';
import Notices from '../pages/Notices';
import MyClasses from '../pages/MyClasses';
import AttendanceHistory from '../pages/AttendanceHistory';
import Timetable from '../pages/Timetable';
import MyChildren from '../pages/MyChildren';
import ChildDetails from '../pages/ChildDetails';
import AttendanceCalendar from '../pages/AttendanceCalendar';
import LeaveRequest from '../pages/LeaveRequest';
import ContactTeacher from '../pages/ContactTeacher';
import SchoolEvents from '../pages/SchoolEvents';
import ParentAIAssistant from '../pages/ParentAIAssistant';
import AIAnalytics from '../pages/AIAnalytics';
import SchoolCalendar from '../pages/SchoolCalendar';
import EventsManagement from '../pages/EventsManagement';
import AdvancedReports from '../pages/AdvancedReports';

// Protected Route Wrapper Component (for sub-routes like /students)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

// Role-based Router Dashboard Dispatcher
const DashboardDispatcher = () => {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }
  if (user?.role === 'teacher') {
    return <TeacherDashboard />;
  }
  if (user?.role === 'parent') {
    return <ParentDashboard />;
  }
  
  return <Navigate to="/login" replace />;
};

// Dynamic Home Route Dispatcher
const HomeRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If logged in, show Dashboard inside MainLayout
  if (user) {
    return (
      <MainLayout>
        <DashboardDispatcher />
      </MainLayout>
    );
  }

  // If unauthenticated, show public Landing Page
  return <LandingPage />;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Dynamic Home Route */}
      <Route path="/" element={<HomeRoute />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Private routes */}
      <Route
        path="/students"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <StudentManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-classes"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <MyClasses />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance/history"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <AttendanceHistory />
          </ProtectedRoute>
        }
      />

      <Route
        path="/timetable"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <Timetable />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teachers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TeacherManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parents"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ParentManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/classes"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ClassManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance/mark"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <MarkAttendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <SchoolSettings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AdminProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notices"
        element={
          <ProtectedRoute>
            <Notices />
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-children"
        element={
          <ProtectedRoute allowedRoles={['admin', 'parent']}>
            <MyChildren />
          </ProtectedRoute>
        }
      />

      <Route
        path="/child/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'parent']}>
            <ChildDetails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance/calendar"
        element={
          <ProtectedRoute allowedRoles={['admin', 'parent']}>
            <AttendanceCalendar />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leave-request"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent']}>
            <LeaveRequest />
          </ProtectedRoute>
        }
      />

      <Route
        path="/contact-teacher"
        element={
          <ProtectedRoute allowedRoles={['admin', 'parent']}>
            <ContactTeacher />
          </ProtectedRoute>
        }
      />

      <Route
        path="/school-events"
        element={
          <ProtectedRoute allowedRoles={['admin', 'parent']}>
            <SchoolEvents />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parent-ai"
        element={
          <ProtectedRoute allowedRoles={['admin', 'parent']}>
            <ParentAIAssistant />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ai-analytics"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <AIAnalytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/school-calendar"
        element={
          <ProtectedRoute>
            <SchoolCalendar />
          </ProtectedRoute>
        }
      />

      <Route
        path="/events"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <EventsManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/advanced-reports"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <AdvancedReports />
          </ProtectedRoute>
        }
      />

      {/* Fallbacks */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
