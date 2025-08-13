import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Auth Components
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';

// Dashboard Components
import CustomerDashboard from './components/customer/CustomerDashboard';
import CleanerDashboard from './components/cleaner/CleanerDashboard';
import CleanerApplication from './components/cleaner/CleanerApplication';

// Existing components (convert to functional components)
import HomePage from './components/HomePage';

// Main App component with authentication
const AppContent = () => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={!isAuthenticated() ? <LoginPage /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!isAuthenticated() ? <RegisterPage /> : <Navigate to="/dashboard" />} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={
        isAuthenticated() ? <DashboardRedirect /> : <Navigate to="/login" />
      } />
      
      {/* Customer Routes */}
      <Route path="/customer/dashboard" element={
        isAuthenticated() && user?.role === 'customer' ? <CustomerDashboard /> : <Navigate to="/login" />
      } />
      
      {/* Cleaner Routes */}
      <Route path="/cleaner/dashboard" element={
        isAuthenticated() && user?.role === 'cleaner' ? <CleanerDashboard /> : <Navigate to="/login" />
      } />
      <Route path="/cleaner/apply" element={
        isAuthenticated() && user?.role === 'cleaner' ? <CleanerApplication /> : <Navigate to="/login" />
      } />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

// Dashboard redirect component
const DashboardRedirect = () => {
  const { user } = useAuth();
  
  if (user?.role === 'customer') {
    return <Navigate to="/customer/dashboard" replace />;
  } else if (user?.role === 'cleaner') {
    return <Navigate to="/cleaner/dashboard" replace />;
  } else if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;