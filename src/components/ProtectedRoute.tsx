import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If user's role is not allowed, redirect to their main hub.
    // If they are cashier, redirect to POS. If admin/manager, goes to dashboard.
    return user.role === 'CASHIER' ? <Navigate to="/pos" replace /> : <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}
