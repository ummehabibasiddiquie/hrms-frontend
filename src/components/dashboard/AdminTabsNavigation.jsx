import React from 'react';
import UserMonthlyReport from './UserMonthlyReport';
import ProjectMonthlyReport from './ProjectMonthlyReport';
import TaskEODReport from './TaskEODReport';
import {
  LayoutGrid,
  Briefcase,
  Users,
  FolderKanban,
  DollarSign,
  FileText
} from 'lucide-react';

const AdminTabsNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'billable_report', label: 'Billable Report', icon: Briefcase },
    { id: 'user_monthly_report', label: 'User Monthly Report', icon: Users },
    { id: 'project_monthly_report', label: 'Project Monthly Report', icon: FolderKanban },
    { id: 'task_eod_report', label: 'Task EOD Report', icon: FileText },
    { id: 'incentives', label: 'Agent Incentives', icon: DollarSign, disabled: true }
  ];

  return (
    <div className="max-w-7xl mx-auto mt-2">
      {/* Navigation Tab Card */}
      <div className="bg-white rounded-2xl shadow-lg mb-6 border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex-1 min-w-fit px-4 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${
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
      {/* Gap between cards */}
      {activeTab === 'user_monthly_report' && <div className="h-4" />}
      {activeTab === 'project_monthly_report' && <div className="h-4" />}
      {/* Filter and Table Card for User Monthly Report */}
      {activeTab === 'user_monthly_report' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <UserMonthlyReport />
        </div>
      )}
      {/* Project Monthly Report Tab */}
      {activeTab === 'project_monthly_report' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <ProjectMonthlyReport />
        </div>
      )}
    </div>
  );
};

export default AdminTabsNavigation;
