
import React, { useState } from "react";
import { useCurrentUserRole } from "../../hooks/useCurrentUserRole";
import { useAuth } from "../../context/AuthContext";
import { exportToCSV } from '../../utils/csvExport';
import { toast } from "react-hot-toast";
import { User, Download, ChevronUp, Calendar, X, RotateCcw, Edit, Plus } from "lucide-react";
import DailyEntryFormModal from "./DailyEntryFormModal";
import { DateRangePicker } from "./CustomCalendar";

function formatDateTime(dt) {
  if (!dt) return '-';
  const dateObj = new Date(dt);
  if (isNaN(dateObj)) return dt;
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const year = dateObj.getUTCFullYear();
  let hours = dateObj.getUTCHours();
  const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}
export default function UserCard({ 
  user, 
  dailyData = [], 
  expanded: controlledExpanded,
  onToggleExpand = () => {},
  selectedMonth = '',
  onRefresh = () => {},
  team_name = '',
  showTeam = false
}) {
  const role = useCurrentUserRole();
  const { user: currentUser } = useAuth();
  
  // Get role_id - could be from role (if it's a number) or from currentUser.role_id
  const roleId = typeof role === 'number' ? role : currentUser?.role_id;
  
  // Check if user is Assistant Manager (role_id = 4) or QA Agent (role_id = 5)
  const canSeeActions = roleId === 4 || roleId === 5 || role === "ASSISTANT_MANAGER" || role === "QA_AGENT";
  
  // Helper function to get QC score color classes
  const getQCScoreColorClass = (score) => {
    if (score === null || score === undefined || score === '-' || isNaN(Number(score))) return 'text-slate-700';
    const numScore = Number(score);
    if (numScore >= 98) return 'text-green-800 bg-green-100 font-bold';
    if (numScore >= 95) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  // Helper function to get tracker count color classes
  const getTrackerCountColorClass = (count) => {
    if (count === null || count === undefined || count === '-' || isNaN(Number(count))) return 'text-slate-700';
    const numCount = Number(count);
    if (numCount >= 9) return 'text-green-800 bg-green-100 font-bold';
    if (numCount >= 7) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };
  
  // Helper function to get month's first and last day
  const getMonthDateRange = (monthStr) => {
    let year, month;
    
    if (!monthStr) {
      // Default to current month
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1; // Convert to 1-based
    } else {
      [year, month] = monthStr.split('-').map(Number);
    }
    
    // Calculate first day of the month (day 1)
    const firstDay = 1;
    
    // Calculate last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    
    // Format as YYYY-MM-DD without timezone issues
    const pad = (n) => String(n).padStart(2, '0');
    
    return {
      start: `${year}-${pad(month)}-${pad(firstDay)}`,
      end: `${year}-${pad(month)}-${pad(lastDay)}`
    };
  };

  // Use controlled expanded state from parent (persists across re-renders)
  const expanded = controlledExpanded !== undefined ? controlledExpanded : false;
  
  // Each card manages its own date range state independently
  const monthRange = getMonthDateRange(selectedMonth);
  const [start, setStart] = useState(monthRange.start);
  const [end, setEnd] = useState(monthRange.end);

  // Modal state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update date range when selectedMonth changes
  React.useEffect(() => {
    const newRange = getMonthDateRange(selectedMonth);
    setStart(newRange.start);
    setEnd(newRange.end);
  }, [selectedMonth]);

  // Filter dailyData according to this card's date range (client-side filtering)
  const filteredRows = dailyData.filter(row => {
    // Use work_date (YYYY-MM-DD format) for accurate date comparison
    const rowDateStr = row.work_date || row.date_time || row.date;
    if (!rowDateStr) return true; // Include rows without dates
    
    // Extract just the date part (YYYY-MM-DD) for comparison
    let dateStr;
    if (rowDateStr.includes('-') && rowDateStr.split('-').length >= 3) {
      // Already in YYYY-MM-DD or DD-MM-YYYY format
      const parts = rowDateStr.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD format
        dateStr = rowDateStr.split('T')[0]; // Remove time part if exists
      } else {
        // DD-MM-YYYY format - convert to YYYY-MM-DD
        dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    } else {
      // Try parsing as date
      const date = new Date(rowDateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else {
        return true; // Can't parse, include it
      }
    }
    
    // Compare as strings (YYYY-MM-DD format allows string comparison)
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  });

  // Handle Add button click
  const handleAddClick = (rowData = null) => {
    setModalMode('add');
    setSelectedEntry(rowData);
    setSelectedDate(rowData?.date_time || rowData?.date || null);
    setShowEntryModal(true);
  };

  // Handle Edit button click
  const handleEditClick = (rowData) => {
    setModalMode('edit');
    setSelectedEntry(rowData);
    setSelectedDate(rowData?.date_time || rowData?.date || null);
    setShowEntryModal(true);
  };

  // Handle modal submit
  const handleModalSubmit = async (formData) => {
    // The actual API call is now handled inside DailyEntryFormModal
    // This callback is called after successful submission
    console.log('Modal submit callback - Entry saved successfully');
    setShowEntryModal(false);
    setSelectedEntry(null);
    setIsSubmitting(false);
    
    // Refresh the daily report data
    if (onRefresh) {
      onRefresh();
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowEntryModal(false);
    setSelectedEntry(null);
    setSelectedDate(null);
    setModalMode('add');
  };

  // AGENT: Only show the table, no card, header, or controls
  if (role === "AGENT") {
    return (
      <div className="mb-6 overflow-hidden rounded-xl shadow-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Date-Time</th>
              <th className="px-6 py-4 text-center font-semibold">Assign Hours</th>
              <th className="px-6 py-4 text-center font-semibold">Worked Hours</th>
              <th className="px-6 py-4 text-center font-semibold">QC Score</th>
              <th className="px-6 py-4 text-center font-semibold">Tracker Count</th>
              <th className="px-6 py-4 text-center font-semibold">Daily Required Hours</th>
              {canSeeActions && (
                <th className="px-6 py-4 text-center font-semibold">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredRows.map((row, idx) => (
              <tr key={row.date_time || row.date || idx} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-slate-100 last:border-0">
                <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">{row.date_time || row.date || row.work_date || '-'}</td>
                <td className="px-6 py-4 text-center text-slate-700 font-semibold">{row.assigned_hours !== null && row.assigned_hours !== undefined ? Number(row.assigned_hours).toFixed(2) : '-'}</td>
                <td className="px-6 py-4 text-center text-slate-700 font-semibold">{row.billable_hours || row.total_billable_hours_day ? Number(row.billable_hours || row.total_billable_hours_day).toFixed(2) : '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-lg inline-block ${getQCScoreColorClass(row.qc_score)}`}>
                    {row.qc_score !== null && row.qc_score !== undefined ? `${Number(row.qc_score).toFixed(2)}%` : '-'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-lg inline-block ${getTrackerCountColorClass(row.trackers_count_day)}`}>
                    {row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-slate-700">{row.tenure_target || row.daily_required_hours ? Number(row.tenure_target || row.daily_required_hours).toFixed(2) : '-'}</td>
                {canSeeActions && (
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleAddClick(row)}
                        className="group relative p-2 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 hover:border-emerald-300 transition-all duration-200 hover:shadow-md"
                        title="Add Entry"
                      >
                        <Plus className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
                      </button>
                      <button
                        onClick={() => handleEditClick(row)}
                        className="group relative p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                        title="Edit Entry"
                      >
                        <Edit className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {/* Totals Row */}
            {filteredRows.length > 0 && (
              <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-t-2 border-blue-300">
                <td className="px-6 py-4 text-gray-900 font-bold whitespace-nowrap">TOTAL</td>
                <td className="px-6 py-4 text-center text-gray-900 font-bold">
                  {filteredRows.reduce((sum, row) => sum + (Number(row.assigned_hours) || 0), 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center text-gray-900 font-bold">
                  {filteredRows.reduce((sum, row) => sum + (Number(row.billable_hours || row.total_billable_hours_day) || 0), 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center text-gray-900 font-bold">
                  {(() => {
                    const scores = filteredRows.filter(row => row.qc_score != null).map(row => Number(row.qc_score));
                    return scores.length > 0 ? `${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)}%` : '-';
                  })()}
                </td>
                <td className="px-6 py-4 text-center text-gray-900 font-bold">
                  {filteredRows.reduce((sum, row) => sum + (Number(row.trackers_count_day) || 0), 0)}
                </td>
                <td className="px-6 py-4 text-center text-gray-900 font-bold">
                  {filteredRows.reduce((sum, row) => sum + (Number(row.tenure_target || row.daily_required_hours) || 0), 0).toFixed(2)}
                </td>
                {canSeeActions && (
                  <td className="px-6 py-4 text-center"></td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // All other roles: show card UI as before
  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 mb-6 group">
      {/* Decorative gradient border on left */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-indigo-500 to-blue-600"></div>
      
      {/* Header Section */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50 border-b border-slate-200">
        <div className="flex items-center gap-4 px-6 py-5">
          {/* User Avatar */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <User className="w-6 h-6 text-white" />
          </div>
          
          {/* User Info */}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">{user.user_name}</h3>
            {showTeam && team_name && (
              <p className="text-sm text-slate-600 font-medium mt-0.5">{team_name}</p>
            )}
          </div>
          
          {/* Toggle Button */}
          <button
            className="p-2 rounded-full hover:bg-blue-100 transition-colors duration-200"
            title={expanded ? "Collapse" : "Expand"}
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={e => { 
              e.stopPropagation(); 
              onToggleExpand(!expanded);
            }}
          >
            <ChevronUp className={`w-5 h-5 text-slate-600 transition-transform duration-300 ${expanded ? '' : 'rotate-180'}`} />
          </button>
        </div>
        
        {/* Filter Section */}
        {expanded && (
          <div className="px-6 pb-5 pt-0">
            {/* Date Range Card */}
            <div className="bg-white p-4 rounded-xl shadow-md border-2 border-blue-100">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
                {/* Icon and Title */}
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 leading-tight">Date Range Filter</h3>
                  </div>
                </div>
                
                {/* Date Range Picker - Using shadcn calendar */}
                <div className="flex-1">
                  <DateRangePicker
                    startDate={start}
                    endDate={end}
                    onStartDateChange={setStart}
                    onEndDateChange={setEnd}
                    label=""
                    description={null}
                    showClearButton={false}
                    compact={true}
                    fieldWidth="220px"
                    noWrapper={true}
                  />
                </div>
                
                {/* Action Buttons - Aligned with date fields */}
                <div className="flex flex-wrap items-center gap-3 self-end">
                  {/* Reset Button */}
                  <button
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg px-6 py-2.5 transition-all shadow-sm hover:shadow-md group"
                    onClick={() => {
                      const newRange = getMonthDateRange(selectedMonth);
                      setStart(newRange.start);
                      setEnd(newRange.end);
                    }}
                    type="button"
                  >
                    <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                    Reset Filter
                  </button>
                  
                  {/* Export Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                      // Helper to safely format number or return '-'
                      const formatNumber = (val) => {
                        if (val === null || val === undefined || val === '' || val === '-') return '-';
                        const num = Number(val);
                        return isNaN(num) ? '-' : num.toFixed(2);
                      };
                      
                      // Use filteredRows (already filtered by date range)
                      let exportData = filteredRows.map(row => ({
                        'Date': formatDateTime(row.date_time ?? row.date),
                        'Assign Hours': formatNumber(row.assigned_hours ?? row.assign_hours ?? row.assignHours),
                        'Worked Hours': formatNumber(row.billable_hours ?? row.workedHours ?? row.worked_hours),
                        'QC Score': row.qc_score != null || row.qcScore != null ? `${formatNumber(row.qc_score ?? row.qcScore)}%` : '-',
                        'Tracker Count': row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-',
                        'Daily Required Hours': formatNumber(row.tenure_target ?? row.dailyRequiredHours ?? row.daily_required_hours)
                      }));
                      if (exportData.length > 0) {
                        const totalAssigned = exportData.reduce((sum, r) => sum + (parseFloat(r['Assign Hours']) || 0), 0);
                        const totalWorked = exportData.reduce((sum, r) => sum + (parseFloat(r['Worked Hours']) || 0), 0);
                        const totalRequired = exportData.reduce((sum, r) => sum + (parseFloat(r['Daily Required Hours']) || 0), 0);
                        const qcScores = exportData.map(r => parseFloat(r['QC Score'])).filter(v => !isNaN(v));
                        const avgQC = qcScores.length > 0 ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%` : '-';
                        
                        const totalTrackers = exportData.reduce((sum, r) => {
                          const count = r['Tracker Count'];
                          return sum + (count !== '-' ? parseInt(count) : 0);
                        }, 0);
                        
                        exportData.push({
                          'Date': 'TOTAL',
                          'Assign Hours': totalAssigned.toFixed(2),
                          'Worked Hours': totalWorked.toFixed(2),
                          'QC Score': avgQC,
                          'Tracker Count': totalTrackers,
                          'Daily Required Hours': totalRequired.toFixed(2)
                        });
                      }
                      const filename = `Daily_Report_${user.user_name || 'User'}_${start || 'all'}_${end || 'all'}.csv`;
                      exportToCSV(exportData, filename);
                      toast.success('Daily report exported successfully!');
                    } catch {
                      toast.error('Failed to export daily report');
                    }
                  }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                    title="Export filtered data"
                    aria-label="Export"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Table Section */}
      {expanded && (
        <div className="p-6 bg-gradient-to-br from-slate-50 to-white">
          <div className="overflow-hidden rounded-xl shadow-md border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Date-Time</th>
                  <th className="px-6 py-4 text-center font-semibold">Assign Hours</th>
                  <th className="px-6 py-4 text-center font-semibold">Worked Hours</th>
                  <th className="px-6 py-4 text-center font-semibold">QC Score</th>
                  <th className="px-6 py-4 text-center font-semibold">Tracker Count</th>
                  <th className="px-6 py-4 text-center font-semibold">Daily Required Hours</th>
                  {canSeeActions && (
                    <th className="px-6 py-4 text-center font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredRows.length > 0 ? (
                  <>
                    {filteredRows.map((row, idx) => (
                      <tr key={row.date_time || row.date || idx} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200">
                        <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">{row.date_time || row.date || '-'}</td>
                        <td className="px-6 py-4 text-center text-slate-700">
                          {row.assign_hours === '-' || row.assignHours === '-' ? '-' : (row.assign_hours !== undefined && row.assign_hours !== null && !isNaN(Number(row.assign_hours)) ? Number(row.assign_hours).toFixed(2) : (row.assignHours ?? row.assigned_hour ?? "-"))}
                        </td>
                        <td className="px-6 py-4 text-center text-blue-700 font-semibold">
                          {row.worked_hours === '-' || row.workedHours === '-' ? '-' : (row.billable_hours !== undefined && row.billable_hours !== null && !isNaN(Number(row.billable_hours)) ? Number(row.billable_hours).toFixed(2) : (row.worked_hours ?? row.workedHours ?? '-'))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg inline-block ${getQCScoreColorClass(row.qc_score ?? row.qcScore)}`}>
                          {row.qc_score === '-' || row.qcScore === '-' ? '-' : ('qc_score' in row ? (row.qc_score !== null && row.qc_score !== undefined && !isNaN(Number(row.qc_score)) ? `${Number(row.qc_score).toFixed(2)}%` : '-') : (row.qcScore ? `${row.qcScore}%` : '-'))}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg inline-block ${getTrackerCountColorClass(row.trackers_count_day)}`}>
                            {row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700">
                          {row.daily_required_hours === '-' || row.dailyRequiredHours === '-' ? '-' : (row.tenure_target !== undefined && row.tenure_target !== null && !isNaN(Number(row.tenure_target)) ? Number(row.tenure_target).toFixed(2) : (row.daily_required_hours ?? row.dailyRequiredHours ?? '-'))}
                        </td>
                        {canSeeActions && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleAddClick(row)}
                                className="group relative p-2 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 hover:border-emerald-300 transition-all duration-200 hover:shadow-md"
                                title="Add Entry"
                              >
                                <Plus className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
                              </button>
                              <button
                                onClick={() => handleEditClick(row)}
                                className="group relative p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                                title="Edit Entry"
                              >
                                <Edit className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-t-2 border-blue-300">
                      <td className="px-6 py-4 text-gray-900 font-bold whitespace-nowrap">TOTAL</td>
                      <td className="px-6 py-4 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => {
                          const val = row.assign_hours ?? row.assignHours ?? row.assigned_hour ?? 0;
                          return sum + (Number(val) || 0);
                        }, 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => {
                          const val = row.billable_hours ?? row.worked_hours ?? row.workedHours ?? 0;
                          return sum + (Number(val) || 0);
                        }, 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-900 font-bold">
                        {(() => {
                          const scores = filteredRows.filter(row => {
                            const score = row.qc_score ?? row.qcScore;
                            return score != null && score !== '-' && !isNaN(Number(score));
                          }).map(row => Number(row.qc_score ?? row.qcScore));
                          return scores.length > 0 ? `${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)}%` : '-';
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.trackers_count_day) || 0), 0)}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => {
                          const val = row.tenure_target ?? row.daily_required_hours ?? row.dailyRequiredHours ?? 0;
                          return sum + (Number(val) || 0);
                        }, 0).toFixed(2)}
                      </td>
                      {canSeeActions && (
                        <td className="px-6 py-4 text-center"></td>
                      )}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <Calendar className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="font-medium">No data available for the selected date range</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Entry Form Modal */}
      <DailyEntryFormModal
        isOpen={showEntryModal}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        initialData={selectedEntry}
        isEditMode={modalMode === 'edit'}
        isSubmitting={isSubmitting}
        user={user}
        userRole={role}
        roleId={roleId}
        userId={user?.user_id || user?.id}
        date={selectedDate}
      />
    </div>
  );
}
