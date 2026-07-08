import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Billing from './pages/Billing.jsx';
import Warehouse from './pages/Warehouse.jsx';
import './App.css';

// Simple Route Guard
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    // Falls back to mock authentication if no token is saved yet (to ease review)
    // We can require sign in but let's check: if we log in once, we set token.
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* App Shell Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="billing" element={<Billing />} />
          <Route path="warehouse" element={<Warehouse />} />
        </Route>

        {/* Fallback redirection */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
