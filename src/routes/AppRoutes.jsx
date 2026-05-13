import OverviewTab from '../components/dashboard/overview/OverviewTab';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import DashboardPage from "../pages/DashboardPage";
import AdminPage from "../pages/AdminPage";
import RosterPage from "../pages/AssistantManagerRoster";
import AssistantManagerRoster from "../pages/AssistantManagerRoster";
import SuperAdminApproval from "../pages/SuperAdminApproval";
import UserRosterReport from "../pages/UserRosterReport";
import Tracker from "../components/AgentDashboard/Tracker.jsx";
import UserTrackingView from "../components/common/UserTrackingView";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoutes";
import { useAuth } from "../context/AuthContext";
import AgentProjectList from "../components/AgentDashboard/AgentProjectList";
import QCFormPage from "../pages/QCFormPage";
import AIEvaluation from "../components/AgentDashboard/AIEvaluation.jsx";

const AppRoutes = () => {
  const { user } = useAuth();

  // Role-based redirect for already-logged-in users (use role_id)
  const getDashboardRoute = () => {
    if (!user) return "/";
    // Agents go to /agent (tracker entry) by default
    if (user.role_id === 6) return "/agent";
    // All other users go to /dashboard
    return "/dashboard";
  };

  return (
    <Routes>
        {/* Public routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Agent Dashboard (Data Entry) */}
        <Route
          path="/agent"
          element={
            <ProtectedRoute allowedRoles={[6]}>
              <Tracker />
            </ProtectedRoute>
          }
        />

        {/* AI Evaluation (Agent Only) */}
        <Route
          path="/ai-evaluation"
          element={
            <ProtectedRoute allowedRoles={[6]}>
              <AppLayout>
                <AIEvaluation />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* User Permission (Admin and Assistant Managers) */}
        <Route
          path="/entry"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <AppLayout>
                <UserTrackingView />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Dashboard for all roles (Analytics/Overview for agents, full dashboard for admins) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={[1,2,3,4,5,6]}>
              <AppLayout>
                {/* Render OverviewTab for agents, DashboardPage for others */}
                {user && user.role_id === 6 ? (
                  <OverviewTab isAgent={true} />
                ) : (
                  <DashboardPage />
                )}
              </AppLayout>
            </ProtectedRoute>
          }
        />

                {/* Agent Billable Report (separate route for agents, uses OverviewTab for tab logic) */}
        <Route
          path="/agent-billable-report"
          element={
            <ProtectedRoute allowedRoles={[6]}>
              <AppLayout>
                {/* Force remount on route change for agent tabs */}
                <OverviewTab isAgent={true} key={window.location.pathname} />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* Billable Report Card Page */}
        <Route
          path="/user-monthly-target"
          element={
            <ProtectedRoute allowedRoles={[1,2,3,4,5,6]}>
              <AppLayout>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin panel (for admin, super admin and assistant managers) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4]}>
              <AppLayout>
                <AdminPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Roster Management (for Assistant Managers) */}
        <Route
          path="/roster"
          element={
            <ProtectedRoute allowedRoles={[4]}>
              <AppLayout>
                <RosterPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Assistant Manager Roster (Dedicated View) */}
        <Route
          path="/assistant-manager-roster"
          element={
            <ProtectedRoute allowedRoles={[4]}>
              <AppLayout>
                <AssistantManagerRoster />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Super Admin Roster Approval */}
        <Route
          path="/super-admin-approval"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <AppLayout>
                <SuperAdminApproval />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* User Roster Report (All users can view their own report) */}
        <Route
          path="/my-roster-report"
          element={
            <ProtectedRoute allowedRoles={[1,2,3,4,5,6]}>
              <AppLayout>
                <UserRosterReport />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* QC Form page (for QA agents and admins) */}
        <Route
          path="/qc-form"
          element={
            <ProtectedRoute allowedRoles={[1, 2, 3, 4, 5]}>
              <AppLayout>
                <QCFormPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback: if already logged in, redirect to correct dashboard; else show login */}
        <Route path="*" element={user ? <Navigate to={getDashboardRoute()} replace /> : <Navigate to="/" replace />} />

        {/* Agent Projects (Data Entry) */}
        <Route
          path="/agent-projects"
          element={
            <ProtectedRoute allowedRoles={[6]}>
              <AppLayout>
                <AgentProjectList />
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
  );
};

export default AppRoutes;