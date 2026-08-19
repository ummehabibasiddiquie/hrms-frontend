import React from 'react';
import {
  LayoutGrid,
  Briefcase,
} from 'lucide-react';
import SubTabsBar from '../common/SubTabsBar';

const AgentTabsNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'billable_report', label: 'Billable & QC Report', icon: Briefcase }
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

export default AgentTabsNavigation;
