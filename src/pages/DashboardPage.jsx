// import AgentBillableReport from '../components/AgentDashboard/AgentBillableReport';
// import BillableReport from '../components/AgentDashboard/BillableReport';
import Tracker from '../components/AgentDashboard/Tracker';
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Settings, Lock, File, CalendarDays } from 'lucide-react';
import { MONTHLY_GOAL, SHIFT_START_HOUR, SHIFT_HOURS_COUNT } from '../utils/constants';
import { isWithinRange, getComparisonRange } from '../utils/dateHelpers';
import FilterBar from '../components/dashboard/FilterBar';
import OverviewTab from '../components/dashboard/overview/OverviewTab';
import QATrackerReport from '../components/dashboard/QATrackerReport';
import QAAgentList from '../components/dashboard/QAAgentList';
import QAAgentAudit from '../components/dashboard/QAAgentAudit';
import ManagerQCReportsOverview from '../components/dashboard/ManagerQCReportsOverview';
import QAAgentDashboard from '../components/QAAgentDashboard/QAAgentDashboard';
import AssistantManagerDashboard from '../components/dashboard/AssistantManagerDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import { useAuth } from '../context/AuthContext'; // Updated to use AuthContext
import { useDeviceInfo } from '../hooks/useDeviceInfo';
import { useUserDropdowns } from '../hooks/useUserDropdowns';
import BillableReportCommon from '../components/common/BillableReport';
import AgentBillableReport from '../components/AgentDashboard/AgentBillableReport';

// Import the split admin components
import UsersManagement from '../components/dashboard/manage/user/UsersManagement';
import ProjectsManagement from '../components/dashboard/manage/project/ProjectsManagement';
import AFDManagement from '../components/dashboard/manage/afd/AFDManagement';
import ProjectCategory from '../components/dashboard/manage/category/ProjectCategory';
import UserTrackingView from '../components/common/UserTrackingView';
import { fetchUsersList } from '../services/authService';
import { fetchProjectsList } from '../services/projectService';
import { toast } from 'react-hot-toast';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import ErrorMessage from '../components/common/ErrorMessage';
import AgentTabsNavigation from '../components/AgentDashboard/AgentTabsNavigation';
import RosterManagement from '../components/roster/RosterManagement';
import MyRoster from '../components/roster/MyRoster';
import QATabsNavigation from '../components/QAAgentDashboard/QATabsNavigation';
import SubTabsBar from '../components/common/SubTabsBar';
import { dashboardTabUrl, isAnalyticsTab } from '../routes/paths';

// Import db if needed for admin operations
import db from '../utils/db';

