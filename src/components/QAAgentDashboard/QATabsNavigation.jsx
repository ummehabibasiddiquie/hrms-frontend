import React from 'react';
import {
  LayoutGrid,
  Briefcase,
  FileCheck,
  FileWarning,
  DollarSign,
  CalendarDays
} from 'lucide-react';
import SubTabsBar from '../common/SubTabsBar';

const QATabsNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'my_roster', label: 'My Roster', icon: CalendarDays },
    { id: 'billable_report', label: 'Billable Report', icon: Briefcase },
    { id: 'audit_report', label: 'Audit Report', icon: FileCheck },
    { id: 'adherence', label: 'Reporting Adherence', icon: FileWarning, disabled: true },
    { id: 'incentives', label: 'Agent Incentives', icon: DollarSign, disabled: true }
  ];

  return (
    <SubTabsBar
      bordered
      equalWidth
      activeTab={activeTab}
      onChange={setActiveTab}
      tabs={tabs}
    />
  );
};

export default QATabsNavigation;
