import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROUTES, getHomeRouteForUser } from "./paths";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (allowedRoles) {
    const roleId = Number(user.role_id);
    if (!allowedRoles.includes(roleId)) {
      return <Navigate to={getHomeRouteForUser(user)} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
