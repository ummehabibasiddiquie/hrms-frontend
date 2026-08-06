import React, { useEffect, useMemo, useState } from "react";
import {
  getDayDisplayInfo,
  getWeeksInMonth,
  toDateOnlyString,
  buildPendingCalendarOverlay,
} from "../../utils/rosterUtils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Excel-style team roster: Week tabs × employee rows × day cells.
 * Click a cell to edit that person's day (parent opens RosterDayEditor).
 */
const RosterTeamWeekGrid = ({
  monthYear,
  rosters = [],
  employees = [],
  pendingRequests = [],
  monthCalendarLocked = false,
  readOnly = false,
  onCellClick,
}) => {
  const weeks = useMemo(() => getWeeksInMonth(monthYear), [monthYear]);
  const [activeWeek, setActiveWeek] = useState(1);

  useEffect(() => {
    if (!weeks.length) return;
    // Default to current week if in this month, else Week 1
    const today = toDateOnlyString(new Date());
    const current = weeks.find((w) =>
      w.dates.some((d) => d.inMonth && d.dateStr === today)
    );
    setActiveWeek(current?.week_number || weeks[0].week_number);
  }, [monthYear, weeks]);

  const week = weeks.find((w) => w.week_number === activeWeek) || weeks[0];

  const rosterByUser = useMemo(() => {
    const map = {};
    (rosters || []).forEach((r) => {
      map[String(r.user_id)] = r;
    });
    return map;
  }, [rosters]);

  const rows = useMemo(() => {
    const empIds = new Set((employees || []).map((e) => String(e.user_id)));
    // Prefer filtered employee list order; fall back to roster list
    if (employees?.length) {
      return employees.map((e) => ({
        user_id: e.user_id,
        user_name: e.user_name || e.name || `User ${e.user_id}`,
        team_name: e.team_name,
        roster: rosterByUser[String(e.user_id)] || null,
      }));
    }
    return (rosters || []).map((r) => ({
      user_id: r.user_id,
      user_name: r.user_name || `User ${r.user_id}`,
      team_name: r.team_name,
      roster: r,
    })).filter((row) => !empIds.size || empIds.has(String(row.user_id)));
  }, [employees, rosters, rosterByUser]);

  if (!weeks.length) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
        No weeks for this month.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-1.5 bg-slate-50">
        {weeks.map((w) => (
          <button
            key={w.week_number}
            type="button"
            onClick={() => setActiveWeek(w.week_number)}
            title={w.label}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              activeWeek === w.week_number
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700"
            }`}
          >
            {w.short_label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-slate-400 px-1">
          {week?.label}
        </span>
      </div>

      <div className="overflow-auto max-h-[min(70vh,720px)]">
        <table className="min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-r border-slate-200 min-w-[160px]">
                Employee
              </th>
              {(week?.dates || []).map((d, idx) => (
                <th
                  key={d.dateStr}
                  className={`px-1.5 py-2 text-center border-b border-slate-200 min-w-[88px] ${
                    d.inMonth ? "" : "opacity-40"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    {WEEKDAY_LABELS[idx]}
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    {d.date.getDate()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={(week?.dates?.length || 0) + 1}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No employees for this filter. Generate rosters or change team.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const roster = row.roster;
                const dayMap = {};
                (roster?.days || []).forEach((day) => {
                  const key = toDateOnlyString(day.roster_date);
                  if (key) dayMap[key] = day;
                });
                const pendingOverlay = buildPendingCalendarOverlay(
                  pendingRequests,
                  roster?.roster_month_id
                );
                const frozen =
                  monthCalendarLocked ||
                  Boolean(roster?.locked_date) ||
                  (roster?.status || "") === "Pending Approval";

                return (
                  <tr key={row.user_id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="sticky left-0 z-[1] bg-white px-3 py-2 border-r border-slate-100 align-middle">
                      <div className="text-sm font-semibold text-slate-800 truncate max-w-[180px]" title={row.user_name}>
                        {row.user_name}
                      </div>
                      {row.team_name && (
                        <div className="text-[10px] text-slate-400 truncate">{row.team_name}</div>
                      )}
                      {!roster && (
                        <div className="text-[10px] text-amber-600 mt-0.5">No roster</div>
                      )}
                    </td>
                    {(week?.dates || []).map((d) => {
                      if (!d.inMonth) {
                        return (
                          <td
                            key={d.dateStr}
                            className="px-1 py-1 bg-slate-50/80 border-l border-slate-50"
                          />
                        );
                      }
                      const day = dayMap[d.dateStr];
                      const pending = pendingOverlay.byDate[d.dateStr];
                      const leaveRemovalPending =
                        day?.leave_id &&
                        pendingOverlay.leaveDeleteIds.has(Number(day.leave_id));
                      const info = getDayDisplayInfo(day, {
                        pending,
                        leaveRemovalPending,
                        dateStr: d.dateStr,
                      });
                      const clickable =
                        !readOnly &&
                        !frozen &&
                        roster &&
                        (day || pending) &&
                        typeof onCellClick === "function";

                      return (
                        <td key={d.dateStr} className="p-0.5 border-l border-slate-50 align-top">
                          <button
                            type="button"
                            disabled={!clickable}
                            title={
                              info.pendingTooltip ||
                              (frozen ? "Locked / pending approval" : info.primaryLabel) ||
                              undefined
                            }
                            onClick={() =>
                              clickable &&
                              onCellClick({
                                roster,
                                day: day || {
                                  roster_date: d.dateStr,
                                  ...pending?.preview,
                                },
                              })
                            }
                            className={`w-full min-h-[52px] rounded-md border px-1 py-1 text-left transition-all ${
                              info.cellClass
                            } ${
                              clickable
                                ? "hover:ring-2 hover:ring-blue-400 cursor-pointer"
                                : "cursor-default opacity-90"
                            }`}
                          >
                            {info.hasPending && (
                              <span className="float-right w-1.5 h-1.5 mt-0.5 rounded-full bg-amber-400" />
                            )}
                            <div className="text-[10px] font-semibold text-slate-700 leading-tight truncate">
                              {info.primaryLabel || "—"}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-0.5">
                              {info.badges.slice(0, 2).map((badge) => (
                                <span
                                  key={badge}
                                  className="text-[9px] px-1 py-0 rounded bg-white/80 text-slate-600 border border-slate-200/80"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RosterTeamWeekGrid;
