import React, { useEffect, useState } from "react";
import { X, Save, Trash2, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  createChangeRequest,
  listRosterLeaves,
  weekoffSwapPreview,
} from "../../services/rosterService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import { toDateOnlyString, getRosterLockMessage, isRosterLocked } from "../../utils/rosterUtils";
import LoadingSpinner from "../common/LoadingSpinner";

const RosterDayEditor = ({
  isOpen,
  onClose,
  day,
  roster,
  readOnly,
  onSaved,
}) => {
  const [tab, setTab] = useState("day");
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  const [dayForm, setDayForm] = useState({
    day_type: "Working",
    shift: "DAY",
    working_type: "Full",
    working_hours: 9,
  });

  const [weekOffDates, setWeekOffDates] = useState([]);
  const [swapPreview, setSwapPreview] = useState(null);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
    affect_target: false,
    is_half_day: false,
    is_rostered: true,
  });
  const [editingLeaveId, setEditingLeaveId] = useState(null);

  useEffect(() => {
    if (!isOpen || !day) return;
    setDayForm({
      day_type: day.day_type || "Working",
      shift: day.shift || "DAY",
      working_type: day.working_type || "Full",
      working_hours: day.working_hours ?? 9,
    });
    setLeaveForm((prev) => {
      const clickedDate = toDateOnlyString(day.roster_date);
      return {
        ...prev,
        start_date: clickedDate,
        end_date: clickedDate,
      };
    });
    setTab("day");
    setSwapPreview(null);
    setEditingLeaveId(null);
  }, [isOpen, day, roster]);

  useEffect(() => {
    if (!isOpen || !roster?.roster_month_id) return;
    const load = async () => {
      try {
        setLoadingLeaves(true);
        const res = await listRosterLeaves({ roster_month_id: roster.roster_month_id });
        setLeaves(res.data || []);
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err));
      } finally {
        setLoadingLeaves(false);
      }
    };
    load();
  }, [isOpen, roster?.roster_month_id]);

  useEffect(() => {
    if (!isOpen || !roster?.days) return;
    const offs = roster.days
      .filter((d) => d.day_type === "WeekOff")
      .map((d) => toDateOnlyString(d.roster_date))
      .filter(Boolean);
    setWeekOffDates(offs);
  }, [isOpen, roster?.days]);

  if (!isOpen || !day || !roster) return null;

  const rosterDate = toDateOnlyString(day.roster_date);

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
      toast.success(updated ? "Leave request updated" : "Change request created");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDayUpdate = () => {
    submitChange("DAY_UPDATE", {
      roster_date: rosterDate,
      day_type: dayForm.day_type,
      shift: dayForm.shift,
      working_type: dayForm.working_type,
      working_hours: Number(dayForm.working_hours),
    });
  };

  const handlePreviewSwap = async () => {
    try {
      setLoading(true);
      const res = await weekoffSwapPreview({
        roster_month_id: roster.roster_month_id,
        week_off_dates: weekOffDates,
      });
      setSwapPreview(res.data);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSwap = () => {
    if (!swapPreview?.changes?.length) {
      toast.error("No week-off changes to apply");
      return;
    }
    submitChange("WEEKOFF_SWAP", { changes: swapPreview.changes });
  };

  const toggleWeekOffDate = (dateStr) => {
    setSwapPreview(null);
    setWeekOffDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleLeaveSave = () => {
    if (loading) return;
    if (!leaveForm.leave_type?.trim()) {
      toast.error("Leave type is required");
      return;
    }
    if (!leaveForm.start_date || !leaveForm.end_date) {
      toast.error("Start and end dates are required");
      return;
    }
    if (leaveForm.end_date < leaveForm.start_date) {
      toast.error("End date cannot be before start date");
      return;
    }
    const payload = {
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason,
      affect_target: leaveForm.affect_target ? 1 : 0,
      is_half_day: leaveForm.is_half_day ? 1 : 0,
      is_rostered: leaveForm.is_rostered ? 1 : 0,
    };
    if (editingLeaveId) {
      submitChange("LEAVE_UPDATE", { ...payload, leave_id: editingLeaveId });
    } else {
      submitChange("LEAVE_ADD", payload);
    }
  };

  const handleLeaveDelete = (leaveId) => {
    submitChange("LEAVE_DELETE", { leave_id: leaveId });
  };

  const startEditLeave = (leave) => {
    setEditingLeaveId(leave.leave_id);
    setLeaveForm({
      leave_type: leave.leave_type || "",
      start_date: toDateOnlyString(leave.start_date),
      end_date: toDateOnlyString(leave.end_date),
      reason: leave.reason || "",
      affect_target: Boolean(leave.affect_target),
      is_half_day: Boolean(leave.is_half_day),
      is_rostered: leave.is_rostered !== 0,
    });
    setTab("leave");
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
          <>
            <div className="flex border-b border-slate-200 px-4">
              {[
                { id: "day", label: "Day" },
                { id: "weekoff", label: "Week Off Swap" },
                { id: "leave", label: "Leave" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 ${
                    tab === t.id
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-slate-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {tab === "day" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <p className="sm:col-span-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    Daily full-day hours are set from User Monthly Tracker (monthly target ÷ working days) when the roster is generated. Monthly extra assigned hours are edited on the summary card, not per day.
                  </p>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Day Type</span>
                    <select
                      value={dayForm.day_type}
                      onChange={(e) => setDayForm({ ...dayForm, day_type: e.target.value })}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="Working">Working</option>
                      <option value="WeekOff">Week Off</option>
                    </select>
                  </label>
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
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Working Type</span>
                    <select
                      value={dayForm.working_type}
                      onChange={(e) => setDayForm({ ...dayForm, working_type: e.target.value })}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="Full">Full Day</option>
                      <option value="Half">Half Day</option>
                    </select>
                  </label>
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
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleDayUpdate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      Save Day Change Request
                    </button>
                  </div>
                </div>
              )}

              {tab === "weekoff" && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Toggle week-off dates for this month. Preview changes before submitting.
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {(roster.days || []).map((d) => {
                      const ds = d.roster_date?.slice(0, 10);
                      if (!ds) return null;
                      const isOff = weekOffDates.includes(ds);
                      return (
                        <button
                          key={ds}
                          type="button"
                          onClick={() => toggleWeekOffDate(ds)}
                          className={`px-2 py-1 text-xs rounded border ${
                            isOff
                              ? "bg-slate-200 border-slate-400 text-slate-800"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          {ds.slice(8)}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePreviewSwap}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Preview Swap
                  </button>
                  {swapPreview?.changes?.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                      <p className="font-semibold mb-2">{swapPreview.changes.length} day(s) will change</p>
                      <ul className="space-y-1 max-h-32 overflow-y-auto">
                        {swapPreview.changes.map((c) => (
                          <li key={c.roster_date}>
                            {c.roster_date}: {c.current_day_type} → {c.proposed_day_type}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleConfirmSwap}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Confirm Week-Off Swap
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === "leave" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-medium text-slate-700">Leave Type</span>
                      <input
                        value={leaveForm.leave_type}
                        onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder="e.g. Casual, Sick"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Start Date</span>
                      <input
                        type="date"
                        value={leaveForm.start_date}
                        onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">End Date</span>
                      <input
                        type="date"
                        value={leaveForm.end_date}
                        onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-medium text-slate-700">Reason</span>
                      <textarea
                        value={leaveForm.reason}
                        onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                        rows={2}
                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={leaveForm.affect_target}
                        onChange={(e) => setLeaveForm({ ...leaveForm, affect_target: e.target.checked })}
                      />
                      <span className="text-sm text-slate-700">Affect Target</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={leaveForm.is_half_day}
                        onChange={(e) => setLeaveForm({ ...leaveForm, is_half_day: e.target.checked })}
                      />
                      <span className="text-sm text-slate-700">Half Day</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleLeaveSave}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    <Save className="w-4 h-4" />
                    {editingLeaveId ? "Update Leave Request" : "Add Leave Request"}
                  </button>

                  <div className="border-t border-slate-200 pt-4">
                    <h4 className="font-semibold text-slate-800 mb-2">Existing Leaves</h4>
                    {loadingLeaves ? (
                      <LoadingSpinner size="sm" />
                    ) : leaves.length === 0 ? (
                      <p className="text-sm text-slate-500">No leaves recorded.</p>
                    ) : (
                      <ul className="space-y-2 max-h-40 overflow-y-auto">
                        {leaves.map((leave) => (
                          <li
                            key={leave.leave_id}
                            className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg text-sm"
                          >
                            <div>
                              <span className="font-medium">{leave.leave_type}</span>
                              <span className="text-slate-500 ml-2">
                                {leave.start_date?.slice(0, 10)} → {leave.end_date?.slice(0, 10)}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => startEditLeave(leave)}
                                className="px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLeaveDelete(leave.leave_id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RosterDayEditor;
