import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Download, FileText, Loader2, RotateCcw, X } from 'lucide-react';
import { fetchEODReportList, fetchEODReportTrackers, generateEODReport } from '../../services/projectService';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const REASON_LABELS = {
  inactive: 'Inactive',
  actual_target_missing: 'Actual target missing',
  tenure_target_missing: 'Tenure target missing',
  tenure_target_zero: 'Tenure target is 0',
  tracker_file_missing: 'Tracker file missing',
  file_not_found: 'File not found on Cloudinary',
  file_unreachable: 'File unreachable on Cloudinary'
};

const formatReasons = (reasons = []) => {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return '-';
  }

  return reasons
    .filter(Boolean)
    .map((reason) => REASON_LABELS[reason] || String(reason).replace(/_/g, ' '))
    .join(', ') || '-';
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateString) => {
  if (!dateString) {
    return '';
  }

  const [year, month, day] = String(dateString).split('-');
  if (!year || !month || !day) {
    return dateString;
  }

  return `${month}-${day}-${year}`;
};

const formatDisplayDateWithDay = (dateString) => {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }

  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const [year, month, day] = String(dateString).split('-');
  if (!year || !month || !day) {
    return dateString;
  }

  const dateStr = `${month}-${day}-${year}`;
  return `${dateStr}\n${dayName}`;
};

// Helper function to get day color class (Saturday/Sunday in red)
const getDayColorClass = (dateString) => {
  if (!dateString) return '';
  const dayName = dateString.split('\n')[1]?.toLowerCase();
  if (dayName === 'saturday' || dayName === 'sunday') {
    return 'text-red-600 font-bold';
  }
  return '';
};

const getDefaultDateRange = () => {
  const today = new Date();
  const toDate = formatLocalDate(today);
  const fromDate = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));

  return { fromDate, toDate };
};

