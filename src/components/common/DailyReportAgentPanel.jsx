import React, { useEffect, useMemo, useState } from "react";
import { Users, Download } from "lucide-react";
import { toast } from "react-hot-toast";
import { exportToCSV } from "../../utils/csvExport";
import { formatISTDateTime } from "../../utils/dateTimeIST";
import UserCard from "./UserCard";

function computeAgentSummary(rows) {
  let worked = 0;
  let assigned = 0;
  let trackers = 0;
  const qcScores = [];

  rows.forEach((row) => {
    const wh = Number(row.billable_hours ?? row.worked_hours ?? row.workedHours);
    if (!Number.isNaN(wh)) worked += wh;

    const ah = Number(row.assigned_hours ?? row.assign_hours ?? row.assignHours);
    if (!Number.isNaN(ah)) assigned += ah;

    const tc = Number(row.trackers_count_day);
    if (!Number.isNaN(tc)) trackers += tc;

    const qc = row.qc_score ?? row.qcScore;
    if (qc != null && qc !== "-" && !Number.isNaN(Number(qc))) {
      qcScores.push(Number(qc));
    }
  });

  const avgQc =
    qcScores.length > 0
      ? (qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(1)
      : "—";

  return {
    days: rows.length,
    worked: worked.toFixed(1),
    assigned: assigned.toFixed(1),
    trackers,
    avgQc,
  };
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatExportDate(dt) {
  return formatISTDateTime(dt, dt || "-");
}

function exportAgentDailyReport(user, rows, rangeStart, rangeEnd, selectedMonth) {
  const formatNumber = (val) => {
    if (val === null || val === undefined || val === "" || val === "-") return "-";
    const num = Number(val);
    return Number.isNaN(num) ? "-" : num.toFixed(2);
  };

  const getStatus = (row) => row?.roster_status || row?.day_status || "—";

  let exportData = rows.map((row) => ({
    Date: formatExportDate(row.date_time ?? row.date),
    "Day Status": getStatus(row),
    "Assign Hours": formatNumber(row.assigned_hours ?? row.assign_hours ?? row.assignHours),
    "Worked Hours": formatNumber(row.billable_hours ?? row.workedHours ?? row.worked_hours),
    "QC Score":
      row.qc_score != null || row.qcScore != null
        ? `${formatNumber(row.qc_score ?? row.qcScore)}%`
        : "-",
    "Tracker Count":
      row.trackers_count_day !== null && row.trackers_count_day !== undefined
        ? row.trackers_count_day
        : "-",
    "Daily Required Hours": formatNumber(
      row.tenure_target ?? row.dailyRequiredHours ?? row.daily_required_hours
    ),
  }));

  if (exportData.length > 0) {
    const totalAssigned = exportData.reduce((sum, r) => sum + (parseFloat(r["Assign Hours"]) || 0), 0);
    const totalWorked = exportData.reduce((sum, r) => sum + (parseFloat(r["Worked Hours"]) || 0), 0);
    const totalRequired = exportData.reduce(
      (sum, r) => sum + (parseFloat(r["Daily Required Hours"]) || 0),
      0
    );
    const qcScores = exportData.map((r) => parseFloat(r["QC Score"])).filter((v) => !Number.isNaN(v));
    const avgQC =
      qcScores.length > 0
        ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%`
        : "-";
    const totalTrackers = exportData.reduce(
      (sum, r) => sum + (r["Tracker Count"] !== "-" ? parseInt(r["Tracker Count"], 10) : 0),
      0
    );
    exportData.push({
      Date: "TOTAL",
      "Day Status": "",
      "Assign Hours": totalAssigned.toFixed(2),
      "Worked Hours": totalWorked.toFixed(2),
      "QC Score": avgQC,
      "Tracker Count": totalTrackers,
      "Daily Required Hours": totalRequired.toFixed(2),
    });
  }

  const filename = `Daily_Report_${user.user_name || "User"}_${rangeStart || selectedMonth || "all"}_${rangeEnd || "all"}.csv`;
  exportToCSV(exportData, filename);
  toast.success("Daily report exported successfully!");
}

export default function DailyReportAgentPanel({
  agents = [],
  canViewTeamFilter = false,
  selectedMonth = "",
  rangeStart = "",
  rangeEnd = "",
  onRefresh = () => {},
  mapRows = (rows) => rows,
}) {
  const [selectedUserId, setSelectedUserId] = useState(null);

  const prepared = useMemo(
    () =>
      agents.map(([userId, { user, rows }]) => ({
        userId: String(userId),
        user,
        rows,
        mappedRows: mapRows(rows),
        summary: computeAgentSummary(mapRows(rows)),
      })),
    [agents, mapRows]
  );

  useEffect(() => {
    if (!prepared.length) {
      setSelectedUserId(null);
      return;
    }
    const stillVisible = prepared.some((a) => a.userId === String(selectedUserId));
    if (!stillVisible) {
      setSelectedUserId(prepared[0].userId);
    }
  }, [prepared, selectedUserId]);

  const selected = prepared.find((a) => a.userId === String(selectedUserId)) || prepared[0];

  if (!prepared.length) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-xl shadow-md border border-blue-100 text-slate-500">
        No agents match your filters
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-l-4 border-blue-500 rounded-xl shadow-lg overflow-hidden flex flex-col">
      {/* Unified header — matches MonthCard row styling */}
      <div className="shrink-0 flex items-stretch border-b border-blue-100 bg-white/90 backdrop-blur rounded-t-xl">
        <div className="w-[240px] xl:w-[260px] shrink-0 flex items-center gap-3 px-6 py-4 border-r border-blue-100">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-sm shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-blue-900 leading-tight">Agents</p>
          </div>
          <span className="ml-auto shrink-0 text-xs font-bold text-white bg-blue-600 rounded-full min-w-[1.75rem] h-7 px-2 flex items-center justify-center">
            {prepared.length}
          </span>
        </div>

        {selected && (
          <div className="flex-1 flex items-center gap-4 px-6 py-4 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-md">
              {getInitials(selected.user.user_name)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900 truncate leading-tight">
                {selected.user.user_name || `User ${selected.userId}`}
              </h3>
              {canViewTeamFilter && selected.user.team_name && (
                <p className="text-sm text-slate-600 font-medium truncate mt-0.5">
                  Team {selected.user.team_name}
                </p>
              )}
            </div>
            {selected.summary && (
              <div className="hidden lg:flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold whitespace-nowrap">
                  {selected.summary.days} days
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                  {selected.summary.worked}h worked
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold whitespace-nowrap">
                  QC {selected.summary.avgQc}%
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                try {
                  exportAgentDailyReport(
                    selected.user,
                    selected.mappedRows,
                    rangeStart,
                    rangeEnd,
                    selectedMonth
                  );
                } catch {
                  toast.error("Failed to export daily report");
                }
              }}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              title="Export this agent"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 h-full flex-col lg:flex-row">
        <aside className="lg:w-[240px] xl:w-[260px] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-blue-100 bg-white/60 h-full min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto panel-scroll px-2 py-2 space-y-1.5">
            {prepared.map((agent) => {
              const active = agent.userId === selected?.userId;
              const initials = getInitials(agent.user.user_name);
              return (
                <button
                  key={agent.userId}
                  type="button"
                  onClick={() => setSelectedUserId(agent.userId)}
                  className={`w-full text-left rounded-lg px-2 py-2 transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 shadow-sm"
                      : "bg-white border border-blue-100 hover:border-blue-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        active
                          ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                          : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                      }`}
                    >
                      {initials}
                    </div>
                    <p className={`font-semibold text-sm truncate leading-tight ${active ? "text-blue-900" : "text-slate-800"}`}>
                      {agent.user.user_name || `User ${agent.userId}`}
                    </p>
                  </div>

                  <div className="mt-1.5 grid grid-cols-3 gap-1">
                    <div className="rounded bg-blue-50 px-1 py-1 text-center min-w-0">
                      <p className="text-[9px] font-semibold uppercase text-blue-600 leading-none">Hours</p>
                      <p className="text-[11px] font-bold text-blue-800 tabular-nums mt-0.5 truncate">{agent.summary.worked}h</p>
                    </div>
                    <div className="rounded bg-emerald-50 px-1 py-1 text-center min-w-0">
                      <p className="text-[9px] font-semibold uppercase text-emerald-600 leading-none">QC</p>
                      <p className="text-[11px] font-bold text-emerald-800 tabular-nums mt-0.5 truncate">{agent.summary.avgQc}%</p>
                    </div>
                    <div className="rounded bg-indigo-50 px-1 py-1 text-center min-w-0">
                      <p className="text-[9px] font-semibold uppercase text-indigo-600 leading-none">Trk</p>
                      <p className="text-[11px] font-bold text-indigo-800 tabular-nums mt-0.5 truncate">{agent.summary.trackers}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden bg-white">
          {selected && (
            <UserCard
              key={selected.userId}
              user={selected.user}
              team_name={selected.user.team_name}
              showTeam={canViewTeamFilter}
              dailyData={selected.mappedRows}
              agentSummary={selected.summary}
              alwaysExpanded
              suppressHeader
              selectedMonth={selectedMonth}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}