const DashboardPage = ({ 
  logs = [], 
  projects = [], 
  users = [],
  qcRecords = [], // Add if needed for other tabs
  onUpdateUsers, 
  onUpdateProjects
}) => {
  // All hooks and state declarations at the top
  const { 
    user: currentUser, 
    canManageUsers, 
    canManageProjects, 
    canViewSalary 
  } = useAuth();
  const { device_id, device_type } = useDeviceInfo();
  const { dropdowns, loadDropdowns } = useUserDropdowns();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const viewParam = searchParams.get('view');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const emptyDate = '';
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateRange, setDateRange] = useState({ start: emptyDate, end: emptyDate });
  const [selectedTask, setSelectedTask] = useState('All');
  const [comparisonMode, setComparisonMode] = useState('previous_period');
  const role = currentUser?.role_name || '';
  const userRole = currentUser?.user_role || '';
  const designation = currentUser?.designation || currentUser?.user_designation || '';
  const roleId = Number(currentUser?.role_id ?? currentUser?.user_role_id ?? 0);
  const designationId = Number(currentUser?.designation_id ?? currentUser?.user_designation_id ?? 0);

  const roleText = String(role).trim().toLowerCase();
  const userRoleText = String(userRole).trim().toLowerCase();
  const designationText = String(designation).trim().toLowerCase();

  const isSuperAdmin =
    roleId === 1 ||
    roleText.includes('super') ||
    userRoleText.includes('super') ||
    designationText.includes('super');

  const isAdmin =
    !isSuperAdmin &&
    (roleId === 2 ||
      roleText.includes('admin') ||
      userRoleText === 'admin' ||
      designationText.includes('admin'));
  const isAgent = roleId === 6 || String(role).toLowerCase() === 'agent' || String(userRole).toUpperCase() === 'AGENT' || String(designation).toLowerCase() === 'agent';
  const isQA = roleId === 5 || String(currentUser?.user_designation).toLowerCase() === 'qa' || String(designation).toLowerCase() === 'qa' || String(role).toLowerCase().includes('qa');
  const isAssistantManager = roleId === 4 || String(designation).toLowerCase() === 'assistant manager' || String(role).toLowerCase().includes('assistant');
  const isProjectManager = roleId === 3 || String(designation).toLowerCase() === 'project manager' || String(role).toLowerCase().includes('project manager');
  const canViewTrackerReport = isQA || isAssistantManager || isProjectManager;
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [adminRequests, setAdminRequests] = useState([]);
  const [managedUsers, setManagedUsers] = useState([]);
  const [loadingManagedUsers, setLoadingManagedUsers] = useState(false);
  const [managedProjects, setManagedProjects] = useState([]);
  const [loadingManagedProjects, setLoadingManagedProjects] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState(() => searchParams.get('adminTab') || 'users');
  const [error, setError] = useState(null);
  const canAccessRoster = isSuperAdmin || isAdmin || isProjectManager || isAssistantManager;
  const canAccessManage = canManageUsers || canManageProjects || isSuperAdmin || canAccessRoster;
  const canViewIncentivesTab = isAdmin || userRole === 'FINANCE_HR' || userRole === 'PROJECT_MANAGER' || isSuperAdmin;
  const canViewAdherence = isAdmin || userRole === 'PROJECT_MANAGER' || isQA || isSuperAdmin;

  // Keep tabs in sync with ?tab= / ?adminTab= query params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'roster_management') {
      setSearchParams({ tab: 'manage', adminTab: 'roster' }, { replace: true });
      setActiveTab('manage');
      setAdminActiveTab('roster');
      return;
    }
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    const adminTabParam = searchParams.get('adminTab');
    if (adminTabParam && adminTabParam !== adminActiveTab) {
      setAdminActiveTab(adminTabParam);
    }
  }, [searchParams, activeTab, adminActiveTab, setSearchParams]);

  const setManageSubTab = useCallback((subTab) => {
    setAdminActiveTab(subTab);
    navigate(dashboardTabUrl('manage', { adminTab: subTab }));
  }, [navigate]);

  useEffect(() => {
    if (activeTab !== 'manage') return;
    const visibleTabs = [
      ...(canManageUsers || isSuperAdmin || isAdmin ? ['users'] : []),
      ...(isAssistantManager || canManageProjects ? ['projects', 'afd'] : []),
      ...(isSuperAdmin || isAdmin ? ['category', 'permissions'] : []),
      ...(canAccessRoster ? ['roster'] : []),
    ];
    if (!visibleTabs.includes(adminActiveTab) && visibleTabs.length > 0) {
      setManageSubTab(visibleTabs[0]);
    }
  }, [activeTab, adminActiveTab, canManageUsers, isSuperAdmin, isAdmin, isAssistantManager, canManageProjects, canAccessRoster, setManageSubTab]);

  const setDashboardTab = useCallback((tab) => {
    setActiveTab(tab);
    navigate(dashboardTabUrl(tab));
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'task_eod_report') {
      setDashboardTab('overview');
    }
  }, [activeTab, setDashboardTab]);

  // Initialize admin data when Manage tab is active
  useEffect(() => {
    if (activeTab === 'manage') {
      const passwordRequests = db.getPasswordRequests() || [];
      setAdminRequests(passwordRequests);
    }
  }, [activeTab]);

  const allTasks = useMemo(() => {
    const tasks = new Set();
    managedProjects.forEach(p => p.tasks?.forEach(t => tasks.add(t.name)));
    return Array.from(tasks).sort();
  }, [managedProjects]);

  // Load projects for Manage → Projects tab from backend
  const loadProjects = useCallback(async () => {
    try {
      setLoadingManagedProjects(true);
      console.log('[AssistantManager] Loading projects...');
      const res = await fetchProjectsList(currentUser?.user_id, { includeInactive: true });
      console.log('[AssistantManager] fetchProjectsList response:', res);
      if (res.status === 200 || res.status === '200') {
        const projectsArray = Array.isArray(res.data) ? res.data : [];
        console.log('[AssistantManager] Raw projects array:', projectsArray);
        const formatted = projectsArray.map(p => {
          const ensureArray = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value;
            return [value];
          };
          return {
            id: p.project_id,
            name: p.project_name,
            description: p.project_description || '',
            project_manager_id: p.project_manager_id,
            project_manager_name: p.project_manager_name || '',
            asst_project_manager_id: ensureArray(p.asst_project_manager_id),
            asst_project_manager_names: ensureArray(p.asst_project_manager_names),
            project_qa_id: ensureArray(p.project_qa_id),
            project_qa_names: ensureArray(p.project_qa_names),
            project_team_id: ensureArray(p.project_team_id),
            project_team_names: ensureArray(p.project_team_names),
            files: p.files || null,
            tasks: p.tasks || [],
            is_active: p.is_active ?? 1,
            created_at: p.created_at,
            updated_at: p.updated_at,
          };
        });
        console.log('[AssistantManager] Formatted projects:', formatted);
        setManagedProjects(formatted);
      } else {
        setError(getFriendlyErrorMessage(res.message || 'Failed to load projects'));
        console.error('[AssistantManager] Error loading projects:', res.message || res);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      console.error('[AssistantManager] Exception loading projects:', err);
    } finally {
      setLoadingManagedProjects(false);
    }
  }, [currentUser]);

  // Load users for Manage → Users tab from backend
  // Fallback no-op for handleResolveRequest to prevent ReferenceError
  const handleResolveRequest = () => {};
  // Fallbacks for project management props
  const potentialOwners = [];
  const potentialAPMs = [];
  const potentialQAs = [];
  const loadUsers = useCallback(async () => {
    try {
      setLoadingManagedUsers(true);
      const userId = currentUser?.user_id || currentUser?.id;
      if (!userId) {
        setError(getFriendlyErrorMessage('User session invalid. Please log in again.'));
        return;
      }
      if (!dropdowns.designations || dropdowns.designations.length === 0) {
        await loadDropdowns();
      }
      const res = await fetchUsersList(userId, device_id, device_type);
      if (res.status === 200 || res.status === '200') {
        const usersArray = Array.isArray(res.data) ? res.data : [];
        const formatted = usersArray.map(u => {
          let designationName = u.designation || u.designation_name || '';
          if (!designationName && u.designation_id && dropdowns.designations) {
            const designationObj = dropdowns.designations.find(
              d => d.designation_id === u.designation_id || d.id === u.designation_id
            );
            if (designationObj) {
              designationName = designationObj.designation_name || designationObj.name || '';
            }
          }
          if (!designationName && u.designation_id) {
            console.log('[DashboardPage] User missing designation:', u.user_name, 'designation_id:', u.designation_id, 'Available fields:', Object.keys(u));
          }
          return {
            id: u.user_id,
            user_id: u.user_id,
            name: u.user_name,
            email: u.user_email,
            phone: u.user_number,
            role: (u.role || u.role_name || '').toUpperCase().replace(/\s+/g, '_'),
            role_id: u.role_id ?? null,
            designation: designationName,
            designation_id: u.designation_id ?? null,
            reportingManager: u.project_manager || '',
            project_manager_name: u.project_manager || '',
            project_manager_names: u.project_manager_names || u.project_manager || '',
            project_managers: u.project_managers || [],
            project_manager_id: u.project_manager_id ?? null,
            assistantManager: u.assistant_manager_id || u.asst_manager || '',
            asst_manager_names: u.asst_manager_names || u.asst_manager || '',
            asst_managers: u.asst_managers || [],
            qualityAnalyst: u.qa_id || u.qa || '',
            team: u.team_id || u.team || '',
            team_name: u.team_name || '',
            password: u.user_password || '',
            password_plain: u.user_password || '',
            asst_manager: u.asst_manager || '',
            qa: u.qa || '',
            address: u.user_address || '',
            tenure: u.user_tenure ?? u.tenure ?? '',
            joining_date: u.joining_date ? String(u.joining_date).slice(0, 10) : '',
            profile_picture: u.profile_picture || null,
            is_active: u.is_active ?? 1
          };
        });
        setManagedUsers(formatted);
      } else {
        setError(getFriendlyErrorMessage(res.message || 'Failed to load users'));
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoadingManagedUsers(false);
    }
  }, [currentUser, device_id, device_type, dropdowns.designations, loadDropdowns]);

  useEffect(() => {
    // Load users ONLY when on the Manage tab AND User Management sub-tab is active AND user has permission
    if (activeTab === 'manage' && adminActiveTab === 'users' && canManageUsers) {
      loadUsers();
    }
    // Load projects for Assistant Manager when switching to projects tab
    if (activeTab === 'manage' && adminActiveTab === 'projects' && (isAssistantManager || canManageProjects)) {
      loadProjects();
    }
  }, [activeTab, adminActiveTab, canManageUsers, loadUsers, isAssistantManager, canManageProjects, loadProjects]);
  // ...existing code...

  // Place all hooks above this line!

  // Use a render variable instead of early return
  // Handler for date range change (for FilterBar)
  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };

  // Conditional rendering for special tabs
  if (error) {
    return <ErrorMessage message={error} />;
  }
  if ((roleId === 1 || roleId === 2 || roleId === 3 || isQA || isAssistantManager) && activeTab === 'tracker_report') {
    return <QATrackerReport />;
  }
  if ((roleId === 1 || roleId === 2 || roleId === 3 || isQA || isAssistantManager) && activeTab === 'agent_file_report') {
    return <QAAgentList />;
  }
  if ((roleId === 1 || roleId === 2 || roleId === 3 || roleId === 4 || roleId === 5) && activeTab === 'qa_agent_audit') {
    // QA Agent (roleId 5) sees only the Report tab with their own data
    if (roleId === 5) {
      const qaAgentName = currentUser?.name || currentUser?.user_name || currentUser?.username || '';
      return <QAAgentAudit defaultTab="audit_report" hideTabNavigation={true} filterByQAAgent={qaAgentName} />;
    }
    // Other roles see both tabs with all data
    return <QAAgentAudit />;
  }
  if ((roleId === 1 || roleId === 2 || roleId === 3 || roleId === 4) && activeTab === 'qc_report_overview') {
    return <ManagerQCReportsOverview />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Debug: Show current active tab */}
      {console.log('[DashboardPage Render] activeTab:', activeTab)}

      {isAnalyticsTab(activeTab) && (() => {
        const isDefault = !dateRange.start && !dateRange.end;
        let rangeToSend = dateRange;
        if (isDefault && isAgent) {
          // Default to current month for agents
          const today = new Date();
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          rangeToSend = {
            start: firstDayOfMonth.toISOString().slice(0, 10),
            end: lastDayOfMonth.toISOString().slice(0, 10)
          };
        } else if (isDefault) {
          // For non-agents, fallback to today
          const dynamicToday = new Date().toISOString().slice(0, 10);
          rangeToSend = { start: dynamicToday, end: dynamicToday };
        }
        // Show OverviewTab (dashboard) for admin and project manager
        // Provide empty objects as fallback for analytics and hourlyChartData to prevent ReferenceError
        const emptyAnalytics = {
          prodCurrent: 0,
          trendText: '',
          trendDir: 'neutral',
          prevRange: { label: '' },
          prodPrevious: 0,
          goalProgress: 0,
          effectiveGoal: 0,
          agentStats: []
        };
        const emptyHourlyChartData = [];
        if (isAdmin || isSuperAdmin || isProjectManager) {
          return <AdminDashboard initialTab="overview" />;
        } else if (isAssistantManager) {
          return <AssistantManagerDashboard />;
        } else if (isQA) {
          // my_roster has a dedicated block below with MyRoster
          if (activeTab === 'my_roster') return null;
          return <QAAgentDashboard embedded={true} />;
        } else if (isAgent) {
          if (activeTab === 'billable_report') {
            return (
              <div className="max-w-7xl mx-auto mt-2">
                <AgentTabsNavigation activeTab={activeTab} setActiveTab={setDashboardTab} />
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mt-4">
                  <AgentBillableReport hideTabBar />
                </div>
              </div>
            );
          }
          // my_roster has a dedicated block below; other agent analytics tabs use OverviewTab
          if (activeTab === 'my_roster') return null;
          return (
            <OverviewTab
              analytics={emptyAnalytics}
              hourlyChartData={emptyHourlyChartData}
              isAgent={isAgent}
              dateRange={rangeToSend}
            />
          );
        } else {
          // fallback for any other role
          return (
            <OverviewTab
              analytics={emptyAnalytics}
              hourlyChartData={emptyHourlyChartData}
              isAgent={isAgent}
              dateRange={rangeToSend}
            />
          );
        }
      })()}

      {/* Remove agent_dashboard navigation panel for agents */}



      {/* Agent Billable Report — handled above via analytics tabs */}

      {/* Admin / Super Admin / Project Manager Billable Report */}
      {activeTab === 'billable_report' && (isAdmin || isSuperAdmin || isProjectManager) && (
        <div className="max-w-7xl mx-auto mt-6">
          <AdminDashboard initialTab="billable_report" />
        </div>
      )}

      {/* User Monthly Report — handled by role dashboards via ?tab=user_monthly_report */}

      {/* Agent's Files & QC Report tab for Assistant Manager and QA */}
      {activeTab === 'agent_file_report' && (isAssistantManager || isQA) && (
        <div className="max-w-7xl mx-auto mt-6">
          <QAAgentList />
        </div>
      )}

      {/* Tracker Report tab for Assistant Manager and QA */}
      {activeTab === 'tracker_report' && (isAssistantManager || isQA) && (
        <div className="max-w-7xl mx-auto mt-6">
          <QATrackerReport />
        </div>
      )}

      {/* Manage Tab (AdminPanel) - Show UI to all who can access, control actions by specific permissions */}
      {activeTab === 'manage' && canAccessManage && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Administration & Management</h2>
                  <p className="text-sm text-slate-500">Manage organization resources, users, and targets.</p>
                </div>
              </div>
            </div>
              
            {/* Admin Tabs Navigation */}
            <SubTabsBar
              className="mb-6"
              bordered
              activeTab={adminActiveTab}
              onChange={setManageSubTab}
              tabs={[
                {
                  id: 'users',
                  label: 'User Management',
                  hidden: !(canManageUsers || isSuperAdmin || isAdmin),
                },
                {
                  id: 'projects',
                  label: 'Projects & Targets',
                  hidden: !(isAssistantManager || canManageProjects),
                },
                {
                  id: 'afd',
                  label: 'AFD Management',
                  hidden: !(isAssistantManager || canManageProjects),
                },
                {
                  id: 'category',
                  label: 'Project Category',
                  hidden: !(isSuperAdmin || isAdmin),
                },
                {
                  id: 'permissions',
                  label: 'User Permission',
                  hidden: !(isSuperAdmin || isAdmin),
                },
                {
                  id: 'roster',
                  label: 'Roster Management',
                  icon: CalendarDays,
                  hidden: !canAccessRoster,
                },
              ]}
            />

            {/* Admin Tab Content */}
            {adminActiveTab === 'users' && (
              canManageUsers ? (
                <UsersManagement
                  users={managedUsers}
                  projects={projects}
                  onUpdateUsers={setManagedUsers}
                  pendingRequests={adminRequests}
                  onResolveRequest={handleResolveRequest}
                  loading={loadingManagedUsers}
                  loadUsers={loadUsers}
                />
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-800">View Only Access</h3>
                  <p className="text-slate-600 mb-4">You can view user information but don't have permission to make changes.</p>
                  <p className="text-sm text-slate-500">Contact your administrator if you need edit access.</p>
                  
                  {/* Show read-only view */}
                  <div className="mt-8">
                    <UsersManagement
                      users={managedUsers}
                      projects={projects}
                      onUpdateUsers={setManagedUsers}
                      pendingRequests={adminRequests}
                      onResolveRequest={handleResolveRequest}
                      loading={loadingManagedUsers}
                      loadUsers={loadUsers}
                      readOnly={true}
                    />
                  </div>
                </div>
              )
            )}
            
            {adminActiveTab === 'projects' && (
              canManageProjects ? (
                <ProjectsManagement
                  projects={managedProjects}
                  onUpdateProjects={setManagedProjects}
                  loading={loadingManagedProjects}
                  loadProjects={loadProjects}
                  potentialOwners={potentialOwners}
                  potentialAPMs={potentialAPMs}
                  potentialQAs={potentialQAs}
                />
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-800">View Only Access</h3>
                  <p className="text-slate-600 mb-4">You can view project information but don't have permission to make changes.</p>
                  <p className="text-sm text-slate-500">Contact your administrator if you need edit access.</p>
                  
                  {/* Show read-only view */}
                  <div className="mt-8">
                    <ProjectsManagement
                      projects={managedProjects}
                      onUpdateProjects={setManagedProjects}
                      loading={loadingManagedProjects}
                      loadProjects={loadProjects}
                      potentialOwners={potentialOwners}
                      potentialAPMs={potentialAPMs}
                      potentialQAs={potentialQAs}
                      readOnly={true}
                    />
                  </div>
                </div>
              )
            )}
            
            {adminActiveTab === 'afd' && (
              <AFDManagement />
            )}
            
            {adminActiveTab === 'category' && (
              <ProjectCategory />
            )}
            
            {adminActiveTab === 'permissions' && (
              <UserTrackingView />
            )}

            {adminActiveTab === 'roster' && canAccessRoster && (
              <RosterManagement />
            )}
          </div>
        </div>
      )}

      {/* My Roster — Agent & QA read-only */}
      {activeTab === 'my_roster' && (isAgent || isQA) && (
        <div className="max-w-7xl mx-auto mt-2">
          {isAgent && (
            <AgentTabsNavigation
              activeTab={activeTab}
              setActiveTab={setDashboardTab}
            />
          )}
          {isQA && (
            <QATabsNavigation
              activeTab={activeTab}
              setActiveTab={setDashboardTab}
            />
          )}
          <div className="mt-4">
            <MyRoster />
          </div>
        </div>
      )}

      {/* Show message if user tries to access Manage tab without permission */}
      {activeTab === 'manage' && !canAccessManage && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4 text-red-600">Access Denied</h2>
          <p className="text-slate-600">
            You don't have permission to access the Manage tab. 
            Only users with user creation or project creation permissions can access this section.
          </p>
        </div>
      )}

      {selectedAgent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedAgent} Details</h2>
              <button
                onClick={() => setSelectedAgent(null)}
                className="bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded transition-colors"
              >
                Close
              </button>
            </div>
            <p className="text-slate-600">
              Detailed view for {selectedAgent}. Add more information here as needed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
