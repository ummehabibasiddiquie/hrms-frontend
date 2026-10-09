/**
 * File: ManagerQCReportsOverview.jsx
 * Description: Manager/Admin comprehensive view of all QC activities and reports
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClientPagination } from '../../hooks/useClientPagination';
import TablePaginationBar from '../common/TablePaginationBar';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  Search,
  Download,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { DateRangePicker } from '../common/CustomCalendar';
import { exportToCSV } from '../../utils/csvExport';
import { formatISTDateISO, formatISTDateMedium, formatISTDateTimeParts, formatISTTime, getISTParts } from "../../utils/dateTimeIST";
import { getErrorIdentity } from "../../utils/qcErrorIdentity";

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultDateRange = () => {
  const today = new Date();
  return {
    startDate: formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: formatLocalDate(today),
  };
};

const isDateOnlyValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

const CompactDateCell = ({ value, showTime = true }) => {
  const parts = getISTParts(value);
  if (!value || !parts) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const includeTime = showTime && !isDateOnlyValue(value);
  return (
    <div className="leading-tight">
      <div className="text-xs font-semibold text-slate-800 whitespace-nowrap">
        {formatISTDateMedium(value)}
      </div>
      {includeTime ? (
        <div className="text-[10px] text-slate-500 whitespace-nowrap">
          {formatISTTime(value)}
        </div>
      ) : null}
    </div>
  );
};

const qcEvalDate = (record) => record?.created_at || record?.evaluation_date || record?.updated_at;
const qcWorkDate = (record) => record?.date_of_file_submission || record?.work_date_only;

const isPendingQcStatus = (status) => String(status || "").toLowerCase() === "pending";
const isCompletedQcStatus = (status) => String(status || "").toLowerCase() === "completed";
const hasStoredScore = (score) => score != null && score !== "";
const Dash = () => <span className="text-xs text-slate-400">-</span>;

const isReworkQcSubmitted = (r) => (
  isCompletedQcStatus(r?.rework_file_qc_status) ||
  String(r?.rework_status || "").toLowerCase() === "completed" ||
  hasStoredScore(r?.rework_qc_score)
);

const isCorrectionQcSubmitted = (c) => (
  isCompletedQcStatus(c?.correction_file_qc_status) ||
  String(c?.correction_status || "").toLowerCase() === "completed" ||
  hasStoredScore(c?.correction_qc_score)
);

const getReworkCycleState = (r) => {
  if (isReworkQcSubmitted(r)) return "done";
  if (r?.rework_file_path || isPendingQcStatus(r?.rework_file_qc_status)) return "awaiting_qc";
  return "awaiting_agent";
};

const getCorrectionCycleState = (c) => {
  if (isCorrectionQcSubmitted(c)) return "done";
  if (c?.correction_file_path || isPendingQcStatus(c?.correction_file_qc_status)) return "awaiting_qc";
  return "awaiting_agent";
};

const CycleStatusBadge = ({ state, doneLabel, awaitingAgentLabel }) => {
  if (state === "done") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
        {doneLabel || "Completed"}
      </span>
    );
  }
  if (state === "awaiting_qc") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
        Awaiting QC
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
      {awaitingAgentLabel || "Awaiting agent file"}
    </span>
  );
};

const dayInRange = (value, startDate, endDate) => {
  const day = formatISTDateISO(value);
  if (!day) return false;
  if (startDate && day < startDate) return false;
  if (endDate && day > endDate) return false;
  return true;
};

const getVisibleReworks = (record) => [...(record.qc_rework || [])];
const getVisibleCorrections = (record) => [...(record.qc_correction || [])];

const ManagerQCReportsOverview = () => {
  const { user } = useAuth();
  
  // Role-based only — designation is never used for access
  const roleId = Number(user?.role_id || user?.user_role_id || 0);
  const roleName = String(user?.role_name || user?.user_role || '').toLowerCase().trim();
  
  const isTeamLeader = roleId === 7 || roleName.includes('team leader');
  const isAssistantManager =
    isTeamLeader ||
    roleId === 4 ||
    roleName === 'assistant manager' ||
    (roleName.includes('assistant') && !roleName.includes('team leader'));
  
  console.log('[ManagerQCReportsOverview] Role Check:', {
    roleId,
    roleName,
    isAssistantManager,
    isTeamLeader
  });
  
  // State management
  const [qcRecords, setQcRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorModal, setErrorModal] = useState({ open: false, errors: [], title: '' });
  
  // Filters — default to current month (1st through today)
  const defaultDateRange = getDefaultDateRange();
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);

  const qcPagination = useClientPagination(filteredRecords, {
    resetKeys: [searchTerm, startDate, endDate],
  });


  // Fetch QC history data
  useEffect(() => {
    const fetchQCHistory = async () => {
      if (!user?.user_id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await api.post('/qc_history_user/view_qc_history_user_based', {
          logged_in_user_id: user.user_id
        });
        
        if (response.data?.status === 200) {
          const records = (response.data.data?.records || []).map((record) => ({
            ...record,
            id: record.id ?? record.qc_record_id,
            qa_agent_name: record.qa_agent_name || record.qc_name,
            qc_rework: record.qc_rework || [],
            qc_correction: record.qc_correction || [],
          }));
          const unique = [...new Map(records.map((record) => [record.id, record])).values()];
          setQcRecords(unique);
          setFilteredRecords(unique);
        } else {
          setError('Failed to fetch QC history');
        }
      } catch (err) {
        console.error('Error fetching QC history:', err);
        setError(err.response?.data?.message || 'Failed to fetch QC history');
        toast.error('Failed to load QC history');
      } finally {
        setLoading(false);
      }
    };

    fetchQCHistory();
  }, [user?.user_id]);

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [searchTerm, startDate, endDate, qcRecords]);

  const applyFilters = () => {
    let filtered = [...qcRecords];

    // Search filter - searches across all table fields
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record => {
        const { types: errorTypes } = getErrorTypes(record.error_list);
        const errorTypesString = errorTypes.join(' ').toLowerCase();
        return (
          record.agent_name?.toLowerCase().includes(searchLower) ||
          record.assistant_manager_name?.toLowerCase().includes(searchLower) ||
          record.team_name?.toLowerCase().includes(searchLower) ||
          record.project_name?.toLowerCase().includes(searchLower) ||
          record.task_name?.toLowerCase().includes(searchLower) ||
          record.qa_agent_name?.toLowerCase().includes(searchLower) ||
          record.file_record_count?.toString().includes(searchLower) ||
          record.qc_generated_count?.toString().includes(searchLower) ||
          getErrorCount(record.error_list).toString().includes(searchLower) ||
          record.qc_score?.toString().includes(searchLower) ||
          errorTypesString.includes(searchLower)
        );
      });
    }

    if (startDate || endDate) {
      filtered = filtered.filter((record) => dayInRange(qcWorkDate(record), startDate, endDate));
    }

    setFilteredRecords(filtered);
  };

  const getStatusBadge = (record) => {
    const status = record.status;

    if (status === 'regular') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          Passed
        </span>
      );
    } else if (status === 'correction') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3 h-3" />
          Correction
        </span>
      );
    } else if (status === 'rework') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" />
          Rework
        </span>
      );
    }
    return <span className="text-xs text-slate-400">—</span>;
  };

  const getQCStatusBadge = (qcStatus) => {
    if (qcStatus === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    } else if (qcStatus === 'correction') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3 h-3" />
          Correction
        </span>
      );
    } else if (qcStatus === 'rework') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" />
          Rework
        </span>
      );
    } else if (qcStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    return <span className="text-xs text-slate-400">—</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return { date: 'N/A', time: '' };
    return formatISTDateTimeParts(dateString);
  };

  const parseErrors = (errorString) => {
    try {
      if (!errorString) return [];
      return typeof errorString === 'string' ? JSON.parse(errorString) : errorString;
    } catch {
      return [];
    }
  };

  // Get error count from error_list
  const getErrorCount = (errorString) => {
    const errors = parseErrors(errorString);
    return errors.length;
  };

  // Get error types summary from error_list
  const getErrorTypes = (errorString) => {
    const errors = parseErrors(errorString);
    if (errors.length === 0) return { types: [], count: 0 };
    
    // Extract unique categories/subcategories
    const types = errors.map(err => err.subcategory || err.category).filter(Boolean);
    const uniqueTypes = [...new Set(types)];
    
    return { types: uniqueTypes, count: errors.length };
  };

  const openErrorModal = (errors, title) => {
    setErrorModal({ open: true, errors: parseErrors(errors), title });
  };

  const handleReset = () => {
    const range = getDefaultDateRange();
    setSearchTerm('');
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setSelectedRecord(null);
  };

  // Export to Excel/CSV
  const handleExportExcel = () => {
    try {
      if (filteredRecords.length === 0) {
        toast.error('No data to export');
        return;
      }

      const exportData = filteredRecords.map(record => {
        const { types, count } = getErrorTypes(record.error_list);
        const evalDate = formatDate(qcEvalDate(record));
        const workDate = formatDate(qcWorkDate(record));
        
        return {
          'Evaluation Date': evalDate.date,
          'Evaluation Time': evalDate.time,
          'Work Date': workDate.date,
          'Work Time': workDate.time,
          'QA Name': record.qa_agent_name || 'N/A',
          'Agent Name': record.agent_name || 'N/A',
          'Project Name': record.project_name || 'N/A',
          'Task Name': record.task_name || 'N/A',
          'Records': record.file_record_count || 0,
          'QC Records': record.qc_generated_count || 0,
          'No. of Errors': count,
          'Final QC Score': `${record.qc_score || 0}%`,
          'Error Types': types.length > 0 ? types.join(', ') : '-'
        };
      });

      // Add summary row
      const totalProjects = new Set(filteredRecords.map(r => r.project_name)).size;
      const totalRecords = filteredRecords.reduce((sum, r) => sum + (parseInt(r.file_record_count || 0)), 0);
      const totalQCRecords = filteredRecords.reduce((sum, r) => sum + (parseInt(r.qc_generated_count || 0)), 0);
      const totalErrors = filteredRecords.reduce((sum, r) => sum + getErrorCount(r.error_list), 0);
      const avgScore = filteredRecords.length > 0 
        ? (filteredRecords.reduce((sum, r) => sum + (parseFloat(r.qc_score || 0)), 0) / filteredRecords.length).toFixed(2)
        : '0.00';

      exportData.push({
        'Evaluation Date': 'SUMMARY',
        'Evaluation Time': '',
        'Work Date': '',
        'Work Time': '',
        'QA Name': '',
        'Agent Name': '',
        'Project Name': `Total Projects: ${totalProjects}`,
        'Task Name': '',
        'Records': totalRecords,
        'QC Records': totalQCRecords,
        'No. of Errors': totalErrors,
        'Final QC Score': `Avg: ${avgScore}%`,
        'Error Types': ''
      });

      const filename = `QC_Reports_${new Date().toISOString().split('T')[0]}.csv`;
      exportToCSV(exportData, filename);
      toast.success(`Exported ${filteredRecords.length} QC records!`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data');
    }
  };

  // Export History Data (Rework & Correction only)
  const handleExportHistory = () => {
    try {
      // Collect all rework and correction history from filtered records
      const historyData = [];
      
      filteredRecords.forEach(record => {
        // Add Rework history
        if (record.qc_rework && record.qc_rework.length > 0) {
          record.qc_rework.forEach(rework => {
            const { types, count } = getErrorTypes(rework.rework_error_list);
            const evalDt = formatDate(rework.updated_at);
            const workDt = formatDate(record.date_of_file_submission);
            
            historyData.push({
              'Type': 'Rework',
              'Evaluation Date': evalDt.date,
              'Work Date': workDt.date,
              'QA Name': record.qa_agent_name || 'N/A',
              'Agent Name': record.agent_name || 'N/A',
              'Project Name': record.project_name || 'N/A',
              'Task Name': record.task_name || 'N/A',
              'Count': rework.rework_count || '-',
              'Records': rework.file_record_count || 0,
              'QC Records': rework.qc_data_generated_count || 0,
              'No. of Errors': count,
              'Final QC Score': rework.rework_qc_score ? `${rework.rework_qc_score}%` : '-',
              'Error Type': types.length > 0 ? types.join(', ') : '-'
            });
          });
        }
        
        // Add Correction history
        if (record.qc_correction && record.qc_correction.length > 0) {
          record.qc_correction.forEach(correction => {
            const evalDt = formatDate(correction.updated_at);
            const workDt = formatDate(record.date_of_file_submission);
            
            historyData.push({
              'Type': 'Correction',
              'Evaluation Date': evalDt.date,
              'Work Date': workDt.date,
              'QA Name': record.qa_agent_name || 'N/A',
              'Agent Name': record.agent_name || 'N/A',
              'Project Name': record.project_name || 'N/A',
              'Task Name': record.task_name || 'N/A',
              'Count': correction.correction_count || '-',
              'Records': '-',
              'QC Records': '-',
              'No. of Errors': '-',
              'Final QC Score': '-',
              'Error Type': '-'
            });
          });
        }
      });

      if (historyData.length === 0) {
        toast.error('No history data (rework/correction) to export');
        return;
      }

      // Calculate summary
      const totalRework = historyData.filter(h => h.Type === 'Rework').length;
      const totalCorrection = historyData.filter(h => h.Type === 'Correction').length;
      const totalReworkErrors = historyData
        .filter(h => h.Type === 'Rework' && h['No. of Errors'] !== '-')
        .reduce((sum, h) => sum + (parseInt(h['No. of Errors']) || 0), 0);

      historyData.push({
        'Type': 'SUMMARY',
        'Evaluation Date': '',
        'Work Date': '',
        'QA Name': '',
        'Agent Name': '',
        'Project Name': `Total Rework: ${totalRework}`,
        'Task Name': `Total Correction: ${totalCorrection}`,
        'Count': '',
        'Records': '',
        'QC Records': '',
        'No. of Errors': totalReworkErrors,
        'Final QC Score': '',
        'Error Type': ''
      });

      const filename = `QC_History_${new Date().toISOString().split('T')[0]}.csv`;
      exportToCSV(historyData, filename);
      toast.success(`Exported ${historyData.length - 1} history records!`);
    } catch (err) {
      console.error('History export error:', err);
      toast.error('Failed to export history data');
    }
  };

  // Export Consolidated Report
  const handleConsolidatedExport = async () => {
    try {
      if (!user?.user_id) {
        toast.error('User not authenticated');
        return;
      }

      const loadingToast = toast.loading('Generating consolidated report...');

      const payload = {
        logged_in_user_id: user.user_id
      };

      if (startDate && endDate) {
        payload.start_date = startDate;
        payload.end_date = endDate;
      }

      const response = await api.post('qc_history_user/consolidated_qc_report', payload);

      if (response.data?.status === 200 && response.data?.data?.records) {
        const records = response.data.data.records;
        
        if (records.length === 0) {
          toast.dismiss(loadingToast);
          toast.error('No data found for the selected criteria');
          return;
        }

        const exportData = records.map(record => {
          const evalDate = record.evaluation_date ? 
            new Date(record.evaluation_date).toISOString().split('T')[0] : 'N/A';
          const workDate = record.work_date ? 
            new Date(record.work_date).toISOString().split('T')[0] : 'N/A';
          const errorTypes = record.error_type && record.error_type.length > 0 
            ? record.error_type.join(', ') : '-';

          return {
            'Evaluation Date': evalDate,
            'Work Date': workDate,
            'QA Name': record.qa_name || 'N/A',
            'Agent Name': record.agent_name || 'N/A',
            'Project Name': record.project_name || 'N/A',
            'Task Name': record.task_name || 'N/A',
            'Records': record.records || 0,
            'QC Records': record.qc_records || 0,
            'No. of Errors': record.no_of_errors || 0,
            'Avg QC Score': record.final_qc_score ? `${record.final_qc_score}%` : '0%',
            'Error Types': errorTypes
          };
        });

        const totalRecords = records.reduce((sum, r) => sum + (r.records || 0), 0);
        const totalQCRecords = records.reduce((sum, r) => sum + (r.qc_records || 0), 0);
        const totalErrors = records.reduce((sum, r) => sum + (r.no_of_errors || 0), 0);
        const avgScore = records.length > 0 
          ? (records.reduce((sum, r) => sum + (r.final_qc_score || 0), 0) / records.length).toFixed(2)
          : '0.00';

        exportData.push({
          'Evaluation Date': 'SUMMARY',
          'Work Date': '',
          'QA Name': '',
          'Agent Name': `Total Records: ${totalRecords}`,
          'Project Name': `Total QC Records: ${totalQCRecords}`,
          'Task Name': `Total Errors: ${totalErrors}`,
          'Records': '',
          'QC Records': '',
          'No. of Errors': '',
          'Avg QC Score': `${avgScore}%`,
          'Error Types': ''
        });

        const dateRangeStr = (startDate && endDate) 
          ? `_${startDate}_to_${endDate}` 
          : '';
        const filename = `Consolidated_QC_Report${dateRangeStr}_${new Date().toISOString().split('T')[0]}.csv`;

        exportToCSV(exportData, filename);
        
        toast.dismiss(loadingToast);
        toast.success(`Exported ${records.length} consolidated records!`);
      } else {
        toast.dismiss(loadingToast);
        toast.error('Failed to fetch consolidated data');
      }
    } catch (err) {
      console.error('Consolidated export error:', err);
      toast.error('Failed to generate consolidated report');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <ErrorMessage message={error} />
      </div>
    );
  }



  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              QC Reports Overview
            </h1>
            <p className="text-blue-100 mt-2">Complete view of all QC activities across the organization</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
            <button
              onClick={handleExportHistory}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <Download className="w-4 h-4" />
              Export History
            </button>
            <button
              onClick={handleConsolidatedExport}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <Download className="w-4 h-4" />
              Consolidated Export
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-600 font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 border-2 border-slate-200">
        <style>{`
          .filter-dropdown-wrapper > div > button {
            height: 46px !important;
            min-height: 46px !important;
            max-height: 46px !important;
          }
          .date-range-compact > div > div {
            margin-bottom: 0 !important;
          }
          .date-range-compact label {
            margin-bottom: 6px !important;
            font-size: 0.75rem !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            color: rgb(71 85 105) !important;
            display: flex !important;
            align-items: center !important;
            gap: 0.375rem !important;
          }
        `}</style>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          {/* Search - searches all fields */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5">
              <Search className="w-3 h-3 text-blue-600" />
              Search All Fields
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
              <input
                type="text"
                placeholder="Search by agent, team lead, project, task, QA, errors, scores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none h-[46px]"
              />
            </div>
          </div>

          {/* Date Range Filter - Applied to Work Date */}
          <div className="date-range-compact">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5">
              <Calendar className="w-3 h-3 text-blue-600" />
              Work Date Range
            </label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              showClearButton={false}
              noWrapper={true}
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* QC Reports Table - New Design */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            QC Evaluation Reports
          </h3>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Eval Date</th>
                  <th className="px-2 py-3 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Work Date</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">QA Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Agent Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Project Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider max-w-[200px] w-[200px]">Task Name</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Records</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">QC Records</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">No. of Errors</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Final QC Score</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider max-w-[160px] w-[160px]">Error Type</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="px-4 py-12 text-center text-slate-500">
                      <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold">No QC records found</p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  qcPagination.pagedItems.map((record, index) => {
                    const visibleReworks = getVisibleReworks(record);
                    const visibleCorrections = getVisibleCorrections(record);
                    const hasHistory = visibleReworks.length > 0 || visibleCorrections.length > 0;
                    const isOpen = selectedRecord?.id === record.id;
                    return (
                    <React.Fragment key={record.id || index}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      {/* Evaluation Date - original QC */}
                      <td className="px-2 py-3 whitespace-nowrap">
                        <CompactDateCell value={qcEvalDate(record)} showTime />
                      </td>
                      
                      {/* Work Date - original file */}
                      <td className="px-2 py-3 whitespace-nowrap">
                        <CompactDateCell value={qcWorkDate(record)} showTime />
                      </td>
                      
                      {/* QA Name - qa_agent_name */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-700">
                          <User className="w-3 h-3" />
                          {record.qa_agent_name || 'N/A'}
                        </span>
                      </td>
                      
                      {/* Agent Name - agent_name */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-semibold text-slate-800 text-sm">{record.agent_name || 'N/A'}</span>
                        </div>
                      </td>
                      
                      {/* Project Name - project_name */}
                      <td className="px-3 py-3 text-sm font-medium text-slate-800">
                        {record.project_name || 'N/A'}
                      </td>
                      
                      {/* Task Name - task_name */}
                      <td className="px-3 py-3 max-w-[200px] w-[200px] align-top">
                        <div className="text-sm text-slate-600 whitespace-normal break-words leading-snug">
                          {record.task_name || 'N/A'}
                        </div>
                      </td>
                      
                      {/* Records - file_record_count */}
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold min-w-[40px]">
                          {record.file_record_count || '0'}
                        </span>
                      </td>
                      
                      {/* QC Records - qc_generated_count */}
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold min-w-[40px]">
                          {record.qc_generated_count || '0'}
                        </span>
                      </td>
                      
                      {/* No. of Errors - from error_list */}
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold min-w-[40px] ${
                          getErrorCount(record.error_list) > 0 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {getErrorCount(record.error_list)}
                        </span>
                      </td>
                      
                      {/* Final QC Score - qc_score */}
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${
                          (record.qc_score || 0) >= 98
                            ? 'bg-green-100 text-green-700'
                            : (record.qc_score || 0) >= 90
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {hasStoredScore(record.qc_score) ? `${record.qc_score}%` : '0%'}
                        </span>
                      </td>
                      
                      {/* Error Type - from error_list */}
                      <td className="px-3 py-3 max-w-[160px] w-[160px] align-top">
                        {(() => {
                          const { types, count } = getErrorTypes(record.error_list);
                          if (count === 0) {
                            return <span className="text-xs text-slate-400">-</span>;
                          }
                          const hasMore = types.length > 1 || count > 1;
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-start px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 whitespace-normal break-words leading-snug">
                                {types[0]}
                              </span>
                              {hasMore && (
                                <button
                                  onClick={() => openErrorModal(record.error_list, `All Errors (${count})`)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold text-left hover:underline"
                                >
                                  View
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      
                      <td className="px-3 py-3 text-center">
                        {hasHistory && (
                          <button
                            onClick={() => setSelectedRecord(isOpen ? null : record)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition-colors"
                            title="View rework and correction history"
                          >
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && hasHistory && (
                      <tr>
                        <td colSpan="12" className="px-0 py-0">
                          <div className="bg-slate-50 border-t-2 border-slate-200">
                            <div className="px-4 py-2 bg-gradient-to-r from-orange-50 to-red-50 border-b border-slate-200">
                              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-orange-600" />
                                Rework & Correction History
                                <span className="text-xs font-normal text-slate-500">
                                  ({visibleReworks.length} Rework, {visibleCorrections.length} Correction)
                                </span>
                              </h4>
                            </div>
                            <div className="overflow-x-auto p-4">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Type</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Eval Date</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Submitted</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Count</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Records</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">QC Rec</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Errors</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Score</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Error Type</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleReworks.map((rework, idx) => {
                                    const cycleState = getReworkCycleState(rework);
                                    const qcDone = cycleState === "done";
                                    const { types, count } = getErrorTypes(rework.rework_error_list);
                                    const score = rework.rework_qc_score;
                                    return (
                                      <tr key={`rework-${rework.qc_rework_id || idx}`} className="border-b border-slate-100 hover:bg-orange-50">
                                        <td className="px-3 py-2">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                            <AlertCircle className="w-3 h-3" />
                                            Rework {rework.rework_count ? `#${rework.rework_count}` : ''}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          {qcDone ? <CompactDateCell value={rework.updated_at || rework.created_at} showTime /> : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          {qcDone ? <CompactDateCell value={rework.updated_at || rework.created_at} showTime /> : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-orange-600">{rework.rework_count || '-'}</td>
                                        <td className="px-3 py-2 text-center">{qcDone ? (rework.file_record_count ?? '-') : <Dash />}</td>
                                        <td className="px-3 py-2 text-center">{qcDone ? (rework.qc_data_generated_count ?? '-') : <Dash />}</td>
                                        <td className="px-3 py-2 text-center">
                                          {qcDone ? (
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                              {count}
                                            </span>
                                          ) : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          {qcDone && hasStoredScore(score) ? (
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${
                                              Number(score) >= 98 ? 'bg-green-100 text-green-700' :
                                              Number(score) >= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                              {score}%
                                            </span>
                                          ) : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-600 max-w-[140px]">
                                          {qcDone && types.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs break-words">{types[0]}</span>
                                              {(types.length > 1 || count > 1) && (
                                                <button
                                                  type="button"
                                                  onClick={() => openErrorModal(rework.rework_error_list, `Rework Errors (${count})`)}
                                                  className="text-xs text-blue-600 font-semibold text-left hover:underline"
                                                >
                                                  View
                                                </button>
                                              )}
                                            </div>
                                          ) : <Dash />}
                                        </td>
                                        <td className="px-3 py-2">
                                          <CycleStatusBadge
                                            state={cycleState}
                                            doneLabel={rework.rework_status || rework.review_status || "completed"}
                                            awaitingAgentLabel="Awaiting rework file"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {visibleCorrections.map((correction, idx) => {
                                    const cycleState = getCorrectionCycleState(correction);
                                    const qcDone = cycleState === "done";
                                    const { types, count } = getErrorTypes(correction.correction_error_list);
                                    const score = correction.correction_qc_score;
                                    return (
                                      <tr key={`correction-${correction.qc_correction_id || idx}`} className="border-b border-slate-100 hover:bg-yellow-50">
                                        <td className="px-3 py-2">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                                            <AlertCircle className="w-3 h-3" />
                                            Correction {correction.correction_count ? `#${correction.correction_count}` : ''}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          {qcDone ? <CompactDateCell value={correction.updated_at || correction.created_at} showTime /> : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          {qcDone ? <CompactDateCell value={correction.updated_at || correction.created_at} showTime /> : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-yellow-700">{correction.correction_count || '-'}</td>
                                        <td className="px-3 py-2 text-center">{qcDone ? (correction.file_record_count ?? '-') : <Dash />}</td>
                                        <td className="px-3 py-2 text-center">{qcDone ? (correction.qc_generated_count ?? correction.qc_data_generated_count ?? '-') : <Dash />}</td>
                                        <td className="px-3 py-2 text-center">
                                          {qcDone ? (
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                              {count}
                                            </span>
                                          ) : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          {qcDone && hasStoredScore(score) ? (
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${
                                              Number(score) >= 98 ? 'bg-green-100 text-green-700' :
                                              Number(score) >= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                              {score}%
                                            </span>
                                          ) : <Dash />}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-600 max-w-[140px]">
                                          {qcDone && types.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs break-words">{types[0]}</span>
                                              {(types.length > 1 || count > 1) && (
                                                <button
                                                  type="button"
                                                  onClick={() => openErrorModal(correction.correction_error_list, `Correction Errors (${count})`)}
                                                  className="text-xs text-blue-600 font-semibold text-left hover:underline"
                                                >
                                                  View
                                                </button>
                                              )}
                                            </div>
                                          ) : <Dash />}
                                        </td>
                                        <td className="px-3 py-2">
                                          <CycleStatusBadge
                                            state={cycleState}
                                            doneLabel={correction.correction_status || correction.review_status || "completed"}
                                            awaitingAgentLabel="Awaiting correction file"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePaginationBar {...qcPagination} itemLabel="QC records" />
        </div>
      </div>

      {/* Summary State Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Projects */}
        <div className="bg-white rounded-xl shadow-md border-2 border-blue-200 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Projects</p>
              <p className="text-2xl font-bold text-blue-600">{filteredRecords.length > 0 ? new Set(filteredRecords.map(r => r.project_name)).size : 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Records - file_record_count */}
        <div className="bg-white rounded-xl shadow-md border-2 border-green-200 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Records</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredRecords.reduce((sum, r) => sum + (parseInt(r.file_record_count || 0)), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <FileCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total QC Records - qc_generated_count */}
        <div className="bg-white rounded-xl shadow-md border-2 border-indigo-200 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total QC Records</p>
              <p className="text-2xl font-bold text-indigo-600">
                {filteredRecords.reduce((sum, r) => sum + (parseInt(r.qc_generated_count || 0)), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Avg. Final QC Score - qc_score */}
        <div className="bg-white rounded-xl shadow-md border-2 border-purple-200 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Avg. Final QC Score</p>
              <p className="text-2xl font-bold text-purple-600">
                {filteredRecords.length > 0 
                  ? (filteredRecords.reduce((sum, r) => sum + (parseFloat(r.qc_score || 0)), 0) / filteredRecords.length).toFixed(2)
                  : '0.00'}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Total No. of Errors - from error_list */}
        <div className="bg-white rounded-xl shadow-md border-2 border-red-200 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total No. of Errors</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredRecords.reduce((sum, r) => sum + getErrorCount(r.error_list), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {errorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setErrorModal({ open: false, errors: [], title: '' })}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{errorModal.title}</h3>
                  <p className="text-blue-100 text-sm">{errorModal.errors.length} error{errorModal.errors.length !== 1 ? 's' : ''} found</p>
                </div>
              </div>
              <button
                onClick={() => setErrorModal({ open: false, errors: [], title: '' })}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {errorModal.errors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-rose-400 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getErrorIdentity(err) && <span className="px-2 py-0.5 bg-rose-400 text-white text-xs font-semibold rounded">{getErrorIdentity(err)}</span>}
                        {err.points && <span className="px-2 py-0.5 bg-slate-500 text-white text-xs font-semibold rounded">-{err.points} pts</span>}
                      </div>
                      <p className="text-sm text-rose-700 font-medium">{err.error || `${err.category}${err.subcategory ? ` - ${err.subcategory}` : ''}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setErrorModal({ open: false, errors: [], title: '' })}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerQCReportsOverview;
