/** HRMS role_id values. Operations is PM-like access, not a Project Manager. */
export const ROLE_SUPER_ADMIN = 1;
export const ROLE_ADMIN = 2;
export const ROLE_PROJECT_MANAGER = 3;
export const ROLE_ASSISTANT_MANAGER = 4;
export const ROLE_QA = 5;
export const ROLE_AGENT = 6;
export const ROLE_ASSISTANT_TEAM_LEADER = 7;
export const ROLE_OPERATIONS = 8;

export function normRoleName(roleName) {
  return String(roleName || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Project Manager menus and data scope — includes Operations. Not the Add-User PM dropdown. */
export function isProjectManagerLike(roleId, roleName) {
  const id = Number(roleId);
  const n = normRoleName(roleName);
  return (
    id === ROLE_PROJECT_MANAGER ||
    id === ROLE_OPERATIONS ||
    n.includes("project manager") ||
    n === "operations"
  );
}
