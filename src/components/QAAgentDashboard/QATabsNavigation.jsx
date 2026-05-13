import React from 'react';
import {
  LayoutGrid,
  Briefcase,
  FileCheck,
  FileText,
  DollarSign,
  RotateCcw
} from 'lucide-react';

const QATabsNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'billable_report', label: 'Agent Billable Report', icon: Briefcase },
    { id: 'audit_report', label: 'Audit Report', icon: FileCheck },
    { id: 'qa_billable_report', label: 'QA Billable Report', icon: FileText },
    { id: 'incentives', label: 'Agent Incentives', icon: DollarSign, disabled: true }
  ];

  return (
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
                <span>{tab.label}</span>
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QATabsNavigation;
