/**
 * File: QAAgentDashboard.jsx
 * Author: Naitik Maisuriya
 * Description: QA Agent Dashboard with stats and pending QC files
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// Set your backend base URL here or use an environment variable (Vite uses import.meta.env)
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "";
import { format } from "date-fns";
import { Users, FileCheck, Download, FileText, TrendingUp, Activity, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { log, logError } from "../../config/environment";
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import ErrorMessage from '../common/ErrorMessage';
import AppLayout from "../../layouts/AppLayout";
import QATabsNavigation from "./QATabsNavigation";
import BillableReport from "../common/BillableReport";
import QABillableReport from "../dashboard/QABillableReport";
import QAFilterBar from "./QAFilterBar";
import QAIndividualAuditReport from "./QAIndividualAuditReport";
import QAAgentQCFormReport from "../dashboard/QAAgentQCFormReport";
import QAAgentReworkCorrectionReview from "../dashboard/QAAgentReworkCorrectionReview";

const QAAgentDashboard = ({ embedded = false }) => {
  // StatCard component for dashboard stats
  const StatCard = ({ title, value, subtext, icon: Icon, trend = 'neutral', alert, className = '' }) => (
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
          <h3 className={`text-2xl sm:text-3xl font-extrabold truncate ${alert ? 'text-red-700' : 'text-slate-900'}`}>
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
  
  // Handle QC Form action
  const navigate = useNavigate();
  const handleQCForm = (tracker) => {
    log('[QAAgentDashboard] Opening QC Form for tracker:', tracker.tracker_id);
    navigate('/qc-form', { state: { tracker } });
  };
  const { user } = useAuth();
  const { device_id, device_type } = useDeviceInfo();
  

  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalAgents: 0,
    pendingQCFiles: 0,
    placeholder1: 0,
    placeholder2: 0
  });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  // Set default date range to today's date
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateRange, setDateRange] = useState({
    start: todayStr,
    end: todayStr
  });

  // Helper to get full file URL for download
  const getFileUrl = (filePath) => {
    if (!filePath) return "";
    // If filePath is already absolute (starts with http), return as is
    if (/^https?:\/\//i.test(filePath)) return filePath;
    // Otherwise, prepend backend base URL
    return BACKEND_BASE_URL + filePath;
  };

  // Format date/time to display format: 3/Feb/2026 and 1:05 PM (UTC)
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return { date: '-', time: '-' };
    
    try {
      // Parse the date string - handle various formats
      let dateObj = new Date(dateTimeStr);
      
      // If invalid date, try to extract date portion
      if (isNaN(dateObj.getTime())) {
        const dateMatch = dateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          dateObj = new Date(dateMatch[0]);
        } else {
          return { date: dateTimeStr, time: '' };
        }
      }
      
      // Format in UTC timezone
      const day = dateObj.getUTCDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[dateObj.getUTCMonth()];
      const year = dateObj.getUTCFullYear();
      const date = `${day}/${month}/${year}`;
      
      let hours = dateObj.getUTCHours();
      const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const time = `${hours}:${minutes} ${ampm}`;
      
      return { date, time };
    } catch (error) {
      console.error('[QAAgentDashboard] Error formatting date:', dateTimeStr, error);
      return { date: dateTimeStr, time: '' };
    }
  };

  // Fetch dashboard data on mount
  // Call dashboard/filter on any filter change (add date/task/project if needed)

  // Fetch dashboard data with filter
  const fetchDashboardData = async (customRange) => {
      // ...existing code...
    try {
      setLoading(true);
      log('[QAAgentDashboard] Fetching dashboard data');
      let payload = {
        logged_in_user_id: user?.user_id,
        device_id,
        device_type
      };
      // If a valid filter is set, use it; otherwise always use today's date
      if (customRange && customRange.start && customRange.end) {
        payload = { ...payload, from_date: customRange.start, to_date: customRange.end };
      } else {
        // Always show today's data by default if no filter is set
        const today = new Date().toISOString().slice(0, 10);
        payload = { ...payload, from_date: today, to_date: today };
      }
      console.log('[QAAgentDashboard] API payload:', payload);
      const res = await api.post('/dashboard/filter', payload);
      console.log('[QAAgentDashboard] API response:', res.data);
      if (res.status === 200 && res.data?.data) {
        const responseData = res.data.data;
        const trackers = responseData.tracker || [];
        const users = responseData.users || [];
        const tasks = responseData.tasks || [];
        const summary = responseData.summary || {};
        console.log('[QAAgentDashboard] Raw trackers:', trackers);
        // Create a map for task lookup
        const taskMap = {};
        tasks.forEach(task => {
          taskMap[task.task_id] = {
            task_name: task.task_name,
            task_target: task.task_target
          };
        });
        // Filter trackers with files and enrich with task names
        let trackersWithFiles = trackers
          .filter(tracker => tracker.tracker_file)
          .map(tracker => {
            const taskInfo = taskMap[tracker.task_id] || {};
            return {
              ...tracker,
              task_name: taskInfo.task_name || 'N/A'
            };
          });
        console.log('[QAAgentDashboard] trackersWithFiles after file filter:', trackersWithFiles);

        // Filter by date range if set, otherwise by today
        let fromDate, toDate;
        if (customRange && customRange.start && customRange.end) {
          fromDate = new Date(customRange.start);
          toDate = new Date(customRange.end);
        } else {
          const today = new Date().toISOString().slice(0, 10);
          fromDate = new Date(today);
          toDate = new Date(today);
        }
        trackersWithFiles = trackersWithFiles.filter(tracker => {
          if (!tracker.date_time) return false;
          
          // Parse the date_time field - handle various formats
          let trackerDate;
          try {
            // Try parsing as-is first
            trackerDate = new Date(tracker.date_time);
            
            // If invalid, try extracting date portion
            if (isNaN(trackerDate.getTime())) {
              // Extract YYYY-MM-DD pattern from the string
              const dateMatch = tracker.date_time.match(/(\d{4})-(\d{2})-(\d{2})/);
              if (dateMatch) {
                trackerDate = new Date(dateMatch[0]);
              } else {
                return false;
              }
            }
          } catch (e) {
            console.error('[QAAgentDashboard] Error parsing date:', tracker.date_time, e);
            return false;
          }
          
          // Compare only date parts (ignore time)
          const trackerDateOnly = new Date(trackerDate.getFullYear(), trackerDate.getMonth(), trackerDate.getDate());
          const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
          const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
          
          return trackerDateOnly >= fromDateOnly && trackerDateOnly <= toDateOnly;
        });
        console.log('[QAAgentDashboard] trackersWithFiles after date filter:', trackersWithFiles);

        // Sort by date_time descending (latest first)
        trackersWithFiles.sort((a, b) => new Date(b.date_time) - new Date(a.date_time));

        // Set stats
        setStats({
          totalAgents: users.length || 0,
          pendingQCFiles: trackersWithFiles.length || 0,
          placeholder1: summary.tracker_rows || 0,
          placeholder2: summary.project_count || 0
        });
        setPendingFiles(trackersWithFiles);
        log('[QAAgentDashboard] Dashboard data loaded - Agents:', users.length, 'Files:', trackersWithFiles.length);
      } else {
        setStats({
          totalAgents: 0,
          pendingQCFiles: 0,
          placeholder1: 0,
          placeholder2: 0
        });
        setPendingFiles([]);
      }
    } catch (err) {
      logError('[QAAgentDashboard] Error fetching dashboard data:', err);
      setError(getFriendlyErrorMessage(err));
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // On mount, data will load automatically via the dateRange useEffect
  // No need for separate mount effect since dateRange is initialized with today's date

  // Auto-apply filter on date change
  useEffect(() => {
    // Fetch data whenever date range changes (including initial load with today's date)
    if (dateRange.start && dateRange.end) {
      fetchDashboardData(dateRange);
    }
    // eslint-disable-next-line
  }, [dateRange.start, dateRange.end]);

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const handleClear = () => {
    // Reset to today's date
    const today = new Date().toISOString().slice(0, 10);
    setDateRange({ start: today, end: today });
  };

  // Debug: log pendingFiles to help diagnose production issues
  useEffect(() => {
    if (pendingFiles) {
      console.log('[QAAgentDashboard] pendingFiles:', pendingFiles);
      pendingFiles.forEach((file, idx) => {
        console.log(`[QAAgentDashboard] File #${idx + 1} download URL:`, getFileUrl(file.tracker_file));
      });
    }
  }, [pendingFiles]);

  const content = (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* Tabs Navigation */}
      <QATabsNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        error ? (
          <ErrorMessage message={error} />
        ) : (
          <>
            {/* Filter Bar - Only in Overview Tab */}
            <QAFilterBar
              dateRange={dateRange}
              handleDateRangeChange={handleDateRangeChange}
              handleClear={handleClear}
            />
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-h-[120px]">
              <StatCard
                icon={Users}
                title="Total ActiveS Agents"
                value={stats.totalAgents}
                subtext="Assigned agents"
                trend="neutral"
                className="h-32 flex flex-col justify-center"
              />
              <StatCard
                icon={FileCheck}
                title="Pending QC Files"
                value={stats.pendingQCFiles}
                subtext="Files to review"
                trend="neutral"
                className="h-32 flex flex-col justify-center"
              />
              {/* <StatCard
                icon={TrendingUp}
                title="Placeholder 1"
                value={stats.placeholder1}
                subtext="Data pending"
                trend="neutral"
                className="h-32 flex flex-col justify-center"
              /> */}
              {/* <StatCard
                icon={Activity}
                title="Placeholder 2"
                value={stats.placeholder2}
                subtext="Data pending"
                trend="neutral"
                className="h-32 flex flex-col justify-center"
              /> */}
            </div>

            {/* Pending QC Files Section */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
              {/* Header with gradient background */}
              <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                      <FileCheck className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Latest Pending QC Files</h2>
                      <p className="text-sm text-blue-100 mt-1 font-medium">Review and process quality check files</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
                    <Clock className="w-4 h-4 text-white" />
                    <span className="text-sm font-semibold text-white">{pendingFiles.length} Pending</span>
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
                    <span className="text-slate-600 font-semibold">Loading pending files...</span>
                  </div>
                </div>
              ) : pendingFiles.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-slate-800 font-bold text-xl mb-2">All Caught Up!</p>
                  <p className="text-slate-500 text-sm">No pending QC files at the moment. Great work!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingFiles.slice(0, 5).map((file, index) => (
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
                            <div className="flex flex-col">
                              <p className="text-sm font-bold text-slate-800">
                                {formatDateTime(file.date_time).date}
                              </p>
                              <p className="text-xs font-medium text-slate-600">
                                {formatDateTime(file.date_time).time}
                              </p>
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
                                href={getFileUrl(file.tracker_file)}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-bold transition-colors group/link"
                              >
                                <Download className="w-4 h-4 group-hover/link:animate-bounce" />
                                Download
                                <ExternalLink className="w-3 h-3 opacity-50" />
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
      
      {activeTab === 'billable_report' && <BillableReport />}

      {activeTab === 'qa_billable_report' && <QABillableReport />}

      {activeTab === 'audit_report' && <QAIndividualAuditReport />}
      
      {activeTab === 'qc_form_report' && <QAAgentQCFormReport />}
      
      {activeTab === 'rework_correction_report' && <QAAgentReworkCorrectionReview />}
    </div>
  );

  // If embedded, return just the content
  if (embedded) {
    return content;
  }

  // Otherwise wrap in AppLayout
  return <AppLayout>{content}</AppLayout>;
}
export default QAAgentDashboard;
