import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Download, FileText, Loader2 } from 'lucide-react';
import { fetchEODReportList, generateEODReport } from '../../services/projectService';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

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
      toast.error('Failed to generate EOD report');
    } finally {
      setGenerating(null);
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
          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 pr-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Date Filter</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={handleFromDateChange}
                  className="px-3 py-2 border border-slate-300 rounded-md bg-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={handleToDateChange}
                  className="px-3 py-2 border border-slate-300 rounded-md bg-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all text-slate-700"
                />
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
            {reportData && (
              <span className="text-sm text-slate-600">
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
                  <tr key={`${task.task_id}-${task.project_id}-${index}`} className="hover:bg-blue-50 transition-colors">
                    <td className="py-4 px-4 text-slate-800 font-semibold">{task.date}</td>
                    <td className="py-4 px-4 text-slate-600">
                      <div>
                        <span className="font-medium text-slate-800">{task.project_name}</span>
                        <span className="text-slate-400 text-xs ml-2">({task.project_code})</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-800 font-medium">{task.task_name}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200">
                        {task.tracker_count}
                      </span>
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
