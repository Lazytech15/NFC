import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { auth } from './firebase-config';
import FileManager from './File_Manager/File_Manager.jsx';
import Header from "./Header/Header.jsx";
import Dashboard from "./Dashboard/Dashboard.jsx";
import Loginform from './Login/Loginform.jsx';
import EventDetails from './Event_details/Event_details.jsx'; 
import styles from './Dashboard/Dashboard.module.css'
import { Loader } from 'lucide-react';

// Single auth check component
const AuthCheck = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className={styles.loading_container}>
            <Loader size={40} className={styles.spinner} />
            <p>Loading...</p>
          </div>;
  }

  // Handle public routes
  if (!user && window.location.pathname === '/login') {
    return children;
  }

  // Handle protected routes
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Handle logged-in user trying to access login page
  if (user && window.location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Root route */}
        <Route 
          path="/" 
          element={
            <AuthCheck>
              <Navigate to="/dashboard" replace />
            </AuthCheck>
          } 
        />
        
        {/* Login route */}
        <Route 
          path="/login" 
          element={
            <AuthCheck>
              <Loginform />
            </AuthCheck>
          } 
        />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <AuthCheck>
              <div>
                {/* <Header /> */}
                <Dashboard />
              </div>
            </AuthCheck>
          } 
        />
        
        {/* FileManager with specific folder Route */}
          <Route 
            path="/files/*" 
            element={
              <AuthCheck>
                <div>
                  {/* <Header /> */}
                  <FileManager />
                </div>
              </AuthCheck>
            } 
          />

        {/* FileManager with specific folder Route */}
        <Route 
          path="/files/:folderId" 
          element={
            <AuthCheck>
              <div>
                {/* <Header /> */}
                <FileManager />
              </div>
            </AuthCheck>
          } 
        />
        
        {/* Event Details Route */}
        <Route 
          path="/event-details/:eventId" 
          element={
            <AuthCheck>
              <div>
                {/* <Header /> */}
                <EventDetails />
              </div>
            </AuthCheck>
          } 
        />

        {/* Catch-all route */}
        <Route 
          path="*" 
          element={
            <Navigate to="/" replace />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;