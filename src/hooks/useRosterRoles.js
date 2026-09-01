import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

export function useRosterRoles() {
  const { user } = useAuth();

  return useMemo(() => {
    const roleId = Number(user?.role_id ?? user?.user_role_id ?? 0);
    const role = String(user?.role || user?.role_name || "").toLowerCase();
    const designation = String(user?.designation || user?.user_designation || "").toLowerCase();

    const isSuperAdmin =
      roleId === 1 || role.includes("super") || designation.includes("super");
    const isAdmin =
      !isSuperAdmin && (roleId === 2 || role === "admin" || designation.includes("admin"));
    const isProjectManager =
      roleId === 3 || role.includes("project manager") || designation.includes("project manager");
    const isAssistantManager =
      roleId === 4 || role.includes("assistant") || designation.includes("assistant");
    const isQA =
      roleId === 5 || role.includes("qa") || designation === "qa";
    const isAgent =
      roleId === 6 || role === "agent" || designation === "agent";

    const canManageRoster =
      isSuperAdmin || isAdmin || isProjectManager || isAssistantManager;
    const canApproveRoster = isSuperAdmin || isAdmin;
    const canResetRegenerate = isSuperAdmin;
    const canModifyHolidayMaster = isSuperAdmin;
    const canViewMyRoster = isAgent || isQA;

    return {
      user,
      roleId,
      isSuperAdmin,
      isAdmin,
      isProjectManager,
      isAssistantManager,
      isQA,
      isAgent,
      canManageRoster,
      canApproveRoster,
      canResetRegenerate,
      canModifyHolidayMaster,
      canViewMyRoster,
    };
  }, [user]);
}
