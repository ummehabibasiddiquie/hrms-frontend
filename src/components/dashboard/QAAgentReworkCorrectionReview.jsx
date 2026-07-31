/**
 * File: QAAgentReworkCorrectionReview.jsx
 * Description: Split view for QA Agent to review rework and correction files by agent
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Send,
  RefreshCw,
  Filter,
  Search,
  X,
  AlertTriangle,
  Users as UsersIcon,
  Check,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { useClientPagination } from '../../hooks/useClientPagination';
import TablePaginationBar from '../common/TablePaginationBar';
import { formatISTDateMedium } from '../../utils/dateTimeIST';

// Dummy data
const dummyPendingReviews = [
  {
    id: 1,
    review_type: 'correction',
    agent_name: 'Jane Smith',
    agent_id: 'agent_1',
    project_name: 'Healthcare Database',
    task_name: 'Patient Records Digitization',
    submitted_at: '2024-03-30T09:15:00Z',
    file_path: 'https://example.com/corrections/correction-001.xlsx',
    original_score: 98.5,
    attempt_count: 1,
    previous_errors: [
      { row: 45, error: 'Missing patient phone number' },
      { row: 102, error: 'Invalid date format in admission_date' },
      { row: 203, error: 'Incorrect diagnosis code' },
      { row: 287, error: 'Missing insurance information' },
      { row: 356, error: 'Duplicate patient ID' },
      { row: 392, error: 'Invalid postal code format' }
    ],
    tracker_data: { tracker_id: 1001 },
    qc_record_id: 101,
    correction_id: 501,
    rework_id: null
  },
  {
    id: 2,
    review_type: 'correction',
    agent_name: 'Jane Smith',
    agent_id: 'agent_1',
    project_name: 'Healthcare Database',
    task_name: 'Lab Results Entry',
    submitted_at: '2024-03-29T14:30:00Z',
    file_path: 'https://example.com/corrections/correction-002.xlsx',
    original_score: 97.2,
    attempt_count: 1,
    previous_errors: [
      { row: 15, error: 'Missing test date' },
      { row: 88, error: 'Invalid result format' }
    ],
    tracker_data: { tracker_id: 1002 },
    qc_record_id: 102,
    correction_id: 502,
    rework_id: null,
    completed: false
  },
  {
    id: 3,
    review_type: 'rework',
    agent_name: 'David Brown',
    agent_id: 'agent_2',
    project_name: 'Real Estate Listings',
    task_name: 'Property Details Entry',
    submitted_at: '2024-03-28T15:00:00Z',
    file_path: 'https://example.com/rework/rework-003.xlsx',
    original_score: 92.3,
    attempt_count: 1,
    previous_errors: [
      { row: 25, error: 'Missing property square footage' },
      { row: 78, error: 'Invalid property type' },
      { row: 134, error: 'Incorrect listing price format' },
      { row: 189, error: 'Missing bedroom count' }
    ],
    tracker_data: { tracker_id: 1003 },
    qc_record_id: 103,
    correction_id: null,
    rework_id: 601
  },
  {
    id: 4,
    review_type: 'rework',
    agent_name: 'Sarah Williams',
    agent_id: 'agent_3',
    project_name: 'Legal Documents',
    task_name: 'Contract Data Extraction',
    submitted_at: '2024-03-29T16:45:00Z',
    file_path: 'https://example.com/rework/rework-004.xlsx',
    original_score: 85.5,
    attempt_count: 1,
    previous_errors: [
      { row: 12, error: 'Missing contract effective date' },
      { row: 34, error: 'Invalid party name format' },
      { row: 67, error: 'Missing clause reference' },
      { row: 89, error: 'Incorrect contract value' }
    ],
    tracker_data: { tracker_id: 1004 },
    qc_record_id: 104,
    correction_id: null,
    rework_id: 602
  },
  {
    id: 5,
    review_type: 'rework',
    agent_name: 'Emily Davis',
    agent_id: 'agent_4',
    project_name: 'Educational Records',
    task_name: 'Student Enrollment',
    submitted_at: '2024-03-30T09:20:00Z',
    file_path: 'https://example.com/rework/rework-005.xlsx',
    original_score: 96.8,
    attempt_count: 3,
    previous_errors: [
      { row: 234, error: 'Formatting issue in phone number' },
      { row: 401, error: 'Missing vaccination records' }
    ],
    tracker_data: { tracker_id: 1005 },
    qc_record_id: 105,
    correction_id: null,
    rework_id: 603
  },
  {
    id: 6,
    review_type: 'correction',
    agent_name: 'Robert Martinez',
    agent_id: 'agent_5',
    project_name: 'Insurance Claims',
    task_name: 'Claims Processing',
    submitted_at: '2024-03-30T10:00:00Z',
    file_path: 'https://example.com/corrections/correction-006.xlsx',
    original_score: 99.8,
    attempt_count: 1,
    previous_errors: [
      { row: 267, error: 'Minor formatting issue in claim date' }
    ],
    tracker_data: { tracker_id: 1006 },
    qc_record_id: 106,
    correction_id: 503,
    rework_id: null,
    completed: false
  },
  {
    id: 7,
    review_type: 'rework',
    agent_name: 'David Brown',
    agent_id: 'agent_2',
    project_name: 'Real Estate Listings',
    task_name: 'Commercial Properties',
    submitted_at: '2024-03-30T11:00:00Z',
    file_path: 'https://example.com/rework/rework-007.xlsx',
    original_score: 88.5,
    attempt_count: 2,
    previous_errors: [
      { row: 12, error: 'Missing zoning info' },
      { row: 45, error: 'Invalid lot size' }
    ],
    tracker_data: { tracker_id: 1007 },
    qc_record_id: 107,
    correction_id: null,
    rework_id: 604
  }
];



const QAAgentReworkCorrectionReview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [errorModal, setErrorModal] = useState({ open: false, errors: [], title: '' });

  // Extract unique agents from data
  const agents = useMemo(() => {
    const agentMap = {};
    dummyPendingReviews.forEach(record => {
      if (!agentMap[record.agent_id]) {
        agentMap[record.agent_id] = {
          agent_id: record.agent_id,
          agent_name: record.agent_name,
          totalFiles: 0,
          reworkCount: 0,
          correctionCount: 0
        };
      }
      agentMap[record.agent_id].totalFiles++;
      if (record.review_type === 'rework') {
        agentMap[record.agent_id].reworkCount++;
      } else {
        agentMap[record.agent_id].correctionCount++;
      }
    });
    return Object.values(agentMap);
  }, []);

  // Filter agents by search
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    return agents.filter(agent =>
      agent.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [agents, searchQuery]);

  // Get selected agent's records
  const selectedAgentRecords = useMemo(() => {
    if (!selectedAgentId) return [];
    let records = dummyPendingReviews.filter(r => r.agent_id === selectedAgentId);
    if (typeFilter !== 'all') {
      records = records.filter(r => r.review_type === typeFilter);
    }
    return records;
  }, [selectedAgentId, typeFilter]);

  const agentPagination = useClientPagination(filteredAgents, { resetKeys: [searchQuery] });
  const recordsPagination = useClientPagination(selectedAgentRecords, {
    resetKeys: [selectedAgentId, typeFilter],
  });

  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
      if (agents.length > 0) {
        setSelectedAgentId(agents[0].agent_id);
      }
    }, 500);
  }, [agents]);

  const handleStartQC = (record) => {
    navigate('/qc-form', {
      state: {
        tracker: record.tracker_data,
        isReview: true,
        reviewType: record.review_type,
        qcRecordId: record.qc_record_id,
        reviewFileId: record.review_type === 'rework' ? record.rework_id : record.correction_id
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return formatISTDateMedium(dateString);
  };

  const openErrorModal = (errors, title) => {
    setErrorModal({ open: true, errors: errors || [], title });
  };

  const closeErrorModal = () => {
    setErrorModal({ open: false, errors: [], title: '' });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 400px)', minHeight: '600px' }}>
        <div className="h-full flex flex-col items-center justify-center p-16">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-pulse" />
            </div>
          </div>
          <p className="text-slate-700 font-bold text-lg mt-6">Loading Reviews</p>
          <p className="text-slate-500 text-sm mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 400px)', minHeight: '600px' }}>
        {filteredAgents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-16">
            <div className="w-24 h-24 bg-linear-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">No Pending Reviews</h3>
            <p className="text-slate-600 text-sm max-w-md mb-6 text-center">
              All rework and correction files have been reviewed.
            </p>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left Sidebar - Agent List */}
            <div className="w-80 border-r-2 border-slate-200 bg-linear-to-b from-slate-50 to-white flex flex-col">
              {/* Sidebar Header */}
              <div className="px-5 py-4 border-b-2 border-slate-200 bg-linear-to-r from-blue-600 to-indigo-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <UsersIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">Agents</h3>
                    <p className="text-blue-100 text-xs font-medium">{filteredAgents.length} with pending reviews</p>
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-md transition-all flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Agents List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {agentPagination.pagedItems.map((agent) => {
                  const isSelected = selectedAgentId === agent.agent_id;

                  return (
                    <button
                      key={agent.agent_id}
                      onClick={() => setSelectedAgentId(agent.agent_id)}
                      className={`w-full text-left p-4 rounded-xl transition-all duration-300 border-2 relative overflow-hidden ${
                        isSelected
                          ? 'bg-white border-blue-600 shadow-lg scale-105'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-blue-600 to-indigo-600"></div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-linear-to-br from-blue-100 to-indigo-100">
                          <UsersIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-sm truncate text-slate-900">
                              {agent.agent_name}
                            </h4>
                            {isSelected && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                                <Check className="w-3 h-3" />
                                <span className="text-xs font-bold">Selected</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {agent.reworkCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                                <RefreshCw className="w-3 h-3" />
                                {agent.reworkCount}
                              </span>
                            )}
                            {agent.correctionCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
                                <AlertCircle className="w-3 h-3" />
                                {agent.correctionCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <TablePaginationBar {...agentPagination} itemLabel="agents" className="border-t-2 border-slate-200" />
            </div>

            {/* Right Panel - Agent's Records */}
            <div className="flex-1 flex flex-col bg-linear-to-br from-slate-50 to-blue-50/30">
              {selectedAgentId && selectedAgent ? (
                <>
                  {/* Header */}
                  <div className="px-6 py-5 border-b-2 border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                          <UsersIcon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">{selectedAgent.agent_name}</h2>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                              {selectedAgent.totalFiles} pending
                            </span>
                            {selectedAgent.reworkCount > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                                {selectedAgent.reworkCount} rework
                              </span>
                            )}
                            {selectedAgent.correctionCount > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
                                {selectedAgent.correctionCount} correction
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Type Filter */}
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:border-blue-500 outline-none font-medium"
                        >
                          <option value="all">All Types</option>
                          <option value="rework">Rework Only</option>
                          <option value="correction">Correction Only</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {selectedAgentRecords.length === 0 ? (
                      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">No Files</h3>
                        <p className="text-sm text-slate-500">No {typeFilter !== 'all' ? typeFilter : ''} files pending for this agent.</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-linear-to-r from-blue-600 to-indigo-600 text-white">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Type</th>
                              <th className="px-4 py-3 text-left font-semibold">Project / Task</th>
                              <th className="px-4 py-3 text-center font-semibold">Submitted</th>
                              <th className="px-4 py-3 text-center font-semibold">Attempt</th>
                              <th className="px-4 py-3 text-center font-semibold">Score</th>
                              <th className="px-4 py-3 text-center font-semibold">Previous Errors</th>
                              <th className="px-4 py-3 text-center font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {recordsPagination.pagedItems.map((record) => (
                              <tr key={record.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  {record.review_type === 'rework' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
                                      <RefreshCw className="w-3 h-3" /> Rework
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
                                      <AlertCircle className="w-3 h-3" /> Correction
                                    </span>
                                  )}
                                  {/* Completed toggle for corrections */}
                                  {record.review_type === 'correction' && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={!!record.completed}
                                        onChange={() => handleToggleCompleted(record.id)}
                                        id={`completed-toggle-${record.id}`}
                                        className="accent-green-600 w-4 h-4"
                                      />
                                      <label htmlFor={`completed-toggle-${record.id}`} className={`text-xs font-medium ${record.completed ? 'text-green-700' : 'text-slate-500'}`}>{record.completed ? 'Completed' : 'Not Completed'}</label>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4 text-blue-500" />
                                    <div>
                                      <p className="font-medium text-slate-800">{record.project_name}</p>
                                      <p className="text-xs text-slate-500">{record.task_name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center text-slate-600">
                                  {formatDate(record.submitted_at)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                                    {record.attempt_count}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`font-bold ${
                                    record.original_score >= 98 ? 'text-green-600' :
                                    record.original_score >= 95 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {record.original_score}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {record.previous_errors?.length > 0 ? (
                                    <button
                                      onClick={() => openErrorModal(record.previous_errors, `${record.project_name} - Previous Errors`)}
                                      className="relative inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                                    >
                                      View
                                      <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-white text-red-600 text-xs font-bold border-2 border-red-600">
                                        {record.previous_errors.length}
                                      </span>
                                    </button>
                                  ) : (
                                    <span className="text-green-600 text-xs font-medium">None</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    {record.file_path && (
                                      <a
                                        href={record.file_path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
                                        title="Download File"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    )}
                                    <button
                                      onClick={() => handleStartQC(record)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                                    >
                                      <Send className="w-3 h-3" />
                                      Start QC
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <TablePaginationBar {...recordsPagination} itemLabel="files" />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center p-16">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-linear-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <UsersIcon className="w-12 h-12 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Select an Agent</h3>
                    <p className="text-slate-600 text-sm">Choose an agent from the sidebar to view their pending reviews</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Modal */}
      {errorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeErrorModal}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-linear-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{errorModal.title}</h3>
                  <p className="text-red-100 text-sm">{errorModal.errors.length} error{errorModal.errors.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={closeErrorModal}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {errorModal.errors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <span className="inline-block px-2 py-0.5 bg-red-600 text-white text-xs font-semibold rounded mb-1">
                        Row {err.row}
                      </span>
                      <p className="text-sm text-red-800">{err.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={closeErrorModal}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default QAAgentReworkCorrectionReview;
