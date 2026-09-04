import React from "react";
import { Calendar, Target, Clock, Briefcase } from "lucide-react";
import { statusBadgeClass, countWorkingDaysFromCalendar, isRosterLocked, getMonthCalendarLockMessage } from "../../utils/rosterUtils";
import RosterLockedBanner from "./RosterLockedBanner";

const Stat = ({ icon: Icon, label, value, sub }) => (
  <div className="rounded-lg bg-slate-50/80 border border-slate-100 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-slate-500">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <p className="text-[10px] font-semibold uppercase tracking-wide truncate">{label}</p>
    </div>
    <p className="text-base font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
    {sub && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>}
  </div>
);

function inferDailyHoursFromRoster(roster) {
  const working = (roster?.days || []).find(
    (d) => d.day_type === "Working" && (d.working_type || "Full") === "Full"
  );
  return working?.working_hours ?? "—";
}

const RosterSummaryCards = ({
  roster,
  pendingCount = 0,
  monthCalendarLocked = false,
  monthLockInfo = null,
  monthYear = "",
}) => {
  if (!roster) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500 text-sm">
        Select an employee to view roster summary.
      </div>
    );
  }

  const dailyHours = inferDailyHoursFromRoster(roster);
  // Prefer API metrics (includes half-day leave as 0.5); fall back to client count
  const workingDaysFromCalendar = countWorkingDaysFromCalendar(roster.days);
  const workingDays =
    roster.calendar_working_days != null && roster.calendar_working_days !== ""
      ? Number(roster.calendar_working_days)
      : workingDaysFromCalendar;
  const targetedDays =
    roster.target_working_days != null && roster.target_working_days !== ""
      ? Number(roster.target_working_days)
      : "—";
  const monthlyHours =
    roster.monthly_target_hours != null && roster.monthly_target_hours !== ""
      ? Number(roster.monthly_target_hours)
      : "—";
  const frozen = monthCalendarLocked || isRosterLocked(roster);

  const fmt = (v) => (typeof v === "number" && Number.isFinite(v) ? v : v);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 truncate">{roster.user_name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {roster.roster_start_date || "—"} → {roster.roster_end_date || "—"}
            <span className="mx-1.5 text-slate-300">·</span>
            {roster.month_year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${statusBadgeClass(roster.status)}`}>
            {roster.status}
          </span>
          {pendingCount > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {monthCalendarLocked && (
          <RosterLockedBanner
            title="Calendar locked"
            message={getMonthCalendarLockMessage(monthYear || roster.month_year, monthLockInfo)}
          />
        )}
        {!monthCalendarLocked && isRosterLocked(roster) && <RosterLockedBanner roster={roster} />}
        {pendingCount > 0 && !frozen && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {pendingCount} change(s) pending approval — working days update after approval.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Stat
          icon={Calendar}
          label="Working Days"
          value={fmt(workingDays) ?? "—"}
          sub="Incl. half-day leave as 0.5"
        />
        <Stat
          icon={Target}
          label="Targeted Days"
          value={fmt(targetedDays)}
          sub="After approved leave"
        />
        <Stat
          icon={Clock}
          label="Monthly Hours"
          value={fmt(monthlyHours)}
          sub="Working days × daily hrs"
        />
        <Stat icon={Clock} label="Daily Hours" value={dailyHours} sub="From monthly tracker" />
        <Stat
          icon={Calendar}
          label="Period"
          value={roster.month_year || "—"}
          sub="Roster month"
        />
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              Extra assigned hours (monthly)
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {frozen
                ? "Locked — extra hours cannot be changed until unlock"
                : "Edit monthly target and extra hours on User Monthly Goal"}
            </p>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums shrink-0">
            {roster.extra_assigned_hours ?? 0}h
          </p>
        </div>
      </div>
    </div>
  );
};

export default RosterSummaryCards;
