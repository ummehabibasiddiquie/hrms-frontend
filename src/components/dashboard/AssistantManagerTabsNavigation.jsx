import React from 'react';
import UserMonthlyReport from './UserMonthlyReport';
import ProjectMonthlyReport from './ProjectMonthlyReport';
import ManagerRosterRequests from '../../pages/ManagerRosterRequests';
import QABillableReport from './QABillableReport';
import {
  LayoutGrid,
  Briefcase,
  Users,
  FolderKanban,
  FileText,
  FileCheck
} from 'lucide-react';

const AssistantManagerTabsNavigation = ({ activeTab, setActiveTab, isSuperAdmin = false }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'billable_report', label: 'Billable Report', icon: Briefcase },
    { id: 'user_monthly_report', label: 'User Monthly Goal', icon: Users },
    { id: 'project_monthly_report', label: 'Project Monthly Report', icon: FolderKanban },
    { id: 'roster_report', label: 'Roster Report', icon: FileText },
    ...(isSuperAdmin ? [{ id: 'qa_billable_report', label: 'QA Billable Report', icon: FileCheck }] : [])
  ];

  return (
    <div className="max-w-7xl mx-auto mt-2">
      {/* Navigation Tab Card */}
      <div className="bg-white rounded-2xl shadow-lg mb-6 border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
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
      {/* Roster Report Tab */}
      {activeTab === 'roster_report' && (
        <div className="mt-6">
          <ManagerRosterRequests />
        </div>
      )}
      {/* QA Billable Report Tab */}
      {activeTab === 'qa_billable_report' && (
        <div className="mt-6">
          <QABillableReport />
        </div>
      )}
    </div>
  );
};

export default AssistantManagerTabsNavigation;
