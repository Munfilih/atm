import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export const AuthRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    if (user) {
    return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
