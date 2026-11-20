import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { isOperationsRole, isProjectManagerLike } from "../utils/roles";

export function useRosterRoles() {
  const { user } = useAuth();

  return useMemo(() => {
    const roleId = Number(user?.role_id ?? user?.user_role_id ?? 0);
    const role = String(user?.role || user?.role_name || "").toLowerCase().trim();

    const isSuperAdmin = roleId === 1 || role.includes("super");
    const isAdmin = !isSuperAdmin && (roleId === 2 || role === "admin");
    const isOperations = isOperationsRole(roleId, role);
    const isProjectManager = isProjectManagerLike(roleId, role);
    const isTeamLeader = roleId === 7 || role.includes("team leader");
    const isAssistantManager =
      !isTeamLeader &&
      (roleId === 4 || role === "assistant manager" || (role.includes("assistant") && !role.includes("team leader")));
    const isQA = roleId === 5 || role === "qa" || role.includes("qa");
    const isAgent = roleId === 6 || role === "agent";

    const canManageRoster =
      !isOperations &&
      (isSuperAdmin || isAdmin || isProjectManager || isAssistantManager || isTeamLeader);
    const canViewRoster = canManageRoster || isOperations;
    // Approvals: Admin and Super Admin only
    const canApproveRoster = isSuperAdmin || isAdmin;
    const canResetRegenerate = isSuperAdmin || isAdmin;
    const canModifyHolidayMaster = isSuperAdmin || isAdmin;
    const canViewMyRoster = isAgent || isQA;

    return {
      user,
      roleId,
      isSuperAdmin,
      isAdmin,
      isProjectManager,
      isOperations,
      isAssistantManager,
      isTeamLeader,
      isQA,
      isAgent,
      canManageRoster,
      canViewRoster,
      canApproveRoster,
      canResetRegenerate,
      canModifyHolidayMaster,
      canViewMyRoster,
    };
  }, [user]);
}
