import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import DashboardPage from "../pages/DashboardPage";
import Tracker from "../components/AgentDashboard/Tracker.jsx";
import UserTrackingView from "../components/common/UserTrackingView";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoutes";
import { useAuth } from "../context/AuthContext";
import AgentProjectList from "../components/AgentDashboard/AgentProjectList";
import QCFormPage from "../pages/QCFormPage";
import AIEvaluation from "../components/AgentDashboard/AIEvaluation.jsx";
import { ROUTES, getHomeRouteForUser, dashboardTabUrl, ROLE_IDS } from "./paths";

const AppRoutes = () => {
  const { user } = useAuth();
  const homeRoute = getHomeRouteForUser(user);

  return (
    <Routes>
      {/* Public */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
      <Route
        path={ROUTES.HOME}
        element={
          user ? <Navigate to={homeRoute} replace /> : <Navigate to={ROUTES.LOGIN} replace />
        }
      />

      {/* Agent tracker (wraps AppLayout internally) */}
      <Route
        path={ROUTES.AGENT}
        element={
          <ProtectedRoute allowedRoles={[ROLE_IDS.AGENT]}>
            <Tracker />
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.AI_EVALUATION}
        element={
          <ProtectedRoute allowedRoles={[ROLE_IDS.AGENT]}>
            <AppLayout>
              <AIEvaluation />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.ENTRY}
        element={
          <ProtectedRoute allowedRoles={[ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN, ROLE_IDS.PROJECT_MANAGER, ROLE_IDS.ASSISTANT_MANAGER]}>
            <AppLayout>
              <UserTrackingView />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.DASHBOARD}
        element={
          <ProtectedRoute allowedRoles={[1, 2, 3, 4, 5, 6]}>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.QC_FORM}
        element={
          <ProtectedRoute allowedRoles={[1, 2, 3, 4, 5]}>
            <AppLayout>
              <QCFormPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.AGENT_PROJECTS}
        element={
          <ProtectedRoute allowedRoles={[ROLE_IDS.AGENT]}>
            <AppLayout>
              <AgentProjectList />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Legacy URLs → current routes */}
      <Route path="/admin" element={<Navigate to={dashboardTabUrl("manage")} replace />} />
      <Route
        path="/agent-billable-report"
        element={<Navigate to={dashboardTabUrl("billable_report")} replace />}
      />
      <Route
        path="/user-monthly-target"
        element={<Navigate to={dashboardTabUrl("user_monthly_report")} replace />}
      />

      {/* Catch-all must be last */}
      <Route
        path="*"
        element={
          user ? <Navigate to={homeRoute} replace /> : <Navigate to={ROUTES.LOGIN} replace />
        }
      />
    </Routes>
  );
};

export default AppRoutes;
