import React, { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  createChangeRequest,
  listRosterLeaves,
} from "../../services/rosterService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import { toDateOnlyString, getRosterLockMessage, isRosterLocked } from "../../utils/rosterUtils";

const RosterDayEditor = ({
  isOpen,
  onClose,
  day,
  roster,
  readOnly,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);

  const [dayForm, setDayForm] = useState({
    day_type: "Working",
    shift: "DAY",
    working_hours: 9,
  });

  const [applyThroughMonthEnd, setApplyThroughMonthEnd] = useState(true);
  const [leaveForm, setLeaveForm] = useState({
    affect_target: false,
    is_half_day: false,
  });

  useEffect(() => {
    if (!isOpen || !day) return;
    const isLeaveDay = day.day_type === "Leave";
    const proposedType = isLeaveDay ? "Leave" : day.day_type || "Working";
    const wasHalf =
      (day.working_type || "").toLowerCase() === "half" ||
      Number(day.is_half_day) === 1 ||
      Number(day.leave_is_half_day) === 1;
    let workingHours = Number(day.working_hours);
    if (proposedType !== "Left" && (!Number.isFinite(workingHours) || workingHours <= 0)) {
      workingHours = 9;
    }
    if (proposedType === "Left") {
      workingHours = 0;
    }
    if (isLeaveDay && wasHalf && workingHours > 5.4) {
      workingHours = Math.round((workingHours / 2) * 100) / 100;
    }
    setDayForm({
      day_type: proposedType,
      shift: day.shift || "DAY",
      working_hours: workingHours,
    });
    setLeaveForm({
      affect_target:
        Number(day.leave_affect_target) === 1 ||
        day.leave_affect_target === true ||
        Number(day.affect_target) === 1 ||
        day.affect_target === true,
      is_half_day: wasHalf,
    });
    setApplyThroughMonthEnd(proposedType !== "Left");
  }, [isOpen, day, roster]);

  useEffect(() => {
    if (!isOpen || !roster?.roster_month_id) return;
    const load = async () => {
      try {
        const res = await listRosterLeaves({ roster_month_id: roster.roster_month_id });
        setLeaves(res.data || []);
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err));
      }
    };
    load();
  }, [isOpen, roster?.roster_month_id]);

  if (!isOpen || !day || !roster) return null;

  const rosterDate = toDateOnlyString(day.roster_date);
  const isHolidayDay = day?.day_type === "Holiday" || Boolean(day?.holiday_id);
  const coveringLeave = leaves.find((l) => {
    const start = toDateOnlyString(l.start_date);
    const end = toDateOnlyString(l.end_date);
    return start && end && start <= rosterDate && rosterDate <= end;
  });

  const submitChange = async (change_type, change_payload) => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await createChangeRequest({
        roster_month_id: roster.roster_month_id,
        change_type,
        change_payload,
      });
      const updated = res.message?.toLowerCase().includes("updated");
      toast.success(
        updated
          ? "Leave updated — it now shows as pending on the calendar"
          : "Saved — the day now shows as pending. Submit for approval when you are done."
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDayUpdate = () => {
    let dayType = dayForm.day_type;
    if (dayType === "Leave") {
      dayType = "Working";
    }
    if (isHolidayDay && dayType === "WeekOff") {
      dayType = "Holiday";
    }
    if (isHolidayDay && dayType === "Leave") {
      toast.error(
        "Leave or half day cannot be added on a Holiday. Set Working (day or night) if this person must work."
      );
      return;
    }
    const isLeft = dayType === "Left";
    submitChange("DAY_UPDATE", {
      roster_date: rosterDate,
      day_type: dayType,
      shift: dayForm.shift,
      working_type: "Full",
      working_hours: isLeft ? 0 : Number(dayForm.working_hours),
      apply_through_month_end: isLeft && applyThroughMonthEnd ? 1 : 0,
      through_end_date: isLeft && applyThroughMonthEnd ? toDateOnlyString(roster.roster_end_date) : undefined,
    });
  };

  const handleLeaveSave = () => {
    if (isHolidayDay) {
      toast.error(
        "Leave or half day cannot be added on a Holiday. Set Working (day or night) if this person must work."
      );
      return;
    }
    const payload = {
      leave_type: coveringLeave?.leave_type || "Leave",
      start_date: coveringLeave ? toDateOnlyString(coveringLeave.start_date) : rosterDate,
      end_date: coveringLeave ? toDateOnlyString(coveringLeave.end_date) : rosterDate,
      reason: coveringLeave?.reason || "",
      affect_target: leaveForm.affect_target ? 1 : 0,
      is_half_day: leaveForm.is_half_day ? 1 : 0,
      is_rostered: 1,
    };
    if (coveringLeave?.leave_id) {
      submitChange("LEAVE_UPDATE", { ...payload, leave_id: coveringLeave.leave_id });
    } else {
      submitChange("LEAVE_ADD", payload);
    }
  };

  const handleSave = () => {
    if (loading) return;
    if (dayForm.day_type === "Leave") {
      handleLeaveSave();
      return;
    }
    handleDayUpdate();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Edit Roster Day</h2>
            <p className="text-sm text-slate-500">{rosterDate} — {roster.user_name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {readOnly ? (
          <div className="p-6 text-slate-600">
            {isRosterLocked(roster) ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-semibold text-red-900">Roster locked</p>
                <p className="mt-1">{getRosterLockMessage(roster)}</p>
              </div>
            ) : (
              <p>This roster is read-only.</p>
            )}
          </div>
        ) : (
          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <p className="sm:col-span-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                Daily full-day hours are set from tenure when the roster is generated. Monthly extra assigned hours are edited on the summary card, not per day.
              </p>
              {isHolidayDay && (
                <p className="sm:col-span-2 text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  This date is a Holiday (highest priority). You can set Working day or Night if this
                  person must work. Leave and half day cannot be added here.
                </p>
              )}
              {day?.day_type === "Leave" && dayForm.day_type !== "Leave" && (
                <p className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This day is on leave. Set Day Type to Working (or Week Off) and save to restore it
                  after approval.
                </p>
              )}
              {dayForm.day_type === "Left" && (
                <p className="sm:col-span-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  Left means the agent is no longer coming from this date.
                </p>
              )}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Day Type</span>
                <select
                  value={dayForm.day_type}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDayForm({
                      ...dayForm,
                      day_type: next,
                      working_hours: next === "Left" ? 0 : dayForm.working_hours,
                    });
                    if (next === "Left") setApplyThroughMonthEnd(true);
                  }}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="Working">Working</option>
                  <option value="WeekOff">Week Off</option>
                  {!isHolidayDay && <option value="Leave">Leave</option>}
                  <option value="Left">Left</option>
                  {(isHolidayDay || dayForm.day_type === "Holiday") && (
                    <option value="Holiday">Holiday</option>
                  )}
                </select>
              </label>

              {dayForm.day_type === "Leave" && !isHolidayDay && (
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={leaveForm.is_half_day}
                      onChange={(e) => setLeaveForm({ ...leaveForm, is_half_day: e.target.checked })}
                    />
                    <span className="text-sm text-slate-700">
                      Half Day
                      <span className="block text-xs text-slate-500 font-normal">
                        Employee works half the day.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={leaveForm.affect_target}
                      onChange={(e) => setLeaveForm({ ...leaveForm, affect_target: e.target.checked })}
                    />
                    <span className="text-sm text-slate-700">
                      Affect Target
                      <span className="block text-xs text-slate-500 font-normal">
                        Tick to reduce monthly working days and hours. Leave unchecked to keep the full monthly target.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {dayForm.day_type !== "Left" && dayForm.day_type !== "Leave" && (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Shift</span>
                    <select
                      value={dayForm.shift}
                      onChange={(e) => setDayForm({ ...dayForm, shift: e.target.value })}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="DAY">Day</option>
                      <option value="NIGHT">Night</option>
                    </select>
                  </label>
                  {dayForm.day_type === "Working" && (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Working Hours</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={dayForm.working_hours}
                        onChange={(e) => setDayForm({ ...dayForm, working_hours: e.target.value })}
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </label>
                  )}
                </>
              )}
              {dayForm.day_type === "Left" && (
                <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={applyThroughMonthEnd}
                    onChange={(e) => setApplyThroughMonthEnd(e.target.checked)}
                  />
                  <span>
                    Apply Left from this date through the end of the month
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Use this when someone will not come from a date (e.g. 21 Sep) onwards.
                    </span>
                  </span>
                </label>
              )}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {dayForm.day_type === "Leave" ? "Save Leave Request" : "Save Day Change Request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RosterDayEditor;
