// import AgentBillableReport from '../components/AgentDashboard/AgentBillableReport';
// import BillableReport from '../components/AgentDashboard/BillableReport';
import Tracker from '../components/AgentDashboard/Tracker';
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Settings, Lock, File, Calendar } from 'lucide-react';
import { MONTHLY_GOAL, SHIFT_START_HOUR, SHIFT_HOURS_COUNT } from '../utils/constants';
import { isWithinRange, getComparisonRange } from '../utils/dateHelpers';
import FilterBar from '../components/dashboard/FilterBar';
import TabsNavigation from '../components/dashboard/TabsNavigation';
import OverviewTab from '../components/dashboard/overview/OverviewTab';
import QATrackerReport from '../components/dashboard/QATrackerReport';
import QAAgentList from '../components/dashboard/QAAgentList';
import QAAgentAudit from '../components/dashboard/QAAgentAudit';
import ManagerQCReportsOverview from '../components/dashboard/ManagerQCReportsOverview';
import QAAgentDashboard from '../components/QAAgentDashboard/QAAgentDashboard';
import AssistantManagerDashboard from '../components/dashboard/AssistantManagerDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import AssistantManagerRoster from '../pages/AssistantManagerRoster';
import UserRosterReport from './UserRosterReport';
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
import SuperAdminApproval from '../pages/SuperAdminApproval';
import { fetchUsersList } from '../services/authService';
import { fetchProjectsList } from '../services/projectService';
import { toast } from 'react-hot-toast';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import ErrorMessage from '../components/common/ErrorMessage';

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
  const [searchParams] = useSearchParams();
  const location = useLocation();
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
  const roleId = currentUser?.role_id;
  const designationId = currentUser?.designation_id;
  const isAdmin = roleId === 2 || String(role).toLowerCase() === 'admin' || String(userRole).toUpperCase() === 'ADMIN' || String(designation).toLowerCase() === 'admin';
  const isSuperAdmin = roleId === 1;
  
  const isAgent = roleId === 6 || String(role).toLowerCase() === 'agent' || String(userRole).toUpperCase() === 'AGENT' || String(designation).toLowerCase() === 'agent';
  const isQA = roleId === 5 || String(currentUser?.user_designation).toLowerCase() === 'qa' || String(designation).toLowerCase() === 'qa' || String(role).toLowerCase().includes('qa');
  const isAssistantManager = roleId === 4 || String(designation).toLowerCase() === 'assistant manager' || String(role).toLowerCase().includes('assistant');
  const isProjectManager = roleId === 3 || String(designation).toLowerCase() === 'project manager' || String(role).toLowerCase().includes('project manager');
  const canViewTrackerReport = isQA || isAssistantManager || isProjectManager;
  // Compute activeTab directly from URL to ensure it always matches
  const params = new URLSearchParams(location.search);
  const activeTab = params.get('tab') || 'overview';
  console.log('DashboardPage - Computed activeTab from URL:', activeTab, 'location.search:', location.search);
  const [adminRequests, setAdminRequests] = useState([]);
  const [managedUsers, setManagedUsers] = useState([]);
  const [loadingManagedUsers, setLoadingManagedUsers] = useState(false);
  const [managedProjects, setManagedProjects] = useState([]);
  const [loadingManagedProjects, setLoadingManagedProjects] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState('users');
  const canAccessManage = canManageUsers || canManageProjects || isAdmin;
  const canViewIncentivesTab = isAdmin || userRole === 'FINANCE_HR' || userRole === 'PROJECT_MANAGER' || isSuperAdmin;
  const canViewAdherence = isAdmin || userRole === 'PROJECT_MANAGER' || isQA || isSuperAdmin;
  const [error, setError] = useState(null);

  // Debug: Log role detection and access control
  console.log('DashboardPage - Role Detection:', { 
    roleId, 
    role, 
    userRole, 
    designation, 
    isAdmin,
    isSuperAdmin,
    isAgent,
    isQA,
    isAssistantManager,
    isProjectManager,
    canManageUsers,
    canManageProjects,
    canAccessManage,
    currentUser: currentUser
  });

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
      const res = await fetchProjectsList(currentUser?.user_id);
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
  if (activeTab === 'roster_report') {
    console.log('DashboardPage - Early return for roster_report, rendering UserRosterReport');
    return <UserRosterReport />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Debug: Show current active tab */}
      {console.log('[DashboardPage Render] activeTab:', activeTab)}

      {activeTab === 'overview' && (() => {
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
          console.log('DashboardPage - Rendering AdminDashboard for role:', { roleId, isAdmin, isSuperAdmin, isProjectManager });
          try {
            return <AdminDashboard />;
          } catch (error) {
            console.error('DashboardPage - Error rendering AdminDashboard:', error);
            return (
              <div className="p-6 bg-white rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4 text-red-600">Dashboard Error</h2>
                <p className="text-slate-600">There was an error loading the dashboard. Please refresh the page.</p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-slate-500">Error Details</summary>
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error.toString()}</pre>
                </details>
              </div>
            );
          }
        } else if (isAssistantManager) {
          return <AssistantManagerDashboard />;
        } else if (isQA) {
          return <QAAgentDashboard embedded={true} />;
        } else if (isAgent) {
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

      {/* Agent Billable Report tab and view */}
      {activeTab === 'billable_report' && isAgent && (
        <div className="max-w-7xl mx-auto mt-2">
          {/* Navigation Tab Card */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-2 mb-2">
            {/* Tab navigation bar component or markup here */}
            {/* If AgentBillableReport renders the tab bar, you may need to move it out and render here instead */}
          </div>
          {/* Filter and Table Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <AgentBillableReport hideTabBar />
          </div>
        </div>
      )}

      {/* Roster Report tab for QA Agent and Agent roles */}
      {(() => {
        console.log('DashboardPage - QA/Agent Roster Report Check:', { activeTab, isAgent, isQA, shouldRender: activeTab === 'roster_report' && (isAgent || isQA) });
        return activeTab === 'roster_report' && (isAgent || isQA) && (
          <div className="max-w-7xl mx-auto mt-2">
            {/* Filter and Table Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <UserRosterReport />
            </div>
          </div>
        );
      })()}

      {/* User Monthly Report tab and view for Assistant Manager */}
      {activeTab === 'user_monthly_report' && isAssistantManager && (
        <div className="max-w-7xl mx-auto mt-2">
          {/* Navigation Tab Card */}
          <AssistantManagerTabsNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
          {/* Gap between cards */}
          <div className="h-4" />
          {/* Filter and Table Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <UserMonthlyReport />
          </div>
        </div>
      )}

      {/* Roster Report tab for management roles */}
      {activeTab === 'roster_report' && (isAssistantManager || isProjectManager || isAdmin || isSuperAdmin) && (
        <div className="max-w-7xl mx-auto mt-2">
          {/* Navigation Tab Card */}
          <TabsNavigation 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            isAgent={isAgent}
            isQA={isQA}
            isAdmin={isAdmin}
            isAssistantManager={isAssistantManager}
            isProjectManager={isProjectManager}
            isSuperAdmin={isSuperAdmin}
            canViewIncentivesTab={canViewIncentivesTab}
            canViewAdherence={canViewAdherence}
          />
          {/* Gap between cards */}
          <div className="h-4" />
          {/* Filter and Table Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <UserRosterReport />
          </div>
        </div>
      )}

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
              
            {/* Admin Tabs Navigation - Show tabs but they'll display permission messages if no access */}
            <div className="flex overflow-x-auto border-b border-slate-200 mb-6 scrollbar-hide">
              <button 
                onClick={() => setAdminActiveTab('users')}
                className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                  adminActiveTab === 'users' 
                    ? 'border-blue-600 text-blue-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                User Management
              </button>
              {/* Show Projects & Targets tab for Assistant Manager */}
              {(isAssistantManager || canManageProjects) && (
                <button 
                  onClick={() => setAdminActiveTab('projects')}
                  className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                    adminActiveTab === 'projects' 
                      ? 'border-blue-600 text-blue-700' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Projects & Targets
                </button>
              )}
              {/* AFD Management tab */}
              {(isAssistantManager || canManageProjects) && (
                <button 
                  onClick={() => setAdminActiveTab('afd')}
                  className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                    adminActiveTab === 'afd' 
                      ? 'border-blue-600 text-blue-700' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  AFD Management
                </button>
              )}
              {/* Project Category tab */}
              <button 
                onClick={() => setAdminActiveTab('category')}
                className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                  adminActiveTab === 'category' 
                    ? 'border-blue-600 text-blue-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Project Category
              </button>
              {/* User Permission tab */}
              <button 
                onClick={() => setAdminActiveTab('permissions')}
                className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                  adminActiveTab === 'permissions' 
                    ? 'border-blue-600 text-blue-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                User Permission
              </button>
              {/* Roster Management - Super Admin Only */}
              {(() => {
                console.log('DashboardPage - Roster Tab Button Check:', { isSuperAdmin, adminActiveTab, roleId: currentUser?.role_id });
                return isSuperAdmin && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('DashboardPage - Clicking Roster Management tab');
                      console.log('Current adminActiveTab before click:', adminActiveTab);
                      setAdminActiveTab('roster-management');
                      console.log('Set adminActiveTab to roster-management');
                    }}
                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
                      adminActiveTab === 'roster-management' 
                        ? 'border-blue-600 text-blue-700' 
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Roster Management
                  </button>
                );
              })()}

              {/* Roster - Admin, Project Manager, Assistant Manager */}
              {(() => {
                const roleId = Number(currentUser?.role_id);
                const showRosterTab = [2, 3, 4].includes(roleId);
                console.log('DashboardPage - Roster Tab Check:', { roleId, showRosterTab, adminActiveTab });
                return showRosterTab && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('DashboardPage - Clicking Roster tab');
                      setAdminActiveTab('roster');
                    }}
                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
                      adminActiveTab === 'roster' 
                        ? 'border-blue-600 text-blue-700' 
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Roster
                  </button>
                );
              })()}
            </div>

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
            
            {adminActiveTab === 'roster' && isSuperAdmin && (
              (() => {
                console.log('DashboardPage - Rendering SuperAdminApproval component');
                return <SuperAdminApproval />;
              })()
            )}

            {adminActiveTab === 'roster-management' && isSuperAdmin && (
              (() => {
                console.log('DashboardPage - Rendering SuperAdminApproval component for roster-management');
                return <SuperAdminApproval />;
              })()
            )}

            {adminActiveTab === 'roster' && [2, 3, 4].includes(Number(currentUser?.role_id)) && (
              (() => {
                console.log('DashboardPage - Rendering AssistantManagerRoster component');
                return <AssistantManagerRoster />;
              })()
            )}
          </div>
        </div>
      )}

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