/**
 * File: QABillableReport.jsx
 * Description: QA Billable Report showing agent-wise QC data with filters and export
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { 
  FileText, 
  Download, 
  Search, 
  Calendar, 
  Users, 
  Clock, 
  FileCheck, 
  Briefcase,
  Loader2,
  X,
  User,
  BarChart3,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { DateRangePicker } from "../common/CustomCalendar";

const QABillableReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  // Track expanded/collapsed state for each QA Agent card
  const [expandedCards, setExpandedCards] = useState({});

  // Role detection
  const roleId = Number(user?.role_id);
  const isQA = roleId === 5;
  const isManager = [1, 2, 3].includes(roleId); // Super Admin, Admin, Project Manager

  // Check if user has permission to view this report
  const hasPermission = useMemo(() => {
    const allowedRoleIds = [1, 2, 3, 5]; // Super Admin, Admin, Project Manager, QA Agent
    return allowedRoleIds.includes(roleId);
  }, [roleId]);

  // Fetch data from API
  const fetchReportData = useCallback(async () => {
    if (!user?.user_id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/qa_agent_report/billable_report", {
        logged_in_user_id: user.user_id,
        date_from: dateRange.start,
        date_to: dateRange.end,
      });

      if (response.data?.status === 200) {
        // Map API response fields to frontend expected fields
        const mappedRecords = (response.data.data?.records || []).map(record => ({
          ...record,
          agent_name: record.qa_agent_name || record.agent_name,
          qa_name: record.qa_agent_name || record.qa_name,
          task_name: record.task_name || 'N/A',
          qa_task_target: record.qa_task_target || '-',
          file_record_count: record.file_record_count || record.daily_production || '-',
          qc_generated_count: record.qc_generated_count || record.daily_qc_records || '-',
          total_files: record.total_files || record.daily_production || '-',
          qa_billable_hours: record.qa_billable_hours || record.daily_billable_hours || '-',
          team_name: record.team_name || 'N/A'
        }));
        
        // Map summary fields
        const mappedSummary = response.data.data?.summary ? {
          ...response.data.data.summary,
          total_files_processed: response.data.data.summary.total_production || response.data.data.summary.total_files_processed || '-',
          total_qc_records: response.data.data.summary.total_qc_records || '-',
          total_unique_qa_agents: response.data.data.summary.total_unique_qa_agents || '-',
          total_billable_hours: response.data.data.summary.total_billable_hours || '-'
        } : null; 
        
        setData(mappedRecords);
        setSummary(mappedSummary);
        toast.success(`Loaded ${mappedRecords.length} records`);
      } else {
        toast.error(response.data?.message || "Failed to load report data");
        setData([]);
        setSummary(null);
      }
    } catch (error) {
      console.error("Error fetching billable report:", error);
      toast.error(error.response?.data?.message || "Failed to load report data");
      setData([]);
      setSummary(null); 
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, dateRange.start, dateRange.end]);

  // Initial load
  useEffect(() => {
    if (hasPermission && user?.user_id) {
      fetchReportData();
    }
  }, [user?.user_id, hasPermission]);

  // Fetch data when date range changes
  useEffect(() => {
    if (hasPermission && user?.user_id && dateRange.start && dateRange.end) {
      fetchReportData();
    }
  }, [dateRange.start, dateRange.end, hasPermission, user?.user_id, fetchReportData]);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    
    const searchLower = searchTerm.toLowerCase();
    return data.filter((record) => {
      return (
        (record.agent_name || record.qa_agent_name)?.toLowerCase().includes(searchLower) ||
        (record.task_name || 'N/A').toLowerCase().includes(searchLower) ||
        (record.team_name || 'N/A').toLowerCase().includes(searchLower) ||
        record.report_date?.includes(searchLower) ||
        String(record.qa_task_target || '-').includes(searchLower) ||
        String(record.file_record_count || record.daily_production || '-').includes(searchLower) ||
        String(record.qc_generated_count || record.daily_qc_records || '-').includes(searchLower) ||
        String(record.total_files || record.daily_production || '-').includes(searchLower) ||
        String(record.qa_billable_hours || record.daily_billable_hours || '-').includes(searchLower) ||
        (record.qa_name || record.qa_agent_name)?.toLowerCase().includes(searchLower)
      );
    });
  }, [data, searchTerm]);

  // Group data by QA Agent for Manager view
  const groupedByQA = useMemo(() => {
    if (isQA) return {};
    
    const grouped = {};
    filteredData.forEach((record) => {
      const qaName = record.qa_name || record.qa_agent_name || "Unknown QA";
      if (!grouped[qaName]) {
        grouped[qaName] = {
          qa_name: qaName,
          records: [],
          total_billable_hours: 0,
          total_files: 0,
          total_qc_records: 0,
        };
      }
      grouped[qaName].records.push(record);
      grouped[qaName].total_billable_hours += Number(record.qa_billable_hours || record.daily_billable_hours) || 0;
      grouped[qaName].total_files += Number(record.total_files || record.daily_production) || 0;
      grouped[qaName].total_qc_records += Number(record.qc_generated_count || record.daily_qc_records) || 0;
    });
    return grouped;
  }, [filteredData, isQA]);

  // Export data to CSV
  const exportToCSV = (records, filename) => {
    if (records.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Agent Name",
      "Date",
      "Task Name",
      "Task Target",
      "Total File Record",
      "Total QC Record",
      "Total Files",
      "Billable Hours",
      "QA Name",
      "Team",
    ];

    const rows = records.map((record) => [
      record.agent_name || record.qa_agent_name,
      record.report_date,
      record.task_name || 'N/A',
      record.qa_task_target || '-',
      record.file_record_count || record.daily_production || '-',
      record.qc_generated_count || record.daily_qc_records || '-',
      record.total_files || record.daily_production || '-',
      record.qa_billable_hours || record.daily_billable_hours || '-',
      record.qa_name || record.qa_agent_name,
      record.team_name,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Report exported successfully");
  };

  // Handle date range change
  const handleDateChange = (field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Toggle card expansion
  const toggleCard = (qaName) => {
    setExpandedCards((prev) => ({
      ...prev,
      [qaName]: !prev[qaName],
    }));
  };

  // Expand all cards
  const expandAll = () => {
    const allExpanded = {};
    Object.keys(groupedByQA).forEach((qaName) => {
      allExpanded[qaName] = true;
    });
    setExpandedCards(allExpanded);
  };

  // Collapse all cards
  const collapseAll = () => {
    setExpandedCards({});
  };

  // Stat Card Component
  const StatCard = ({ title, value, icon: Icon, color = "blue" }) => {
    const colorClasses = {
      blue: "bg-blue-50 border-blue-200 text-blue-600",
      green: "bg-green-50 border-green-200 text-green-600",
      purple: "bg-purple-50 border-purple-200 text-purple-600",
      orange: "bg-orange-50 border-orange-200 text-orange-600",
    };

    return (
      <div
        className={`rounded-xl border-2 p-4 shadow-sm transition-all hover:shadow-md ${colorClasses[color]}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {title}
            </p>
            <h3 className="text-xl font-bold text-slate-800 mt-1">{value}</h3>
          </div>
          <div className={`p-2 rounded-lg bg-white/80`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
    );
  };

  // Data Table Component
  const DataTable = ({ records, showAgentInfo = true }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {showAgentInfo && (
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                Agent Name
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
              Task Name
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
              Task Target
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
              File Records
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
              QC Records
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
              Total Files
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
              Billable Hours
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record, index) => (
            <tr
              key={`${record.qa_agent_id || record.agent_id}-${index}-${record.report_date}`}
              className="hover:bg-slate-50 transition-colors"
            >
              {showAgentInfo && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {record.agent_name || record.qa_agent_name}
                      </p>
                      <p className="text-xs text-slate-500">{record.team_name}</p>
                    </div>
                  </div>
                </td>
              )}
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-slate-700">
                  {format(new Date(record.report_date), "dd MMM yyyy")}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-slate-700">
                  {record.task_name || 'N/A'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">
                  {record.qa_task_target || '-'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-sm font-semibold text-slate-700">
                  {record.file_record_count || record.daily_production || '-'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold">
                  {record.qc_generated_count || record.daily_qc_records || '-'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-sm font-semibold text-slate-700">
                  {record.total_files || record.daily_production || '-'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-sm font-bold text-orange-600">
                    {record.qa_billable_hours || record.daily_billable_hours || '-'}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!hasPermission) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h3>
        <p className="text-slate-500">
          You do not have permission to view this report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  QA Billable Report
                </h2>
                <p className="text-sm text-blue-100 mt-0.5 font-medium">
                  Agent-wise QC billable hours and records
                </p>
              </div>
            </div>
            {/* Export button - different for QA vs Manager */}
            {isQA ? (
              <button
                onClick={() => exportToCSV(filteredData, `QA_Billable_Report_${dateRange.start}_to_${dateRange.end}.csv`)}
                disabled={filteredData.length === 0 || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                title="Export all data to CSV"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            ) : isManager ? (
              <button
                onClick={() => exportToCSV(filteredData, `QA_Billable_Report_All_${dateRange.start}_to_${dateRange.end}.csv`)}
                disabled={filteredData.length === 0 || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                title="Export all data to CSV"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Date Range Filter */}
          <div className="flex-1">
            <DateRangePicker
              startDate={dateRange.start}
              endDate={dateRange.end}
              onStartDateChange={(date) => handleDateChange("start", date)}
              onEndDateChange={(date) => handleDateChange("end", date)}
              onClear={() => {
                const today = format(new Date(), "yyyy-MM-dd");
                setDateRange({ start: today, end: today });
              }}
              label="Date Range Filter"
              description="Select your preferred date range"
              showClearButton={true}
              noWrapper={true}
            />
          </div>

          {/* Search Filter */}
          <div className="flex items-start gap-3 flex-1 lg:max-w-md">
            <div className="flex-1 relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Search by agent, task, date..."
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200"></div>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
          </div>
          <span className="text-slate-600 font-semibold">Loading report data...</span>
        </div>
      )}

      {/* No Data State */}
      {!loading && filteredData.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Data Found</h3>
          <p className="text-slate-500 text-sm">
            {searchTerm
              ? "No records match your search criteria"
              : "No records available for the selected date range"}
          </p>
        </div>
      )}

      {/* QA Agent View - Simple Table */}
      {!loading && isQA && filteredData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <DataTable records={filteredData} showAgentInfo={true} />
        </div>
      )}

      {/* Manager View - QA Agent Cards */}
      {!loading && isManager && filteredData.length > 0 && (
        <div className="space-y-4">
          {/* Expand/Collapse Controls */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-slate-200 px-4 py-3">
            <span className="text-sm font-semibold text-slate-600">
              {Object.keys(groupedByQA).length} QA Agents
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          {Object.values(groupedByQA).map((qaGroup) => {
            const isExpanded = expandedCards[qaGroup.qa_name] === true; // Default to collapsed
            return (
              <div
                key={qaGroup.qa_name}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                {/* QA Agent Card Header - Clickable */}
                <div
                  onClick={() => toggleCard(qaGroup.qa_name)}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-5 py-4 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">
                          {qaGroup.qa_name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {qaGroup.records.length} records
                        </p>
                      </div>
                      {/* Expand/Collapse Icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCard(qaGroup.qa_name);
                        }}
                        className="ml-2 p-1 hover:bg-blue-200 rounded-full transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-blue-600" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* QA Agent Stats */}
                      <div className="flex items-center gap-4 mr-4">
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase">Billable Hours</p>
                          <p className="text-sm font-bold text-orange-600">
                            {qaGroup.total_billable_hours.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase">Files</p>
                          <p className="text-sm font-bold text-blue-600">
                            {qaGroup.total_files}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase">QC Records</p>
                          <p className="text-sm font-bold text-green-600">
                            {qaGroup.total_qc_records}
                          </p>
                        </div>
                      </div>
                      {/* Individual Export Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportToCSV(
                            qaGroup.records,
                            `QA_Billable_${qaGroup.qa_name.replace(/\s+/g, "_")}_${dateRange.start}_to_${dateRange.end}.csv`
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold text-xs shadow-sm hover:shadow transition-all duration-200"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                    </div>
                  </div>
                </div>
                {/* QA Agent Data Table - Collapsible */}
                {isExpanded && (
                  <div className="p-0 animate-in slide-in-from-top-2 duration-200">
                    <DataTable records={qaGroup.records} showAgentInfo={true} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats Cards - Only for QA Agent view */}
      {isQA && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Billable Hours"
            value={summary.total_billable_hours}
            icon={Clock}
            color="blue"
          />
          <StatCard
            title="Total Files Processed"
            value={summary.total_files_processed || summary.total_production || '-'}
            icon={FileText}
            color="green"
          />
          <StatCard
            title="Total QC Records"
            value={summary.total_qc_records}
            icon={FileCheck}
            color="purple"
          />
          <StatCard
            title="Total Agents"
            value={summary.total_unique_agents}
            icon={Users}
            color="orange"
          />
        </div>
      )}

      {/* Manager Summary */}
      {isManager && summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Overall Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">Total Billable Hours</p>
              <p className="text-xl font-bold text-orange-600">
                {summary.total_billable_hours}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">Total Files</p>
              <p className="text-xl font-bold text-blue-600">
                {summary.total_files_processed || summary.total_production || '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">QC Records</p>
              <p className="text-xl font-bold text-green-600">
                {summary.total_qc_records}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">QA Agents</p>
              <p className="text-xl font-bold text-purple-600">
                {summary.total_unique_qa_agents}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QABillableReport;
