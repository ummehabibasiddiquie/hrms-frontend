/**
 * Central route paths — single source of truth for React Router + navigate().
 */

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  RESET_PASSWORD: "/reset-password",
  DASHBOARD: "/dashboard",
  AGENT: "/agent",
  AGENT_PROJECTS: "/agent-projects",
  AI_EVALUATION: "/ai-evaluation",
  ENTRY: "/entry",
  QC_FORM: "/qc-form",
};

export const ROLE_IDS = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  PROJECT_MANAGER: 3,
  ASSISTANT_MANAGER: 4,
  QA_AGENT: 5,
  AGENT: 6,
};

/** Default landing page after login (or when access is denied). */
export function getHomeRouteForUser(user) {
  if (!user) return ROUTES.LOGIN;
  if (Number(user.role_id) === ROLE_IDS.AGENT) return ROUTES.AGENT;
  return ROUTES.DASHBOARD;
}

/** Top-level Analytics tabs (Overview area) — each gets its own ?tab= route. */
export const ANALYTICS_TABS = [
  "overview",
  "billable_report",
  "user_monthly_report",
  "project_monthly_report",
  "incentives",
  "mgmt_incentives",
  "my_roster",
  "audit_report",
  "adherence",
];

export function isAnalyticsTab(tab) {
  return ANALYTICS_TABS.includes(tab);
}

/** Build /dashboard?tab=...&adminTab=...&subtab=... URLs for tab navigation. */
export function dashboardTabUrl(tab, extraParams = {}) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value != null && value !== "") params.set(key, String(value));
  });
  return `${ROUTES.DASHBOARD}?${params.toString()}`;
}

export function isLoginPath(pathname) {
  return pathname === ROUTES.LOGIN || pathname === ROUTES.HOME;
}
