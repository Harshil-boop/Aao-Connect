import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import PublicForm from './pages/PublicForm';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardOverview from './pages/admin/DashboardOverview';
import ApplicantsManagement from './pages/admin/ApplicantsManagement';
import AccountSettings from './pages/admin/AccountSettings';

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Application Form Only (No Admin links or info) */}
          <Route path="/" element={<PublicForm />} />

          {/* Secure Admin Login */}
          <Route path="/admin-panel/login" element={<AdminLogin />} />

          {/* Modular Admin Portal with Separate Pages */}
          <Route path="/admin-panel" element={<AdminLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="applicants" element={<ApplicantsManagement />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>

          {/* Fallback & Redirects */}
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="/admin/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
