import React from 'react';
import UserMonthlyReport from './UserMonthlyReport';
import ProjectMonthlyReport from './ProjectMonthlyReport';
import {
  LayoutGrid,
  Briefcase,
  Users,
  FolderKanban,
  DollarSign,
} from 'lucide-react';
import SubTabsBar from '../common/SubTabsBar';

const AssistantManagerTabsNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'billable_report', label: 'Billable Report', icon: Briefcase },
    { id: 'user_monthly_report', label: 'User Monthly Goal', icon: Users },
    { id: 'project_monthly_report', label: 'Project Monthly Report', icon: FolderKanban },
    { id: 'incentives', label: 'Agent Incentives', icon: DollarSign, disabled: true }
  ];

  return (
    <div className="max-w-7xl mx-auto mt-2">
      <SubTabsBar
        bordered
        equalWidth
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={tabs}
      />
      {activeTab === 'user_monthly_report' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <UserMonthlyReport />
        </div>
      )}
      {activeTab === 'project_monthly_report' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <ProjectMonthlyReport />
        </div>
      )}
    </div>
  );
};

export default AssistantManagerTabsNavigation;
