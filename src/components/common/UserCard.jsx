
import React, { useState } from "react";
import { useCurrentUserRole } from "../../hooks/useCurrentUserRole";
import { useAuth } from "../../context/AuthContext";
import { exportToCSV } from '../../utils/csvExport';
import { toast } from "react-hot-toast";
import { User, Download, ChevronUp, Calendar, X, Edit } from "lucide-react";
import DailyEntryFormModal from "./DailyEntryFormModal";
import { formatISTDateTime } from "../../utils/dateTimeIST";

function formatDateTime(dt) {
  return formatISTDateTime(dt, dt || "-");
}
export default function UserCard({ 
  user, 
  dailyData = [], 
  expanded: controlledExpanded,
  onToggleExpand = () => {},
  selectedMonth = '',
  rangeStart = '',
  rangeEnd = '',
  onRefresh = () => {},
  team_name = '',
  showTeam = false,
  alwaysExpanded = false,
  suppressHeader = false,
  agentSummary = null,
}) {
  const role = useCurrentUserRole();
  const { user: currentUser } = useAuth();
  
  // Get role_id - could be from role (if it's a number) or from currentUser.role_id
  const roleId = Number(typeof role === 'number' ? role : currentUser?.role_id);
  const normalizedRole = String(
    role || currentUser?.role || currentUser?.role_name || currentUser?.user_role || ''
  ).toUpperCase();
  const normalizedDesignation = String(
    currentUser?.designation || currentUser?.user_designation || ''
  ).toUpperCase();

  // IMPORTANT: In this app, Super Admin vs Admin must be decided by role (not by permission flags),
  // because Admin users can also have both permissions enabled.
  const isSuperAdmin =
    roleId === 1 ||
    normalizedRole.includes("SUPER_ADMIN") ||
    normalizedRole.includes("SUPER ADMIN") ||
    normalizedDesignation.includes("SUPER");

  const isAdmin = !isSuperAdmin && (roleId === 2 || normalizedRole === "ADMIN");
  const isProjectManager =
    roleId === 3 ||
    normalizedRole.includes("PROJECT_MANAGER") ||
    normalizedRole.includes("PROJECT MANAGER");
  const isAssistantManager =
    roleId === 4 ||
    normalizedRole.includes("ASSISTANT") ||
    normalizedRole.includes("ASST") ||
    normalizedDesignation.includes("ASSISTANT") ||
    normalizedDesignation.includes("ASST");
  
  // Only Admin, Project Manager, and Assistant Manager can edit assigned hours in Billable Report.
  const canSeeActions = isAdmin || isProjectManager || isAssistantManager;
  
  // Helper function to get QC score color classes
  const getQCScoreColorClass = (score) => {
    if (score === null || score === undefined || score === '-' || isNaN(Number(score))) return 'text-slate-700';
    const numScore = Number(score);
    if (numScore >= 98) return 'text-green-800 bg-green-100 font-bold';
    if (numScore >= 95) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  const getRosterStatus = (row) => row?.roster_status || row?.day_status || '—';

  const getRosterStatusClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('week off')) return 'text-slate-700 bg-slate-100 font-semibold';
    if (s.includes('holiday')) return 'text-purple-800 bg-purple-100 font-semibold';
    if (s.includes('half day leave')) return 'text-amber-800 bg-amber-100 font-semibold';
    if (s.includes('leave')) return 'text-orange-800 bg-orange-100 font-semibold';
    if (s.includes('half day')) return 'text-amber-800 bg-amber-50 font-semibold';
    if (s.includes('pre join')) return 'text-slate-600 bg-slate-50 font-semibold';
    if (s.includes('working')) return 'text-green-800 bg-green-50 font-semibold';
    return 'text-slate-600 bg-slate-50';
  };

  // Helper function to get tracker count color classes
  const getTrackerCountColorClass = (count) => {
    if (count === null || count === undefined || count === '-' || isNaN(Number(count))) return 'text-slate-700';
    const numCount = Number(count);
    if (numCount >= 9) return 'text-green-800 bg-green-100 font-bold';
    if (numCount >= 7) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  const isWeekendDay = (dayName) => {
    if (!dayName) return false;
    const day = String(dayName).toLowerCase();
    return day === 'saturday' || day === 'sunday';
  };

  const getDayColorClass = (dayName) => {
    return isWeekendDay(dayName) ? 'text-red-600 font-bold' : '';
  };

  const expanded = alwaysExpanded || (controlledExpanded !== undefined ? controlledExpanded : false);
  const filteredRows = dailyData;
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
              <th className="px-6 py-4 text-center font-semibold">Day Status</th>
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
              <tr key={row.date_time || row.date || idx} className={`${isWeekendDay(row.day) ? 'bg-orange-50 border-l-4 border-l-orange-800' : ''} hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200`}>
                <td className={`px-6 py-4 font-medium whitespace-pre-line ${getDayColorClass(row.day)}`}>
                  {row.date_time || row.date || row.work_date || '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-lg inline-block ${getRosterStatusClass(getRosterStatus(row))}`}>
                    {getRosterStatus(row)}
                  </span>
                </td>
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
                        onClick={() => handleEditClick(row)}
                        className="group relative p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                        title="Edit Assigned Hours"
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
                <td className="px-6 py-4 text-center text-gray-900 font-bold">—</td>
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

  // Panel mode — matches standard UserCard styling (Daily Report split view)
  if (alwaysExpanded && suppressHeader) {
    const headerTh = "px-4 py-2.5 text-white font-semibold bg-blue-600";
    const tableClass = "w-full min-w-[720px] text-sm table-fixed border-collapse";

    const renderColGroup = () => (
      <colgroup>
        <col style={{ width: canSeeActions ? "17%" : "18%" }} />
        <col style={{ width: canSeeActions ? "12%" : "13%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: canSeeActions ? "13%" : "14%" }} />
        {canSeeActions && <col style={{ width: "8%" }} />}
      </colgroup>
    );

    return (
      <div className="relative flex flex-col overflow-hidden h-full min-h-0 bg-white">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-3">
          <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-slate-200 overflow-hidden bg-white">
            {/* Header stays fixed — only body scrolls */}
            <div className="shrink-0 overflow-x-auto bg-blue-600 border-b-2 border-blue-700 shadow-sm">
              <table className={tableClass}>
                {renderColGroup()}
                <thead>
                  <tr>
                    <th className={`${headerTh} text-left whitespace-nowrap`}>Date-Time</th>
                    <th className={`${headerTh} text-center`}>Day Status</th>
                    <th className={`${headerTh} text-center`}>Assign Hours</th>
                    <th className={`${headerTh} text-center`}>Worked Hours</th>
                    <th className={`${headerTh} text-center`}>QC Score</th>
                    <th className={`${headerTh} text-center`}>Tracker Count</th>
                    <th className={`${headerTh} text-center`}>Daily Required Hours</th>
                    {canSeeActions && <th className={`${headerTh} text-center`}>Actions</th>}
                  </tr>
                </thead>
              </table>
            </div>

            <div className="flex-1 min-h-0 overflow-auto panel-scroll overflow-x-auto">
              <table className={tableClass}>
                {renderColGroup()}
                <tbody className="bg-white divide-y divide-slate-100">
                {filteredRows.length > 0 ? (
                  <>
                    {filteredRows.map((row, idx) => (
                      <tr
                        key={row.date_time || row.date || idx}
                        className={`${isWeekendDay(row.day) ? 'bg-orange-50 border-l-4 border-l-orange-800' : ''} hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200`}
                      >
                        <td className={`px-4 py-2 font-medium whitespace-pre-line ${getDayColorClass(row.day)}`}>{row.date_time || row.date || '-'}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-lg inline-block text-xs ${getRosterStatusClass(getRosterStatus(row))}`}>
                            {getRosterStatus(row)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-slate-700">
                          {row.assign_hours === '-' || row.assignHours === '-' ? '-' : (row.assign_hours !== undefined && row.assign_hours !== null && !isNaN(Number(row.assign_hours)) ? Number(row.assign_hours).toFixed(2) : (row.assignHours ?? row.assigned_hour ?? "-"))}
                        </td>
                        <td className="px-4 py-2 text-center text-blue-700 font-semibold">
                          {row.worked_hours === '-' || row.workedHours === '-' ? '-' : (row.billable_hours !== undefined && row.billable_hours !== null && !isNaN(Number(row.billable_hours)) ? Number(row.billable_hours).toFixed(2) : (row.worked_hours ?? row.workedHours ?? '-'))}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-lg inline-block text-xs ${getQCScoreColorClass(row.qc_score ?? row.qcScore)}`}>
                            {row.qc_score === '-' || row.qcScore === '-' ? '-' : ('qc_score' in row ? (row.qc_score !== null && row.qc_score !== undefined && !isNaN(Number(row.qc_score)) ? `${Number(row.qc_score).toFixed(2)}%` : '-') : (row.qcScore ? `${row.qcScore}%` : '-'))}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-lg inline-block text-xs ${getTrackerCountColorClass(row.trackers_count_day)}`}>
                            {row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-slate-700">
                          {row.daily_required_hours === '-' || row.dailyRequiredHours === '-' ? '-' : (row.tenure_target !== undefined && row.tenure_target !== null && !isNaN(Number(row.tenure_target)) ? Number(row.tenure_target).toFixed(2) : (row.daily_required_hours ?? row.dailyRequiredHours ?? '-'))}
                        </td>
                        {canSeeActions && (
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleEditClick(row)}
                              className="group relative p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                              title="Edit Assigned Hours"
                            >
                              <Edit className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-t-2 border-blue-300">
                      <td className="px-4 py-2 text-gray-900 font-bold whitespace-nowrap">TOTAL</td>
                      <td className="px-4 py-2 text-center text-gray-900 font-bold">—</td>
                      <td className="px-4 py-2 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.assign_hours ?? row.assignHours ?? row.assigned_hour) || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.billable_hours ?? row.worked_hours ?? row.workedHours) || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-900 font-bold">
                        {(() => {
                          const scores = filteredRows.filter(row => row.qc_score != null && row.qc_score !== '-').map(row => Number(row.qc_score));
                          return scores.length > 0 ? `${(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)}%` : '-';
                        })()}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.trackers_count_day) || 0), 0)}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.tenure_target ?? row.daily_required_hours ?? row.dailyRequiredHours) || 0), 0).toFixed(2)}
                      </td>
                      {canSeeActions && <td className="px-4 py-2" />}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={canSeeActions ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                      No daily entries for this period
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </div>
        </div>
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
          logged_in_user_id={currentUser?.user_id || currentUser?.id}
        />
      </div>
    );
  }

  if (alwaysExpanded) {
    return (
      <div className="relative flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-lg mb-0 h-full min-h-0">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-indigo-500 to-blue-600" />

        <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight truncate">{user.user_name}</h3>
              {showTeam && team_name && (
                <p className="text-xs text-slate-600 font-medium truncate">{team_name}</p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const formatNumber = (val) => {
                    if (val === null || val === undefined || val === '' || val === '-') return '-';
                    const num = Number(val);
                    return isNaN(num) ? '-' : num.toFixed(2);
                  };
                  let exportData = filteredRows.map(row => ({
                    'Date': formatDateTime(row.date_time ?? row.date),
                    'Day Status': getRosterStatus(row),
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
                    const totalTrackers = exportData.reduce((sum, r) => sum + (r['Tracker Count'] !== '-' ? parseInt(r['Tracker Count']) : 0), 0);
                    exportData.push({
                      'Date': 'TOTAL',
                      'Day Status': '',
                      'Assign Hours': totalAssigned.toFixed(2),
                      'Worked Hours': totalWorked.toFixed(2),
                      'QC Score': avgQC,
                      'Tracker Count': totalTrackers,
                      'Daily Required Hours': totalRequired.toFixed(2)
                    });
                  }
                  const filename = `Daily_Report_${user.user_name || 'User'}_${rangeStart || selectedMonth || 'all'}_${rangeEnd || 'all'}.csv`;
                  exportToCSV(exportData, filename);
                  toast.success('Daily report exported successfully!');
                } catch {
                  toast.error('Failed to export daily report');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all duration-200 shrink-0"
              title="Export this agent"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto panel-scroll p-2 bg-gradient-to-br from-slate-50 to-white">
          <div className="overflow-hidden rounded-xl shadow-md border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold whitespace-nowrap">Date-Time</th>
                  <th className="px-4 py-2 text-center font-semibold">Day Status</th>
                  <th className="px-4 py-2 text-center font-semibold">Assign Hours</th>
                  <th className="px-4 py-2 text-center font-semibold">Worked Hours</th>
                  <th className="px-4 py-2 text-center font-semibold">QC Score</th>
                  <th className="px-4 py-2 text-center font-semibold">Tracker Count</th>
                  <th className="px-4 py-2 text-center font-semibold">Daily Required Hours</th>
                  {canSeeActions && (
                    <th className="px-4 py-2 text-center font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredRows.length > 0 ? (
                  <>
                    {filteredRows.map((row, idx) => (
                      <tr
                        key={row.date_time || row.date || idx}
                        className={`${isWeekendDay(row.day) ? 'bg-orange-50 border-l-4 border-l-orange-800' : ''} hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200`}
                      >
                        <td className={`px-4 py-2 font-medium whitespace-pre-line ${getDayColorClass(row.day)}`}>{row.date_time || row.date || '-'}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-lg inline-block text-xs ${getRosterStatusClass(getRosterStatus(row))}`}>
                            {getRosterStatus(row)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-slate-700">
                          {row.assign_hours === '-' || row.assignHours === '-' ? '-' : (row.assign_hours !== undefined && row.assign_hours !== null && !isNaN(Number(row.assign_hours)) ? Number(row.assign_hours).toFixed(2) : (row.assignHours ?? row.assigned_hour ?? "-"))}
                        </td>
                        <td className="px-4 py-2 text-center text-blue-700 font-semibold">
                          {row.worked_hours === '-' || row.workedHours === '-' ? '-' : (row.billable_hours !== undefined && row.billable_hours !== null && !isNaN(Number(row.billable_hours)) ? Number(row.billable_hours).toFixed(2) : (row.worked_hours ?? row.workedHours ?? '-'))}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-lg inline-block text-xs ${getQCScoreColorClass(row.qc_score ?? row.qcScore)}`}>
                            {row.qc_score === '-' || row.qcScore === '-' ? '-' : ('qc_score' in row ? (row.qc_score !== null && row.qc_score !== undefined && !isNaN(Number(row.qc_score)) ? `${Number(row.qc_score).toFixed(2)}%` : '-') : (row.qcScore ? `${row.qcScore}%` : '-'))}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-lg inline-block text-xs ${getTrackerCountColorClass(row.trackers_count_day)}`}>
                            {row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-slate-700">
                          {row.daily_required_hours === '-' || row.dailyRequiredHours === '-' ? '-' : (row.tenure_target !== undefined && row.tenure_target !== null && !isNaN(Number(row.tenure_target)) ? Number(row.tenure_target).toFixed(2) : (row.daily_required_hours ?? row.dailyRequiredHours ?? '-'))}
                        </td>
                        {canSeeActions && (
                          <td className="px-5 py-3 text-center">
                            <button
                              onClick={() => handleEditClick(row)}
                              className="group relative p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                              title="Edit Assigned Hours"
                            >
                              <Edit className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-t-2 border-blue-300">
                      <td className="px-5 py-3 text-gray-900 font-bold whitespace-nowrap">TOTAL</td>
                      <td className="px-5 py-3 text-center text-gray-900 font-bold">—</td>
                      <td className="px-5 py-3 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.assign_hours ?? row.assignHours ?? row.assigned_hour) || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.billable_hours ?? row.worked_hours ?? row.workedHours) || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-900 font-bold">
                        {(() => {
                          const scores = filteredRows.filter(row => row.qc_score != null && row.qc_score !== '-').map(row => Number(row.qc_score));
                          return scores.length > 0 ? `${(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)}%` : '-';
                        })()}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.trackers_count_day) || 0), 0)}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-900 font-bold">
                        {filteredRows.reduce((sum, row) => sum + (Number(row.tenure_target ?? row.daily_required_hours) || 0), 0).toFixed(2)}
                      </td>
                      {canSeeActions && <td />}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={canSeeActions ? 8 : 7} className="px-5 py-12 text-center text-slate-500">
                      No data for the selected date range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
          logged_in_user_id={currentUser?.user_id || currentUser?.id}
        />
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
        
        {expanded && (
          <div className="px-6 pb-4 pt-0 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const formatNumber = (val) => {
                    if (val === null || val === undefined || val === '' || val === '-') return '-';
                    const num = Number(val);
                    return isNaN(num) ? '-' : num.toFixed(2);
                  };

                  let exportData = filteredRows.map(row => ({
                    'Date': formatDateTime(row.date_time ?? row.date),
                    'Day Status': getRosterStatus(row),
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
                      'Day Status': '',
                      'Assign Hours': totalAssigned.toFixed(2),
                      'Worked Hours': totalWorked.toFixed(2),
                      'QC Score': avgQC,
                      'Tracker Count': totalTrackers,
                      'Daily Required Hours': totalRequired.toFixed(2)
                    });
                  }
                  const filename = `Daily_Report_${user.user_name || 'User'}_${rangeStart || selectedMonth || 'all'}_${rangeEnd || 'all'}.csv`;
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
                  <th className="px-6 py-4 text-center font-semibold">Day Status</th>
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
                    <tr key={row.date_time || row.date || idx} className={`${isWeekendDay(row.day) ? 'bg-orange-50 border-l-4 border-l-orange-800' : ''} hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200`}>
                        <td className={`px-6 py-4 font-medium whitespace-pre-line ${getDayColorClass(row.day)}`}>{row.date_time || row.date || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg inline-block ${getRosterStatusClass(getRosterStatus(row))}`}>
                            {getRosterStatus(row)}
                          </span>
                        </td>
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
                                onClick={() => handleEditClick(row)}
                                className="group relative p-2 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                                title="Edit Assigned Hours"
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
                      <td className="px-6 py-4 text-center text-gray-900 font-bold">—</td>
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
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
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
        logged_in_user_id={currentUser?.user_id || currentUser?.id}
      />
    </div>
  );
}
