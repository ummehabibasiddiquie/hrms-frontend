/**
 * File: QCFormReportView.jsx
 * Author: Naitik Maisuriya
 * Description: QC Form Report View - Displays QC evaluation records with detailed metrics
 */
import React, { useState, useMemo, useEffect } from "react";
import { FileCheck, Calendar, Users, Award, AlertCircle, CheckCircle2, Download, Search, X, Filter, RotateCcw, XCircle, FileSpreadsheet } from "lucide-react";
import { DateRangePicker } from "../common/CustomCalendar";
import SearchableSelect from "../common/SearchableSelect";
import { useAuth } from "../../context/AuthContext";
import { getQCRecordsList } from "../../services/qcService";
import { exportToCSV } from '../../utils/csvExport';
import { toast } from 'react-hot-toast';

const QCFormReportView = () => {
  const { user } = useAuth();
  const [qcReports, setQcReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = React.useCallback(async () => {
    try {
      setLoading(true);
      // If user is Agent (and not QA/Admin), API will filter for their own records
      const isAgentView = user?.designation?.toLowerCase().includes('agent') && !user?.designation?.toLowerCase().includes('qa');
      const userIdToPass = isAgentView ? user?.user_id : null;
      
      const response = await getQCRecordsList(userIdToPass);
      if (response && response.success) {
        setQcReports(response.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch QC reports", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);
  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, Regular, Rework
  const [showErrorListModal, setShowErrorListModal] = useState(false);
  const [selectedErrorList, setSelectedErrorList] = useState([]);
  const [selectedRecordInfo, setSelectedRecordInfo] = useState(null);
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());

  // Filter and search logic
  const filteredReports = useMemo(() => {
    let filtered = qcReports;

    // Filter by date range (created_at)
    if (startDate && endDate) {
      filtered = filtered.filter(report => {
        if (!report.created_at) return false;
        const evalDate = new Date(report.created_at).toISOString().split('T')[0];
        return evalDate >= startDate && evalDate <= endDate;
      });
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(report => report.status?.trim().toLowerCase() === statusFilter.toLowerCase());
    }

    // Search across multiple fields
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(report =>
        (report.agent_name || "").toLowerCase().includes(query) ||
        (report.qa_name || "").toLowerCase().includes(query) ||
        (report.am_name || "").toLowerCase().includes(query) ||
        (report.project_name || "").toLowerCase().includes(query) ||
        (report.task_name || "").toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [qcReports, searchQuery, statusFilter, startDate, endDate]);

  // Calculate summary stats
  const stats = useMemo(() => {
    return {
      total: filteredReports.length,
      regular: filteredReports.filter(r => r.status?.trim().toLowerCase() === "regular").length,
      rework: filteredReports.filter(r => r.status?.trim().toLowerCase() === "rework").length,
      correction: filteredReports.filter(r => r.status?.trim().toLowerCase() === "correction").length,
      avgScore: filteredReports.length > 0 
        ? (filteredReports.reduce((sum, r) => sum + parseFloat(r.qc_score || 0), 0) / filteredReports.length).toFixed(2)
        : 0
    };
  }, [filteredReports]);

  // Format date for display
  const formatDateTime = (dateTimeStr) => {
    const dt = new Date(dateTimeStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = dt.getDate();
    const month = monthNames[dt.getMonth()];
    const year = dt.getFullYear();
    let hours = dt.getHours();
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes} ${ampm}`
    };
  };

  const formatDate = (dateStr) => {
    const dt = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = dt.getDate();
    const month = monthNames[dt.getMonth()];
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setStartDate(getTodayDate());
    setEndDate(getTodayDate());
  };

  // Export to CSV function
  const handleExportToExcel = () => {
    try {
      if (filteredReports.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Calculate summary statistics
      const totalRecords = filteredReports.length;
      const totalQCRecords = filteredReports.reduce((sum, report) => {
        return sum + (report.qc_generated_count || 0);
      }, 0);
      const avgScore = filteredReports.length > 0 
        ? (filteredReports.reduce((sum, r) => sum + parseFloat(r.qc_score || 0), 0) / filteredReports.length).toFixed(2)
        : 0;

      // Prepare summary data
      const summaryData = [
        { 'Summary': 'Total Records', 'Value': `${totalRecords} Records` },
        { 'Summary': 'Total QC Records', 'Value': totalQCRecords },
        { 'Summary': 'Avg Score', 'Value': `${avgScore}%` },
        {}, // Empty row for spacing
      ];

      // Prepare data for export
      const exportData = filteredReports.map((report) => {
        // Format evaluation date & time
        const evalDateTime = report.created_at ? formatDateTime(report.created_at) : { date: "N/A", time: "N/A" };
        const evaluationDateTime = `${evalDateTime.date} ${evalDateTime.time}`;
        
        // Format work date
        const workDate = report.date_of_file_submission ? formatDate(report.date_of_file_submission) : "N/A";
        
        // Parse error list
        let errorList = [];
        try {
          errorList = typeof report.error_list === 'string' ? JSON.parse(report.error_list) : (report.error_list || []);
        } catch (e) {
          errorList = [];
        }
        
        // Format error list as comma-separated string
        const errorListString = errorList.length > 0 
          ? errorList.map((error, idx) => {
              const errorLabel = typeof error === 'object' 
                ? (error.error || error.name || error.message || error.error_name || JSON.stringify(error)) 
                : String(error);
              return `${idx + 1}. ${errorLabel}`;
            }).join('; ')
          : 'No errors';
        
        return {
          'Evaluation Date & Time': evaluationDateTime,
          'Work Date': workDate,
          'Assistant Manager': report.am_name || 'N/A',
          'QA Agent': report.qa_name || 'N/A',
          'Agent': report.agent_name || 'N/A',
          'Project': report.project_name || 'N/A',
          'Task': report.task_name || 'N/A',
          'Total Record': report.file_record_count || 0,
          'QC Record': report.qc_generated_count || 0,
          'Errors Count': errorList.length,
          'Error List': errorListString,
          'Status': report.status || 'N/A',
          'QC Score': report.qc_score || 0
        };
      });

      // Combine summary and data for export
      const combinedData = [...summaryData, ...exportData];

      // Generate filename with date range
      const filename = `QC_Form_Report_${startDate}_to_${endDate}.csv`;

      // Export to CSV
      exportToCSV(combinedData, filename);

      toast.success(`Exported ${filteredReports.length} records successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const getScoreColor = (score) => {
    if (score > 98) return "text-green-700 bg-green-50 border-green-200";
    if (score >= 95) return "text-yellow-700 bg-yellow-50 border-yellow-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  // Handle Error List Modal
  const handleOpenErrorListModal = (errorList, recordInfo) => {
    // Ensure errorList is always an array
    let parsedErrorList = [];
    
    try {
      if (typeof errorList === 'string') {
        parsedErrorList = JSON.parse(errorList);
      } else if (Array.isArray(errorList)) {
        parsedErrorList = errorList;
      }
    } catch (e) {
      console.error('[QCFormReportView] Error parsing error list:', e);
      parsedErrorList = [];
    }
    
    setSelectedErrorList(parsedErrorList);
    setSelectedRecordInfo(recordInfo);
    setShowErrorListModal(true);
  };

  const handleCloseErrorListModal = () => {
    setShowErrorListModal(false);
    setSelectedErrorList([]);
    setSelectedRecordInfo(null);
  };

  const renderErrorListModal = () => {
    if (!showErrorListModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shadow-sm">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Error List</h3>
                {selectedRecordInfo && (
                  <p className="text-sm text-slate-600 font-medium mt-0.5">
                    {selectedRecordInfo.agentName} • {selectedRecordInfo.projectName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleCloseErrorListModal}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-all shadow-sm hover:shadow"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 max-h-[calc(85vh-180px)] overflow-y-auto">
            {selectedErrorList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-slate-600 font-semibold text-lg">No errors found</p>
                <p className="text-slate-500 text-sm mt-1">This record has a clean evaluation</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedErrorList.map((error, index) => {
                  const errorLabel = typeof error === 'object' 
                    ? (error.error || error.name || error.message || JSON.stringify(error)) 
                    : String(error);
                  
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 hover:border-red-300 transition-all group"
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-red-200 rounded-lg shrink-0 mt-0.5 group-hover:bg-red-300 transition-all">
                        <span className="text-red-700 font-bold text-sm">#{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                          <p className="text-sm text-slate-800 font-medium leading-relaxed break-words">
                            {errorLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">
                  Total Errors: <span className="font-bold text-slate-900">{selectedErrorList.length}</span>
                </span>
              </div>
              <button
                onClick={handleCloseErrorListModal}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* All Filters Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-slate-200">
        <div className="space-y-4">
          {/* Date Range Filter */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
            <div className="flex-1 w-full">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                label="Evaluation Date Range"
                description="Filter QC reports by evaluation date"
                showClearButton={false}
              />
            </div>
          </div>

          {/* Search and Status Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by agent, QA, manager, project..."
                className="w-full pl-12 pr-12 py-3 text-sm font-medium border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-lg transition-all flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-64">
              <SearchableSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "Regular", label: "Regular" },
                  { value: "Rework", label: "Rework" },
                  { value: "Correction", label: "Correction" }
                ]}
                icon={Filter}
                placeholder="Select Status"
                isClearable={false}
              />
            </div>

            {/* Export Button */}
            <button 
              onClick={handleExportToExcel}
              disabled={loading || filteredReports.length === 0}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200" 
              title="Export filtered data to Excel"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Clear Filters */}
            {(searchQuery || statusFilter !== "all" || startDate !== getTodayDate() || endDate !== getTodayDate()) && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">
                  Evaluation Date & Time
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">
                  Work Date
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">
                  Assistant Manager
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">
                  QA Agent
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">
                  Agent
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">
                  Project / Task
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">
                  Total Record
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">
                  QC Record
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">
                  Errors
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">
                  Error List
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">
                  Status
                </th>
                <th className="px-4 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">
                  QC Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="12" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div>
                      <p className="text-slate-500 font-medium text-sm">Loading QC Reports...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <FileCheck className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-bold text-lg">No reports found</p>
                      <p className="text-slate-500 text-sm">Try adjusting your filters or search query</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report, index) => {
                  const evalDateTime = report.created_at ? formatDateTime(report.created_at) : { date: "N/A", time: "N/A" };
                  const workDate = report.date_of_file_submission ? formatDate(report.date_of_file_submission) : "N/A";
                  
                  let eList = [];
                  try {
                    eList = typeof report.error_list === 'string' ? JSON.parse(report.error_list) : (report.error_list || []);
                  } catch (e) {
                    console.error("Error parsing error_list for row", e);
                  }
                  
                  const errorCount = eList.length;
                  const totalRecord = report.file_record_count || 0;
                  const qcRecord = report.qc_generated_count || 0;
                  
                  const amName = report.am_name || "N/A";
                  const qaName = report.qa_name || "N/A";
                  const agentName = report.agent_name || "N/A";
                  const projectName = report.project_name || "N/A";
                  const taskName = report.task_name || "N/A";
                  
                  return (
                    <tr
                      key={report.id}
                      className={`transition-all duration-200 group ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } hover:bg-slate-50`}
                    >
                      {/* Evaluation Date & Time */}
                      <td className="px-4 py-4 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{evalDateTime.date}</div>
                            <div className="text-xs text-slate-500 font-medium mt-0.5">
                              <span className="bg-slate-100 px-2 py-0.5 rounded">{evalDateTime.time}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Work Date */}
                      <td className="px-4 py-4 align-middle whitespace-nowrap">
                        <div className="font-semibold text-slate-700 text-sm">{workDate}</div>
                      </td>

                      {/* Assistant Manager */}
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-2 max-w-[140px]">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0">
                            {amName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium text-slate-800 text-sm break-words">{amName}</span>
                        </div>
                      </td>

                      {/* QA Agent */}
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-2 max-w-[140px]">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0">
                            {qaName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium text-slate-800 text-sm break-words">{qaName}</span>
                        </div>
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-2 max-w-[140px]">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0">
                            {agentName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium text-slate-800 text-sm break-words">{agentName}</span>
                        </div>
                      </td>

                      {/* Project / Task */}
                      <td className="px-4 py-4 align-middle">
                        <div className="max-w-[180px]">
                          <div className="font-bold text-slate-900 text-sm mb-1 break-words">{projectName}</div>
                          <div className="text-xs text-slate-600 font-medium bg-slate-100 px-2 py-1 rounded inline-block break-words">
                            {taskName}
                          </div>
                        </div>
                      </td>

                      {/* Total Record */}
                      <td className="px-4 py-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          <span className="font-bold text-slate-800 text-sm">{totalRecord}</span>
                        </div>
                      </td>

                      {/* QC Record */}
                      <td className="px-4 py-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          <span className="font-bold text-slate-800 text-sm">{qcRecord}</span>
                        </div>
                      </td>

                      {/* Errors */}
                      <td className="px-4 py-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          <span className="font-bold text-slate-800 text-sm">{errorCount}</span>
                        </div>
                      </td>

                      {/* Error List */}
                      <td className="px-4 py-4 align-middle">
                        <button
                          onClick={() => handleOpenErrorListModal(eList, {
                            agentName: agentName,
                            projectName: projectName,
                            taskName: taskName,
                            evalDate: evalDateTime.date
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-100 border border-slate-200 hover:border-blue-300 rounded-lg text-slate-700 hover:text-blue-700 text-xs font-bold transition-all"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          View
                          {errorCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
                              {errorCount}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 align-middle text-center">
                        {report.status?.trim().toLowerCase() === "regular" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-medium text-xs border border-green-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Regular
                          </span>
                        ) : report.status?.trim().toLowerCase() === "rework" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 font-medium text-xs border border-orange-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Rework
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-medium text-xs border border-red-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Correction
                          </span>
                        )}
                      </td>

                      {/* QC Score */}
                      <td className="px-4 py-4 align-middle text-center">
                        <div className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm shadow-sm ${getScoreColor(Number(report.qc_score || 0))}`}>
                          <Award className="w-4 h-4" />
                          {Number(report.qc_score || 0).toFixed(2)}%
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-slate-200">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800">Statistics Summary</h3>
          <p className="text-slate-600 text-sm font-medium mt-1">Overview of evaluation metrics</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Reports Card */}
          <div className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 min-w-0 group/card transform hover:-translate-y-1 bg-white border-2 border-slate-200 hover:border-blue-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-12 translate-x-12"></div>
            <div className="relative p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide truncate text-slate-600">Total Reports</p>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold truncate text-slate-900">{stats.total}</h3>
              </div>
              <div className="p-3 rounded-xl shadow-sm shrink-0 z-10 bg-blue-100">
                <FileCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          {/* Regular Card */}
          <div className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 min-w-0 group/card transform hover:-translate-y-1 bg-white border-2 border-slate-200 hover:border-blue-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -translate-y-12 translate-x-12"></div>
            <div className="relative p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide truncate text-slate-600">Regular</p>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold truncate text-slate-900">{stats.regular}</h3>
              </div>
              <div className="p-3 rounded-xl shadow-sm shrink-0 z-10 bg-green-100">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Rework Card */}
          <div className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 min-w-0 group/card transform hover:-translate-y-1 bg-white border-2 border-slate-200 hover:border-blue-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -translate-y-12 translate-x-12"></div>
            <div className="relative p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide truncate text-slate-600">Rework</p>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold truncate text-slate-900">{stats.rework}</h3>
              </div>
              <div className="p-3 rounded-xl shadow-sm shrink-0 z-10 bg-orange-100">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Correction Card */}
          <div className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 min-w-0 group/card transform hover:-translate-y-1 bg-white border-2 border-slate-200 hover:border-blue-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -translate-y-12 translate-x-12"></div>
            <div className="relative p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide truncate text-slate-600">Correction</p>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold truncate text-slate-900">{stats.correction}</h3>
              </div>
              <div className="p-3 rounded-xl shadow-sm shrink-0 z-10 bg-red-100">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* Avg Score Card */}
          <div className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 min-w-0 group/card transform hover:-translate-y-1 bg-white border-2 border-slate-200 hover:border-blue-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -translate-y-12 translate-x-12"></div>
            <div className="relative p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide truncate text-slate-600">Avg Score</p>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold truncate text-slate-900">{stats.avgScore}%</h3>
              </div>
              <div className="p-3 rounded-xl shadow-sm shrink-0 z-10 bg-purple-100">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderErrorListModal()}
    </div>
  );
};

export default QCFormReportView;
