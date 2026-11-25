import React, { useState, useEffect, useRef } from "react";
// Role ID to role string mapping
const ROLE_MAP = {
  1: "SUPER_ADMIN",
  2: "ADMIN",
  3: "PROJECT_MANAGER",
  4: "ASSISTANT_MANAGER",
  5: "QA_AGENT",
  6: "AGENT",
  7: "TEAM_LEADER",
  8: "OPERATIONS",
};
import { ViewState } from "../../utils/constants";
import { ROUTES, dashboardTabUrl } from "../../routes/paths";
import {
  LayoutDashboard,
  PenTool,
  Database,
  LogOut,
  Settings,
  Award,
  CalendarClock,
  BookOpen,
  Menu,
  X,
  FileText,
  Users,
  Briefcase,
  Brain,
  UserCheck,
  BarChart3,
  CheckCircle2,
  CalendarDays,
  Mail,
  Clock,
  FolderKanban,
  ChevronDown,
  ClipboardCheck
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import GeminiKeyModal from "../GeminiKeyModal";
import { fetchGeminiApiKey } from "../../services/agentService";
import { useAuth } from "../../context/AuthContext";

import logo from "../../assets/Transform logo.png";

const QC_NAV_VIEWS = new Set(["AGENT_LIST", "QC_REPORT_OVERVIEW", "QA_AGENT_AUDIT"]);

const Header = ({
  currentUser,
  handleLogout,
  canAccessEntry,
  canAccessManage,
  canAccessQuality,
  isAgent
}) => {
  // Debug: Log currentUser to check available properties
  useEffect(() => {
    // eslint-disable-next-line
    Briefcase
  }, [currentUser]);
  // Helper to get initials from user's name
  const getInitials = () => {
    const name = currentUser?.name || currentUser?.user_name || currentUser?.username || "";
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length === 1) {
      return parts[0][0]?.toUpperCase() || "";
    }
    return `${parts[0][0]?.toUpperCase() || ""}${parts[parts.length - 1][0]?.toUpperCase() || ""}`;
  };
  // Debug: Log currentUser to check available properties
  // console.log('Header currentUser:', currentUser);
  const { canAccessAgentFilesQc, canAccessQaAgentAudit, canAccessQcReportOverview } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [qcMenuOpen, setQcMenuOpen] = useState(false);
  const [geminiKeyOpen, setGeminiKeyOpen] = useState(false);
  const qcMenuRef = useRef(null);
  const navigate = useNavigate();

  const location = useLocation();

  // Fetch Gemini API key status on mount
  useEffect(() => {
    const userId = currentUser?.user_id || currentUser?.id;
    if (!userId || sessionStorage.getItem("gemini_api_key")) return;

    const loadKey = async () => {
      try {
        const res = await fetchGeminiApiKey(userId);
        if (res.success && res.hasKey && res.gemini_api_key) {
          sessionStorage.setItem("gemini_api_key", res.gemini_api_key);
          window.dispatchEvent(new CustomEvent("gemini-key-updated"));
        }
      } catch (error) {
        console.error("[Header] Failed to load Gemini key:", error);
      }
    };

    loadKey();
  }, [currentUser]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (qcMenuRef.current && !qcMenuRef.current.contains(event.target)) {
        setQcMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Get role label from role_id or role string
  const getRoleLabel = () => {
    if (currentUser?.role_id) {
      const roleName = ROLE_MAP[Number(currentUser.role_id)] || "";
      return roleName.replace("_", " ").replace("SUPER ADMIN", "Admin");
    }
    // fallback to role string
    return (currentUser?.role || currentUser?.role_name || currentUser?.user_role || "").toString();
  };

  // -----------------------------
  // ROUTE HELPERS (see routes/paths.js for path constants)
  // -----------------------------

  const goTo = (view) => {
    setQcMenuOpen(false);
    const roleId = Number(currentUser.role_id);
    const role = (currentUser?.role || currentUser?.role_name || currentUser?.user_role || '').toString().toUpperCase();
    
    // Handle Analytics tab for all roles: always go to /dashboard?tab=overview
    if (view === ViewState.DASHBOARD || view === 'DASHBOARD' || view === 'Analytics') {
      navigate(dashboardTabUrl('overview'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'TRACKER_REPORT') {
      navigate(dashboardTabUrl('tracker_report'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'QA_HOURS') {
      navigate(dashboardTabUrl('qa_hours'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'AGENT_LIST') {
      navigate(dashboardTabUrl('agent_file_report'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'QC_REPORT_OVERVIEW') {
      navigate(dashboardTabUrl('qc_report_overview'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'QA_AGENT_AUDIT') {
      navigate(dashboardTabUrl('qa_agent_audit', { subtab: 'audit_form' }));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'MY_ROSTER') {
      navigate(dashboardTabUrl('my_roster'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'SOPS') {
      navigate(dashboardTabUrl('sops'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'MY_PROJECTS') {
      navigate(dashboardTabUrl('my_projects'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'MY_REPORT') {
      navigate(dashboardTabUrl('my_hours'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'REPORT_EMAILS') {
      navigate(dashboardTabUrl('report_emails'));
      setIsMobileMenuOpen(false);
      return;
    }
    
    if (view === ViewState.ADMIN_PANEL) {
      navigate(dashboardTabUrl('manage'));
      setIsMobileMenuOpen(false);
      return;
    }
    
    if (roleId === 6 || (role.includes('AGENT') && !role.includes('QA') && roleId !== 5)) {
      if (view === ViewState.ENTRY || view === 'ENTRY') {
        navigate(ROUTES.AGENT);
      } else if (view === ViewState.DASHBOARD || view === 'DASHBOARD') {
        navigate(ROUTES.DASHBOARD);
      } else if (view === 'billable_report') {
        navigate(dashboardTabUrl('billable_report'));
      } else if (view === 'AI_EVALUATION') {
        navigate(ROUTES.AI_EVALUATION);
        setIsMobileMenuOpen(false);
        return;
      } else if (view === 'AGENT_PROJECTS') {
        navigate(ROUTES.AGENT_PROJECTS);
        setIsMobileMenuOpen(false);
        return;
      } else {
        navigate(ROUTES.AGENT);
      }
    } else {
      navigate(ROUTES.DASHBOARD);
    }
    setIsMobileMenuOpen(false);
  };

  // -----------------------------
  // Nav Items (Header Buttons)
  // -----------------------------

  // Role-based tab mapping
  // Debug: Log currentUser to check available properties

  const getNavItems = () => {
    const roleId = Number(currentUser?.role_id);
    const role = (currentUser?.role || currentUser?.role_name || currentUser?.user_role || '').toString().toUpperCase();
    // Always show for admin and super admin (by role_id)
    if (roleId === 1 || roleId === 2) {
      const items = [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
        { view: "QA_HOURS", label: "QA Report", icon: Clock },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
      if (roleId === 1) {
        items.push({ view: "REPORT_EMAILS", label: "Emails", icon: Mail });
      }
      return items;
    }
    // For field agents only — "QA AGENT" also contains "AGENT"
    if (roleId === 6 || (role.includes('AGENT') && !role.includes('QA') && roleId !== 5)) {
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "MY_ROSTER", label: "My Roster", icon: CalendarDays },
        { view: ViewState.ENTRY, label: "Tracker", icon: PenTool },
        { view: "AI_EVALUATION", label: "AI", icon: Brain },
      ];
    }
    if (!role) {
      // Try role_id mapping if role string is missing
      if (currentUser?.role_id) {
        if (roleId === 5) {
          return [
            { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
            { view: "MY_REPORT", label: "My Report", icon: Clock },
            { view: "MY_ROSTER", label: "My Roster", icon: CalendarDays },
            { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
            { view: "AGENT_LIST", label: "Agent Files", icon: Users },
            { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
          ];
        }
        if (roleId === 3 || roleId === 8) {
          return [
            { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
            { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
            { view: "QA_HOURS", label: "QA Report", icon: Clock },
            { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
          ];
        }
        if (roleId === 4) {
          return [
            { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
            { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
            { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
          ];
        }
        if (roleId === 7) {
          // Team Leader: team view plus QA work (QC on agents where they are set as the QA)
          return [
            { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
            { view: "MY_REPORT", label: "My Report", icon: Clock },
            { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
            { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
          ];
        }
        // All other role_ids (not admin/superadmin)
        return [
          { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
          { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
        ];
      }
      return [];
    }
    if (role.includes('QA')) {
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "MY_REPORT", label: "My Report", icon: Clock },
        { view: "MY_ROSTER", label: "My Roster", icon: CalendarDays },
        { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
        { view: "AGENT_LIST", label: "Agent Files", icon: Users },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
    }
    if (role.includes('TEAM LEADER') || role.includes('TEAM_LEADER') || roleId === 7) {
      // Team Leader: team view plus QA work (QC on agents where they are set as the QA)
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "MY_REPORT", label: "My Report", icon: Clock },
        { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
    }
    if (role.includes('ASSISTANT') || role.includes('ASST')) {
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
    }
    // Project Manager fallback
    if (role.includes('PROJECT_MANAGER') || role.replace(/\s+/g, '').toLowerCase() === 'projectmanager' || role.includes('OPERATIONS') || roleId === 3 || roleId === 8) {
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "TRACKER_REPORT", label: "Tracker", icon: FileText },
        { view: "QA_HOURS", label: "QA Report", icon: Clock },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
    }
    // Default: show nothing or fallback
    return [];
  };

  const navItems = (() => {
    const items = getNavItems();
    const insertAfter = (view, tab) => {
      if (!items.length || items.some((i) => i.view === tab.view)) return;
      const idx = items.findIndex((i) => i.view === view);
      if (idx >= 0) items.splice(idx + 1, 0, tab);
      else items.splice(Math.min(1, items.length), 0, tab);
    };
    const hasQcOverviewFlag =
      Number(currentUser?.qc_overview_permission) === 1;
    if (canAccessAgentFilesQc) {
      insertAfter("TRACKER_REPORT", { view: "AGENT_LIST", label: "Agent Files", icon: Users });
    }
    if (canAccessQcReportOverview) {
      insertAfter("AGENT_LIST", { view: "QC_REPORT_OVERVIEW", label: "QC Overview", icon: BarChart3 });
      if (!items.some((i) => i.view === "QC_REPORT_OVERVIEW")) {
        insertAfter("TRACKER_REPORT", { view: "QC_REPORT_OVERVIEW", label: "QC Overview", icon: BarChart3 });
      }
    } else {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (items[i].view === "QC_REPORT_OVERVIEW") items.splice(i, 1);
      }
    }
    // Overview permission (any role) replaces QA Report (hours). Agent Files only keeps Agent Files & QC.
    if (hasQcOverviewFlag) {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (items[i].view === "QA_HOURS") items.splice(i, 1);
      }
    }
    if (canAccessQaAgentAudit) {
      insertAfter("QC_REPORT_OVERVIEW", { view: "QA_AGENT_AUDIT", label: "Audit", icon: UserCheck });
      if (!items.some((i) => i.view === "QA_AGENT_AUDIT")) {
        insertAfter("AGENT_LIST", { view: "QA_AGENT_AUDIT", label: "Audit", icon: UserCheck });
      }
    }
    if (!items.length) return items;
    const moveAiLast = (list) => {
      const ai = list.filter((i) => i.view === "AI_EVALUATION");
      const rest = list.filter((i) => i.view !== "AI_EVALUATION");
      return [...rest, ...ai];
    };
    const roleId = Number(currentUser?.role_id);
    const roleName = String(
      currentUser?.role_name || currentUser?.role || currentUser?.user_role || ""
    ).toLowerCase();
    const isAssistantManager =
      roleId === 4 ||
      roleName === "assistant manager" ||
      (roleName.includes("assistant") && !roleName.includes("team leader")) ||
      (roleName.includes("asst") && !roleName.includes("team leader"));
    // Admin, Super Admin and Project Manager manage SOPs from Manage; everyone else views them here.
    if (roleId === 1 || roleId === 2 || roleId === 3 || roleId === 8) return moveAiLast(items);
    const sops = { view: "SOPS", label: "SOPs", icon: BookOpen };
    const isFieldAgent =
      isAgent ||
      roleId === 6 ||
      (roleName.includes("agent") && !roleName.includes("qa"));
    // AM has Manage → Projects & Targets. Agents pick projects in Tracker; they do not need this tab.
    if (isAssistantManager || isFieldAgent) return moveAiLast([...items, sops]);
    return moveAiLast([...items, { view: "MY_PROJECTS", label: "Projects", icon: FolderKanban }, sops]);
  })();
  // DEBUG: Log navItems and currentUser for troubleshooting tab visibility

  // Helper function to check if a tab is active
  const isTabActive = (view) => {
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const currentTab = searchParams.get('tab');
    const roleId = Number(currentUser?.role_id);
    const role = (currentUser?.role || currentUser?.role_name || currentUser?.user_role || '').toString().toUpperCase();

    // Check for Analytics/Dashboard
    if (view === ViewState.DASHBOARD || view === 'Analytics') {
      const analyticsTabs = ['overview', 'billable_report', 'user_monthly_report', 'project_monthly_report', 'audit_report', 'kra_report'];
      return currentPath === '/dashboard' && (!currentTab || analyticsTabs.includes(currentTab));
    }

    // Check for Tracker Report
    if (view === 'TRACKER_REPORT') {
      return currentPath === '/dashboard' && currentTab === 'tracker_report';
    }

    if (view === 'QA_HOURS') {
      return currentPath === '/dashboard' && currentTab === 'qa_hours';
    }

    // Check for Agent List/Agent's Files & QC Report
    if (view === 'AGENT_LIST') {
      return currentPath === '/dashboard' && currentTab === 'agent_file_report';
    }

    // Check for QC Report Overview
    if (view === 'QC_REPORT_OVERVIEW') {
      return currentPath === '/dashboard' && currentTab === 'qc_report_overview';
    }

    // Check for QA Agent Audit
    if (view === 'QA_AGENT_AUDIT') {
      return currentPath === '/dashboard' && currentTab === 'qa_agent_audit';
    }

    if (view === 'MY_ROSTER') {
      return currentPath === '/dashboard' && currentTab === 'my_roster';
    }

    if (view === 'SOPS') {
      return currentPath === '/dashboard' && (currentTab === 'sops' || (currentTab === 'manage' && searchParams.get('adminTab') === 'sops'));
    }

    if (view === 'MY_REPORT') {
      return currentPath === '/dashboard' && currentTab === 'my_hours';
    }

    if (view === 'MY_PROJECTS') {
      return currentPath === '/dashboard' && currentTab === 'my_projects';
    }

    if (view === 'REPORT_EMAILS') {
      return currentPath === '/dashboard' && currentTab === 'report_emails';
    }

    // Check for Manage/Admin Panel
    if (view === ViewState.ADMIN_PANEL) {
      return currentPath === ROUTES.DASHBOARD && currentTab === 'manage';
    }

    if (view === ViewState.ENTRY) {
      if (roleId === 6 || role.includes('AGENT')) {
        return currentPath === ROUTES.AGENT;
      }
      return false;
    }

    if (view === 'AI_EVALUATION') {
      return currentPath === ROUTES.AI_EVALUATION;
    }

    if (view === 'AGENT_PROJECTS') {
      return currentPath === ROUTES.AGENT_PROJECTS;
    }

    // Check for Billable Report
    if (view === 'billable_report') {
      return currentPath === '/dashboard' && currentTab === 'billable_report';
    }

    return false;
  };

  // -----------------------------
  // NAV BUTTON UI (Desktop)
  // -----------------------------
  const renderNavButton = (item) => {
    const isActive = isTabActive(item.view);
    return (
      <button
        key={item.view}
        onClick={() => !item.disabled && goTo(item.view)}
        className={`inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          isActive
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'text-slate-600 bg-slate-50 hover:bg-slate-200'
        } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={item.disabled}
        title={item.disabled ? 'Projects tab is temporarily disabled' : item.label}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span>{item.label}</span>
      </button>
    );
  };

  const renderQcDropdown = (items) => {
    const isActive = items.some((item) => isTabActive(item.view));
    return (
      <div key="qc" className="relative shrink-0" ref={qcMenuRef}>
        <button
          type="button"
          onClick={() => setQcMenuOpen((open) => !open)}
          className={`inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            isActive
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "text-slate-600 bg-slate-50 hover:bg-slate-200"
          }`}
        >
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span>QC</span>
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${qcMenuOpen ? "rotate-180" : ""}`} />
        </button>
        {qcMenuOpen && (
          <div className="absolute left-0 top-full mt-2 z-[80] w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            {items.map((item) => {
              const active = isTabActive(item.view);
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => !item.disabled && goTo(item.view)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderDesktopNav = () => {
    const qcItems = navItems.filter((item) => QC_NAV_VIEWS.has(item.view));
    const groupQc = qcItems.length > 1;
    let qcDone = false;
    return navItems.map((item) => {
      if (groupQc && QC_NAV_VIEWS.has(item.view)) {
        if (qcDone) return null;
        qcDone = true;
        return renderQcDropdown(qcItems);
      }
      return renderNavButton(item);
    });
  };

  // -----------------------------
  // NAV BUTTON UI (Mobile)
  // -----------------------------
  const renderMobileNavButton = (item) => {
    const isActive = isTabActive(item.view);
    return (
      <button
        key={item.view}
        onClick={() => goTo(item.view)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors w-full ${
          isActive
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'text-slate-700 bg-slate-50 hover:bg-slate-200'
        }`}
      >
        <item.icon className="w-5 h-5" />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50 left-0 right-0 overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-visible">
          <div className="flex items-center justify-between h-16 overflow-visible">
            {/* LEFT: LOGO */}
            <div className="flex items-center gap-2 shrink-0">

              <img src={logo} alt="TFS Ops Tracker Logo" className="h-10 w-auto" />
            </div>

            {/* RIGHT: NAVIGATION + USER INFO + LOGOUT */}
            <div className="flex items-center gap-3 min-w-0 overflow-visible">
              <div className="hidden lg:flex items-center gap-1.5 overflow-visible">
                {renderDesktopNav()}
              </div>
              <button
                type="button"
                className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"
                onClick={() => setIsMobileMenuOpen(true)}
                title="Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2 border-l border-slate-200 pl-4 shrink-0">

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-lg font-bold text-white">
                    {getInitials()}
                  </div>
                  {/* Show Gemini Key button only for Agent role */}
                  {(() => {
                    const roleId = Number(currentUser?.role_id);
                    const role = (currentUser?.role || currentUser?.role_name || currentUser?.user_role || '').toString().toUpperCase();
                    if (roleId === 6 || role.includes('AGENT')) {
                      return (
                        <button
                          onClick={() => setGeminiKeyOpen(true)}
                          className="p-2 rounded-full hover:bg-purple-50 text-purple-600 transition-colors"
                          title="Gemini AI Key"
                        >
                          <Brain className="w-5 h-5" />
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button
                    onClick={() => {

                      if (typeof handleLogout === 'function') {
                        handleLogout();
                      } else if (window && window.sessionStorage) {
                        window.sessionStorage.clear();
                        window.location.href = '/';
                      }
                    }}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      <div className={`
        fixed top-0 right-0 h-full bg-white shadow-xl z-50
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        w-80 max-w-[85vw] lg:hidden border-l border-slate-200
      `}>
        <div className="p-6 flex flex-col h-full">

          {/* USER INFO */}
          <div className="pb-6 mb-6 border-b border-slate-200">
            <h3 className="font-bold text-xl">{currentUser.name}</h3>
            <p className="text-sm text-slate-500">
              {currentUser.designation || currentUser.role}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {getRoleLabel() ? `${getRoleLabel()} View` : ""}
            </p>
          </div>

          {/* NAV ITEMS */}
          <div className="flex-1 space-y-2">
            {navItems.map(renderMobileNavButton)}
          </div>

          {/* LOGOUT */}
          <button
            onClick={() => {
              handleLogout();
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 w-full transition-colors mt-6 border-t border-slate-200 pt-6"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>

        </div>
      </div>
      <GeminiKeyModal 
        isOpen={geminiKeyOpen} 
        onClose={() => setGeminiKeyOpen(false)} 
        currentUser={currentUser}
      />
    </>
  );
};



export default Header;
