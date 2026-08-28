import React, { useMemo } from "react";

function formatNumber(val) {
  if (val === null || val === undefined || val === "") return "-";
  const num = Number(val);
  return Number.isNaN(num) ? "-" : num.toFixed(2);
}

function getQCScoreColorClass(score) {
  if (score === null || score === undefined || score === "-" || Number.isNaN(Number(score))) {
    return "text-slate-800 bg-slate-100";
  }
  const numScore = Number(score);
  if (numScore >= 98) return "text-green-800 bg-green-100 font-bold";
  if (numScore >= 95) return "text-yellow-700 bg-yellow-100 font-bold";
  return "text-red-700 bg-red-200 font-bold";
}

function computeTotals(users) {
  const totalBillable = users.reduce(
    (sum, u) => sum + (Number(u.total_billable_hours) || 0),
    0
  );
  const totalGoal = users.reduce((sum, u) => sum + (Number(u.monthly_total_target) || 0), 0);
  const totalPending = users.reduce((sum, u) => sum + (Number(u.pending_target) || 0), 0);
  const qcScores = users.map((u) => Number(u.avg_qc_score)).filter((v) => !Number.isNaN(v));
  const avgQc =
    qcScores.length > 0
      ? (qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)
      : "—";

  return {
    billable: totalBillable.toFixed(2),
    goal: totalGoal.toFixed(2),
    pending: totalPending.toFixed(2),
    avgQc,
  };
}

/** Full-width monthly summary — all agents in one table (not split-panel). */
export default function MonthlyReportAgentPanel({
  users = [],
  month = { label: "-", year: "-" },
  hideTeamColumn = false,
}) {
  const rows = useMemo(
    () =>
      users.map((user, idx) => ({
        key: String(user.user_id ?? user.userId ?? idx),
        user,
        billable: formatNumber(user.total_billable_hours),
        goal: user.monthly_total_target ?? "-",
        pending: formatNumber(user.pending_target),
        qc:
          user.avg_qc_score != null && user.avg_qc_score !== ""
            ? `${formatNumber(user.avg_qc_score)}%`
            : "-",
      })),
    [users]
  );

  const totals = useMemo(() => computeTotals(users), [users]);

  if (!rows.length) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-xl shadow-md border border-blue-100 text-slate-500">
        No agents match your filters
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-l-4 border-blue-500 rounded-xl shadow-lg overflow-hidden">
      {/* Month summary header */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-4 bg-white/90 backdrop-blur border-b border-blue-100">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 shadow-md shrink-0">
          <div className="text-lg font-bold leading-none">{month.label}</div>
          <div className="text-xs opacity-90 mt-0.5">{month.year}</div>
        </div>
        <div className="text-sm text-slate-600 font-medium">
          {rows.length} {rows.length === 1 ? "User" : "Users"}
        </div>
      </div>

      {/* All agents — full-width table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4 sm:p-6">
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="shrink-0 overflow-x-auto bg-blue-600 border-b-2 border-blue-700">
            <table className="w-full min-w-[640px] text-sm table-fixed border-collapse">
              <colgroup>
                <col style={{ width: hideTeamColumn ? "28%" : "22%" }} />
                {!hideTeamColumn && <col style={{ width: "14%" }} />}
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: hideTeamColumn ? "18%" : "14%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-white bg-blue-600 whitespace-nowrap">User Name</th>
                  {!hideTeamColumn && (
                    <th className="px-5 py-3 text-left font-semibold text-white bg-blue-600 whitespace-nowrap">Team</th>
                  )}
                  <th className="px-5 py-3 text-center font-semibold text-white bg-blue-600 whitespace-nowrap">Billable Hours</th>
                  <th className="px-5 py-3 text-center font-semibold text-white bg-blue-600 whitespace-nowrap">Monthly Goal</th>
                  <th className="px-5 py-3 text-center font-semibold text-white bg-blue-600 whitespace-nowrap">Pending</th>
                  <th className="px-5 py-3 text-center font-semibold text-white bg-blue-600 whitespace-nowrap">Avg. QC</th>
                </tr>
              </thead>
            </table>
          </div>

          <div className="flex-1 min-h-0 overflow-auto panel-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm table-fixed border-collapse">
              <colgroup>
                <col style={{ width: hideTeamColumn ? "28%" : "22%" }} />
                {!hideTeamColumn && <col style={{ width: "14%" }} />}
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: hideTeamColumn ? "18%" : "14%" }} />
              </colgroup>
              <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-indigo-50/80 transition-colors duration-150"
                >
                  <td className="px-5 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                    {row.user.user_name || "-"}
                  </td>
                  {!hideTeamColumn && (
                    <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">
                      {row.user.team_name || "-"}
                    </td>
                  )}
                  <td className="px-5 py-2.5 text-center text-blue-700 font-semibold tabular-nums">
                    {row.billable}
                  </td>
                  <td className="px-5 py-2.5 text-center text-slate-700 tabular-nums">{row.goal}</td>
                  <td className="px-5 py-2.5 text-center text-amber-700 font-medium tabular-nums">
                    {row.pending}
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <span
                      className={`px-2 py-1 rounded-lg inline-block text-xs ${getQCScoreColorClass(row.user.avg_qc_score)}`}
                    >
                      {row.qc}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-t-2 border-blue-300">
                <td className="px-5 py-3 text-slate-900 font-bold whitespace-nowrap">TOTAL</td>
                {!hideTeamColumn && <td className="px-5 py-3" />}
                <td className="px-5 py-3 text-center text-slate-900 font-bold tabular-nums">
                  {totals.billable}
                </td>
                <td className="px-5 py-3 text-center text-slate-900 font-bold tabular-nums">
                  {totals.goal}
                </td>
                <td className="px-5 py-3 text-center text-slate-900 font-bold tabular-nums">
                  {totals.pending}
                </td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`px-2 py-1 rounded-lg inline-block text-xs font-bold ${getQCScoreColorClass(totals.avgQc)}`}
                  >
                    {totals.avgQc !== "—" ? `${totals.avgQc}%` : "—"}
                  </span>
                </td>
              </tr>
            </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
