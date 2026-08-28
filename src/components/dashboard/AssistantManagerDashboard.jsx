import React, { useEffect, useState } from "react";
import AssistantManagerTabsNavigation from "./AssistantManagerTabsNavigation";
import { format } from "date-fns";
import { FileText, Users, Clock, TrendingUp, Download, Filter, CheckCircle2, Calendar, RotateCcw, Funnel } from "lucide-react";

import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import ErrorMessage from '../common/ErrorMessage';
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useDeviceInfo } from '../../hooks/useDeviceInfo';
import BillableReport from "../common/BillableReport";
import QATrackerReport from './QATrackerReport';
import QAAgentList from './QAAgentList';
import QAAgentAudit from './QAAgentAudit';
import { DateRangePicker } from '../common/CustomCalendar';
import { formatISTDateTimeParts } from '../../utils/dateTimeIST';
import { useRoutedDashboardTab } from '../../hooks/useRoutedDashboardTab';

const AssistantManagerDashboard = () => {
  // StatCard component for dashboard stats
  const StatCard = ({ title, value, subtext, icon: Icon, trend = 'neutral', alert, className = '', valueClassName = '' }) => (
    <div
      className={`relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 min-w-0 group/card transform hover:-translate-y-1 ${className} 
        ${alert ? 'bg-white border-2 border-red-300' : 'bg-white border-2 border-slate-200 hover:border-blue-300'}`}
    >
      {/* Subtle decorative element */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-12 translate-x-12"></div>
      
      <div className="relative p-5 flex items-center justify-between gap-4">
        {/* Content Container */}
        <div className="flex-1 min-w-0 z-10">
          {/* Title */}
          <div className="flex items-center gap-1.5 mb-2">
            <p className={`text-xs font-bold uppercase tracking-wide truncate ${alert ? 'text-red-600' : 'text-slate-600'}`}>
              {title}
            </p>
          </div>

          {/* Value */}
          <h3 className={`text-2xl sm:text-3xl font-extrabold truncate ${alert ? 'text-red-700' : 'text-slate-900'} ${valueClassName}`}>
            {value}
          </h3>

          {/* Subtext */}
          {subtext && (
            <p className={`text-xs font-semibold mt-1.5 truncate 
              ${trend === 'up' ? 'text-green-600' :
                trend === 'down' ? 'text-red-500' :
                'text-slate-500'}`}>
              {subtext}
            </p>
          )}
        </div>

        {/* Icon Container */}
        <div className={`p-3 rounded-xl shadow-sm flex-shrink-0 z-10 
          ${alert ? 'bg-red-100' :
            trend === 'up' ? 'bg-green-100' :
            'bg-blue-100'}`}>
          <Icon className={`w-6 h-6 ${alert ? 'text-red-600' : trend === 'up' ? 'text-green-600' : 'text-blue-600'}`} />
        </div>
      </div>
    </div>
  );

  // Tab state synced to ?tab= (same pattern as Manage → adminTab)
  const [activeTab, setActiveTab] = useRoutedDashboardTab('overview');
  const { user } = useAuth();
  // Project/task name mapping state
  const [projectNameMap, setProjectNameMap] = useState({});
  const [taskNameMap, setTaskNameMap] = useState({});

  // Fetch project/task mapping once
  useEffect(() => {
    const fetchDropdownMapping = async () => {
      try {
        const dropdownRes = await api.post("/dropdown/get", {
          dropdown_type: "projects with tasks",
          logged_in_user_id: user?.user_id
        });
        const projectsWithTasks = dropdownRes.data?.data || [];
        const pMap = {};
        const tMap = {};
        projectsWithTasks.forEach(project => {
          pMap[String(project.project_id)] = project.project_name;
          (project.tasks || []).forEach(task => {
            tMap[String(task.task_id)] = task.task_name || task.label;
          });
        });
        setProjectNameMap(pMap);
        setTaskNameMap(tMap);
      } catch (err) {
        // Silent fail for dashboard
      }
    };
    if (user?.user_id) {
      fetchDropdownMapping();
    }
  }, [user?.user_id]);
  const { device_id, device_type } = useDeviceInfo();
  
  // Set default date range to today's date (matches QA Agent behavior)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateRange, setDateRange] = useState({
    start: todayStr,
    end: todayStr,
  });
  const [stats, setStats] = useState({
    totalAgents: 0,
    qcPending: 0,
    billableHours: 0,
    assignedHours: 0,
    avgQcScore: 0,
    latestQc: [],
  });
  const [loading, setLoading] = useState(false); // Restored loading state for async fetch
  const [error, setError] = useState(null);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        // If no filter applied, show today's data only (but do not set date in filter UI)
        let payload = {
          logged_in_user_id: user?.user_id || user?.id,
          device_id,
          device_type,
        };
        // Do NOT send user_id in the payload, only logged_in_user_id
        // (If user_id is present elsewhere, ensure it's not included)
        // If user applies a date filter, use it; otherwise, send today's date in API only
        if (dateRange.start && dateRange.end) {
          payload.date_from = dateRange.start;
          payload.date_to = dateRange.end;
        } else if (!dateRange.start && !dateRange.end) {
          // Default: show today's data only
          const today = format(new Date(), 'yyyy-MM-dd'); // No time displayed here, so nothing to change
          payload.date_from = today;
          payload.date_to = today;
        }
        const res = await api.post('/dashboard/filter', payload);
        if (res.data && res.data.status === 200) {
          const data = res.data.data || {};
          console.log('[AssistantManagerDashboard] Dashboard API data:', data);
          // Only show trackers with files, sorted by date_time desc, limit 5
          const latestQc = (data.tracker || [])
            .filter(row => !!row.tracker_file)
            .sort((a, b) => new Date(b.date_time) - new Date(a.date_time))
            .slice(0, 5)
            .map(row => ({
              ...row,
              user_name: row.user_name || '-',
              project_name: projectNameMap[String(row.project_id)] || row.project_name || String(row.project_id) || '-',
              file_name: row.tracker_file ? row.tracker_file.split('/').pop() : '-',
              qc_score: row.qc_score || '-',
              date: row.date_time ? row.date_time.split(' ')[0] : '-',
              task_name: taskNameMap[String(row.task_id)] || row.task_name || String(row.task_id) || '-',
            }));
          setStats({
            totalAgents: (data.users || []).length,
            qcPending: (data.tracker || []).filter(row => row.tracker_file && row.qc_status === 'pending').length,
            billableHours: (data.summary?.total_billable_hours || 0).toFixed(2),
            assignedHours: (data.summary?.total_assigned_hours || 0).toFixed(2),
            avgQcScore: '-', // Not provided in response
            latestQc,
          });
        } else {
          setStats({ totalAgents: 0, qcPending: 0, billableHours: 0, avgQcScore: 0, latestQc: [] });
        }
      } catch (err) {
        setError(getFriendlyErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [user, dateRange, device_id, device_type, projectNameMap, taskNameMap]);

  // const handleDateChange = (field, value) => {
  //   setDateRange((prev) => ({ ...prev, [field]: value }));
  // };

  // Handler for date change
  const handleDateRangeChange = (field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  // Handler for clearing filter - reset to today
  const handleClearFilter = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDateRange({ start: today, end: today });
  };

  return (
    <div className={`max-w-7xl mx-auto ${activeTab === 'billable_report' ? 'pb-2' : 'space-y-4 pb-10'}`}>
      {/* Navigation Tabs */}
      <AssistantManagerTabsNavigation activeTab={activeTab} setActiveTab={setActiveTab} compact={activeTab === 'billable_report'} />
      
      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        error ? (
          <ErrorMessage message={error} />
        ) : (
          <>
            {/* Custom Calendar Filter Bar (same as QAAgentDashboard) */}
            <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 mb-4">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
                {/* Header Section */}
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm">
                    <Funnel className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 leading-tight">Date Range Filter</h3>
                    <p className="text-xs text-slate-500 font-medium">Select your preferred date range</p>
                  </div>
                </div>
                {/* Custom Calendar Component */}
                <div className="flex-1">
                  <DateRangePicker
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    onStartDateChange={(value) => handleDateRangeChange('start', value)}
                    onEndDateChange={(value) => handleDateRangeChange('end', value)}
                    noWrapper={true}
                    showClearButton={false}
                  />
                </div>
                {/* Reset Button */}
                <div className="flex-shrink-0">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5 opacity-0">
                    Action
                  </label>
                  <button
                    onClick={handleClearFilter}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg px-6 py-2.5 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 group"
                  >
                    <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                    Reset to Today
                  </button>
                </div>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-h-[120px]">
              <StatCard
                icon={Users}
                title="Total Active Agents"
                value={stats.totalAgents}
                subtext="Assigned agents"
                trend="neutral"
                className="h-32 flex flex-col justify-center"
              />
              {/* <StatCard
                icon={FileText}
                title="Pending QC Files"
                value={stats.qcPending}
                subtext="Files to review"
                trend="neutral"
                className="h-32 flex flex-col justify-center"
              /> */}
              <StatCard
                icon={Clock}
                title="Total Billable Hours"
                value={`${Number(stats.billableHours).toFixed(2)} / ${Number(stats.assignedHours).toFixed(2)}`}
                subtext="Billable / Assigned hours"
                trend="up"
                className="h-32 flex flex-col justify-center"
                valueClassName="text-xl sm:text-2xl"
              />
              {/* <StatCard
                icon={TrendingUp}
                title="Avg QC Score"
                value={stats.avgQcScore}
                subtext="Average QC score"
                trend="neutral"
                className="h-32 flex flex-col justify-center"
              /> */}
            </div>

            {/* Latest QC Done Files Section */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
              {/* Header with gradient background */}
              <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Latest QC Files</h2>
                      <p className="text-sm text-blue-100 mt-1 font-medium">Files recently reviewed for quality check</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
                    <Clock className="w-4 h-4 text-white" />
                    <span className="text-sm font-semibold text-white">{stats.latestQc.length} Files</span>
                  </div>
                </div>
              </div>

              {/* Content Area */}
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200"></div>
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
                    </div>
                    <span className="text-slate-600 font-semibold">Loading QC files...</span>
                  </div>
                </div>
              ) : stats.latestQc.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-slate-800 font-bold text-xl mb-2">All Caught Up!</p>
                  <p className="text-slate-500 text-sm">No QC files found in this period.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stats.latestQc.map((file, index) => (
                    <div
                      key={file.tracker_id || index}
                      className="group px-6 py-5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-5">
                        {/* File Icon */}
                        <div className="relative">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                            <FileText className="w-7 h-7 text-blue-600" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-white text-xs font-bold">{index + 1}</span>
                          </div>
                        </div>

                        {/* File Details Grid */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Date/Time
                            </p>
                            <div className="text-sm font-bold text-slate-800">
                              {file.date_time ? (() => {
                                const { date, time } = formatISTDateTimeParts(file.date_time);
                                return (
                                  <>
                                    <div>{date}</div>
                                    <div className="text-xs text-slate-600">{time}</div>
                                  </>
                                );
                              })() : "-"}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Agent</p>
                            <p className="text-sm font-bold text-blue-700">
                              {file.user_name || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Project</p>
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {file.project_name || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Task</p>
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {file.task_name || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">File</p>
                            {file.tracker_file ? (
                              <a
                                href={file.tracker_file}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-bold transition-colors group/link"
                              >
                                <Download className="w-4 h-4 group-hover/link:animate-bounce" />
                                Download
                              </a>
                            ) : (
                              <span className="text-slate-400 text-sm font-medium">No file</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}
      
      {/* Billable Report Tab */}
      {activeTab === 'billable_report' && <BillableReport />}
      {activeTab === 'tracker_report' && (
        <div className="max-w-7xl mx-auto mt-6">
          <QATrackerReport />
        </div>
      )}
      {activeTab === 'agent_file_report' && (
        <div className="max-w-7xl mx-auto mt-6">
          <QAAgentList />
        </div>
      )}
      {activeTab === 'qa_agent_audit' && (
        <div className="max-w-7xl mx-auto mt-6">
          <QAAgentAudit />
        </div>
      )}
    </div>
  );
};

export default AssistantManagerDashboard;