const TaskEODReport = () => {
  const { user } = useAuth();
  const defaultRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [trackerModal, setTrackerModal] = useState({
    open: false,
    loading: false,
    task: null,
    data: null,
    activeTab: 'valid'
  });
  const loggedInUserId = user?.user_id || user?.id;

  const fetchReportList = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      return;
    }

    if (!loggedInUserId) {
      setReportData(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchEODReportList({
        logged_in_user_id: loggedInUserId,
        from_date: fromDate,
        to_date: toDate
      });
      if (response?.status === 200) {
        setReportData(response.data);
      } else {
        toast.error(response?.message || 'Failed to fetch EOD report list');
        setReportData(null);
      }
    } catch (error) {
      console.error('Error fetching EOD report list:', error);
      toast.error('Failed to fetch EOD report list');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, loggedInUserId]);

  useEffect(() => {
    fetchReportList();
  }, [fetchReportList]);

  const handleFromDateChange = (event) => {
    const nextFromDate = event.target.value;

    setFromDate(nextFromDate);
    if (toDate && nextFromDate && nextFromDate > toDate) {
      setToDate(nextFromDate);
    }
  };

  const handleToDateChange = (event) => {
    const nextToDate = event.target.value;

    setToDate(nextToDate);
    if (fromDate && nextToDate && nextToDate < fromDate) {
      setFromDate(nextToDate);
    }
  };

  const handleResetFilters = () => {
    const currentMonthRange = getDefaultDateRange();
    setFromDate(currentMonthRange.fromDate);
    setToDate(currentMonthRange.toDate);
  };

  const handleGenerateReport = async (task) => {
    if (!loggedInUserId) {
      toast.error('User session not found');
      return;
    }

    const generateKey = `${task.task_id}-${task.project_id}-${task.report_date}`;
    setGenerating(generateKey);
    try {
      const response = await generateEODReport({
        logged_in_user_id: loggedInUserId,
        task_id: task.task_id,
        project_id: task.project_id,
        date: task.report_date
      });

      // Handle file download
      if (response && response instanceof Blob) {
        // If backend returned a JSON error blob (common when responseType is 'blob'),
        // parse it and show the message instead of downloading a broken file.
        const isJsonBlob = response.type && response.type.includes('application/json');
        if (isJsonBlob) {
          const text = await response.text();
          try {
            const parsed = JSON.parse(text);
            const failedFiles = parsed?.data?.failed_files || [];
            if (Array.isArray(failedFiles) && failedFiles.length > 0) {
              const preview = failedFiles
                .slice(0, 3)
                .map((f) => `#${f?.tracker_id} (${f?.user_name || 'Unknown'})`)
                .join(', ');
              const more = failedFiles.length > 3 ? ` +${failedFiles.length - 3} more` : '';
              toast.error(`${parsed?.message || 'Failed to generate EOD report'} Missing/unreadable: ${preview}${more}.`);
            } else {
              toast.error(parsed?.message || 'Failed to generate EOD report');
            }
          } catch (e) {
            toast.error('Failed to generate EOD report');
          }
          return;
        }

        const url = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EOD_Report_${task.task_name}_${formatDisplayDate(task.report_date)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('EOD report downloaded successfully!');
      } else {
        toast.error('Failed to generate EOD report');
      }
    } catch (error) {
      console.error('Error generating EOD report:', error);
      // When responseType is blob, error body may still be a JSON blob
      const errBlob = error?.response?.data;
      if (errBlob instanceof Blob && errBlob.type && errBlob.type.includes('application/json')) {
        try {
          const text = await errBlob.text();
          const parsed = JSON.parse(text);
          const failedFiles = parsed?.data?.failed_files || [];
          if (Array.isArray(failedFiles) && failedFiles.length > 0) {
            const preview = failedFiles
              .slice(0, 3)
              .map((f) => `#${f?.tracker_id} (${f?.user_name || 'Unknown'})`)
              .join(', ');
            const more = failedFiles.length > 3 ? ` +${failedFiles.length - 3} more` : '';
            toast.error(`${parsed?.message || 'Failed to generate EOD report'} Missing/unreadable: ${preview}${more}.`);
          } else {
            toast.error(parsed?.message || 'Failed to generate EOD report');
          }
          return;
        } catch (e) {
          // fall through to generic
        }
      }
      toast.error(error?.response?.data?.message || 'Failed to generate EOD report');
    } finally {
      setGenerating(null);
    }
  };

  const handleViewTrackers = async (task) => {
    if (!loggedInUserId) {
      toast.error('User session not found');
      return;
    }

    setTrackerModal({
      open: true,
      loading: true,
      task,
      data: null,
      activeTab: 'valid'
    });

    try {
      const response = await fetchEODReportTrackers({
        logged_in_user_id: loggedInUserId,
        task_id: task.task_id,
        project_id: task.project_id,
        date: task.report_date
      });

      if (response?.status === 200) {
        setTrackerModal(prev => ({
          ...prev,
          loading: false,
          data: response.data
        }));
      } else {
        toast.error(response?.message || 'Failed to fetch tracker list');
        setTrackerModal(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error fetching tracker list:', error);
      toast.error('Failed to fetch tracker list');
      setTrackerModal(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in p-4 md:p-0 w-full">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Task EOD Consolidated Report</h2>
            <p className="text-slate-500 text-xs">Generate task-wise daily reports on demand</p>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col gap-4 mb-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-lg shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Task List</h3>
              {reportData?.from_date && reportData?.to_date && (
                <p className="text-xs text-slate-500">
                  Showing records from {reportData.from_date} to {reportData.to_date}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={handleFromDateChange}
                  className="w-[180px] px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-700 hover:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={handleToDateChange}
                  className="w-[180px] px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-slate-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-slate-700 hover:border-blue-400"
                />
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              {reportData && (
                <span className="text-sm font-medium text-slate-600 self-center">
                  {reportData.total_tasks} task{reportData.total_tasks !== 1 ? 's' : ''} found
                </span>
              )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <span className="ml-3 text-slate-600">Loading tasks...</span>
          </div>
        ) : !reportData || reportData.tasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">No tasks found</h3>
            <p className="text-slate-500">
              {!reportData 
                ? 'Loading task list'
                : 'No valid tasks found for the selected date range. Tasks must have all required fields filled.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white">
                  <th className="text-left py-4 px-4 font-bold uppercase tracking-wide">Date</th>
                  <th className="text-left py-4 px-4 font-bold uppercase tracking-wide">Project</th>
                  <th className="text-left py-4 px-4 font-bold uppercase tracking-wide">Task</th>
                  <th className="text-center py-4 px-4 font-bold uppercase tracking-wide">Entries</th>
                  <th className="text-center py-4 px-4 font-bold uppercase tracking-wide">Generate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reportData.tasks.map((task, index) => (
                  <tr key={`${task.task_id}-${task.project_id}-${index}`} className={`${getDayColorClass(formatDisplayDateWithDay(task.date)) ? 'bg-orange-50 border-l-4 border-l-orange-800' : ''} hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200`}>
                    <td className="py-4 px-4 text-slate-800 font-semibold whitespace-pre-line">
                      <div className={getDayColorClass(formatDisplayDateWithDay(task.date))}>{formatDisplayDateWithDay(task.date)}</div>
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      <div>
                        <span className="font-medium text-slate-800">{task.project_name}</span>
                        <span className="text-slate-400 text-xs ml-2">({task.project_code})</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-800 font-medium">{task.task_name}</td>
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleViewTrackers(task)}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200 hover:from-green-200 hover:to-emerald-200 transition-colors"
                      >
                        {task.tracker_count}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => handleGenerateReport(task)}
                        disabled={generating === `${task.task_id}-${task.project_id}-${task.report_date}`}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                      >
                        {generating === `${task.task_id}-${task.project_id}-${task.report_date}` ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Generate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {trackerModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Tracker List</h3>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">
                  {trackerModal.task?.task_name} • {trackerModal.task?.project_name} • {formatDisplayDateWithDay(trackerModal.task?.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrackerModal({ open: false, loading: false, task: null, data: null, activeTab: 'valid' })}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5 text-slate-700" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              {trackerModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                  <span className="ml-3 text-slate-600">Loading trackers...</span>
                </div>
              ) : !trackerModal.data ? (
                <div className="text-center py-12 text-slate-600">No data</div>
              ) : (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="text-sm text-slate-600 font-medium">
                      Total: {trackerModal.data.total_all} • Valid: {trackerModal.data.total_valid} • Excluded: {trackerModal.data.total_invalid}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTrackerModal(prev => ({ ...prev, activeTab: 'valid' }))}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                          trackerModal.activeTab === 'valid'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Valid ({trackerModal.data.total_valid})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrackerModal(prev => ({ ...prev, activeTab: 'invalid' }))}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                          trackerModal.activeTab === 'invalid'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Excluded ({trackerModal.data.total_invalid})
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="text-left py-3 px-4 font-bold uppercase tracking-wide">Tracker ID</th>
                          <th className="text-left py-3 px-4 font-bold uppercase tracking-wide">User</th>
                          <th className="text-left py-3 px-4 font-bold uppercase tracking-wide">Work Date</th>
                          <th className="text-left py-3 px-4 font-bold uppercase tracking-wide">Shift</th>
                          <th className="text-right py-3 px-4 font-bold uppercase tracking-wide">Production</th>
                          <th className="text-left py-3 px-4 font-bold uppercase tracking-wide">File</th>
                          {trackerModal.activeTab === 'invalid' && (
                            <th className="text-left py-3 px-4 font-bold uppercase tracking-wide">Reason</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(trackerModal.activeTab === 'valid'
                          ? trackerModal.data.valid_trackers
                          : trackerModal.data.invalid_trackers
                        ).map((t) => (
                          <tr key={t.tracker_id} className="hover:bg-blue-50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-800">{t.tracker_id}</td>
                            <td className="py-3 px-4 text-slate-700">{t.user_name}</td>
                            <td className="py-3 px-4 text-slate-700">{t.date_time_display || t.date_time || '-'}</td>
                            <td className="py-3 px-4 text-slate-700">{t.shift || '-'}</td>
                            <td className="py-3 px-4 text-right text-slate-700">{t.production ?? '-'}</td>
                            <td className="py-3 px-4">
                              {t.tracker_file ? (
                                <a
                                  href={t.tracker_file}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-700 font-semibold hover:underline"
                                >
                                  Open
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            {trackerModal.activeTab === 'invalid' && (
                              <td className="py-3 px-4 text-slate-700">
                                {formatReasons(t.reasons)}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setTrackerModal({ open: false, loading: false, task: null, data: null, activeTab: 'valid' })}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Information
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use From and To dates to auto-load valid task entries for the selected range</li>
          <li>• Only tasks with all required fields (production, billable_hours, actual_target, tenure_target, tracker_file) are shown</li>
          <li>• If multiple files are uploaded for the same task and date (even by the same agent), all files are merged and duplicates are removed based on important columns</li>
          <li>• Reports are generated on-demand and not stored in the database</li>
          <li>• Click "Generate" to download the consolidated report for that row's date</li>
        </ul>
      </div>
    </div>
  );
};

export default TaskEODReport;
