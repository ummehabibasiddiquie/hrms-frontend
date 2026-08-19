import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import AgentGoalStatusModal from './components/AgentDashboard/AgentGoalStatusModal';
import { Toaster } from "react-hot-toast";
import { BrowserRouter } from 'react-router-dom';

const AgentGoalModalHost = () => {
  const { user } = useAuth();
  if (Number(user?.role_id) !== 6) return null;
  return <AgentGoalStatusModal />;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '8px',
              background: '#18181b',
              color: '#fff',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              fontSize: '1rem',
              boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)',
              padding: '14px 20px',
              minWidth: '220px',
              maxWidth: '90vw',
              animation: 'toastSlideIn 0.35s ease-out',
            },
            success: {
              style: { background: '#22c55e', color: '#fff' },
              className: 'toast-success toast-animate',
              iconTheme: { primary: '#fff', secondary: '#16a34a' },
            },
            error: {
              style: { background: '#ef4444', color: '#fff' },
              className: 'toast-animate',
              iconTheme: { primary: '#fff', secondary: '#b91c1c' },
            },
          }}
        />
        <AppRoutes />
        <AgentGoalModalHost />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
