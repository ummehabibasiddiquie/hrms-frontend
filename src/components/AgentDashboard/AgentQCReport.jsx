/**
 * File: AgentQCReport.jsx
 * Author: Naitik Maisuriya
 * Description: QC Report component for Agent Dashboard
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import nodeApi from '../../services/nodeApi';
import api from '../../services/api';
import { exportToCSV } from '../../utils/csvExport';
import { 
  Download, 
  FileSpreadsheet, 
  RotateCcw,
  Award,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  File
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import ErrorMessage from '../common/ErrorMessage';
import { DateRangePicker } from '../common/CustomCalendar';

const AgentQCReport = () => {
  const { user } = useAuth();

  // Helper function to get QC score color classes
  const getQCScoreColorClass = (score) => {
    if (score === null || score === undefined || score === '-' || isNaN(Number(score))) return 'text-slate-700';
    const numScore = Number(score);
    if (numScore >= 95) return 'text-green-800 bg-green-100 font-bold';
    if (numScore >= 80) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  // Helper function to get status badge classes
  const getStatusBadgeClass = (status) => {
    if (!status) return 'bg-slate-100 text-slate-700';
    const statusLower = status.toLowerCase();
    if (statusLower === 'regular' || statusLower === 'approved') return 'bg-green-100 text-green-800';
    if (statusLower === 'rework') return 'bg-yellow-100 text-yellow-800';
    if (statusLower === 'correction') return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-700';
  };

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to format date and time
  const formatDateTime = (timestamp) => {
    if (!timestamp) return { date: '-', time: '-' };
    
    try {
      const date = new Date(timestamp);
      
      // Format date as: 10/Mar/2026
      const day = String(date.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      
      // Format time as: 12:00 AM
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
      
      return { date: formattedDate, time: formattedTime };
    } catch (e) {
      console.error('[AgentQCReport] Error formatting date:', e);
      return { date: '-', time: '-' };
    }
  };

  // Handle Rework/Correction Modal
  const handleOpenReworkModal = (errorList, recordInfo, status, qcId, trackerId) => {
    // Modal can open for all statuses to view errors
    // File upload will only be available for rework/correction

    // Ensure errorList is always an array
    let parsedErrorList = [];
    
    try {
      if (typeof errorList === 'string') {
        parsedErrorList = JSON.parse(errorList);
      } else if (Array.isArray(errorList)) {
        parsedErrorList = errorList;
      }
    } catch (e) {
      console.error('[AgentQCReport] Error parsing error list:', e);
      parsedErrorList = [];
    }
    
    // Get rework file path using tracker_id (matched from Python API)
    const reworkFilePath = reworkFiles[trackerId] || null;
    
    setSelectedErrorList(parsedErrorList);
    setSelectedRecordInfo({ ...recordInfo, status, qcId, trackerId, reworkFilePath });
    setShowErrorListModal(true);
  };

  const handleCloseErrorListModal = () => {
    setShowErrorListModal(false);
    setSelectedErrorList([]);
    setSelectedRecordInfo(null);
    setUploadedFile(null);
    setFilePreview(null);
    setUploadError('');
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('File size must be less than 10MB');
      return;
    }

    setUploadedFile(file);
    setFilePreview(file.name);
    setUploadError('');
  };

  // Handle file submission
  const handleSubmitRework = async () => {
    if (!uploadedFile) {
      toast.error('Please upload a file before submitting');
      return;
    }

    if (!selectedRecordInfo?.trackerId) {
      toast.error('Invalid record information');
      return;
    }

    setSubmittingRework(true);
    const loadingToast = toast.loading('Uploading rework file...');

    try {
      const formData = new FormData();
      formData.append('tracker_id', selectedRecordInfo.trackerId);
      formData.append('rework_file_path', uploadedFile);

      // Submit to Python backend API
      const response = await api.post('/qc_rework/add_rework_file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Rework file uploaded successfully!', { id: loadingToast });
      handleCloseErrorListModal();
      
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('[AgentQCReport] Error uploading rework file:', err);
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg, { id: loadingToast });
    } finally {
      setSubmittingRework(false);
    }
  };

  // State management
  const [startDate, setStartDate] = useState(() => getTodayDate());
  const [endDate, setEndDate] = useState(() => getTodayDate());
  const [allQcData, setAllQcData] = useState([]);
  const [reworkFiles, setReworkFiles] = useState({}); // Map of tracker_id -> rework_file_path
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showErrorListModal, setShowErrorListModal] = useState(false);
  const [selectedErrorList, setSelectedErrorList] = useState([]);
  const [selectedRecordInfo, setSelectedRecordInfo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [submittingRework, setSubmittingRework] = useState(false);

  // Filter data by date range on frontend
  const qcData = useMemo(() => {
    if (!startDate || !endDate) return allQcData;

    return allQcData.filter(record => {
      if (!record.evaluation_datetime) return false;

      const recordDate = new Date(record.evaluation_datetime);
      recordDate.setHours(0, 0, 0, 0);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      return recordDate >= start && recordDate <= end;
    });
  }, [allQcData, startDate, endDate]);

  // Fetch QC report data
  useEffect(() => {
    const fetchQCData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Call Node API to get ALL QC records+ (no date filtering on API)
        const response = await nodeApi.get('/qc-records/list', {
          params: {
            agent_user_id: user?.user_id
          }
        });

        // Map API response to component format
        const records = response.data?.data || [];
        const mappedData = records.map(record => {
          return {
            qc_id: record.id,
            tracker_id: record.tracker_id,
            evaluation_datetime: record.timestamp,
            qa_agent: record.qa_name || '-',
            project_task: `${record.project_name || '-'} / ${record.task_name || '-'}`,
            project_name: record.project_name,
            task_name: record.task_name,
            file_name: record.file_path,
            total_records: record.file_record_count,
            error_list: record.error_list,
            status: record.status,
            qc_score: record.qc_score
          };
        });

        setAllQcData(mappedData);

        // Fetch rework file data from Python API
        try {
          const reworkResponse = await api.post('/qc_rework/view_rework_trackers', { agent_id: parseInt(user?.user_id) });
          const reworkRecords = reworkResponse.data?.data?.records || [];
          
          // Create a map using tracker_id (from Node API) -> rework_file_path
          // Match Python records to Node records by project, task, and evaluation time
          const reworkFileMap = {};
          
          reworkRecords.forEach(reworkRecord => {
            if (reworkRecord.rework_file_path && reworkRecord.rework_file_path.trim()) {
              // Find matching QC record by project_name, task_name, and timestamp
              const matchingQcRecord = mappedData.find(qcRecord => {
                const projectMatch = qcRecord.project_name === reworkRecord.project_name;
                const taskMatch = qcRecord.task_name === reworkRecord.task_name;
                
                // Compare evaluation timestamps (allowing for timezone differences)
                const qcTime = new Date(qcRecord.evaluation_datetime).getTime();
                const reworkTime = new Date(reworkRecord.evaluation_datetime).getTime();
                const timeDiff = Math.abs(qcTime - reworkTime);
                const timeMatch = timeDiff < 21600000; // Within 6 hours (to handle timezone issues)
                
                return projectMatch && taskMatch && timeMatch;
              });
              
              if (matchingQcRecord) {
                reworkFileMap[matchingQcRecord.tracker_id] = reworkRecord.rework_file_path;
              }
            }
          });
          
          setReworkFiles(reworkFileMap);
        } catch (reworkErr) {
          console.error('[AgentQCReport] Error fetching rework data:', reworkErr);
          // Don't show error to user, just log it - rework data is optional
        }

      } catch (err) {
        console.error('[AgentQCReport] Error fetching QC data:', err);
        const msg = getFriendlyErrorMessage(err);
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    if (user?.user_id) {
      fetchQCData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Export to CSV
  const handleExportExcel = () => {
    try {
      if (qcData.length === 0) {
        toast.error('No data to export');
        return;
      }

      const exportData = qcData.map(row => ({
        'Evaluation Date & Time': row.evaluation_datetime || '-',
        'QA Agent': row.qa_agent || '-',
        'Project/Task': row.project_task || '-',
        'File': row.file_name && row.file_name !== '-' ? 'Yes' : 'No',
        'Total Records': row.total_records || 0,
        'Error List': row.error_list || '-',
        'Status': row.status || '-',
        'QC Score': row.qc_score != null ? `${row.qc_score}%` : '-'
      }));

      // Calculate summary
      const avgScore = qcData.reduce((sum, r) => sum + (Number(r.qc_score) || 0), 0) / qcData.length;

      exportData.push({
        'Evaluation Date & Time': 'SUMMARY',
        'QA Agent': '',
        'Project/Task': '',
        'File': '-',
        'Total Records': qcData.reduce((sum, r) => sum + (Number(r.total_records) || 0), 0),
        'Error List': '',
        'Status': '',
        'QC Score': `${avgScore.toFixed(2)}%`
      });

      const filename = `QC_Report_${startDate}_to_${endDate}.csv`;
      exportToCSV(exportData, filename);
      toast.success('QC report exported!');
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-2 sm:px-4">
      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6 mb-6">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          label="Evaluation Date Range"
          description="Filter QC reports by evaluation date"
          showClearButton={false}
        />
        
        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 group"
            onClick={() => {
              setStartDate(getTodayDate());
              setEndDate(getTodayDate());
            }}
            type="button"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
            Reset
          </button>
          
          <button
            onClick={handleExportExcel}
            disabled={loading || qcData.length === 0}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* QC Report Table */}
      <div className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
            <p className="text-blue-700 font-semibold">Loading QC report...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorMessage message={error} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-100">
              <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Evaluation Date & Time</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">QA Agent</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Project/Task</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">File</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Total Records</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Error List</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">QC Score</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-blue-50">
                {qcData.length > 0 ? (
                  qcData.map((row, idx) => {
                    const dateTime = formatDateTime(row.evaluation_datetime);
                    const errorCount = Array.isArray(row.error_list) ? row.error_list.length : 
                                       (typeof row.error_list === 'string' && row.error_list !== '-' ? 
                                       (() => {
                                         try {
                                           return JSON.parse(row.error_list).length;
                                         } catch {
                                           return 0;
                                         }
                                       })() : 0);
                    
                    return (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors duration-150">
                      <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{dateTime.date}</span>
                          <span className="text-xs text-gray-600">{dateTime.time}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{row.qa_agent || '-'}</td>
                      <td className="px-6 py-4 text-gray-900">{row.project_task || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {row.file_name && row.file_name !== '-' ? (
                          <a 
                            href={row.file_name}
                            download={row.file_name.split('/').pop()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-bold transition-colors group/link"
                          >
                            <Download className="w-4 h-4 group-hover/link:animate-bounce" />
                            Download
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-semibold text-gray-900">
                          {row.total_records || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {(row.status?.toLowerCase() === 'rework' || row.status?.toLowerCase() === 'correction') ? (
                          <button
                            onClick={() => handleOpenReworkModal(row.error_list, {
                              qaAgent: row.qa_agent,
                              projectTask: row.project_task,
                              evalDate: dateTime.date,
                              trackerId: row.tracker_id
                            }, row.status, row.qc_id, row.tracker_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 border border-orange-300 hover:border-orange-400 rounded-lg text-orange-700 hover:text-orange-800 text-xs font-bold transition-all"
                          >
                            <Upload className="w-3 h-3" />
                            {reworkFiles[row.tracker_id] ? 'View Fix' : 'Upload Fix'}
                            {errorCount > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
                                {errorCount}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenReworkModal(row.error_list, {
                              qaAgent: row.qa_agent,
                              projectTask: row.project_task,
                              evalDate: dateTime.date,
                              trackerId: row.tracker_id
                            }, row.status, row.qc_id, row.tracker_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-100 border border-slate-200 hover:border-blue-300 rounded-lg text-slate-700 hover:text-blue-700 text-xs font-bold transition-all"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            View Errors
                            {errorCount > 0 && (
                              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
                                {errorCount}
                              </span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg font-semibold text-sm inline-block ${getStatusBadgeClass(row.status)}`}>
                          {row.status || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg inline-block ${getQCScoreColorClass(row.qc_score)}`}>
                          {row.qc_score != null ? `${Number(row.qc_score).toFixed(2)}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm">
                      <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No QC data available</p>
                      <p className="text-xs mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {!loading && !error && qcData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Average QC Score Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md border border-blue-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-700 mb-1">Average QC Score</p>
                <p className="text-3xl font-bold text-blue-900">
                  {qcData.length > 0 
                    ? `${(qcData.reduce((sum, r) => sum + (Number(r.qc_score) || 0), 0) / qcData.length).toFixed(2)}%`
                    : '-'}
                </p>
              </div>
              <Award className="w-12 h-12 text-blue-600 opacity-50" />
            </div>
          </div>

          {/* Total Submissions Card */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md border border-green-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-700 mb-1">Total Submissions</p>
                <p className="text-3xl font-bold text-green-900">{qcData.length}</p>
              </div>
              <FileSpreadsheet className="w-12 h-12 text-green-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Error List Modal */}
      {showErrorListModal && (
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
                      {selectedRecordInfo.qaAgent} • {selectedRecordInfo.projectTask}
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
              {/* File Upload Section - Only for Rework/Correction */}
              {(selectedRecordInfo?.status?.toLowerCase() === 'rework' || selectedRecordInfo?.status?.toLowerCase() === 'correction') && (
                (selectedRecordInfo?.reworkFilePath && selectedRecordInfo.reworkFilePath.trim()) ? (
                  // File already uploaded - show message and download link
                  <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-green-800 mb-1">File Already Uploaded</h4>
                        <p className="text-sm text-green-700 mb-3">
                          You have already submitted your corrected file for this rework/correction.
                        </p>
                        <a
                          href={selectedRecordInfo.reworkFilePath}
                          download={selectedRecordInfo.reworkFilePath.split('/').pop()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                        >
                          <Download className="w-4 h-4" />
                          Download Uploaded File
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  // File not uploaded yet - show upload form
                  <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                      <div className="flex items-center gap-2">
                        <Upload className="w-4 h-4 text-blue-600" />
                        Upload Corrected File
                        <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <div className="space-y-3">
                      <div
                        onClick={() => document.getElementById('rework-file-input').click()}
                        className="relative border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-100/50 transition-all"
                      >
                        <input
                          id="rework-file-input"
                          type="file"
                          onChange={handleFileUpload}
                          className="hidden"
                          accept="*/*"
                        />
                        {filePreview ? (
                          <div className="flex items-center justify-center gap-2">
                            <File className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-semibold text-green-700">{filePreview}</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-600">Click to upload file</p>
                            <p className="text-xs text-slate-500 mt-1">Maximum file size: 10MB</p>
                          </>
                        )}
                      </div>
                      {uploadError && (
                        <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {uploadError}
                        </p>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Error List */}
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
                      ? (error.error || error.name || error.message || error.error_type || JSON.stringify(error)) 
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
                <div className="flex items-center gap-3">
                  {(selectedRecordInfo?.status?.toLowerCase() === 'rework' || selectedRecordInfo?.status?.toLowerCase() === 'correction') && !(selectedRecordInfo?.reworkFilePath && selectedRecordInfo.reworkFilePath.trim()) && (
                    <button
                      onClick={handleSubmitRework}
                      disabled={!uploadedFile || submittingRework}
                      className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      {submittingRework ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Submit
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleCloseErrorListModal}
                    className="px-6 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentQCReport;
