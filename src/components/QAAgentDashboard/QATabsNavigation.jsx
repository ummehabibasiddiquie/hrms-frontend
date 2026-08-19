import React from 'react';
import {
  LayoutGrid,
  Briefcase,
  FileCheck,
} from 'lucide-react';
import SubTabsBar from '../common/SubTabsBar';

const QATabsNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'billable_report', label: 'Billable Report', icon: Briefcase },
    { id: 'audit_report', label: 'Audit Report', icon: FileCheck }
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
