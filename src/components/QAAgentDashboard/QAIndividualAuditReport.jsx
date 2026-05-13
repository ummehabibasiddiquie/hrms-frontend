/**
 * File: QAIndividualAuditReport.jsx
 * Author: Naitik Maisuriya
 * Description: Individual QA Agent Audit Report showing only the logged-in QA agent's audit entries
 */
import React, { useState, useEffect } from 'react';
import { 
  FileCheck,
  Download,
  ExternalLink,
  Search,
  Users,
  Award,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import ErrorMessage from '../common/ErrorMessage';
import { DateRangePicker } from '../common/CustomCalendar';

const QAIndividualAuditReport = () => {
  const { user } = useAuth();

  // Helper function to get QC score color classes
  const getQCScoreColorClass = (score) => {
    if (score === null || score === undefined || score === '-' || isNaN(Number(score))) return 'text-slate-600 bg-slate-100';
    const numScore = Number(score);
    if (numScore >= 95) return 'text-green-700 bg-green-200 font-bold';
    if (numScore >= 80) return 'text-yellow-700 bg-yellow-200 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  // Helper function to get audit status badge classes
  const getAuditStatusBadgeClass = (status) => {
    if (!status) return 'bg-slate-100 text-slate-700';
    const statusLower = status.toLowerCase();
    if (statusLower === 'approved' || statusLower === 'verified') return 'bg-green-100 text-green-700 font-bold';
    if (statusLower === 'pending') return 'bg-yellow-100 text-yellow-700 font-bold';
    if (statusLower === 'rejected') return 'bg-red-100 text-red-700 font-bold';
    return 'bg-slate-100 text-slate-700';
  };

  // Helper function to format date and time
  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === '-') return { date: '-', time: '-' };
    
    try {
      const date = new Date(dateTimeString);
      const day = date.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const formattedTime = `${hours}:${minutes} ${ampm}`;
      
      return { date: formattedDate, time: formattedTime };
    } catch (e) {
      console.error('[QAIndividualAuditReport] Error formatting date:', e);
      return { date: dateTimeString, time: '' };
    }
  };

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // State management
  const [auditData, setAuditData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(() => getTodayDate());
  const [endDate, setEndDate] = useState(() => getTodayDate());

  // Get unique agent names from records
  const uniqueAgents = React.useMemo(() => {
    const agents = new Set();
    auditData.forEach(record => {
      if (record.agent_name) agents.add(record.agent_name);
    });
    return Array.from(agents);
  }, [auditData]);

  // Filter records based on filters
  const filteredRecords = React.useMemo(() => {
    let filtered = auditData;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record =>
        (record.agent_name || '').toLowerCase().includes(query) ||
        (record.project_name || '').toLowerCase().includes(query) ||
        (record.task_name || '').toLowerCase().includes(query)
      );
    }

    // Date range filter with proper time handling
    if (startDate || endDate) {
      filtered = filtered.filter(record => {
        if (!record.audit_datetime) return false;
        
        const recordDate = new Date(record.audit_datetime);
        recordDate.setHours(0, 0, 0, 0);
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (recordDate < start) return false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (recordDate > end) return false;
        }
        
        return true;
      });
    }

    return filtered;
  }, [auditData, searchQuery, startDate, endDate]);

  // Clear all filters
  const resetAllFilters = () => {
    setSearchQuery('');
    setStartDate(getTodayDate());
    setEndDate(getTodayDate());
  };

  // Fetch audit data
  useEffect(() => {
    const fetchAuditData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[QAIndividualAuditReport] Fetching QC audit report...');

        // Call Python backend API with user_id
        const response = await api.post('/qc_audit/report', {
          logged_in_user_id: user?.user_id
        });

        console.log('[QAIndividualAuditReport] API Response:', response.data);

        // Extract records from response
        const records = response.data?.data?.records || [];

        // Map API response to component format
        const mappedData = records.map((record, index) => ({
          audit_id: index + 1,
          audit_datetime: record.audit_datetime,
          agent_name: record.agent_name,
          project_name: record.project,
          task_name: record.task,
          total_qcs: record.total_qcs,
          avg_qc_score: parseFloat(record.avg_qc_score) || 0,
          qc_checked_file: record.qc_checked_file,
          status: record.status,
          error_notes: record.error_notes
        }));

        setAuditData(mappedData);
        console.log('[QAIndividualAuditReport] Mapped data:', mappedData);
        console.log('[QAIndividualAuditReport] Total records:', mappedData.length);

        if (mappedData.length > 0) {
          toast.success(`Loaded ${mappedData.length} audit record${mappedData.length !== 1 ? 's' : ''}`);
        }
      } catch (err) {
        console.error('[QAIndividualAuditReport] Error fetching audit data:', err);
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
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight cursor-default">My Audit Report</h2>
            <p className="text-slate-600 text-sm font-medium mt-1 cursor-default">View your individual audit entries and performance</p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-md border-2 border-blue-100 p-6">
        {/* All Filters in One Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          {/* Search Filter */}
          <div className="lg:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-2">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by agent, project, or task..."
              className="w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
          </div>

          {/* Date Range Filter */}
          <div className="lg:col-span-2">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              showClearButton={false}
              noWrapper={true}
              fieldWidth={null}
            />
          </div>

          {/* Reset Filter Button */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-2 opacity-0">
              Action
            </label>
            <button
              type="button"
              onClick={resetAllFilters}
              className="w-full h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg px-4 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
            >
              <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
            <p className="text-blue-700 font-semibold">Loading audit data...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorMessage message={error} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-400 font-medium text-lg">No audit records found</p>
            <p className="text-gray-400 text-sm mt-2">
              {searchQuery || startDate || endDate
                ? 'Try adjusting your filters'
                : 'No audit data available for this period'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Audit Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Agent Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Total QCs</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">QC Score</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">QC Checked File</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Error Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((record, index) => {
                  const { date, time } = formatDateTime(record.audit_datetime);
                  return (
                    <tr key={record.audit_id || index} className="hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{date}</span>
                          <span className="text-xs text-slate-600">{time}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-blue-700">{record.agent_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{record.project_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{record.task_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-slate-800">{record.total_qcs || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${getQCScoreColorClass(record.avg_qc_score)}`}>
                          {record.avg_qc_score !== null && record.avg_qc_score !== undefined ? `${record.avg_qc_score}%` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {record.qc_checked_file && record.qc_checked_file !== '-' ? (
                          <a 
                            href={record.qc_checked_file}
                            download=""
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-bold transition-colors group/link"
                          >
                            <Download className="w-4 h-4 group-hover/link:animate-bounce" />
                            Download
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold uppercase ${getAuditStatusBadgeClass(record.status)}`}>
                          {record.status || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{record.error_notes || '-'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {!loading && !error && filteredRecords.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase">Total Records</p>
                  <p className="text-2xl font-bold text-slate-800">{filteredRecords.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase">Average Score</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {(filteredRecords.reduce((sum, r) => sum + (r.avg_qc_score || 0), 0) / filteredRecords.length).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase">Agents</p>
                  <p className="text-2xl font-bold text-slate-800">{uniqueAgents.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QAIndividualAuditReport;
