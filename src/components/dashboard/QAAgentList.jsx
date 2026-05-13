/**
 * File: QAAgentList.jsx
 * Author: Naitik Maisuriya
 * Description: QA Agent List - Shows assigned agents with their tracker data (files only)
 */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Download, FileText, FileCheck, Users as UsersIcon, Search, X, RotateCcw, Check, Loader2, RefreshCw, AlertTriangle, XCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import nodeApi from "../../services/nodeApi";
import { fetchProjectCategoryAFD, generateQCSample } from "../../services/qcService";
import { useAuth } from "../../context/AuthContext";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { log, logError } from "../../config/environment";

import QAAgentQCFormReport from "./QAAgentQCFormReport";
import QAAgentReworkCorrectionReview from "./QAAgentReworkCorrectionReview";
import { DateRangePicker } from '../common/CustomCalendar';

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Pending QC Files Table Component
const PendingQCFilesTable = ({ trackers, handleQCForm, qcFormLoading, handleSaveStatus, savingStatus, correctionStatus, setCorrectionStatus, user, selectedAgentId, agentDateFilters, getTodayDate, fetchReworkTrackers }) => {
  const [errorModal, setErrorModal] = useState({ open: false, errors: [], title: '' });

  const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    // Parse the date string format: "Fri, 03 Apr 2026 11:10:33 GMT"
    // Extract date and time directly without timezone conversion
    const match = dateString.match(/(\d{2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hours, minutes] = match;
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${parseInt(day, 10).toString().padStart(2, '0')} ${month} ${year}, ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm.toLowerCase()}`;
    }
    // Fallback for unexpected format - use UTC to avoid timezone conversion
    const date = new Date(dateString);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    const hour12 = hours % 12 || 12;
    return `${day} ${month} ${year}, ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const getScoreClass = (score) => {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score === 100) return 'text-green-600 font-bold';
    if (score >= 95) return 'text-yellow-600 font-bold';
    return 'text-red-600 font-bold';
  };

  const parseErrors = (errors) => {
    if (!errors) return [];
    if (typeof errors === 'string') {
      try { return JSON.parse(errors); } catch { return []; }
    }
    return Array.isArray(errors) ? errors : [];
  };

  const openErrorModal = (errors, title) => {
    setErrorModal({ open: true, errors: parseErrors(errors), title });
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

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Project / Task</th>
              <th className="px-4 py-3 text-left font-semibold">Submitted Date & Time</th>
              <th className="px-4 py-3 text-center font-semibold">Attempt</th>
              <th className="px-4 py-3 text-center font-semibold">Previous Score</th>
              <th className="px-4 py-3 text-center font-semibold">Previous Errors</th>
              <th className="px-4 py-3 text-center font-semibold">File</th>
              <th className="px-4 py-3 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trackers.map((tracker, index) => {
              const errors = parseErrors(tracker.previous_error_list);
              const trackerId = tracker.qc_record_id || tracker.id || `tracker-${index}`;
              return (
                <tr key={trackerId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {getTypeBadge(tracker.type)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{tracker.project_name || '—'}</p>
                      <p className="text-xs text-slate-500">{tracker.task_name || '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(tracker.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">
                      {tracker.attempt || '—'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-center ${getScoreClass(tracker.previous_qc_score)}`}>
                    {tracker.previous_qc_score !== null && tracker.previous_qc_score !== undefined ? `${tracker.previous_qc_score}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {errors.length > 0 ? (
                      <button
                        onClick={() => openErrorModal(tracker.previous_error_list, `Previous Errors - ${tracker.type === 'rework' ? 'Rework' : 'Correction'} #${tracker.attempt}`)}
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
                    {tracker.file_path ? (
                      <a
                        href={tracker.file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
                        title="Download File"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tracker.type === 'rework' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQCForm(tracker);
                        }}
                        disabled={qcFormLoading === trackerId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white text-xs font-semibold transition-colors"
                      >
                        {qcFormLoading === trackerId ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading
                          </>
                        ) : (
                          <>
                            <FileCheck className="w-3 h-3" />
                            QC Form
                          </>
                        )}
                      </button>
                    ) : tracker.type === 'correction' ? (
                      <div className="flex flex-col items-center gap-2">
                        <select
                          value={correctionStatus[trackerId] || ''}
                          onChange={e => {
                            setCorrectionStatus(prev => ({ ...prev, [trackerId]: e.target.value }));
                          }}
                          disabled={savingStatus[trackerId]}
                          required
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${correctionStatus[trackerId] === undefined || correctionStatus[trackerId] === '' ? 'bg-slate-100 text-slate-500 border-slate-300' : correctionStatus[trackerId] === 'completed' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'} ${savingStatus[trackerId] ? 'opacity-60 cursor-not-allowed' : ''}`}
                          style={{ minWidth: 120 }}
                        >
                          <option value="" disabled>Select status</option>
                          <option value="completed">Completed</option>
                          <option value="correction">Correction</option>
                        </select>
                        {correctionStatus[trackerId] && (
                          <button
                            className="mt-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center gap-1"
                            onClick={() => handleSaveStatus(tracker, trackerId)}
                            disabled={savingStatus[trackerId]}
                          >
                            {savingStatus[trackerId] ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Status'
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                        {err.row && <span className="px-2 py-0.5 bg-rose-400 text-white text-xs font-semibold rounded">Row {err.row}</span>}
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
    </>
  );
};

const QAAgentList = () => {
  const { user } = useAuth();
  const { device_id, device_type } = useDeviceInfo();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [qcFormLoading, setQcFormLoading] = useState(null); // Track specific tracker_id that's loading
  const [agentTrackers, setAgentTrackers] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  
  // Tab state - read from URL parameter if available
  const subtabParam = searchParams.get('subtab');
  const [activeTab, setActiveTab] = useState(
    subtabParam === 'qc_report' ? 'qc_report' :
    subtabParam === 'rework_review' ? 'rework_review' :
    'agent_files'
  );
  
  // Selected agent for split view
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  
  // Per-agent date filter states
  const [agentDateFilters, setAgentDateFilters] = useState({});

  // Project/task name mapping state
  const [projectNameMap, setProjectNameMap] = useState({});
  const [taskNameMap, setTaskNameMap] = useState({});

  // Local state for correction status selection per tracker
  const [correctionStatus, setCorrectionStatus] = useState({});
  const [savingStatus, setSavingStatus] = useState({});


  // Fetch project/task mapping, then tracker data
  useEffect(() => {
    const fetchAllData = async () => {
      if (!user?.user_id) return;
      setLoading(true);
      try {
        // 1. Fetch mapping
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

        // 2. Fetch ALL tracker data (no date filter) to get all agents assigned to this QA
        const allTrackersRes = await api.post("/tracker/view", {
          logged_in_user_id: user?.user_id,
          device_id: device_id,
          device_type: device_type,
          qc_pending: 0  // Fetch only QC pending trackers
        });
        const allTrackerData = allTrackersRes.data?.data || {};
        const allTrackers = allTrackerData.trackers || [];
        let myTrackers = allTrackers;
        if (myTrackers.some(t => t.qa_agent_id !== undefined)) {
          myTrackers = myTrackers.filter(t => String(t.qa_agent_id) === String(user?.user_id));
        }
        
        // Build agents list from ALL tracker data (to get all agents ever assigned)
        const agentsMap = {};
        myTrackers.forEach(tracker => {
          if (!agentsMap[String(tracker.user_id)]) {
            agentsMap[String(tracker.user_id)] = {
              user_id: tracker.user_id,
              user_name: tracker.user_name || '-',
            };
          }
        });
        
        // Also fetch pending QC files to get agents with rework/correction files
        try {
          const pendingQCRes = await api.post('/qc_rework/view_pending_qc_files', {});
          const pendingRecords = pendingQCRes.data?.data?.record || [];
          
          // Add agents from pending QC files to agents map
          pendingRecords.forEach(record => {
            const agentName = record.agent_name;
            // Try to find matching agent by name
            const existingAgent = Object.values(agentsMap).find(a => a.user_name === agentName);
            if (!existingAgent && agentName) {
              // Create a new agent entry with name only (we'll use name for matching later)
              const tempId = `temp_${agentName.replace(/\s+/g, '_')}`;
              agentsMap[tempId] = {
                user_id: tempId,
                user_name: agentName,
              };
            }
          });
        } catch (err) {
          logError('[QAAgentList] Error fetching pending QC files for agents:', err);
          // Continue without pending QC agents
        }
        
        const allAgents = Object.values(agentsMap);
        
        // 3. Fetch today's tracker data to get initial file counts
        const today = getTodayDate();
        const todayTrackersRes = await api.post("/tracker/view", {
          logged_in_user_id: user?.user_id,
          device_id: device_id,
          device_type: device_type,
          date_from: today,
          date_to: today,
          qc_pending: 0  // Fetch only QC pending trackers
        });
        const todayTrackerData = todayTrackersRes.data?.data || {};
        const todayTrackers = todayTrackerData.trackers || [];
        let myTodayTrackers = todayTrackers;
        if (myTodayTrackers.some(t => t.qa_agent_id !== undefined)) {
          myTodayTrackers = myTodayTrackers.filter(t => String(t.qa_agent_id) === String(user?.user_id));
        }
        
        // Build initial trackers by agent for today (for file counts)
        const initialTrackersByAgent = {};
        allAgents.forEach(agent => {
          initialTrackersByAgent[agent.user_id] = myTodayTrackers
            .filter(t => String(t.user_id) === String(agent.user_id) && t.tracker_file)
            .map(tracker => ({
              ...tracker,
              user_name: tracker.user_name || agent.user_name || '-',
              project_name: tracker.project_name || pMap[String(tracker.project_id)] || '-',
              task_name: tracker.task_name || tMap[String(tracker.task_id)] || '-',
            }));
        });
        
        setAgents(allAgents);
        setAgentTrackers(initialTrackersByAgent);
        
        // Initialize date filters for all agents to today's date
        const initialDateFilters = {};
        allAgents.forEach(agent => {
          initialDateFilters[agent.user_id] = { startDate: today, endDate: today };
        });
        setAgentDateFilters(initialDateFilters);
        
        // Auto-select first agent if available
        if (allAgents.length > 0) {
          setSelectedAgentId(allAgents[0].user_id);
        }
        
        log('[QAAgentList] Agents loaded:', allAgents.length);
      } catch (err) {
        logError('[QAAgentList] Error fetching agent list data:', err);
        toast.error("Failed to load agent data");
        setAgents([]);
        setAgentTrackers({});
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [user?.user_id, device_id, device_type]);

  // Re-fetch data when tab changes and agent is selected
  useEffect(() => {
    if (selectedAgentId && (activeTab === 'agent_files' || activeTab === 'agent_rework_files' || activeTab === 'rework_review')) {
      if (activeTab === 'agent_rework_files' || activeTab === 'rework_review') {
        // Fetch with date filter or default to today
        const filters = agentDateFilters[selectedAgentId] || { startDate: getTodayDate(), endDate: getTodayDate() };
        fetchReworkTrackers(selectedAgentId, filters.startDate, filters.endDate);
      } else {
        fetchAgentTrackers(selectedAgentId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Initialize correction status when trackers change
  useEffect(() => {
    if (activeTab === 'rework_review' && selectedAgentId) {
      const trackers = agentTrackers[selectedAgentId] || [];
      const initial = {};
      trackers.forEach((tracker, idx) => {
        if (tracker.type === 'correction') {
          const trackerId = tracker.qc_record_id || tracker.id || `tracker-${idx}`;
          initial[trackerId] = '';
        }
      });
      setCorrectionStatus(initial);
    }
  }, [agentTrackers, selectedAgentId, activeTab]);

  // Fetch tracker data for specific agent with date range
  const fetchAgentTrackers = async (agentId, startDate = null, endDate = null) => {
    setAgentLoading(true);
    try {
      // Use provided dates or fall back to state/today's date
      const filters = startDate && endDate 
        ? { startDate, endDate }
        : (agentDateFilters[agentId] || { startDate: getTodayDate(), endDate: getTodayDate() });
      
      log('[QAAgentList] Fetching trackers for agent:', agentId, 'with dates:', filters);
      
      const trackerRes = await api.post("/tracker/view", {
        logged_in_user_id: user?.user_id,
        device_id: device_id,
        device_type: device_type,
        date_from: filters.startDate,
        date_to: filters.endDate,
        qc_pending: 0  // Fetch only QC pending trackers
      });

      const trackerData = trackerRes.data?.data || {};
      const allTrackers = trackerData.trackers || [];
      
      // Filter for trackers assigned to logged-in QA
      let myTrackers = allTrackers;
      if (myTrackers.some(t => t.qa_agent_id !== undefined)) {
        myTrackers = myTrackers.filter(t => String(t.qa_agent_id) === String(user?.user_id));
      }
      
      // Filter for this specific agent and only trackers with files
      const agentSpecificTrackers = myTrackers
        .filter((tracker) => String(tracker.user_id) === String(agentId) && tracker.tracker_file)
        .map(tracker => ({
          ...tracker,
          project_name: tracker.project_name || projectNameMap[String(tracker.project_id)] || '-',
          task_name: tracker.task_name || taskNameMap[String(tracker.task_id)] || '-',
        }));
      
      log('[QAAgentList] Found trackers for agent:', agentSpecificTrackers.length);
      
      setAgentTrackers(prev => ({
        ...prev,
        [agentId]: agentSpecificTrackers
      }));
    } catch (error) {
      logError("[QAAgentList] Error fetching agent trackers:", error);
      toast.error("Failed to fetch tracker data");
    } finally {
      setAgentLoading(false);
    }
  };

  // Fetch pending QC files data (rework & correction) for specific agent
  const fetchReworkTrackers = async (agentId, startDate = null, endDate = null) => {
    setAgentLoading(true);
    try {
      log('[QAAgentList] Fetching pending QC files for agent:', agentId);
      
      // Call new API endpoint
      const response = await api.post('/qc_rework/view_pending_qc_files', {});
      
      const records = response.data?.data?.record || [];
      
      // Log the first record to see structure
      if (records.length > 0) {
        console.group('[QAAgentList] 🔍 API Response Analysis');
        console.log('Sample API record structure:', records[0]);
        console.log('Available fields:', Object.keys(records[0]));
        console.table({
          'tracker_id': records[0].tracker_id,
          'agent_id': records[0].agent_id,
          'project_id': records[0].project_id,
          'task_id': records[0].task_id,
          'project_category_id': records[0].project_category_id,
          'sampling_percentage': records[0].sampling_percentage,
          'agent_name': records[0].agent_name,
          'project_name': records[0].project_name,
          'task_name': records[0].task_name
        });
        console.log('✅ API is returning all required IDs correctly!');
        console.groupEnd();
      }
      
      // Find the agent name for this agentId
      const selectedAgent = agents.find(a => String(a.user_id) === String(agentId));
      const agentName = selectedAgent?.user_name;
      
      // Filter records for this specific agent and transform data
      let agentPendingFiles = records
        .filter(record => record.agent_name === agentName)
        .map(record => {
          // Determine if we have rework or correction data
          const hasRework = record.latest_rework && Object.keys(record.latest_rework).length > 0;
          const hasCorrection = record.latest_correction && Object.keys(record.latest_correction).length > 0;
          
          let type, updatedAt, attempt, previousScore, previousErrors, filePath, qcRecordId, trackerFile;
          
          if (hasRework) {
            type = 'rework';
            updatedAt = record.latest_rework.updated_at;
            attempt = record.latest_rework.rework_count;
            previousScore = record.latest_rework.previous_qc_score;
            previousErrors = record.latest_rework.previous_error_list;
            filePath = record.latest_rework.rework_file_path;
            qcRecordId = record.latest_rework.qc_record_id;
            trackerFile = record.latest_rework.rework_file_path;
          } else if (hasCorrection) {
            type = 'correction';
            updatedAt = record.latest_correction.updated_at;
            attempt = record.latest_correction.correction_count;
            previousScore = record.latest_correction.previous_qc_score;
            previousErrors = record.latest_correction.previous_error_list;
            filePath = record.latest_correction.correction_file_path;
            qcRecordId = record.latest_correction.qc_record_id;
            trackerFile = record.latest_correction.correction_file_path;
          } else {
            return null; // Skip if neither rework nor correction data exists
          }
          
          return {
            ...record, // Spread record first to get all top-level fields including IDs
            // Override with specific nested values (these take precedence)
            id: qcRecordId,
            agent_name: record.agent_name,
            project_name: record.project_name,
            task_name: record.task_name,
            type: type,
            updated_at: updatedAt,
            attempt: attempt,
            previous_qc_score: previousScore,
            previous_error_list: previousErrors,
            file_path: filePath,
            qc_record_id: qcRecordId,
            tracker_file: trackerFile,
            // Explicitly preserve critical IDs from API (must be explicit to avoid undefined override)
            tracker_id: record.tracker_id,
            agent_id: record.agent_id,
            user_id: record.agent_id, // Use agent_id as user_id since API doesn't provide user_id
            project_id: record.project_id,
            task_id: record.task_id,
            project_category_id: record.project_category_id,
            qc_percentage: record.sampling_percentage || record.qc_percentage || 50, // API uses sampling_percentage
            date_of_file_submission: updatedAt, // Use rework/correction updated_at as submission date
          };
        })
        .filter(Boolean); // Remove null entries
      
      // Log the first mapped file to see structure
      if (agentPendingFiles.length > 0) {
        console.group('[QAAgentList] 📦 Mapped Data Analysis');
        console.log('First mapped pending file:', agentPendingFiles[0]);
        console.table({
          'tracker_id': agentPendingFiles[0].tracker_id,
          'agent_id': agentPendingFiles[0].agent_id,
          'user_id': agentPendingFiles[0].user_id,
          'project_id': agentPendingFiles[0].project_id,
          'task_id': agentPendingFiles[0].task_id,
          'project_category_id': agentPendingFiles[0].project_category_id,
          'qc_percentage': agentPendingFiles[0].qc_percentage
        });
        console.log('✅ All required IDs are present and ready to pass to QC Form');
        console.groupEnd();
      }
      
      // Frontend date filtering if dates are provided
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        agentPendingFiles = agentPendingFiles.filter(file => {
          const fileDate = new Date(file.updated_at);
          return fileDate >= start && fileDate <= end;
        });
        
        log('[QAAgentList] Filtered pending files by date:', {
          startDate,
          endDate,
          totalRecords: records.length,
          filteredRecords: agentPendingFiles.length
        });
      }
      
      log('[QAAgentList] Found pending QC files for agent:', agentPendingFiles.length);
      
      setAgentTrackers(prev => ({
        ...prev,
        [agentId]: agentPendingFiles
      }));
    } catch (error) {
      logError("[QAAgentList] Error fetching pending QC files:", error);
      toast.error("Failed to fetch pending QC files data");
    } finally {
      setAgentLoading(false);
    }
  };

  // Filter and sort agents based on search query
  const filteredAndSortedAgents = useMemo(() => {
    if (!searchQuery.trim()) {
      return agents;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = agents.filter(agent => 
      agent.user_name.toLowerCase().includes(query)
    );
    
    // Sort: exact matches first, then partial matches
    return filtered.sort((a, b) => {
      const aName = a.user_name.toLowerCase();
      const bName = b.user_name.toLowerCase();
      const aStartsWith = aName.startsWith(query);
      const bStartsWith = bName.startsWith(query);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return aName.localeCompare(bName);
    });
  }, [agents, searchQuery]);

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
  };

  // Handle date changes for specific agent
  const handleAgentStartDateChange = (agentId, dateValue) => {
    const currentFilters = agentDateFilters[agentId] || { startDate: getTodayDate(), endDate: getTodayDate() };
    const newFilters = {
      ...currentFilters,
      startDate: dateValue
    };
    
    setAgentDateFilters(prev => ({
      ...prev,
      [agentId]: newFilters
    }));
    
    // Fetch updated data with new dates immediately
    if (activeTab === 'agent_rework_files' || activeTab === 'rework_review') {
      fetchReworkTrackers(agentId, newFilters.startDate, newFilters.endDate);
    } else {
      fetchAgentTrackers(agentId, newFilters.startDate, newFilters.endDate);
    }
  };

  const handleAgentEndDateChange = (agentId, dateValue) => {
    const currentFilters = agentDateFilters[agentId] || { startDate: getTodayDate(), endDate: getTodayDate() };
    const newFilters = {
      ...currentFilters,
      endDate: dateValue
    };
    
    setAgentDateFilters(prev => ({
      ...prev,
      [agentId]: newFilters
    }));
    
    // Fetch updated data with new dates immediately
    if (activeTab === 'agent_rework_files' || activeTab === 'rework_review') {
      fetchReworkTrackers(agentId, newFilters.startDate, newFilters.endDate);
    } else {
      fetchAgentTrackers(agentId, newFilters.startDate, newFilters.endDate);
    }
  };

  // Reset filters for specific agent
  const handleResetAgentFilters = (agentId) => {
    const today = getTodayDate();
    setAgentDateFilters(prev => ({
      ...prev,
      [agentId]: { startDate: today, endDate: today }
    }));
    // Fetch updated data with today's date immediately
    if (activeTab === 'agent_rework_files' || activeTab === 'rework_review') {
      fetchReworkTrackers(agentId, today, today);
    } else {
      fetchAgentTrackers(agentId, today, today);
    }
  };

  // Handler to save correction status
  const handleSaveStatus = async (tracker, trackerId) => {
    const selectedStatus = correctionStatus[trackerId];
    
    if (!selectedStatus) {
      toast.error('Please select a status');
      return;
    }

    // Validate required fields
    if (!tracker.agent_id) {
      toast.error('Agent ID is missing');
      return;
    }
    if (!tracker.project_id) {
      toast.error('Project ID is missing');
      return;
    }
    if (!tracker.task_id) {
      toast.error('Task ID is missing');
      return;
    }
    if (!tracker.tracker_id) {
      toast.error('Tracker ID is missing');
      return;
    }

    setSavingStatus(prev => ({ ...prev, [trackerId]: true }));
    const loadingToast = toast.loading('Saving status...');

    try {
      const payload = {
        agent_id: tracker.agent_id,
        logged_in_user_id: user?.user_id,
        project_id: tracker.project_id,
        task_id: tracker.task_id,
        qa_user_id: user?.user_id,
        status: selectedStatus,
        tracker_id: tracker.tracker_id
      };

      console.group('[QAAgentList] 💾 Save Correction Status');
      console.log('Payload:', payload);
      console.groupEnd();

      // Determine which endpoint to call based on the tracker type and status
      let endpoint = '/qc-records/save'; // default fallback
      
      // Check if this is a correction tracker (has correction history)
      if (tracker.correction_cycle_count > 0 && tracker.correction_cycle_count !== null) {
        endpoint = '/qc-correction/save';
      } else if (tracker.rework_cycle_count > 0 && tracker.rework_cycle_count !== null) {
        endpoint = '/qc-rework/save';
      } else {
        endpoint = '/qc-regular/save';
      }

      console.log(`[QAAgentList] Using endpoint: ${endpoint}`);

      const response = await nodeApi.post(endpoint, payload);

      toast.dismiss(loadingToast);
      
      // Check for successful response (status code 200-299 means success)
      if (response.status >= 200 && response.status < 300) {
        toast.success('Status saved successfully!');
        
        // Refresh the data after successful save
        if (selectedAgentId) {
          const filters = agentDateFilters[selectedAgentId];
          await fetchReworkTrackers(
            selectedAgentId,
            filters?.startDate || getTodayDate(),
            filters?.endDate || getTodayDate()
          );
        }
      } else {
        toast.error(response.data?.message || 'Failed to save status');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('[QAAgentList] Error saving status:', error);
      toast.error(error.response?.data?.message || 'Failed to save status');
    } finally {
      setSavingStatus(prev => ({ ...prev, [trackerId]: false }));
    }
  };

  // Handle QC Form action
  const navigate = useNavigate();
  const handleQCForm = async (tracker) => {
    console.group('[QAAgentList] 🔍 QC Form Handler');
    console.log('Tracker ID:', tracker.tracker_id);
    console.table({
      'tracker_id': tracker.tracker_id,
      'agent_id': tracker.agent_id,
      'user_id': tracker.user_id,
      'project_id': tracker.project_id, 
      'task_id': tracker.task_id,
      'project_category_id': tracker.project_category_id,
      'qc_percentage': tracker.qc_percentage
    });
    console.groupEnd();
    
    // Validate required data
    if (!tracker.project_category_id) {
      toast.error('Project category not found for this tracker');
      logError('[QAAgentList] Missing project_category_id in tracker:', tracker);
      return;
    }
    
    if (!user?.user_id) {
      toast.error('User not authenticated');
      return;
    }
    
    // Validate that required IDs are present
    if (!tracker.agent_id) {
      console.error('❌ [QAAgentList] Agent ID is missing!');
      toast.error('Agent ID not found. Cannot proceed with QC. Check console for details.');
      return;
    }
    
    if (!tracker.project_id) {
      console.error('❌ [QAAgentList] Project ID is missing!');
      toast.error('Project ID not found. Cannot proceed with QC. Check console for details.');
      return;
    }
    
    if (!tracker.task_id) {
      console.error('❌ [QAAgentList] Task ID is missing!');
      toast.error('Task ID not found. Cannot proceed with QC. Check console for details.');
      return;
    }
    
    setQcFormLoading(tracker.tracker_id); // Set the specific tracker ID that's loading
    const loadingToast = toast.loading('Preparing QC Form...');
    
    try {
      // Fetch AFD data, generate sample, and get agent's user details concurrently
      log('[QAAgentList] Fetching AFD and generating sample for tracker:', tracker.tracker_id);
      
      const [afdResponse, sampleResponse, userListResponse] = await Promise.all([
        fetchProjectCategoryAFD(tracker.project_category_id),
        generateQCSample(tracker.tracker_id, user.user_id, tracker.qc_percentage),
        // Fetch user list to get agent's manager information
        api.post('/user/list', {
          user_id: user?.user_id,
          device_id: user?.device_id || 'web',
          device_type: user?.device_type || 'Laptop'
        }).catch(err => {
          logError('[QAAgentList] Failed to fetch user list:', err);
          return { data: { data: [] } };
        })
      ]);
      
      log('[QAAgentList] AFD Response:', afdResponse);
      log('[QAAgentList] Sample Response:', sampleResponse);
      
      // Extract AFD data from response
      const afdData = afdResponse?.data?.[0]?.afd?.[0] || null;
      
      if (!afdData) {
        toast.error('No AFD data found for this project category', { id: loadingToast });
        logError('[QAAgentList] No AFD data in response:', afdResponse);
        return;
      }
      
      // Extract sample data from response
      const sampleData = sampleResponse?.data || null;
      
      if (!sampleData) {
        toast.error('Failed to generate sample data', { id: loadingToast });
        logError('[QAAgentList] No sample data in response:', sampleResponse);
        return;
      }
      
      // Find the agent's user data to get their manager
      const usersList = userListResponse?.data?.data || [];
      const agentUserData = usersList.find(u => String(u.user_id) === String(tracker.user_id));
      
      // Helper function to extract valid ID (not 0, null, or undefined)
      const extractValidId = (id) => {
        const numId = id ? Number(id) : null;
        return numId && numId > 0 ? numId : null;
      };
      
      // Extract assistant manager ID from agent's user data
      const assistantManagerId = extractValidId(agentUserData?.assistant_manager_id)
        || extractValidId(agentUserData?.asst_manager_id)
        || extractValidId(agentUserData?.manager_id)
        || extractValidId(tracker.assistant_manager_id)
        || extractValidId(tracker.asst_manager_id)
        || extractValidId(tracker.project_manager_id)
        || null;
      
      log('[QAAgentList] Agent user data:', agentUserData);
      log('[QAAgentList] Extracted assistant_manager_id:', assistantManagerId, 'is_null:', assistantManagerId === null);
      
      // Enhance tracker with assistant manager ID (only if valid, otherwise don't include the fields)
      const enhancedTracker = {
        ...tracker,
        assistant_manager_id: assistantManagerId,
        asst_manager_id: assistantManagerId,
        ass_manager_id: assistantManagerId
      };
      
      toast.success('QC Form ready!', { id: loadingToast });
      
      // Log tracker data to debug assistant manager field
      console.log('[QAAgentList] Tracker data being passed to QC form:', {
        tracker_id: enhancedTracker.tracker_id,
        user_id: enhancedTracker.user_id,
        project_id: enhancedTracker.project_id,
        task_id: enhancedTracker.task_id,
        assistant_manager_id: enhancedTracker.assistant_manager_id,
        asst_manager_id: enhancedTracker.asst_manager_id,
        ass_manager_id: enhancedTracker.ass_manager_id,
        project_manager_id: enhancedTracker.project_manager_id,
        manager_id: enhancedTracker.manager_id,
        all_tracker_fields: Object.keys(enhancedTracker)
      });
      
      // Navigate to QC form with all the data
      navigate('/qc-form', { 
        state: { 
          tracker: enhancedTracker,
          afdData,
          sampleData
        } 
      });
      
    } catch (error) {
      logError('[QAAgentList] Error preparing QC Form:', error);
      toast.error(
        error.response?.data?.message || error.message || 'Failed to prepare QC Form',
        { id: loadingToast }
      );
    } finally {
      setQcFormLoading(null); // Reset loading state
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Section with Tabs */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-slate-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left - Title */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight cursor-default">Agent Files & QC Report</h2>
                <p className="text-slate-600 text-sm font-medium mt-1 cursor-default">View and manage agent files with QC forms</p>
              </div>
            </div>

            {/* Right - Tabs Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('agent_files')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === 'agent_files'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Agent's Tracker File</span>
              </button>
              <button
                onClick={() => setActiveTab('rework_review')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === 'rework_review'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Agent's Rework & Correction File</span>
              </button>
              <button
                onClick={() => setActiveTab('qc_report')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === 'qc_report'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>QC Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Split View Layout - Agent Files */}
        {activeTab === 'agent_files' && (
          <>
        <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 400px)', minHeight: '600px' }}>
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center p-16">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <UsersIcon className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              </div>
              <p className="text-slate-700 font-bold text-lg mt-6">Loading Agent Data</p>
              <p className="text-slate-500 text-sm mt-2">Please wait while we fetch the information...</p>
            </div>
          ) : filteredAndSortedAgents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-16">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                <UsersIcon className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                {searchQuery ? 'No Agents Found' : 'No Agent Data Available'}
              </h3>
              <p className="text-slate-600 text-sm max-w-md mb-6 text-center">
                {searchQuery 
                  ? `We couldn't find any agents matching "${searchQuery}". Try adjusting your search.`
                  : 'No agents are currently assigned to you. Please check back later or contact your administrator.'
                }
              </p>
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-xl transition-all duration-300"
                >
                  <X className="w-4 h-4" />
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-full">
              {/* Left Sidebar - Agent List */}
              <div className="w-80 border-r-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white flex flex-col">
                {/* Sidebar Header */}
                <div className="px-5 py-4 border-b-2 border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <UsersIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base">Agents</h3>
                      <p className="text-blue-100 text-xs font-medium">{filteredAndSortedAgents.length} Total</p>
                    </div>
                  </div>
                </div>

                {/* Search Section */}
                <div className="p-3 border-b-2 border-slate-200 bg-white">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search agents..."
                      className="w-full pl-10 pr-9 py-2.5 text-sm font-medium border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-all placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={handleClearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-md transition-all flex items-center justify-center group"
                      >
                        <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <div className="mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      <span className="font-bold text-xs">
                        {filteredAndSortedAgents.length} result{filteredAndSortedAgents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Agents List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {filteredAndSortedAgents.map((agent) => {
                    const trackers = agentTrackers[agent.user_id] || [];
                    const isSelected = selectedAgentId === agent.user_id;
                    
                    return (
                      <button
                        key={agent.user_id}
                        onClick={() => {
                          setSelectedAgentId(agent.user_id);
                          // Initialize date filter to today if not set
                          if (!agentDateFilters[agent.user_id]) {
                            const today = getTodayDate();
                            setAgentDateFilters(prev => ({
                              ...prev,
                              [agent.user_id]: { startDate: today, endDate: today }
                            }));
                          }
                          // Call appropriate API based on active tab
                          if (activeTab === 'agent_rework_files') {
                            const filters = agentDateFilters[agent.user_id] || { startDate: getTodayDate(), endDate: getTodayDate() };
                            fetchReworkTrackers(agent.user_id, filters.startDate, filters.endDate);
                          } else {
                            fetchAgentTrackers(agent.user_id);
                          }
                        }}
                        disabled={agentLoading}
                        className={`w-full text-left p-4 rounded-xl transition-all duration-300 border-2 relative overflow-hidden ${
                          isSelected
                            ? 'bg-white border-blue-600 shadow-lg scale-105'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                        } ${agentLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {/* Left accent border for selected */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 to-indigo-600"></div>
                        )}
                        
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm bg-gradient-to-br from-blue-100 to-indigo-100`}>
                            <UsersIcon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-sm truncate text-slate-900">
                                {agent.user_name}
                              </h4>
                              {isSelected && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                                  <Check className="w-3 h-3" />
                                  <span className="text-xs font-bold">Selected</span>
                                </div>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">
                              <FileText className="w-3 h-3" />
                              <span>{trackers.length} file{trackers.length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel - Agent Details */}
              <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30">
                {agentLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                      <p className="text-slate-700 font-bold text-lg">Loading Agent Data...</p>
                      <p className="text-slate-500 text-sm mt-2">Please wait</p>
                    </div>
                  </div>
                ) : selectedAgentId ? (() => {
                  const selectedAgent = agents.find(a => a.user_id === selectedAgentId);
                  const trackers = agentTrackers[selectedAgentId] || [];
                  
                  return (
                    <>
                      {/* Header */}
                      <div className="px-6 py-5 border-b-2 border-slate-200 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                              <UsersIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-slate-900">{selectedAgent?.user_name}</h2>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                                  {trackers.length} file{trackers.length !== 1 ? 's' : ''}
                                </span>
                                {trackers.length > 0 && (
                                  <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                                    {agentDateFilters[selectedAgentId]?.startDate === agentDateFilters[selectedAgentId]?.endDate
                                      ? format(new Date(agentDateFilters[selectedAgentId]?.startDate), 'dd MMM yyyy')
                                      : `${format(new Date(agentDateFilters[selectedAgentId]?.startDate), 'dd MMM')} - ${format(new Date(agentDateFilters[selectedAgentId]?.endDate), 'dd MMM yyyy')}`
                                    }
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Date Filter - Use DateRangePicker */}
                      <div className="px-6 py-3 bg-white border-b border-slate-200">
                        <DateRangePicker
                          startDate={agentDateFilters[selectedAgentId]?.startDate || ''}
                          endDate={agentDateFilters[selectedAgentId]?.endDate || ''}
                          onStartDateChange={(date) => handleAgentStartDateChange(selectedAgentId, date)}
                          onEndDateChange={(date) => handleAgentEndDateChange(selectedAgentId, date)}
                          onClear={() => handleResetAgentFilters(selectedAgentId)}
                          label=""
                          description=""
                          showClearButton={true}
                          noWrapper={true}
                          fieldWidth="200px"
                        />
                      </div>

                      {/* Files Table */}
                      <div className="flex-1 overflow-y-auto p-6">
                        {trackers.length > 0 ? (
                          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                <tr>
                                  <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                                  <th className="px-4 py-3 text-left font-semibold">Project / Task</th>
                                  <th className="px-4 py-3 text-center font-semibold">File</th>
                                  <th className="px-4 py-3 text-center font-semibold">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {trackers.map((tracker, index) => {
                                  const formatDateTime = (dateTimeStr) => {
                                    if (!dateTimeStr) return { date: '—', time: '' };
                                    // Parse the date string format: "Fri, 03 Apr 2026 11:10:33 GMT"
                                    // Extract date and time directly without timezone conversion
                                    const match = dateTimeStr.match(/(\d{2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2})/);
                                    if (match) {
                                      const [, day, month, year, hours, minutes] = match;
                                      const hour = parseInt(hours, 10);
                                      const ampm = hour >= 12 ? 'PM' : 'AM';
                                      const hour12 = hour % 12 || 12;
                                      return {
                                        date: `${parseInt(day, 10)}/${month}/${year}`,
                                        time: `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`
                                      };
                                    }
                                    // Fallback for unexpected format
                                    const dateObj = new Date(dateTimeStr);
                                    const day = dateObj.getUTCDate();
                                    const month = dateObj.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
                                    const year = dateObj.getUTCFullYear();
                                    const hours = dateObj.getUTCHours();
                                    const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0');
                                    const ampm = hours >= 12 ? 'PM' : 'AM';
                                    const hour12 = hours % 12 || 12;
                                    return {
                                      date: `${day}/${month}/${year}`,
                                      time: `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`
                                    };
                                  };

                                  const dateTime = formatDateTime(tracker.date_time || tracker.tracker_datetime);

                                  return (
                                    <tr key={tracker.tracker_id || index} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 text-slate-600">
                                        <div>
                                          <p className="font-medium">{dateTime.date}</p>
                                          {dateTime.time && <p className="text-xs text-slate-500">{dateTime.time}</p>}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div>
                                          <p className="font-medium text-slate-800">{tracker.project_name || '—'}</p>
                                          <p className="text-xs text-slate-500">{tracker.task_name || '—'}</p>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        {tracker.tracker_file ? (
                                          <a
                                            href={tracker.tracker_file}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
                                            title="Download File"
                                          >
                                            <Download className="w-4 h-4" />
                                          </a>
                                        ) : (
                                          <span className="text-slate-400 text-xs">—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleQCForm(tracker);
                                          }}
                                          disabled={qcFormLoading === tracker.tracker_id}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white text-xs font-semibold transition-colors"
                                        >
                                          {qcFormLoading === tracker.tracker_id ? (
                                            <>
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                              Loading
                                            </>
                                          ) : (
                                            <>
                                              <FileCheck className="w-3 h-3" />
                                              QC Form
                                            </>
                                          )}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-slate-700">No Files Found</h3>
                            <p className="text-sm text-slate-500">No tracker files available for this agent in the selected date range.</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })() : (
                  <div className="h-full flex items-center justify-center p-16">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <UsersIcon className="w-12 h-12 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Select an Agent</h3>
                      <p className="text-slate-600 text-sm">Choose an agent from the sidebar to view their files</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {/* QC Form Report Tab */}
        {activeTab === 'qc_report' && (
          <QAAgentQCFormReport />
        )}

        {/* Rework & Correction Review Tab */}
        {activeTab === 'rework_review' && (
          <>
        <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 400px)', minHeight: '600px' }}>
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center p-16">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <UsersIcon className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              </div>
              <p className="text-slate-700 font-bold text-lg mt-6">Loading Agent Data</p>
              <p className="text-slate-500 text-sm mt-2">Please wait while we fetch the information...</p>
            </div>
          ) : filteredAndSortedAgents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-16">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                <UsersIcon className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                {searchQuery ? 'No Agents Found' : 'No Agent Data Available'}
              </h3>
              <p className="text-slate-600 text-sm max-w-md mb-6 text-center">
                {searchQuery 
                  ? `We couldn't find any agents matching "${searchQuery}". Try adjusting your search.`
                  : 'No agents are currently assigned to you. Please check back later or contact your administrator.'
                }
              </p>
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-xl transition-all duration-300"
                >
                  <X className="w-4 h-4" />
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-full">
              {/* Left Sidebar - Agent List */}
              <div className="w-80 border-r-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white flex flex-col">
                {/* Sidebar Header */}
                <div className="px-5 py-4 border-b-2 border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <UsersIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base">Agents</h3>
                      <p className="text-blue-100 text-xs font-medium">{filteredAndSortedAgents.length} Total</p>
                    </div>
                  </div>
                </div>

                {/* Search Section */}
                <div className="p-3 border-b-2 border-slate-200 bg-white">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search agents..."
                      className="w-full pl-10 pr-9 py-2.5 text-sm font-medium border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-all placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={handleClearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-md transition-all flex items-center justify-center group"
                      >
                        <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <div className="mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      <span className="font-bold text-xs">
                        {filteredAndSortedAgents.length} result{filteredAndSortedAgents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Agents List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {filteredAndSortedAgents.map((agent) => {
                    const trackers = agentTrackers[agent.user_id] || [];
                    const isSelected = selectedAgentId === agent.user_id;
                    
                    return (
                      <button
                        key={agent.user_id}
                        onClick={() => {
                          setSelectedAgentId(agent.user_id);
                          // Initialize date filter to today if not set
                          if (!agentDateFilters[agent.user_id]) {
                            const today = getTodayDate();
                            setAgentDateFilters(prev => ({
                              ...prev,
                              [agent.user_id]: { startDate: today, endDate: today }
                            }));
                          }
                          // Fetch pending QC files for rework/correction
                          const filters = agentDateFilters[agent.user_id] || { startDate: getTodayDate(), endDate: getTodayDate() };
                          fetchReworkTrackers(agent.user_id, filters.startDate, filters.endDate);
                        }}
                        disabled={agentLoading}
                        className={`w-full text-left p-4 rounded-xl transition-all duration-300 border-2 relative overflow-hidden ${
                          isSelected
                            ? 'bg-white border-blue-600 shadow-lg scale-105'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                        } ${agentLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {/* Left accent border for selected */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 to-indigo-600"></div>
                        )}
                        
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm bg-gradient-to-br from-blue-100 to-indigo-100`}>
                            <UsersIcon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-sm truncate text-slate-900">
                                {agent.user_name}
                              </h4>
                              {isSelected && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                                  <Check className="w-3 h-3" />
                                  <span className="text-xs font-bold">Selected</span>
                                </div>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">
                              <FileText className="w-3 h-3" />
                              <span>{trackers.length} file{trackers.length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel - Agent Details */}
              <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30">
                {agentLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                      <p className="text-slate-700 font-bold text-lg">Loading Pending QC Files...</p>
                      <p className="text-slate-500 text-sm mt-2">Please wait</p>
                    </div>
                  </div>
                ) : selectedAgentId ? (() => {
                  const selectedAgent = agents.find(a => a.user_id === selectedAgentId);
                  const trackers = agentTrackers[selectedAgentId] || [];
                  
                  return (
                    <>
                      {/* Header */}
                      <div className="px-6 py-5 border-b-2 border-slate-200 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                              <UsersIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-slate-900">{selectedAgent?.user_name}</h2>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                                  {trackers.length} pending file{trackers.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Date Filter - Use DateRangePicker */}
                      <div className="px-6 py-3 bg-white border-b border-slate-200">
                        <DateRangePicker
                          startDate={agentDateFilters[selectedAgentId]?.startDate || ''}
                          endDate={agentDateFilters[selectedAgentId]?.endDate || ''}
                          onStartDateChange={(date) => handleAgentStartDateChange(selectedAgentId, date)}
                          onEndDateChange={(date) => handleAgentEndDateChange(selectedAgentId, date)}
                          onClear={() => handleResetAgentFilters(selectedAgentId)}
                          label=""
                          description=""
                          showClearButton={true}
                          noWrapper={true}
                          fieldWidth="200px"
                        />
                      </div>

                      {/* Pending Files Table */}
                      <div className="flex-1 overflow-y-auto p-6">
                        {trackers.length > 0 ? (
                          <PendingQCFilesTable 
                            trackers={trackers}
                            handleQCForm={handleQCForm}
                            qcFormLoading={qcFormLoading}
                            handleSaveStatus={handleSaveStatus}
                            savingStatus={savingStatus}
                            correctionStatus={correctionStatus}
                            setCorrectionStatus={setCorrectionStatus}
                            user={user}
                            selectedAgentId={selectedAgentId}
                            agentDateFilters={agentDateFilters}
                            getTodayDate={getTodayDate}
                            fetchReworkTrackers={fetchReworkTrackers}
                          />
                        ) : (
                          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-slate-700">No Pending Files</h3>
                            <p className="text-sm text-slate-500">No pending rework or correction files for this agent.</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })() : (
                  <div className="h-full flex items-center justify-center p-16">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <UsersIcon className="w-12 h-12 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Select an Agent</h3>
                      <p className="text-slate-600 text-sm">Choose an agent from the sidebar to view their pending files</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {/* QC Dashboard Tab */}
        {activeTab === 'qc_dashboard' && (
          <QAAgentQCDashboard />
        )}

        {/* Loader spinner style */}
        <style>{`
          .loader {
            border: 4px solid #e0e7ef;
            border-top: 4px solid #2563eb;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default QAAgentList;
