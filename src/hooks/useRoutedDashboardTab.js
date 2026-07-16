import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { dashboardTabUrl } from "../routes/paths";

/**
 * Sync a dashboard tab with ?tab= (same pattern as Manage's ?adminTab=).
 */
export function useRoutedDashboardTab(defaultTab = "overview") {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get("tab") || defaultTab;

  const setActiveTab = useCallback(
    (tab) => {
      if (!tab || tab === activeTab) return;
      navigate(dashboardTabUrl(tab));
    },
    [navigate, activeTab]
  );

  return [activeTab, setActiveTab];
}

/**
 * Sync a nested sub-tab with ?subtab= while keeping the current ?tab= (and optional extras).
 * Example: /dashboard?tab=agent_file_report&subtab=rework_review
 */
export function useRoutedSubTab(defaultSubtab, options = {}) {
  const {
    paramName = "subtab",
    parentTab,
    extraParams = {},
  } = options;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeSubTab = searchParams.get(paramName) || defaultSubtab;
  const currentTab = parentTab || searchParams.get("tab") || "overview";

  const setActiveSubTab = useCallback(
    (subtab) => {
      if (!subtab || subtab === activeSubTab) return;
      const nextExtras = { ...extraParams };
      // Preserve adminTab when under Manage
      const adminTab = searchParams.get("adminTab");
      if (adminTab) nextExtras.adminTab = adminTab;
      nextExtras[paramName] = subtab;
      navigate(dashboardTabUrl(currentTab, nextExtras));
    },
    [navigate, currentTab, paramName, extraParams, searchParams, activeSubTab]
  );

  return [activeSubTab, setActiveSubTab];
}
