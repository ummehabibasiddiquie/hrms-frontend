/**
 * File: QAAgentAudit.jsx
 * Author: Naitik Maisuriya
 * Description: QA Agent Audit component for Admin, Super Admin, Project Manager, and Assistant Manager
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import nodeApi from '../../services/nodeApi';
import api from '../../services/api';
import { exportToCSV } from '../../utils/csvExport';
import { 
  Download, 
  FileSpreadsheet, 
  Calendar as CalendarIcon, 
  ChevronDown,
  ChevronUp,
  UserCheck,
  Award,
  Search,
  Users,
  FileText,
  FileCheck,
  Plus,
  X,
  User,
  AlertCircle
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import ErrorMessage from '../common/ErrorMessage';
import { DateRangePicker } from '../common/CustomCalendar';
import MultiSelectWithCheckbox from '../common/MultiSelectWithCheckbox';

const QAAgentAudit = () => {
  const { user } = useAuth();

  console.log('[QAAgentAudit] Component rendered. User:', user);

  // Helper function to get QC score color classes
  const getQCScoreColorClass = (score) => {
    if (score === null || score === undefined || score === '-' || isNaN(Number(score))) return 'text-slate-700';
    const numScore = Number(score);
    if (numScore >= 95) return 'text-green-800 bg-green-100 font-bold';
    if (numScore >= 80) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  // Helper function to get audit status badge classes
  const getAuditStatusBadgeClass = (status) => {
    if (!status) return 'bg-slate-100 text-slate-700';
    const statusLower = status.toLowerCase();
    if (statusLower === 'approved' || statusLower === 'verified') return 'bg-green-100 text-green-800';
    if (statusLower === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (statusLower === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-700';
  };

  // Helper function to format date and time
  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === '-') return { date: '-', time: '-' };
    
    try {
      const date = new Date(dateTimeString);
      
      // Format date as "6/Mar/2026"
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      
      // Format time as "12:13 AM"
      const formattedTime = date.toLocaleString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
      
      return { date: formattedDate, time: formattedTime };
    } catch (_error) {
      return { date: '-', time: '-' };
    }
  };

  // Helper function to handle file download
  const handleFileDownload = (fileName, fileUrl) => {
    if (!fileName || !fileUrl) {
      toast.error('File not available for download');
      return;
    }
    
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank'; // Open in new tab if direct download fails
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Downloading ${fileName}...`);
    } catch (error) {
      console.error('[QAAgentAudit] File download error:', error);
      toast.error('Failed to download file');
    }
  };

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // State management
  const [activeTab, setActiveTab] = useState('audit_form'); // 'audit_form' or 'audit_report'
  const [dateRange, setDateRange] = useState({ start: '', end: '' }); // No default date since filter UI is removed
  const [auditData, setAuditData] = useState([]);
  const [reportData, setReportData] = useState([]); // Separate state for audit report
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedAgents, setExpandedAgents] = useState({}); // Track which QA agents are expanded
  const [searchQuery, setSearchQuery] = useState(''); // Search within QA agents
  
  // Individual agent filters - stores filters per agent
  const [agentFilters, setAgentFilters] = useState({}); // { qaAgentName: { agents: [], startDate: '', endDate: '' } }
  
  // Modal state for QC Score input
  const [showQCScoreModal, setShowQCScoreModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [qcScoreInput, setQcScoreInput] = useState('');
  const [qcCheckedFile, setQcCheckedFile] = useState(null);
  const [errorNotes, setErrorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal state for Error List viewing
  const [showErrorListModal, setShowErrorListModal] = useState(false);
  const [selectedErrorList, setSelectedErrorList] = useState([]);
  const [selectedRecordInfo, setSelectedRecordInfo] = useState(null);

  // Group audit data by QA Agent
  const groupedByQAAgent = React.useMemo(() => {
    const grouped = {};
    
    console.log('[QAAgentAudit] Grouping audit data. Total records:', auditData.length);
    console.log('[QAAgentAudit] Date range filter:', dateRange);
    console.log('[QAAgentAudit] Sample record:', auditData[0]);
    
    // Filter by date range if set
    let filteredData = auditData;
    if (dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      console.log('[QAAgentAudit] Filtering by date range:', startDate, 'to', endDate);
      filteredData = auditData.filter(record => {
        if (!record.audit_datetime && !record.timestamp) {
          console.log('[QAAgentAudit] Record missing datetime:', record);
          return false;
        }
        const recordDate = new Date(record.audit_datetime || record.timestamp);
        const matches = recordDate >= startDate && recordDate <= endDate;
        console.log(`[QAAgentAudit] Record date: ${recordDate.toISOString()}, Matches: ${matches}`);
        return matches;
      });
      console.log('[QAAgentAudit] After date filter:', filteredData.length, 'records');
    } else {
      console.log('[QAAgentAudit] No date filter applied, showing all records');
    }
    
    filteredData.forEach(record => {
      const qaName = record.qc_agent_name || 
                     record.qa_agent_name || 
                     record.qa_user_name || 
                     record.qa_name || 
                     record.qc_name || 
                     record.checked_by || 
                     'Unknown QA Agent';
      
      // Debug log to see what fields are available
      if (qaName === 'Unknown QA Agent') {
        console.log('[QAAgentAudit] Record with unknown QA agent:', {
          qc_agent_name: record.qc_agent_name,
          qa_agent_name: record.qa_agent_name,
          qa_user_name: record.qa_user_name,
          qa_name: record.qa_name,
          qc_name: record.qc_name,
          checked_by: record.checked_by,
          allKeys: Object.keys(record)
        });
      }
      
      if (!grouped[qaName]) {
        grouped[qaName] = {
          qaAgentName: qaName,
          qaAgentId: record.qc_agent_id || record.qa_agent_id || record.qa_user_id || qaName,
          records: [],
          totalQCs: 0,
          totalErrors: 0,
          avgScore: 0
        };
      }
      grouped[qaName].records.push(record);
      grouped[qaName].totalQCs += Number(record.total_qc_performed) || 0;
      grouped[qaName].totalErrors += (Array.isArray(record.error_list) ? record.error_list.length : 0);
    });
    
    // Calculate average scores
    Object.keys(grouped).forEach(qaName => {
      const records = grouped[qaName].records;
      if (records.length > 0) {
        const totalScore = records.reduce((sum, r) => sum + (Number(r.average_qc_score) || 0), 0);
        grouped[qaName].avgScore = (totalScore / records.length).toFixed(2);
      }
    });
    
    const result = Object.values(grouped);
    console.log('[QAAgentAudit] Grouped by QA Agent:', result.length, 'QA agents');
    console.log('[QAAgentAudit] Grouped data:', result);
    return result;
  }, [auditData, dateRange]);

  // Group report data by Agent
  const groupedReportData = React.useMemo(() => {
    const grouped = {};
    
    console.log('[QAAgentAudit] Grouping report data. Total records:', reportData.length);
    
    // Filter by date range if set
    let filteredData = reportData;
    if (dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      filteredData = reportData.filter(record => {
        if (!record.audit_datetime) return false;
        const recordDate = new Date(record.audit_datetime);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }
    
    filteredData.forEach(record => {
      const qaAgentKey = record.qc_agent_name || 
                         record.qa_agent_name || 
                         record.qa_user_name || 
                         record.qa_name || 
                         record.qc_name || 
                         record.checked_by || 
                         'Unknown QA Agent';
      
      // Debug log to see what fields are available
      if (qaAgentKey === 'Unknown QA Agent') {
        console.log('[QAAgentAudit] Report record with unknown QA agent:', {
          qc_agent_name: record.qc_agent_name,
          qa_agent_name: record.qa_agent_name,
          qa_user_name: record.qa_user_name,
          qa_name: record.qa_name,
          qc_name: record.qc_name,
          checked_by: record.checked_by,
          allKeys: Object.keys(record),
          fullRecord: record
        });
      }
      
      if (!grouped[qaAgentKey]) {
        grouped[qaAgentKey] = {
          qaAgentName: qaAgentKey,
          records: [],
          totalQCs: 0,
          totalErrors: 0,
          avgScore: 0
        };
      }
      grouped[qaAgentKey].records.push(record);
      grouped[qaAgentKey].totalQCs += Number(record.total_qc_performed) || 0;
      grouped[qaAgentKey].totalErrors += Number(record.total_errors_found) || 0;
    });
    
    // Calculate average scores
    Object.keys(grouped).forEach(qaAgentKey => {
      const records = grouped[qaAgentKey].records;
      if (records.length > 0) {
        const totalScore = records.reduce((sum, r) => sum + (Number(r.average_qc_score) || 0), 0);
        grouped[qaAgentKey].avgScore = (totalScore / records.length).toFixed(2);
      }
    });
    
    const result = Object.values(grouped);
    console.log('[QAAgentAudit] Grouped report data:', result.length, 'QA agents');
    return result;
  }, [reportData, dateRange]);

  // Filter grouped data by search query
  const filteredQAAgents = React.useMemo(() => {
    console.log('[QAAgentAudit] Filtering QA Agents...');
    console.log('[QAAgentAudit] Search query:', searchQuery);
    console.log('[QAAgentAudit] Grouped QA Agents before filter:', groupedByQAAgent.length);
    
    if (!searchQuery.trim()) {
      console.log('[QAAgentAudit] No search query, returning all grouped agents');
      return groupedByQAAgent;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = groupedByQAAgent.filter(qa =>
      qa.qaAgentName.toLowerCase().includes(query) ||
      qa.records.some(r =>
        (r.agent_name || '').toLowerCase().includes(query) ||
        (r.project_name || '').toLowerCase().includes(query) ||
        (r.task_name || '').toLowerCase().includes(query)
      )
    );
    console.log('[QAAgentAudit] Filtered QA Agents:', filtered.length);
    return filtered;
  }, [groupedByQAAgent, searchQuery]);

  // Filter report data by search query
  const filteredReportAgents = React.useMemo(() => {
    console.log('[QAAgentAudit] Filtering Report Agents...');
    
    if (!searchQuery.trim()) {
      return groupedReportData;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = groupedReportData.filter(agent =>
      agent.qaAgentName.toLowerCase().includes(query) ||
      agent.records.some(r =>
        (r.agent_name || '').toLowerCase().includes(query) ||
        (r.project_name || '').toLowerCase().includes(query) ||
        (r.task_name || '').toLowerCase().includes(query)
      )
    );
    console.log('[QAAgentAudit] Filtered Report Agents:', filtered.length);
    return filtered;
  }, [groupedReportData, searchQuery]);

  // Auto-expand all QA agents when data is loaded
  React.useEffect(() => {
    if (filteredQAAgents.length > 0) {
      const allExpanded = {};
      filteredQAAgents.forEach(qa => {
        allExpanded[qa.qaAgentName] = true;
      });
      setExpandedAgents(allExpanded);
      console.log('[QAAgentAudit] Auto-expanded all QA agents:', Object.keys(allExpanded));
    }
  }, [filteredQAAgents]);

  // Toggle QA Agent section
  const toggleAgent = (qaName) => {
    setExpandedAgents(prev => ({
      ...prev,
      [qaName]: !prev[qaName]
    }));
  };

  // Expand all or collapse all
  const expandAll = () => {
    const allExpanded = {};
    filteredQAAgents.forEach(qa => {
      allExpanded[qa.qaAgentName] = true;
    });
    setExpandedAgents(allExpanded);
  };

  const collapseAll = () => {
    setExpandedAgents({});
  };

  // Get filters for a specific agent
  const getAgentFilter = (qaAgentName) => {
    const todayDate = getTodayDate();
    return agentFilters[qaAgentName] || { agents: [], startDate: todayDate, endDate: todayDate };
  };

  // Update filters for a specific agent
  const updateAgentFilter = (qaAgentName, filterType, value) => {
    setAgentFilters(prev => ({
      ...prev,
      [qaAgentName]: {
        ...getAgentFilter(qaAgentName),
        [filterType]: value
      }
    }));
  };

  // Clear filters for a specific agent
  const clearAgentFilters = (qaAgentName) => {
    setAgentFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[qaAgentName];
      return newFilters;
    });
  };

  // Filter records for a specific QA agent based on individual filters
  const getFilteredRecords = (records, qaAgentName) => {
    const filter = getAgentFilter(qaAgentName);
    
    let filtered = [...records];
    
    // Filter by agents (agent_name)
    if (filter.agents && filter.agents.length > 0) {
      filtered = filtered.filter(record => 
        filter.agents.includes(record.agent_name)
      );
    }
    
    // Filter by date range
    if (filter.startDate || filter.endDate) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.timestamp || record.audit_datetime);
        
        // Set start date to beginning of day (00:00:00)
        const start = filter.startDate ? new Date(filter.startDate) : null;
        if (start) {
          start.setHours(0, 0, 0, 0);
        }
        
        // Set end date to end of day (23:59:59.999)
        const end = filter.endDate ? new Date(filter.endDate) : null;
        if (end) {
          end.setHours(23, 59, 59, 999);
        }
        
        if (start && recordDate < start) return false;
        if (end && recordDate > end) return false;
        return true;
      });
    }
    
    return filtered;
  };

  // Get unique agent names from records for a specific QA agent
  const getUniqueAgents = (records) => {
    const agents = [...new Set(records.map(r => r.agent_name).filter(Boolean))];
    return agents.map(agent => ({ value: agent, label: agent }));
  };

  // Handle QC Score Modal
  const handleOpenQCScoreModal = (record) => {
    setSelectedRecord(record);
    setQcScoreInput('');
    setQcCheckedFile(null);
    setErrorNotes('');
    setShowQCScoreModal(true);
  };

  const handleCloseQCScoreModal = () => {
    setShowQCScoreModal(false);
    setSelectedRecord(null);
    setQcScoreInput('');
    setQcCheckedFile(null);
    setErrorNotes('');
    setIsSubmitting(false);
  };

  const handleSubmitQCScore = async () => {
    if (!qcScoreInput || isNaN(Number(qcScoreInput))) {
      toast.error('Please enter a valid QC Score');
      return;
    }

    const score = Number(qcScoreInput);
    if (score < 0 || score > 100) {
      toast.error('QC Score must be between 0 and 100');
      return;
    }

    if (!selectedRecord || !selectedRecord.audit_id) {
      toast.error('No record selected');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create FormData
      const formData = new FormData();
      formData.append('qc_record_id', selectedRecord.audit_id);
      formData.append('qc_score', score);
      
      if (qcCheckedFile) {
        formData.append('qc_checked_file', qcCheckedFile);
      }
      
      if (errorNotes && errorNotes.trim()) {
        formData.append('error_notes', errorNotes.trim());
      }

      console.log('[QAAgentAudit] Submitting QC Score:', {
        qc_record_id: selectedRecord.audit_id,
        qc_score: score,
        has_file: !!qcCheckedFile,
        error_notes: errorNotes?.trim() || ''
      });

      // Submit to Python backend API
      const response = await api.post('/qc_audit/add', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('[QAAgentAudit] QC Score submission response:', response.data);

      // Check if submission was successful
      // Handle both response.data.success and response.status
      if (response.data.success || response.status === 200 || response.status === 201) {
        // Show success toast (green color)
        toast.success(`QC Score ${score}% submitted successfully!`, {
          duration: 3000,
          style: {
            background: '#10B981',
            color: '#fff',
            fontWeight: 'bold'
          },
          iconTheme: {
            primary: '#fff',
            secondary: '#10B981',
          }
        });
        
        // Close modal
        handleCloseQCScoreModal();
        
        // Refresh the audit data after a short delay to show the toast
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error(response.data.message || 'Failed to submit QC Score');
      }
    } catch (error) {
      console.error('[QAAgentAudit] Error submitting QC Score:', error);
      toast.error(error.response?.data?.message || 'Failed to submit QC Score');
    } finally {
      setIsSubmitting(false);
    }
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
      console.error('[QAAgentAudit] Error parsing error list:', e);
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

  // Get current date and time for modal display
  const getCurrentDateTime = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const year = now.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;
    
    const formattedTime = now.toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    return { date: formattedDate, time: formattedTime };
  };

  // Fetch audit form data
  useEffect(() => {
    if (activeTab !== 'audit_form') return;

    const fetchAuditData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('[QAAgentAudit] Fetching all QC audit data...');

        // Call the API endpoint - fetch all QC records
        const response = await nodeApi.get('/qc-records/list');

        console.log('[QAAgentAudit] API Response:', response.data);

        // Map API response to expected structure
        const apiData = response.data?.data || [];
        const mappedData = apiData.map(record => ({
          audit_id: record.id,
          audit_datetime: record.timestamp || record.date_of_file_submission,
          timestamp: record.timestamp || record.date_of_file_submission, // Keep original field
          qa_agent_name: record.qa_name,
          qa_agent_id: record.qc_user_id,
          agent_name: record.agent_name,
          project_name: record.project_name,
          task_name: record.task_name,
          file_name: record['10%_file_path'] ? record['10%_file_path'].split('/').pop() : (record.file_path ? record.file_path.split('/').pop() : 'N/A'),
          file_url: record['10%_file_path'] || record.file_path || '', // URL for downloading
          total_qc_performed: record['10%_data_generated_count'] || record.file_record_count || 0,
          '10%_data_generated_count': record['10%_data_generated_count'] || 0, // Keep original field
          '10%_qc_file_records': record['10%_data_generated_count'] || 0, // Alternative field name
          qc_score: record.qc_score ?? null, // Keep original field - preserve null if no score added
          average_qc_score: record.qc_score ?? null,
          error_score: record.error_score ?? null, // Keep original field - preserve null if no errors
          total_errors_found: record.error_score ?? null,
          status: record.status || 'Pending', // Keep original field
          audit_status: record.status || 'Pending',
          comments: '', // Not in API response, can be added later
          file_record_count: record.file_record_count || 0,
          // Store original file paths for download functionality
          file_path: record.file_path,
          qc_file_path: record['10%_file_path'],
          error_list: (() => {
            // Parse error_list if it's a JSON string, otherwise use as-is
            try {
              if (typeof record.error_list === 'string') {
                return JSON.parse(record.error_list);
              }
              return Array.isArray(record.error_list) ? record.error_list : [];
            } catch (e) {
              console.warn('[QAAgentAudit] Failed to parse error_list:', e);
              return [];
            }
          })(),
          tracker_id: record.tracker_id,
          project_id: record.project_id,
          task_id: record.task_id,
          // Audit-related fields (from QC audit submissions)
          qc_checked_file: record.qc_checked_file || null,
          error_notes: record.error_notes || null,
          audit_performed: !!(record.qc_checked_file || record.error_notes) // Boolean flag to check if audit was done
        }));

        setAuditData(mappedData);
        console.log('[QAAgentAudit] Mapped data:', mappedData);
        console.log('[QAAgentAudit] Total records fetched:', mappedData.length);

      } catch (err) {
        console.error('[QAAgentAudit] Error fetching audit data:', err);
        const msg = getFriendlyErrorMessage(err);
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    if (user?.user_id) {
      fetchAuditData();
    }
  }, [user, activeTab]);

  // Fetch audit report data
  useEffect(() => {
    if (activeTab !== 'audit_report') return;

    const fetchReportData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('[QAAgentAudit] Fetching QC audit report...');

        // Call the Python API endpoint with user_id
        const response = await api.post('/qc_audit/report', {
          logged_in_user_id: user?.user_id
        });

        console.log('[QAAgentAudit] Report API Response:', response.data);

        // Extract records from response
        const records = response.data?.data?.records || [];
        
        // Map API response to expected structure
        const mappedData = records.map(record => ({
          agent_name: record.agent_name,
          qc_agent_name: record.qc_agent_name,
          audit_datetime: record.audit_datetime,
          project_name: record.project,
          task_name: record.task,
          total_qc_performed: record.total_qcs,
          average_qc_score: parseFloat(record.avg_qc_score) || 0,
          total_errors_found: parseFloat(record.total_errors) || 0,
          qc_checked_file: record.qc_checked_file,
          qc_status: record.qc_status,
          audit_status: record.status,
          notes: record.error_notes,
          comments: record.error_notes
        }));

        console.log('[QAAgentAudit] Mapped report data:', mappedData);
        setReportData(mappedData);
      } catch (error) {
        console.error('[QAAgentAudit] Error fetching report data:', error);
        setError(getFriendlyErrorMessage(error.response?.data?.message || error.message || 'Failed to load audit report'));
      } finally {
        setLoading(false);
      }
    };

    if (user?.user_id) {
      fetchReportData();
    }
  }, [user, activeTab]);

  // Export to Excel - exports ALL user data regardless of filters
  const handleExportExcel = () => {
    try {
      // Use raw data (all records) for export, not filtered by UI filters
      const dataToExport = activeTab === 'audit_report' ? reportData : auditData;
      
      if (dataToExport.length === 0) {
        toast.error('No data to export');
        return;
      }

      let exportData;
      
      if (activeTab === 'audit_report') {
        // Export format for audit report - ALL users
        exportData = dataToExport.map(row => ({
          'Audit Date & Time': row.audit_datetime || '-',
          'Agent Name': row.agent_name || '-',
          'Project': row.project_name || '-',
          'Task': row.task_name || '-',
          'Total QCs': row.total_qc_performed || 0,
          'QC Score': row.average_qc_score != null ? `${row.average_qc_score}%` : '-',
          'QC Checked File': row.qc_checked_file || '-',
          'Status': row.audit_status || '-',
          'Error Notes': row.notes || '-'
        }));
        
        // Calculate summary for report
        const avgScore = dataToExport.reduce((sum, r) => sum + (Number(r.average_qc_score) || 0), 0) / dataToExport.length;
        const totalQCs = dataToExport.reduce((sum, r) => sum + (Number(r.total_qc_performed) || 0), 0);

        exportData.push({
          'Audit Date & Time': 'SUMMARY',
          'Agent Name': '',
          'Project': '',
          'Task': '',
          'Total QCs': totalQCs,
          'QC Score': `${avgScore.toFixed(2)}%`,
          'QC Checked File': '',
          'Status': '',
          'Error Notes': ''
        });
      } else {
        // Export format for audit form - ALL QA agents and users
        exportData = dataToExport.map(row => ({
          'Audit Date & Time': row.audit_datetime || '-',
          'QA Agent': row.qa_agent_name || '-',
          'Agent Name': row.agent_name || '-',
          'Project': row.project_name || '-',
          'Task': row.task_name || '-',
          'File': row.file_name || '-',
          'Total QCs': row.total_qc_performed || 0,
          'QC Score': row.average_qc_score != null ? `${row.average_qc_score}%` : '-',
          'Status': row.audit_status || '-'
        }));

        // Calculate summary for audit form
        const avgScore = dataToExport.reduce((sum, r) => sum + (Number(r.average_qc_score) || 0), 0) / dataToExport.length;
        const totalQCs = dataToExport.reduce((sum, r) => sum + (Number(r.total_qc_performed) || 0), 0);

        exportData.push({
          'Audit Date & Time': 'SUMMARY',
          'QA Agent': '',
          'Agent Name': '',
          'Project': '',
          'Task': '',
          'File': '',
          'Total QCs': totalQCs,
          'QC Score': `${avgScore.toFixed(2)}%`,
          'Status': ''
        });
      }

      // Generate filename with current timestamp
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `QA_Agent_Audit_All_Users_${timestamp}.csv`;
      
      exportToCSV(exportData, filename);
      toast.success(`Exported ${dataToExport.length} records for all users!`);
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight cursor-default">QA Agent Audit</h2>
              <p className="text-slate-600 text-sm font-medium mt-1 cursor-default">Monitor and review QA Agent performance and quality checking activities</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-2xl shadow-lg mb-6 border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('audit_form')}
              className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                activeTab === 'audit_form'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                <span>QA Agent Audit Form</span>
              </div>
              {activeTab === 'audit_form' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('audit_report')}
              className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                activeTab === 'audit_report'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileCheck className="w-4 h-4" />
                <span>QA Agent Audit Report</span>
              </div>
              {activeTab === 'audit_report' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'audit_form' && (
          <>
      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* Search Input */}
          <div className="flex-1 lg:flex-none lg:w-80">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-2">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              Search QA Agents
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by QA agent name..."
              className="w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grouped QA Agent Audit Report */}
      <div className="space-y-4">
        {(() => {
          console.log('[QAAgentAudit] ========== RENDER CHECK ==========');
          console.log('[QAAgentAudit] Render - Loading:', loading);
          console.log('[QAAgentAudit] Render - Error:', error);
          console.log('[QAAgentAudit] Render - Filtered QA Agents:', filteredQAAgents);
          console.log('[QAAgentAudit] Render - Filtered QA Agents Length:', filteredQAAgents.length);
          console.log('[QAAgentAudit] Render - Search Query:', searchQuery);
          return null;
        })()}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md border border-blue-100 py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
            <p className="text-blue-700 font-semibold">Loading QA Agent Audit data...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6">
            <ErrorMessage message={error} />
          </div>
        ) : filteredQAAgents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-400 font-medium text-lg">No QA agents found</p>
            <p className="text-gray-400 text-sm mt-2">
              {searchQuery ? 'Try adjusting your search query' : 'No audit data available for this period'}
            </p>
          </div>
        ) : (
          filteredQAAgents.map(({ qaAgentName, records }) => {
            const isExpanded = expandedAgents[qaAgentName];
            const filteredRecords = getFilteredRecords(records, qaAgentName);
            const agentFilter = getAgentFilter(qaAgentName);
            const uniqueAgents = getUniqueAgents(records);
            
            // Calculate statistics for this QA agent
            const totalRecords = records.length;
            const totalQCs = records.reduce((sum, r) => sum + (Number(r.total_qc_performed) || Number(r['10%_qc_file_records']) || Number(r['10%_data_generated_count']) || 0), 0);
            const avgScore = records.length > 0
              ? (records.reduce((sum, r) => sum + (Number(r.qc_score) || Number(r.average_qc_score) || 0), 0) / records.length)
              : 0;
            const totalErrors = records.reduce((sum, r) => sum + (Array.isArray(r.error_list) ? r.error_list.length : 0), 0);

            return (
              <div key={qaAgentName} className="bg-white rounded-xl shadow-lg border-2 border-blue-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* QA Agent Header Card */}
                <div 
                  className="bg-gradient-to-br from-blue-50 via-white to-blue-50 border-b-2 border-blue-200 p-6"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Avatar with clean design */}
                      <div className="relative flex-shrink-0">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shadow-md border-2 border-blue-200">
                          {qaAgentName ? qaAgentName.charAt(0).toUpperCase() : '?'}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                            {qaAgentName}
                          </h3>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-md">
                            <FileCheck className="w-3.5 h-3.5" />
                            {totalRecords} {totalRecords === 1 ? 'Record' : 'Records'}
                          </span>
                        </div>
                        
                        {/* Statistics Row */}
                        <div className="flex items-center gap-6 mt-3">
                          {/* Total QCs */}
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Award className="w-4 h-4 text-blue-700" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Total QC Records</p>
                              <p className="text-lg font-bold text-blue-700">{totalQCs}</p>
                            </div>
                          </div>
                          
                          {/* Average Score */}
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${
                              avgScore >= 95 ? 'bg-green-100' : avgScore >= 80 ? 'bg-yellow-100' : 'bg-red-100'
                            }`}>
                              <UserCheck className={`w-4 h-4 ${
                                avgScore >= 95 ? 'text-green-700' : avgScore >= 80 ? 'text-yellow-700' : 'text-red-700'
                              }`} />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Avg Score</p>
                              <p className={`text-lg font-bold ${
                                avgScore >= 95 ? 'text-green-700' : avgScore >= 80 ? 'text-yellow-700' : 'text-red-700'
                              }`}>
                                {avgScore.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        className="p-3 rounded-xl bg-blue-100 hover:bg-blue-200 transition-all duration-150 shadow-md hover:shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAgent(qaAgentName);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-blue-700" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-blue-700" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Individual Agent Filters */}
                  {isExpanded && (
                    <div className="mt-6 pt-5 border-t-2 border-blue-100">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Agent Name Filter */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-2">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            Filter by Agent Name
                          </label>
                          <MultiSelectWithCheckbox
                            value={agentFilter.agents}
                            onChange={(value) => updateAgentFilter(qaAgentName, 'agents', value)}
                            options={uniqueAgents}
                            icon={User}
                            placeholder="All Agents"
                            showSelectAll={true}
                          />
                        </div>

                        {/* Date Range Filter */}
                        <div className="lg:col-span-2">
                          <DateRangePicker
                            startDate={agentFilter.startDate}
                            endDate={agentFilter.endDate}
                            onStartDateChange={(date) => updateAgentFilter(qaAgentName, 'startDate', date)}
                            onEndDateChange={(date) => updateAgentFilter(qaAgentName, 'endDate', date)}
                            onClear={() => clearAgentFilters(qaAgentName)}
                            label=""
                            description=""
                            showClearButton={true}
                            noWrapper={true}
                            fieldWidth="200px"
                          />
                        </div>
                      </div>
                      
                      {/* Filter Summary */}
                      {(agentFilter.agents.length > 0 || agentFilter.startDate || agentFilter.endDate) && (
                        <div className="mt-4 flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700">Active Filters:</span>
                          {agentFilter.agents.length > 0 && (
                            <span className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold shadow-sm">
                              Agents: {agentFilter.agents.length}
                            </span>
                          )}
                          {(agentFilter.startDate || agentFilter.endDate) && (
                            <span className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold shadow-sm">
                              Date Range Applied
                            </span>
                          )}
                          <span className="font-bold text-slate-700 ml-2">
                            Showing <span className="text-blue-700">{filteredRecords.length}</span> of <span className="text-slate-500">{records.length}</span> records
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Audit Records Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-blue-100">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Agent Name</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Project Name</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Task Name</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">QC File</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">File Record Count</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">10% QC Record Count</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Error Score</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Error List</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">QC Score</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Date and Time</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-50">
                        {filteredRecords.length === 0 ? (
                          <tr>
                            <td colSpan="12" className="px-6 py-12 text-center">
                              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="w-10 h-10 text-slate-400" />
                              </div>
                              <p className="text-slate-700 font-bold text-lg mb-2">No Data Found</p>
                              <p className="text-slate-500 text-sm">No records available for the selected date range.</p>
                              <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or selecting a different date range.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredRecords.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors duration-150">
                            <td className="px-6 py-4 text-gray-900 font-medium">{row.agent_name || '-'}</td>
                            <td className="px-6 py-4 text-gray-900">{row.project_name || '-'}</td>
                            <td className="px-6 py-4 text-gray-900">{row.task_name || '-'}</td>
                            <td className="px-6 py-4 text-center">
                              {row.file_name && row.file_name !== '-' ? (
                                <a
                                  href={row.file_url || '#'}
                                  download={row.file_name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-bold transition-colors group/link"
                                >
                                  <Download className="w-4 h-4 group-hover/link:animate-bounce" aria-hidden="true" />
                                  Download
                                </a>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-semibold text-slate-700">
                                {row.file_record_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-semibold text-blue-600">
                                {row['10%_qc_file_records'] || row['10%_data_generated_count'] || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-semibold text-red-600">
                                {Array.isArray(row.error_list) ? row.error_list.length : 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handleOpenErrorListModal(row.error_list, {
                                  agent_name: row.agent_name,
                                  project_name: row.project_name,
                                  task_name: row.task_name,
                                  qc_score: row.qc_score,
                                  error_score: row.error_score,
                                  timestamp: row.timestamp
                                })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-100 border border-slate-200 hover:border-blue-300 rounded-lg text-slate-700 hover:text-blue-700 text-xs font-bold transition-all"
                              >
                                <FileSpreadsheet className="w-3 h-3" />
                                View {row.error_list && row.error_list.length > 0 && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
                                    {row.error_list.length}
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 rounded-lg font-semibold text-sm inline-block ${getAuditStatusBadgeClass(row.status || row.audit_status)}`}>
                                {row.status || row.audit_status || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 rounded-lg inline-block ${getQCScoreColorClass(row.qc_score || row.average_qc_score)}`}>
                                {row.qc_score != null ? `${Number(row.qc_score).toFixed(2)}%` : (row.average_qc_score != null ? `${Number(row.average_qc_score).toFixed(2)}%` : '-')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">{formatDateTime(row.timestamp || row.audit_datetime).date}</span>
                                <span className="text-xs text-gray-600">{formatDateTime(row.timestamp || row.audit_datetime).time}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {!row.audit_performed ? (
                                <button
                                  onClick={() => handleOpenQCScoreModal(row)}
                                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white rounded-lg font-bold text-sm shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Score
                                </button>
                              ) : (
                                <span className="text-sm text-slate-500 font-medium">Score Added</span>
                              )}
                            </td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
          </>
        )}

        {activeTab === 'audit_report' && (
          <>
      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* Search Input */}
          <div className="flex-1 lg:flex-none lg:w-80">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-2">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              Search QA Agents
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by QA agent name..."
              className="w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>
          
          {/* Export Button */}
          <div className="flex items-end ml-auto">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Grouped QA Agent Audit Report */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl shadow-md border border-blue-100 py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
            <p className="text-blue-700 font-semibold">Loading QA Agent Audit data...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6">
            <ErrorMessage message={error} />
          </div>
        ) : filteredReportAgents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-400 font-medium text-lg">No QA agents found</p>
            <p className="text-gray-400 text-sm mt-2">
              {searchQuery ? 'Try adjusting your search query' : 'No audit data available for this period'}
            </p>
          </div>
        ) : (
          filteredReportAgents.map(({ qaAgentName, records }) => {
            const isExpanded = expandedAgents[qaAgentName];
            const filteredRecords = getFilteredRecords(records, qaAgentName);
            const agentFilter = getAgentFilter(qaAgentName);
            const uniqueAgents = getUniqueAgents(records);
            
            // Calculate statistics for this QA agent
            const totalRecords = records.length;
            const totalQCs = records.reduce((sum, r) => sum + (Number(r.total_qc_performed) || Number(r['10%_qc_file_records']) || Number(r['10%_data_generated_count']) || 0), 0);
            const avgScore = records.length > 0
              ? (records.reduce((sum, r) => sum + (Number(r.qc_score) || Number(r.average_qc_score) || 0), 0) / records.length)
              : 0;
            const totalErrors = records.reduce((sum, r) => sum + (Array.isArray(r.error_list) ? r.error_list.length : 0), 0);

            return (
              <div key={qaAgentName} className="bg-white rounded-xl shadow-lg border-2 border-blue-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* QA Agent Header Card */}
                <div 
                  className="bg-gradient-to-br from-blue-50 via-white to-blue-50 border-b-2 border-blue-200 p-6"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Avatar with clean design */}
                      <div className="relative flex-shrink-0">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shadow-md border-2 border-blue-200">
                          {qaAgentName ? qaAgentName.charAt(0).toUpperCase() : '?'}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                            {qaAgentName}
                          </h3>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-md">
                            <FileCheck className="w-3.5 h-3.5" />
                            {totalRecords} {totalRecords === 1 ? 'Record' : 'Records'}
                          </span>
                        </div>
                        
                        {/* Statistics Row */}
                        <div className="flex items-center gap-6 mt-3">
                          {/* Total QCs */}
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Award className="w-4 h-4 text-blue-700" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Total QC Records</p>
                              <p className="text-lg font-bold text-blue-700">{totalQCs}</p>
                            </div>
                          </div>
                          
                          {/* Average Score */}
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${
                              avgScore >= 95 ? 'bg-green-100' : avgScore >= 80 ? 'bg-yellow-100' : 'bg-red-100'
                            }`}>
                              <UserCheck className={`w-4 h-4 ${
                                avgScore >= 95 ? 'text-green-700' : avgScore >= 80 ? 'text-yellow-700' : 'text-red-700'
                              }`} />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Avg Score</p>
                              <p className={`text-lg font-bold ${
                                avgScore >= 95 ? 'text-green-700' : avgScore >= 80 ? 'text-yellow-700' : 'text-red-700'
                              }`}>
                                {avgScore.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Expand/Collapse Button */}
                      <button
                        className="p-3 rounded-xl bg-blue-100 hover:bg-blue-200 transition-all duration-150 shadow-md hover:shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAgent(qaAgentName);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-blue-700" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-blue-700" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Individual Agent Filters */}
                  {isExpanded && (
                    <div className="mt-6 pt-5 border-t-2 border-blue-100">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Agent Name Filter */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-2">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            Filter by Agent Name
                          </label>
                          <MultiSelectWithCheckbox
                            value={agentFilter.agents}
                            onChange={(value) => updateAgentFilter(qaAgentName, 'agents', value)}
                            options={uniqueAgents}
                            icon={User}
                            placeholder="All Agents"
                            showSelectAll={true}
                          />
                        </div>

                        {/* Date Range Filter */}
                        <div className="lg:col-span-2">
                          <DateRangePicker
                            startDate={agentFilter.startDate}
                            endDate={agentFilter.endDate}
                            onStartDateChange={(date) => updateAgentFilter(qaAgentName, 'startDate', date)}
                            onEndDateChange={(date) => updateAgentFilter(qaAgentName, 'endDate', date)}
                            onClear={() => clearAgentFilters(qaAgentName)}
                            label=""
                            description=""
                            showClearButton={true}
                            noWrapper={true}
                            fieldWidth="200px"
                          />
                        </div>
                      </div>
                      
                      {/* Filter Summary */}
                      {(agentFilter.agents.length > 0 || agentFilter.startDate || agentFilter.endDate) && (
                        <div className="mt-4 flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700">Active Filters:</span>
                          {agentFilter.agents.length > 0 && (
                            <span className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold shadow-sm">
                              Agents: {agentFilter.agents.length}
                            </span>
                          )}
                          {(agentFilter.startDate || agentFilter.endDate) && (
                            <span className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold shadow-sm">
                              Date Range Applied
                            </span>
                          )}
                          <span className="font-bold text-slate-700 ml-2">
                            Showing <span className="text-blue-700">{filteredRecords.length}</span> of <span className="text-slate-500">{records.length}</span> records
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Audit Records Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-blue-100">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Audit Date & Time</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Agent Name</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Project</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Task</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Total QCs</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">QC Score</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">QC Checked File</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Error Notes</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-50">
                        {filteredRecords.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="px-6 py-12 text-center">
                              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="w-10 h-10 text-slate-400" />
                              </div>
                              <p className="text-slate-700 font-bold text-lg mb-2">No Data Found</p>
                              <p className="text-slate-500 text-sm">No records available for the selected date range.</p>
                              <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or selecting a different date range.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredRecords.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors duration-150">
                            <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">{formatDateTime(row.timestamp || row.audit_datetime).date}</span>
                                <span className="text-xs text-gray-600">{formatDateTime(row.timestamp || row.audit_datetime).time}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-900">{row.agent_name || '-'}</td>
                            <td className="px-6 py-4 text-gray-900">{row.project_name || '-'}</td>
                            <td className="px-6 py-4 text-gray-900">{row.task_name || '-'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-semibold text-blue-600">
                                {row.total_qc_performed || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 rounded-lg inline-block ${getQCScoreColorClass(row.average_qc_score)}`}>
                                {row.average_qc_score != null ? `${Number(row.average_qc_score).toFixed(2)}%` : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {row.qc_checked_file && row.qc_checked_file !== '-' ? (
                                <a 
                                  href={row.qc_checked_file}
                                  download={row.qc_checked_file.split('/').pop()}
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
                              <span className={`px-3 py-1 rounded-lg font-semibold text-sm inline-block ${getAuditStatusBadgeClass(row.audit_status)}`}>
                                {row.audit_status || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-600 text-sm">{row.notes || '-'}</td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
          </>
        )}
      </div>

      {/* QC Score Modal */}
      {showQCScoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-blue-50/30 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border-2 border-blue-300 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">Add QC Score</h2>
                  {selectedRecord && (
                    <div className="mt-2 space-y-1">
                      <p className="text-blue-100 text-sm">
                        <span className="font-semibold">Agent:</span> {selectedRecord.agent_name}
                      </p>
                      <p className="text-blue-100 text-sm">
                        <span className="font-semibold">Project:</span> {selectedRecord.project_name} | {selectedRecord.task_name}
                      </p>
                    </div>
                  )}
                  {/* Current Date and Time */}
                  <div className="mt-3 flex items-center gap-4 text-blue-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span className="font-semibold">{getCurrentDateTime().date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2"/>
                      </svg>
                      <span className="font-semibold">{getCurrentDateTime().time}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCloseQCScoreModal}
                  className="p-2 hover:bg-blue-500 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* QC Score */}
              <div className="mb-5">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase mb-2">
                  <Award className="w-4 h-4 text-blue-600" />
                  QC Score (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={qcScoreInput}
                  onChange={(e) => setQcScoreInput(e.target.value)}
                  placeholder="Enter QC Score (0-100)"
                  className="w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-4 py-3 text-lg font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Score must be between 0 and 100
                </p>
              </div>

              {/* QC Checked File */}
              <div className="mb-5">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase mb-2">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  QC Checked File
                </label>
                <input
                  type="file"
                  onChange={(e) => setQcCheckedFile(e.target.files[0] || null)}
                  accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                  className="w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-4 py-3 text-base font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                />
                {qcCheckedFile && (
                  <p className="text-xs text-slate-600 mt-2 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-green-600" />
                    <span className="font-medium">{qcCheckedFile.name}</span>
                    <span className="text-slate-400">({(qcCheckedFile.size / 1024).toFixed(2)} KB)</span>
                  </p>
                )}
              </div>

              {/* Error Notes */}
              <div className="mb-6">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase mb-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Error Notes
                </label>
                <textarea
                  value={errorNotes}
                  onChange={(e) => setErrorNotes(e.target.value)}
                  placeholder="Enter Error Notes (Optional)"
                  rows="3"
                  className="w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-4 py-3 text-base font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCloseQCScoreModal}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all border-2 border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitQCScore}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Score'
                  )}
                </button>
              </div>
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
                      {selectedRecordInfo.agent_name} • {selectedRecordInfo.project_name}
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
      )}
    </div>
  );
};

export default QAAgentAudit;
