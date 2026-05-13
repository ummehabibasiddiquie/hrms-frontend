/**
 * File: AgentQCReportPage.jsx
 * Description: Agent's QC Report page - simplified table view
 */
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  FileCheck,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Clock,
  X,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import nodeApi from '../services/nodeApi';
import { DateRangePicker } from '../components/common/CustomCalendar';

const AgentQCReportPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [qcRecords, setQcRecords] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [errorModal, setErrorModal] = useState({ open: false, errors: [], title: '' });
  const [uploadModal, setUploadModal] = useState({ open: false, record: null, type: '', historyItem: null });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Filter states
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch QC history from API
  const fetchQCHistory = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      const response = await api.post('qc_history_user/view_qc_history_user_based', {
        logged_in_user_id: user.user_id
      });

      if (response.data?.status === 200 && response.data?.data?.records) {
        setQcRecords(response.data.data.records);
      } else {
        toast.error('Failed to fetch QC history');
      }
    } catch (error) {
      console.error('Error fetching QC history:', error);
      toast.error('Failed to fetch QC history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQCHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return { date: '—', time: '' };
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

  const parseErrors = (errors) => {
    if (!errors) return [];
    if (typeof errors === 'string') {
      try { return JSON.parse(errors); } catch { return []; }
    }
    return Array.isArray(errors) ? errors : [];
  };

  const getStatusInfo = (record) => {
    const score = record.qc_score;
    const status = record.status;
    const qcStatus = record.qc_status;
    const hasCorrection = record.qc_correction?.length > 0;
    const lastCorrection = record.qc_correction?.[record.qc_correction.length - 1];
    const hasRework = record.qc_rework?.length > 0;
    const lastRework = record.qc_rework?.[record.qc_rework.length - 1];
    const hasReworkInProgress = lastRework && (lastRework.rework_status === 'rework' || lastRework.rework_file_qc_status === 'pending');
    const hasCorrectionInProgress = lastCorrection && (lastCorrection.correction_status === 'correction' || lastCorrection.correction_file_qc_status === 'pending');

    if (status === 'regular' || score === 100) {
      return {
        badge: <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" /> Passed</span>,
        message: 'Congratulations! Your file has successfully passed quality check.',
        canUpload: false
      };
    }
    if (status === 'correction') {
      return {
        badge: hasCorrectionInProgress
          ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700"><Clock className="w-3 h-3" /> Under Review</span>
          : <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3" /> Correction</span>,
        message: hasCorrectionInProgress
          ? 'Your correction file is under review by QA team.'
          : 'Please correct the errors and upload the corrected file (One attempt only).',
        canUpload: !hasCorrectionInProgress,
        uploadType: 'correction'
      };
    }
    if (status === 'rework') {
      return {
        badge: hasReworkInProgress
          ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700"><Clock className="w-3 h-3" /> Under Review</span>
          : <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Rework</span>,
        message: hasReworkInProgress
          ? 'Your rework file is under review by QA team.'
          : 'Please fix all errors and upload the reworked file.',
        canUpload: !hasReworkInProgress,
        uploadType: 'rework'
      };
    }
    return { badge: <span className="text-xs text-slate-500">—</span>, message: '', canUpload: false };
  };

  const getScoreClass = (score) => {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score === 100) return 'text-green-600 font-bold';
    if (score >= 95) return 'text-yellow-600 font-bold';
    return 'text-red-600 font-bold';
  };

  const getQCStatusBadge = (qcStatus) => {
    if (qcStatus === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>
      );
    } else if (qcStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    } else if (qcStatus === 'correction') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3 h-3" /> Correction
        </span>
      );
    } else if (qcStatus === 'rework') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" /> Rework
        </span>
      );
    }
    return <span className="text-xs text-slate-500">{qcStatus || '—'}</span>;
  };

  const getTypeBadge = (type) => {
    if (type === 'rework') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" /> Rework
        </span>
      );
    } else if (type === 'correction') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3 h-3" /> Correction
        </span>
      );
    }
    return <span className="text-xs text-slate-500">—</span>;
  };

  const getStatusBadge = (status) => {
    if (status === 'regular' || status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" /> {status === 'completed' ? 'Completed' : 'Regular'}
        </span>
      );
    } else if (status === 'correction') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3 h-3" /> Correction
        </span>
      );
    } else if (status === 'rework') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" /> Rework
        </span>
      );
    }
    return <span className="text-xs text-slate-500">—</span>;
  };

  const openErrorModal = (errors, projectTask) => {
    setErrorModal({ open: true, errors: parseErrors(errors), title: `${projectTask} - Errors` });
  };

  const openUploadModal = (record, type, historyItem = null) => {
    setUploadModal({ open: true, record, type, historyItem });
    setUploadFile(null);
  };

  // Filter QC records based on date range and search query (project/task)
  const filteredRecords = useMemo(() => {
    let filtered = [...qcRecords];

    // Filter by date range
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(record => {
        const submissionDate = record.date_of_file_submission ? new Date(record.date_of_file_submission) : null;
        if (!submissionDate) return false;

        const startDate = dateRange.start ? new Date(dateRange.start) : null;
        const endDate = dateRange.end ? new Date(dateRange.end) : null;

        if (startDate && submissionDate < startDate) return false;
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          if (submissionDate > endDateTime) return false;
        }
        return true;
      });
    }

    // Filter by project name or task name (unified search)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record => 
        record.project_name?.toLowerCase().includes(query) ||
        record.task_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [qcRecords, dateRange, searchQuery]);

  // Clear all filters
  const handleClearFilters = () => {
    setDateRange({ start: '', end: '' });
    setSearchQuery('');
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !uploadModal.record) {
      toast.error('Please select a file first');
      return;
    }

    if (!uploadModal.historyItem) {
      toast.error('History item not found');
      return;
    }

    try {
      setUploading(true);
      
      // Get qcId from historyItem based on type
      let qcId;
      if (uploadModal.type === 'rework') {
        qcId = uploadModal.historyItem.qc_record_id;
      } else if (uploadModal.type === 'correction') {
        qcId = uploadModal.historyItem.qc_record_id;
      }

      if (!qcId) {
        toast.error('QC record ID not found');
        setUploading(false);
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('qcId', qcId);
      formData.append('type', uploadModal.type); // 'rework' or 'correction'
      formData.append('file', uploadFile);
      formData.append('logged_in_user_id', user.user_id);

      // Call the upload API
      const response = await nodeApi.post('qc-records/agent-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.status === 200 || response.data?.success) {
        const { type } = uploadModal;
        toast.success(`${type === 'rework' ? 'Rework' : 'Correction'} file uploaded successfully!`);

        // Refresh data
        await fetchQCHistory();

        setUploadModal({ open: false, record: null, type: '', historyItem: null });
        setUploadFile(null);
      } else {
        toast.error(response.data?.message || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200">
        <FileCheck className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-lg font-bold text-slate-800">My QC Reports</h1>
          <p className="text-xs text-slate-500">View your file quality check results</p>
        </div>
      </div>

      {/* Filters - All in One Line */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-4">
          {/* Date Range Filter */}
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onStartDateChange={(date) => setDateRange(prev => ({ ...prev, start: date }))}
            onEndDateChange={(date) => setDateRange(prev => ({ ...prev, end: date }))}
            onClear={handleClearFilters}
            label=""
            description=""
            showClearButton={false}
            noWrapper={true}
            fieldWidth="200px"
          />

          {/* Unified Project/Task Search */}
          <div style={{ width: '250px' }} className="flex-shrink-0">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5">
              <Search className="w-3 h-3 text-blue-600" />
              Project / Task
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project or task name..."
              className="w-full px-3 py-2.5 text-sm border-2 border-blue-200 rounded-lg bg-slate-50 hover:bg-blue-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>
        </div>

        {/* Active Filters & Clear Button */}
        {(dateRange.start || dateRange.end || searchQuery) && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Active Filters:</span>
              {(dateRange.start || dateRange.end) && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold shadow-sm">
                  Date Range
                </span>
              )}
              {searchQuery && (
                <span className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold shadow-sm">
                  Project/Task
                </span>
              )}
              <span className="font-bold text-slate-700 ml-2">
                Showing <span className="text-blue-700">{filteredRecords.length}</span> of <span className="text-slate-500">{qcRecords.length}</span> records
              </span>
            </div>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <X className="w-3 h-3" />
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Submission Date & Time</th>
                <th className="px-4 py-3 text-left font-semibold">Project / Task</th>
                <th className="px-4 py-3 text-center font-semibold">Score</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">QC Status</th>
                <th className="px-4 py-3 text-center font-semibold">Errors</th>
                <th className="px-4 py-3 text-center font-semibold">QC File</th>
                <th className="px-4 py-3 text-center font-semibold">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => {
                const errors = parseErrors(record.error_list);
                const statusInfo = getStatusInfo(record);
                const isExpanded = expandedRow === record.id;

                return (
                  <React.Fragment key={record.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">
                        {(() => {
                          const dt = formatDateTime(record.date_of_file_submission);
                          return (
                            <div>
                              <p className="font-medium">{dt.date}</p>
                              {dt.time && <p className="text-xs text-slate-500">{dt.time}</p>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{record.project_name}</div>
                        <div className="text-xs text-slate-500">{record.task_name}</div>
                      </td>
                      <td className={`px-4 py-3 text-center ${getScoreClass(record.qc_score)}`}>
                        {record.qc_score !== null && record.qc_score !== undefined ? `${record.qc_score}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(record.status)}</td>
                      <td className="px-4 py-3 text-center">{getQCStatusBadge(record.qc_status)}</td>
                      <td className="px-4 py-3 text-center">
                        {errors.length > 0 ? (
                          <button
                            onClick={() => openErrorModal(record.error_list, `${record.project_name} - ${record.task_name}`)}
                            className="relative inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
                          >
                            View
                            <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-rose-700 text-white text-xs font-bold">
                              {errors.length}
                            </span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-600 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> None
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {record.qc_file_path ? (
                          <a
                            href={record.qc_file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {((record.qc_rework && record.qc_rework.length > 0) || (record.qc_correction && record.qc_correction.length > 0)) ? (
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : record.id)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Row - History + Message */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="8" className="p-0">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-200">
                            {/* Status Message */}
                            <div className="px-4 py-3 border-b border-blue-200">
                              <p className="text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{statusInfo.message}</p>
                            </div>

                            {/* History */}
                            <div className="p-4">
                              <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                QC History
                              </h4>
                              
                              {/* Build history items from rework and correction */}
                              {(() => {
                                const historyItems = [];
                                
                                // Add rework items
                                (record.qc_rework || []).forEach(r => {
                                  historyItems.push({
                                    ...r,
                                    type: 'rework',
                                    updated_at: r.updated_at,
                                    attempt: r.rework_count,
                                    status: r.rework_status,
                                    score: r.rework_qc_score,
                                    errors: r.rework_error_list,
                                    file_path: r.rework_file_path
                                  });
                                });
                                
                                // Add correction items
                                (record.qc_correction || []).forEach(c => {
                                  historyItems.push({
                                    ...c,
                                    type: 'correction',
                                    updated_at: c.updated_at,
                                    attempt: c.correction_count,
                                    status: c.correction_status,
                                    score: null,
                                    errors: c.correction_error_list,
                                    file_path: c.correction_file_path
                                  });
                                });
                                
                                // Sort by updated_at
                                historyItems.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
                                
                                if (historyItems.length === 0) {
                                  return (
                                    <div className="text-center py-8 text-slate-500">
                                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                      <p className="text-sm font-medium">No history available</p>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="overflow-hidden rounded-lg border border-slate-200">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold">Type</th>
                                          <th className="px-3 py-2 text-left font-semibold">Date & Time</th>
                                          <th className="px-3 py-2 text-center font-semibold">Attempt</th>
                                          <th className="px-3 py-2 text-center font-semibold">Status</th>
                                          <th className="px-3 py-2 text-center font-semibold">Score</th>
                                          <th className="px-3 py-2 text-center font-semibold">Errors</th>
                                          <th className="px-3 py-2 text-center font-semibold">File</th>
                                          <th className="px-3 py-2 text-center font-semibold">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {historyItems.map((item, idx) => {
                                          const itemErrors = item.type === 'rework' ? parseErrors(item.errors) : [];
                                          const canUploadHere = item.type === 'rework' 
                                            ? (item.rework_status === 'rework' && !item.rework_file_path)
                                            : (item.correction_status === 'correction' && !item.correction_file_path);
                                          
                                          return (
                                            <tr key={idx} className="hover:bg-slate-50">
                                              <td className="px-3 py-2">{getTypeBadge(item.type)}</td>
                                              <td className="px-3 py-2 text-slate-600">
                                                {(() => {
                                                  const dt = formatDateTime(item.updated_at);
                                                  return (
                                                    <div>
                                                      <p className="font-medium">{dt.date}</p>
                                                      {dt.time && <p className="text-xs text-slate-500">{dt.time}</p>}
                                                    </div>
                                                  );
                                                })()}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">
                                                  #{item.attempt}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                {item.type === 'rework' ? getStatusBadge(item.status) : '—'}
                                              </td>
                                              <td className={`px-3 py-2 text-center ${getScoreClass(item.score)}`}>
                                                {item.type === 'rework' && item.score !== null && item.score !== undefined ? `${item.score}%` : '—'}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                {item.type === 'rework' && itemErrors.length > 0 ? (
                                                  <button
                                                    onClick={() => openErrorModal(item.errors, `${item.type === 'rework' ? 'Rework' : 'Correction'} #${item.attempt} - Errors`)}
                                                    className="relative inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
                                                  >
                                                    View
                                                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-rose-700 text-white text-xs font-bold">
                                                      {itemErrors.length}
                                                    </span>
                                                  </button>
                                                ) : '—'}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                {item.file_path ? (
                                                  <a
                                                    href={item.file_path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                                                  >
                                                    <Download className="w-3 h-3" />
                                                  </a>
                                                ) : (
                                                  <span className="text-xs text-slate-400">—</span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                {canUploadHere ? (
                                                  <button
                                                    onClick={() => openUploadModal(record, item.type, item)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold transition-colors"
                                                  >
                                                    <Upload className="w-3 h-3" />
                                                    Upload
                                                  </button>
                                                ) : (
                                                  <span className="text-xs text-slate-400">—</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {qcRecords.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No QC Records Found</p>
            <p className="text-sm">Your submitted files will appear here after QC review.</p>
          </div>
        )}

        {qcRecords.length > 0 && filteredRecords.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No Records Match Your Filters</p>
            <p className="text-sm">Try adjusting your search criteria or date range.</p>
          </div>
        )}
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
                      <p className="text-sm text-rose-700 font-medium">{err.error}</p>
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

      {/* Upload Modal */}
      {uploadModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setUploadModal({ open: false, record: null, type: '', historyItem: null })}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Upload {uploadModal.type === 'rework' ? 'Rework' : 'Correction'} File
                    {uploadModal.historyItem && ` - Attempt #${uploadModal.historyItem.attempt}`}
                  </h3>
                  <p className="text-blue-100 text-sm">{uploadModal.record?.project_name}</p>
                </div>
              </div>
              <button
                onClick={() => setUploadModal({ open: false, record: null, type: '', historyItem: null })}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                id="upload-file-input"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
              <label
                htmlFor="upload-file-input"
                className="block w-full px-4 py-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors text-center"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <span className="text-sm text-slate-600">
                  {uploadFile ? uploadFile.name : 'Click to select file (Excel/CSV)'}
                </span>
              </label>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setUploadModal({ open: false, record: null, type: '', historyItem: null })}
                  className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile || uploading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentQCReportPage;
