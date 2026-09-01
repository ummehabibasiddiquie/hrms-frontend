import React, { useState, useEffect } from "react";
// Role ID to role string mapping
const ROLE_MAP = {
  1: "SUPER_ADMIN",
  2: "ADMIN",
  3: "PROJECT_MANAGER",
  4: "ASSISTANT_MANAGER",
  5: "QA_AGENT",
  6: "AGENT"
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
  CalendarDays
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import GeminiKeyModal from "../GeminiKeyModal";
import { fetchGeminiApiKey } from "../../services/agentService";

import logo from "../../assets/Transform logo.png";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [geminiKeyOpen, setGeminiKeyOpen] = useState(false);
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
      navigate(dashboardTabUrl('qa_agent_audit'));
      setIsMobileMenuOpen(false);
      return;
    }
    if (view === 'MY_ROSTER') {
      navigate(dashboardTabUrl('my_roster'));
      setIsMobileMenuOpen(false);
      return;
    }
    
    if (view === ViewState.ADMIN_PANEL) {
      navigate(dashboardTabUrl('manage'));
      setIsMobileMenuOpen(false);
      return;
    }
    
    if (roleId === 6 || role.includes('AGENT')) {
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
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "TRACKER_REPORT", label: "Tracker Report", icon: FileText },
        { view: "AGENT_LIST", label: "Agent Files & QC Report", icon: Users },
        { view: "QC_REPORT_OVERVIEW", label: "QC Report Overview", icon: BarChart3 },
        { view: "QA_AGENT_AUDIT", label: "QA Agent Audit", icon: UserCheck },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
    }
    // For agents (role_id 6 or role includes 'AGENT')
    if (roleId === 6 || role.includes('AGENT')) {
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "MY_ROSTER", label: "My Roster", icon: CalendarDays },
        { view: ViewState.ENTRY, label: "Tracker", icon: PenTool },
        { view: "AI_EVALUATION", label: "AI Evaluation", icon: Brain },
      ];
    }
    if (!role) {
      // Try role_id mapping if role string is missing
      if (currentUser?.role_id) {
        if (roleId === 5) {
          return [
            { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
            { view: "MY_ROSTER", label: "My Roster", icon: CalendarDays },
            { view: "TRACKER_REPORT", label: "Tracker Report", icon: FileText },
            { view: "AGENT_LIST", label: "Agent Files & QC Report", icon: Users },
          ];
        }
        if (roleId === 3) {
          return [
            { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
            { view: "TRACKER_REPORT", label: "Tracker Report", icon: FileText },
            { view: "QC_REPORT_OVERVIEW", label: "QC Report Overview", icon: BarChart3 },
            { view: "QA_AGENT_AUDIT", label: "QA Agent Audit", icon: UserCheck },
            { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
          ];
        }
        if (roleId === 4) {
          return [
            { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
            { view: "TRACKER_REPORT", label: "Tracker Report", icon: FileText },
            { view: "QC_REPORT_OVERVIEW", label: "QC Report Overview", icon: BarChart3 },
            { view: "QA_AGENT_AUDIT", label: "QA Agent Audit", icon: UserCheck },
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
        { view: "MY_ROSTER", label: "My Roster", icon: CalendarDays },
        { view: "TRACKER_REPORT", label: "Tracker Report", icon: FileText },
        { view: "AGENT_LIST", label: "Agent Files & QC Report", icon: Users },
      ];
    }
    if (role.includes('ASSISTANT') || role.includes('ASST')) {
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "TRACKER_REPORT", label: "Tracker Report", icon: FileText },
        { view: "QC_REPORT_OVERVIEW", label: "QC Report Overview", icon: BarChart3 },
        { view: "QA_AGENT_AUDIT", label: "QA Agent Audit", icon: UserCheck },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
    }
    // Project Manager fallback
    if (role.includes('PROJECT_MANAGER') || role.replace(/\s+/g, '').toLowerCase() === 'projectmanager' || roleId === 3) {
      return [
        { view: ViewState.DASHBOARD, label: "Analytics", icon: LayoutDashboard },
        { view: "TRACKER_REPORT", label: "Tracker Report", icon: FileText },
        { view: "QC_REPORT_OVERVIEW", label: "QC Report Overview", icon: BarChart3 },
        { view: "QA_AGENT_AUDIT", label: "QA Agent Audit", icon: UserCheck },
        { view: ViewState.ADMIN_PANEL, label: "Manage", icon: Settings },
      ];
    }
    // Default: show nothing or fallback
    return [];
  };

  const navItems = getNavItems();
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
      const analyticsTabs = ['overview', 'billable_report', 'user_monthly_report', 'project_monthly_report', 'audit_report'];
      return currentPath === '/dashboard' && (!currentTab || analyticsTabs.includes(currentTab));
    }

    // Check for Tracker Report
    if (view === 'TRACKER_REPORT') {
      return currentPath === '/dashboard' && currentTab === 'tracker_report';
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
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
          isActive
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'text-slate-600 bg-slate-50 hover:bg-slate-200'
        } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={item.disabled}
        title={item.disabled ? 'Projects tab is temporarily disabled' : item.label}
      >
        <item.icon className="w-4 h-4" />
        <span className="hidden md:inline">{item.label}</span>
      </button>
    );
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

      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50 left-0 right-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* LEFT: LOGO */}
            <div className="flex items-center gap-2 shrink-0">

              <img src={logo} alt="TFS Ops Tracker Logo" className="h-10 w-auto" />
            </div>

            {/* RIGHT: NAVIGATION + USER INFO + LOGOUT */}
            <div className="flex items-center gap-6">
              <div className="hidden lg:flex items-center space-x-2">
                {navItems.map(renderNavButton)}
              </div>
              
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
        w-80 max-w-[85vw] md:hidden border-l border-slate-200
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
