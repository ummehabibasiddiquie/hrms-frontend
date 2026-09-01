import React from "react";
import { getCalendarDays, getDayDisplayInfo, buildPendingCalendarOverlay, toDateOnlyString } from "../../utils/rosterUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RosterCalendar = ({
  monthYear,
  days = [],
  readOnly = false,
  onDayClick,
  pendingRequests = [],
  rosterMonthId = null,
  rosterStartDate = null,
}) => {
  const dayMap = React.useMemo(() => {
    const map = {};
    (days || []).forEach((d) => {
      const key = toDateOnlyString(d.roster_date);
      if (key) map[key] = d;
    });
    return map;
  }, [days]);

  const pendingOverlay = React.useMemo(
    () => buildPendingCalendarOverlay(pendingRequests, rosterMonthId),
    [pendingRequests, rosterMonthId]
  );

  const calendarDays = getCalendarDays(monthYear);
  const hasPendingChanges = Object.keys(pendingOverlay.byDate).length > 0 || pendingOverlay.leaveDeleteIds.size > 0;
  const startStr = rosterStartDate ? toDateOnlyString(rosterStartDate) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {hasPendingChanges && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm border-2 border-dashed border-blue-400 bg-blue-50 shrink-0" />
            Blue = submitted, awaiting approval
          </span>
        </div>
      )}
      <div className="grid grid-cols-7 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-3 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200">
        {calendarDays.map((cell, idx) => {
          if (cell.pad) {
            return <div key={`pad-${idx}`} className="min-h-[100px] bg-slate-50" />;
          }

          const day = dayMap[cell.dateStr];
          const pending = pendingOverlay.byDate[cell.dateStr];
          const leaveRemovalPending =
            day?.leave_id && pendingOverlay.leaveDeleteIds.has(Number(day.leave_id));

          const info = getDayDisplayInfo(day, {
            pending,
            leaveRemovalPending,
            dateStr: cell.dateStr,
          });

          const clickable = !readOnly && (day || pending) && onDayClick;
          const showContent = day || pending;
          const beforeJoining = Boolean(startStr && cell.dateStr < startStr && !day && !pending);

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={!clickable}
              title={info.pendingTooltip || undefined}
              onClick={() => clickable && onDayClick(day || { roster_date: cell.dateStr, ...pending?.preview })}
              className={`min-h-[100px] p-2 text-left border transition-all relative ${
                beforeJoining ? "bg-slate-50 border-slate-100" : info.cellClass
              } ${
                clickable ? "hover:ring-2 hover:ring-blue-400 cursor-pointer" : "cursor-default"
              }`}
            >
              {info.hasPending && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white" title="Pending approval" />
              )}
              <div className="text-sm font-bold text-slate-800 mb-1">{cell.date.getDate()}</div>
              {showContent ? (
                <>
                  <div className="text-xs font-semibold text-slate-700 truncate">{info.primaryLabel}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {info.badges.map((badge) => (
                      <span
                        key={badge}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          badge === "Pending"
                            ? "bg-amber-100 text-amber-800 border-amber-200 font-semibold"
                            : badge === "Removal pending"
                              ? "bg-orange-100 text-orange-700 border-orange-200"
                              : "bg-white/80 text-slate-600 border-slate-200"
                        }`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  {info.hasPending && info.pendingTooltip && (
                    <p className="mt-1.5 text-[10px] text-amber-700 leading-tight line-clamp-2 opacity-0 group-hover:opacity-100 sm:opacity-100">
                      Awaiting approval
                    </p>
                  )}
                </>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  {beforeJoining ? "Before joining" : "No data"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RosterCalendar;
