/**
 * File: QAAgentQCFormReport.jsx
 * Description: QA Agent's view of all QC forms they've submitted with complete history
 */
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  AlertTriangle
} from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';
import CustomSelect from '../common/CustomSelect';
import api from '../../services/api';

const QAAgentQCFormReport = () => {
  const [loading, setLoading] = useState(true);
  const [qcRecords, setQcRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [errorModal, setErrorModal] = useState({ open: false, errors: [], title: '' });

  // Fetch QC history from API
  const fetchQCHistory = async () => {
    try {
      setLoading(true);
      const response = await api.post('qc_rework/view_all_qc_history');

      if (response.data?.status === 200 && response.data?.data?.records) {
        // Map API response to component format
        const mappedRecords = response.data.data.records.map(record => ({
          id: record.qc_record_id,
          agent_name: record.agent_name,
          project_name: record.project_name,
          task_name: record.task_name,
          qc_score: record.qc_score,
          status: record.status,
          qc_status: record.qc_status,
          created_at: record.created_at,
          date_of_file_submission: record.date_of_file_submission,
          qc_file_path: record.qc_file_path,
          whole_file_path: record.whole_file_path,
          // Keep raw correction data
          qc_correction: record.qc_correction || [],
          // Keep raw rework data
          qc_rework: record.qc_rework || []
        }));

        setQcRecords(mappedRecords);
        setFilteredRecords(mappedRecords);
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
  }, []);

  // Apply filters when search or status changes
  useEffect(() => {
    let filtered = [...qcRecords];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.task_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    setFilteredRecords(filtered);
  }, [searchTerm, statusFilter, qcRecords]);

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

  // Build history items from rework and correction data
  const buildHistoryItems = (record) => {
    const items = [];

    // Add rework items
    (record.qc_rework || []).forEach(r => {
      items.push({
        id: `rework-${r.qc_rework_id}`,
        type: 'rework',
        count: r.rework_count,
        created_at: r.created_at,
        status: r.rework_status,
        score: r.rework_qc_score,
        errors: r.rework_error_list,
        file_path: r.rework_file_path
      });
    });

    // Add correction items
    (record.qc_correction || []).forEach(c => {
      items.push({
        id: `correction-${c.qc_correction_id}`,
        type: 'correction',
        count: c.correction_count,
        created_at: c.created_at,
        status: c.correction_status,
        score: null, // API doesn't have correction_qc_score
        errors: c.correction_error_list,
        file_path: c.correction_file_path
      });
    });

    // Sort by created_at
    return items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 border-2 border-slate-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by agent, project, or task..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <CustomSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'regular', label: 'Regular' },
                { value: 'correction', label: 'Correction' },
                { value: 'rework', label: 'Rework' }
              ]}
              icon={Filter}
              placeholder="Filter by status"
              className="w-48"
            />
          </div>

          {/* Clear Filter Button */}
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear Filter
          </button>
        </div>
      </div>

      {/* QC Records Table */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Agent</th>
                <th className="px-4 py-3 text-left font-semibold">Project</th>
                <th className="px-4 py-3 text-left font-semibold">Task</th>
                <th className="px-4 py-3 text-center font-semibold">QC Score</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">QC Status</th>
                <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                <th className="px-4 py-3 text-center font-semibold">Tracker File</th>
                <th className="px-4 py-3 text-center font-semibold">QC File</th>
                <th className="px-4 py-3 text-center font-semibold">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-slate-500">
                    <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No QC records found</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isExpanded = expandedRow === record.id;
                  const historyItems = buildHistoryItems(record);

                  return (
                    <React.Fragment key={record.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-slate-800">{record.agent_name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{record.project_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{record.task_name || '—'}</td>
                        <td className={`px-4 py-3 text-center ${getScoreClass(record.qc_score)}`}>
                          {record.qc_score !== null && record.qc_score !== undefined ? `${record.qc_score}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(record.status)}</td>
                        <td className="px-4 py-3 text-center">{getQCStatusBadge(record.qc_status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDateTime(record.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {record.whole_file_path ? (
                            <a
                              href={record.whole_file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {record.qc_file_path ? (
                            <a
                              href={record.qc_file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {historyItems.length > 0 ? (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : record.id)}
                              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Row - History */}
                      {isExpanded && historyItems.length > 0 && (
                        <tr>
                          <td colSpan="10" className="p-0">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-200 p-4">
                              <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                QC History
                              </h4>
                              <div className="overflow-hidden rounded-lg border border-slate-200">
                                <table className="w-full text-sm">
                                  <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold">Type</th>
                                      <th className="px-3 py-2 text-left font-semibold">Date & Time</th>
                                      <th className="px-3 py-2 text-center font-semibold">Status</th>
                                      <th className="px-3 py-2 text-center font-semibold">Score</th>
                                      <th className="px-3 py-2 text-center font-semibold">Errors</th>
                                      <th className="px-3 py-2 text-center font-semibold">File</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {historyItems.map((item) => {
                                      const errors = parseErrors(item.errors);
                                      return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                          <td className="px-3 py-2">
                                            {item.type === 'rework' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
                                                <XCircle className="w-3 h-3" /> Rework #{item.count}
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
                                                <AlertCircle className="w-3 h-3" /> Correction #{item.count}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">{formatDateTime(item.created_at)}</td>
                                          <td className="px-3 py-2 text-center">{getStatusBadge(item.status)}</td>
                                          <td className={`px-3 py-2 text-center ${getScoreClass(item.score)}`}>
                                            {item.score !== null && item.score !== undefined ? `${item.score}%` : '—'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {errors.length > 0 ? (
                                              <button
                                                onClick={() => openErrorModal(item.errors, `${item.type === 'rework' ? 'Rework' : 'Correction'} #${item.count} - Errors`)}
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
                                              <span className="text-slate-400 text-xs">—</span>
                                            )}
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

export default QAAgentQCFormReport;
