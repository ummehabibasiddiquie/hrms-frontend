import React from 'react';
import UserMonthlyReport from './UserMonthlyReport';
import ProjectMonthlyReport from './ProjectMonthlyReport';
import {
  LayoutGrid,
  Briefcase,
  Users,
  FolderKanban,
  DollarSign,
  Gem,
  CalendarDays
} from 'lucide-react';
import SubTabsBar from '../common/SubTabsBar';

const TabsNavigation = ({
  activeTab,
  setActiveTab,
  isAgent,
  isQA,
  isAdmin,
  isAssistantManager,
  isProjectManager,
  isSuperAdmin,
  canViewIncentivesTab
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    ...(isAgent
      ? [{ id: 'billable_report', label: 'Billable Report', icon: Briefcase }]
      : [{
          id: 'bookings',
          label: 'Billable Report',
          icon: Briefcase,
          hidden: !(isQA || isAssistantManager || isProjectManager || isAdmin || isSuperAdmin),
        }]),
    ...(isProjectManager || isAssistantManager || isAdmin || isSuperAdmin || isQA ? [
      { id: 'user_monthly_report', label: 'User Monthly Report', icon: Users },
      { id: 'project_monthly_report', label: 'Project Monthly Report', icon: FolderKanban },
      { id: 'incentives', label: 'Agent Incentives', icon: DollarSign },
      { id: 'mgmt_incentives', label: 'Management Incentives', icon: Gem },
    ] : [
      { id: 'incentives', label: 'Agent Incentives', icon: DollarSign, hidden: !(canViewIncentivesTab && !isQA), disabled: true },
      { id: 'mgmt_incentives', label: 'Management Incentives', icon: Gem, hidden: !(!isAgent && !isQA), disabled: true },
    ]),
    ...((isAgent || isQA) ? [{ id: 'my_roster', label: 'My Roster', icon: CalendarDays }] : []),
  ];

  const visibleTabs = tabs.filter((tab) => tab && !tab.hidden);

  return (
    <div className="relative w-full">
      <SubTabsBar
        bordered
        equalWidth
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={tabs}
      />

      {activeTab === 'user_monthly_report' && (
        <div className="mt-4">
          <UserMonthlyReport />
        </div>
      )}

      {activeTab === 'project_monthly_report' && (
        <div className="mt-4">
          <ProjectMonthlyReport />
        </div>
      )}

      <div className="sm:hidden mt-2">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-700 text-sm font-medium"
        >
          {visibleTabs.map((tab) => (
            <option key={tab.id} value={tab.id} disabled={tab.disabled}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TabsNavigation;
