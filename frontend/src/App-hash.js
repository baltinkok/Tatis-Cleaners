import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
// ... rest of your imports

// Replace BrowserRouter with HashRouter temporarily
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          {/* Your routes */}
        </Router>
      </AuthProvider>  
    </ErrorBoundary>
  );
}

export default App;