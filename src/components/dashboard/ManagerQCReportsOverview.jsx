/**
 * File: ManagerQCReportsOverview.jsx
 * Description: Manager/Admin comprehensive view of all QC activities and reports
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
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
  Users,
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

const ManagerQCReportsOverview = () => {
  const { user } = useAuth();
  
  // Check if user is Assistant Manager (hide team column/filter)
  const roleId = Number(user?.role_id || user?.user_role_id || 0);
  const designation = String(user?.designation || user?.user_designation || '').toLowerCase().trim();
  const roleName = String(user?.role_name || user?.user_role || '').toLowerCase().trim();
  
  const isAssistantManager = 
    roleId === 4 || 
    designation.includes('assistant') || 
    designation.includes('asst') ||
    roleName.includes('assistant') ||
    roleName.includes('asst');
  
  console.log('[ManagerQCReportsOverview] Role Check:', {
    roleId,
    designation,
    roleName,
    isAssistantManager
  });
  
  // State management
  const [qcRecords, setQcRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorModal, setErrorModal] = useState({ open: false, errors: [], title: '' });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');


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
          const records = response.data.data?.records || [];
          setQcRecords(records);
          setFilteredRecords(records);
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

    // Date range filter - applied to Evaluation Date (created_at)
    if (startDate || endDate) {
      filtered = filtered.filter(record => {
        if (!record.created_at) return false;
        const recordDate = new Date(record.created_at);
        recordDate.setHours(0, 0, 0, 0);
        
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return recordDate >= start && recordDate <= end;
        } else if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          return recordDate >= start;
        } else if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return recordDate <= end;
        }
        return true;
      });
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
    // Parse the date string format: "Fri, 03 Apr 2026 15:26:48 GMT"
    // Extract date and time directly without timezone conversion
    const match = dateString.match(/(\d{2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hours, minutes] = match;
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return {
        date: `${parseInt(day, 10)}/${month}/${year}`,
        time: `${hour12}:${minutes} ${ampm}`
      };
    }
    // Fallback for unexpected format - use UTC to avoid timezone conversion
    const date = new Date(dateString);
    const day = date.getUTCDate();
    const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return {
      date: `${day}/${month}/${year}`,
      time: `${hour12}:${minutes} ${ampm}`
    };
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
    setFilteredRecords(qcRecords);
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
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
        const evalDate = formatDate(record.created_at);
        const workDate = formatDate(record.date_of_file_submission);
        
        return {
          'Evaluation Date': evalDate.date,
          'Evaluation Time': evalDate.time,
          'Work Date': workDate.date,
          'Work Time': workDate.time,
          'Team Lead': record.assistant_manager_name || record.team_name || 'N/A',
          'Agent Name': record.agent_name || 'N/A',
          'Project Name': record.project_name || 'N/A',
          'Task Name': record.task_name || 'N/A',
          'Records': record.file_record_count || 0,
          'QC Records': record.qc_generated_count || 0,
          'No. of Errors': count,
          'Final QC Score': `${record.qc_score || 0}%`,
          'Error Types': types.length > 0 ? types.join(', ') : '-',
          'QA Name': record.qa_agent_name || 'N/A'
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
        'Team Lead': '',
        'Agent Name': '',
        'Project Name': `Total Projects: ${totalProjects}`,
        'Task Name': '',
        'Records': totalRecords,
        'QC Records': totalQCRecords,
        'No. of Errors': totalErrors,
        'Final QC Score': `Avg: ${avgScore}%`,
        'Error Types': '',
        'QA Name': ''
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
              'Team Lead': record.assistant_manager_name || 'N/A',
              'Agent Name': record.agent_name || 'N/A',
              'Project Name': record.project_name || 'N/A',
              'Task Name': record.task_name || 'N/A',
              'Count': rework.rework_count || '-',
              'Records': rework.file_record_count || 0,
              'QC Records': rework.qc_data_generated_count || 0,
              'No. of Errors': count,
              'Final QC Score': rework.rework_qc_score ? `${rework.rework_qc_score}%` : '-',
              'Error Type': types.length > 0 ? types.join(', ') : '-',
              'QA Name': record.qa_agent_name || 'N/A'
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
              'Team Lead': record.assistant_manager_name || 'N/A',
              'Agent Name': record.agent_name || 'N/A',
              'Project Name': record.project_name || 'N/A',
              'Task Name': record.task_name || 'N/A',
              'Count': correction.correction_count || '-',
              'Records': '-',
              'QC Records': '-',
              'No. of Errors': '-',
              'Final QC Score': '-',
              'Error Type': '-',
              'QA Name': record.qa_agent_name || 'N/A'
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
        'Team Lead': '',
        'Agent Name': '',
        'Project Name': `Total Rework: ${totalRework}`,
        'Task Name': `Total Correction: ${totalCorrection}`,
        'Count': '',
        'Records': '',
        'QC Records': '',
        'No. of Errors': totalReworkErrors,
        'Final QC Score': '',
        'Error Type': '',
        'QA Name': ''
      });

      const filename = `QC_History_${new Date().toISOString().split('T')[0]}.csv`;
      exportToCSV(historyData, filename);
      toast.success(`Exported ${historyData.length - 1} history records!`);
    } catch (err) {
      console.error('History export error:', err);
      toast.error('Failed to export history data');
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

          {/* Date Range Filter - Applied to Evaluation Date */}
          <div className="date-range-compact">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5">
              <Calendar className="w-3 h-3 text-blue-600" />
              Evaluation Date Range
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
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Evaluation Date</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Work Date</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Team Lead</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Agent Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Project Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Task Name</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Records</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">QC Records</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">No. of Errors</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Final QC Score</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Error Type</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">QA Name</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="px-4 py-12 text-center text-slate-500">
                      <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold">No QC records found</p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <React.Fragment key={record.id || index}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      {/* Evaluation Date - created_at */}
                      <td className="px-3 py-3 text-sm text-slate-700">
                        {(() => {
                          const dt = formatDate(record.created_at);
                          return (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-500" />
                              <div>
                                <span className="font-medium">{dt.date}</span>
                                {dt.time && <span className="text-xs text-slate-500 ml-1">{dt.time}</span>}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      
                      {/* Work Date - date_of_file_submission */}
                      <td className="px-3 py-3 text-sm text-slate-700">
                        {(() => {
                          const dt = formatDate(record.date_of_file_submission);
                          return (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-green-500" />
                              <div>
                                <span className="font-medium">{dt.date}</span>
                                {dt.time && <span className="text-xs text-slate-500 ml-1">{dt.time}</span>}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      
                      {/* Team Lead - assistant_manager_name */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-700">
                          <Users className="w-3 h-3" />
                          {record.assistant_manager_name || record.team_name || 'N/A'}
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
                      <td className="px-3 py-3 text-sm text-slate-600">
                        {record.task_name || 'N/A'}
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
                          {record.qc_score || '0'}%
                        </span>
                      </td>
                      
                      {/* Error Type - from error_list */}
                      <td className="px-3 py-3">
                        {(() => {
                          const { types, count } = getErrorTypes(record.error_list);
                          if (count === 0) {
                            return <span className="text-xs text-slate-400">-</span>;
                          }
                          return (
                            <div className="flex flex-col gap-1">
                              {/* Show first 2 error types as badges */}
                              <div className="flex flex-wrap gap-1">
                                {types.slice(0, 2).map((type, idx) => (
                                  <span 
                                    key={idx} 
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200"
                                  >
                                    {type}
                                  </span>
                                ))}
                              </div>
                              {/* Show summary if more errors exist */}
                              {types.length > 2 && (
                                <button
                                  onClick={() => openErrorModal(record.error_list, `All Errors (${count})`)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium text-left hover:underline"
                                >
                                  +{types.length - 2} more error types • View all {count} errors
                                </button>
                              )}
                              {types.length <= 2 && count > types.length && (
                                <button
                                  onClick={() => openErrorModal(record.error_list, `All Errors (${count})`)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium text-left hover:underline"
                                >
                                  View all {count} errors
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      
                      {/* QA Name - qa_agent_name */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-700">
                          <User className="w-3 h-3" />
                          {record.qa_agent_name || 'N/A'}
                        </span>
                      </td>
                      
                      {/* Expand/Collapse Button */}
                      <td className="px-3 py-3 text-center">
                        {(record.qc_rework?.length > 0 || record.qc_correction?.length > 0) && (
                          <button
                            onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition-colors"
                            title="View History"
                          >
                            {selectedRecord?.id === record.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* History Section - Rework & Correction */}
                    {selectedRecord?.id === record.id && (record.qc_rework?.length > 0 || record.qc_correction?.length > 0) && (
                      <tr>
                        <td colSpan="13" className="px-0 py-0">
                          <div className="bg-slate-50 border-t-2 border-slate-200">
                            {/* History Header */}
                            <div className="px-4 py-2 bg-gradient-to-r from-orange-50 to-red-50 border-b border-slate-200">
                              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-orange-600" />
                                Rework & Correction History
                                <span className="text-xs font-normal text-slate-500">
                                  ({record.qc_rework?.length || 0} Rework, {record.qc_correction?.length || 0} Correction)
                                </span>
                              </h4>
                            </div>
                            
                            {/* History Table */}
                            <div className="overflow-x-auto p-4">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Type</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Eval Date</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Work Date</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Team Lead</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Agent</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Project</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Task</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Count</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Records</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">QC Rec</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Errors</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-600 uppercase">Score</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">Error Type</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase">QA</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Rework History */}
                                  {record.qc_rework?.map((rework, idx) => {
                                    const { types, count } = getErrorTypes(rework.rework_error_list);
                                    const evalDt = formatDate(rework.updated_at);
                                    const workDt = formatDate(record.date_of_file_submission);
                                    return (
                                      <tr key={`rework-${idx}`} className="border-b border-slate-100 hover:bg-orange-50">
                                        <td className="px-3 py-2">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                            <AlertCircle className="w-3 h-3" />
                                            Rework
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-700">{evalDt.date}</td>
                                        <td className="px-3 py-2 text-slate-700">{workDt.date}</td>
                                        <td className="px-3 py-2 text-slate-700">{record.assistant_manager_name || 'N/A'}</td>
                                        <td className="px-3 py-2 font-medium text-slate-800">{record.agent_name || 'N/A'}</td>
                                        <td className="px-3 py-2 text-slate-700">{record.project_name || 'N/A'}</td>
                                        <td className="px-3 py-2 text-slate-700">{record.task_name || 'N/A'}</td>
                                        <td className="px-3 py-2 text-center font-bold text-orange-600">{rework.rework_count || '-'}</td>
                                        <td className="px-3 py-2 text-center">{rework.file_record_count || 0}</td>
                                        <td className="px-3 py-2 text-center">{rework.qc_data_generated_count || 0}</td>
                                        <td className="px-3 py-2 text-center">
                                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {count}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${
                                            (rework.rework_qc_score || 0) >= 98 ? 'bg-green-100 text-green-700' :
                                            (rework.rework_qc_score || 0) >= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                          }`}>
                                            {rework.rework_qc_score ? `${rework.rework_qc_score}%` : '-'}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-600">
                                          {types.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {types.slice(0, 2).map((type, tidx) => (
                                                <span key={tidx} className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs">{type}</span>
                                              ))}
                                              {types.length > 2 && <span className="text-xs text-slate-400">+{types.length - 2}</span>}
                                            </div>
                                          ) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-600">{record.qa_agent_name || 'N/A'}</td>
                                      </tr>
                                    );
                                  })}
                                  
                                  {/* Correction History */}
                                  {record.qc_correction?.map((correction, idx) => {
                                    const evalDt = formatDate(correction.updated_at);
                                    const workDt = formatDate(record.date_of_file_submission);
                                    return (
                                      <tr key={`correction-${idx}`} className="border-b border-slate-100 hover:bg-red-50">
                                        <td className="px-3 py-2">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                            <XCircle className="w-3 h-3" />
                                            Correction
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-700">{evalDt.date}</td>
                                        <td className="px-3 py-2 text-slate-700">{workDt.date}</td>
                                        <td className="px-3 py-2 text-slate-700">{record.assistant_manager_name || 'N/A'}</td>
                                        <td className="px-3 py-2 font-medium text-slate-800">{record.agent_name || 'N/A'}</td>
                                        <td className="px-3 py-2 text-slate-700">{record.project_name || 'N/A'}</td>
                                        <td className="px-3 py-2 text-slate-700">{record.task_name || 'N/A'}</td>
                                        <td className="px-3 py-2 text-center font-bold text-red-600">{correction.correction_count || '-'}</td>
                                        <td className="px-3 py-2 text-center">-</td>
                                        <td className="px-3 py-2 text-center">-</td>
                                        <td className="px-3 py-2 text-center">-</td>
                                        <td className="px-3 py-2 text-center">-</td>
                                        <td className="px-3 py-2 text-xs text-slate-600">-</td>
                                        <td className="px-3 py-2 text-xs text-slate-600">{record.qa_agent_name || 'N/A'}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                        <span className="px-2 py-0.5 bg-rose-400 text-white text-xs font-semibold rounded">Row {err.row}</span>
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
