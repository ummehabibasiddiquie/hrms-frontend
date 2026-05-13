import React, { useRef } from 'react';
import UserMonthlyReport from './UserMonthlyReport';
import ProjectMonthlyReport from './ProjectMonthlyReport';
import QABillableReport from './QABillableReport';
import {
  LayoutGrid,
  Briefcase,
  Users,
  FolderKanban,
  DollarSign,
  Gem,
  FileCheck
} from 'lucide-react';

const TabsNavigation = ({
  activeTab,
  setActiveTab,
  isAgent,
  isQA,
  isAdmin,
  isAssistantManager,
  isProjectManager,
  isSuperAdmin,
  canViewIncentivesTab,
  canViewAdherence
}) => {
  const tabsRef = useRef(null);
    
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid, alwaysVisible: true },
    // Billable Report tab: for agents and for QA, Assistant Manager, Project Manager, Admin, Super Admin
    ...(isAgent
      ? [{ id: 'billable_report', label: 'Billable Report', icon: Briefcase, visible: true }]
      : [{ id: 'bookings', label: 'Billable Report', icon: Briefcase, visible: (isQA || isAssistantManager || isProjectManager || isAdmin || isSuperAdmin) }]),
    // Show all required tabs for project manager
    ...(isProjectManager || isAssistantManager || isAdmin || isSuperAdmin ? [
      { id: 'user_monthly_report', label: 'User Monthly Report', icon: Users, visible: true, disabled: false },
      { id: 'project_monthly_report', label: 'Project Monthly Report', icon: FolderKanban, visible: true, disabled: false },
      { id: 'roster_report', label: 'Roster Report', icon: Users, visible: true, disabled: false },
      { id: 'mgmt_incentives', label: 'Management Incentives', icon: Gem, visible: true, disabled: false },
      ...(isSuperAdmin ? [{ id: 'qa_billable_report', label: 'QA Billable Report', icon: FileCheck, visible: true, disabled: false }] : []),
    ] : [
      { id: 'incentives', label: 'Agent Incentives', icon: DollarSign, visible: canViewIncentivesTab && !isQA, disabled: true },
      { id: 'mgmt_incentives', label: 'Management Incentives', icon: Gem, visible: !isAgent && !isQA, disabled: true },
    ]),
  ];

  // Ensure 'overview' tab is always visible, regardless of any other logic
  const visibleTabs = tabs.filter(tab => tab.id === 'overview' || tab.alwaysVisible || tab.visible);

  return (
    <div className="relative w-full">
      {/* Horizontal scrollable tabs with modern design */}
      <div className="bg-white rounded-2xl shadow-lg mb-6 border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-hide">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex-1 min-w-fit px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : tab.disabled
                    ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </div>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Render UserMonthlyReport below the tab bar when active */}
      {activeTab === 'user_monthly_report' && (
        <div className="mt-4">
          <UserMonthlyReport />
        </div>
	  )}

      {/* Render ProjectMonthlyReport below the tab bar when active */}
      {activeTab === 'project_monthly_report' && (
        <div className="mt-4">
          <ProjectMonthlyReport />
        </div>
	  )}

      {/* Render QABillableReport below the tab bar when active */}
      {activeTab === 'qa_billable_report' && (
        <div className="mt-4">
          <QABillableReport />
        </div>
	  )}

      {/* Mobile Dropdown */}
      <div className="sm:hidden mt-2">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-700 text-sm font-medium"
        >
          {visibleTabs.map(tab => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TabsNavigation;
