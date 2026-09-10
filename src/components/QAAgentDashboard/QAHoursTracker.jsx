/**
 * QA Hours Tracker - Tracker entries, Daily and Monthly reports.
 * QC/Rework hours come from QC files. Feedback/Reporting are added as tracker-style entries.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import {
  DateRangePicker,
  MonthYearPicker,
  SingleDatePicker,
  getCurrentYyyyMm,
  monthYearToYyyyMm,
  yyyyMmToMonthYear,
} from "../common/CustomCalendar";
import SearchableSelect from "../common/SearchableSelect";
import ErrorMessage from "../common/ErrorMessage";
import { todayISTISO, formatISTDateTimeParts, formatISTDateMedium } from "../../utils/dateTimeIST";
import {
  addQATrackerEntry,
  deleteQATrackerEntry,
  fetchQATrackerDay,
  fetchQATrackerEntries,
  fetchQATrackerList,
  fetchQATrackerMonthly,
  updateQATrackerEntry,
} from "../../services/qaTrackerService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";

const ACTIVITY_OPTIONS = [
  { value: "feedback", label: "Feedback & Training" },
  { value: "reporting", label: "Reporting & Other" },
];

const activityLabel = (type) =>
  ACTIVITY_OPTIONS.find((o) => o.value === type)?.label || type;

const fmt = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return (0).toFixed(digits);
  return n.toFixed(digits);
};

const fmtTrackerTime = (value) => {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "none" || raw.toLowerCase() === "null") return "";
  const { date, time } = formatISTDateTimeParts(raw);
  if (date && date !== "-") return time ? `${date} ${time}` : date;
  return raw;
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const parseIsoDate = (iso) => {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const weekdayName = (iso) => {
  const dt = parseIsoDate(iso);
  if (!dt) return "";
  return WEEKDAY_NAMES[dt.getDay()] || "";
};

const isWeekendIso = (iso) => {
  const dt = parseIsoDate(iso);
  if (!dt) return false;
  const day = dt.getDay();
  return day === 0 || day === 6;
};

const dayHasWork = (row) => {
  if (!row) return false;
  return (
    Number(row.total_hours) > 0 ||
    Number(row.qc_hours) > 0 ||
    Number(row.rework_hours) > 0 ||
    Number(row.feedback_hours) > 0 ||
    Number(row.reporting_hours) > 0 ||
    Number(row.qc_files) > 0 ||
    Number(row.rework_files) > 0 ||
    Number(row.qc_records) > 0 ||
    Number(row.file_records) > 0
  );
};

const formatReportDate = (iso) => {
  const dt = parseIsoDate(iso);
  if (!dt) return iso || "-";
  const pad = (n) => String(n).padStart(2, "0");
  const day = weekdayName(iso);
  return day
    ? `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}\n${day}`
    : `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
};

const addDaysIso = (iso, days) => {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return iso;
  const dt = new Date(year, month - 1, day + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const fillMonthDays = (rows, yyyyMm, todayIso, qaUserId) => {
  const { start, end } = monthBounds(yyyyMm);
  if (!start || !end) return Array.isArray(rows) ? rows : [];
  const monthOfToday = String(todayIso || "").slice(0, 7);
  const cap = yyyyMm === monthOfToday ? todayIso : end;
  if (!cap || cap < start) return [];
  const byDate = {};
  (rows || []).forEach((row) => {
    if (row?.work_date) byDate[row.work_date] = row;
  });
  const filled = [];
  for (let d = start; d <= cap; d = addDaysIso(d, 1)) {
    const existing = byDate[d];
    // Same as agent daily report: hide Sat/Sun unless there is work that day.
    if (isWeekendIso(d) && !dayHasWork(existing)) continue;
    filled.push(
      existing || {
        qa_user_id: qaUserId,
        work_date: d,
        qc_hours: 0,
        rework_hours: 0,
        feedback_hours: 0,
        reporting_hours: 0,
        total_hours: 0,
        expected_total: 9,
        qc_files: 0,
        rework_files: 0,
        qc_records: 0,
        file_records: 0,
        projects: [],
      }
    );
  }
  filled.reverse();
  return filled;
};

const monthBounds = (yyyyMm) => {
  const [year, month] = String(yyyyMm || "").split("-").map(Number);
  if (!year || !month) return { start: "", end: "" };
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(last).padStart(2, "0")}`,
  };
};

const dateInMonth = (dateStr, yyyyMm) => {
  if (!dateStr || !yyyyMm) return false;
  return String(dateStr).slice(0, 7) === yyyyMm;
};

const clampDateToMonth = (dateStr, yyyyMm, fallback) => {
  if (dateInMonth(dateStr, yyyyMm)) return dateStr;
  if (dateInMonth(fallback, yyyyMm)) return fallback;
  return monthBounds(yyyyMm).end || monthBounds(yyyyMm).start;
};

const QAHoursTracker = ({ mode = "self" }) => {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;
  const today = useMemo(() => todayISTISO() || new Date().toISOString().slice(0, 10), []);
  const isManager = mode === "manager";
  const currentMonth = getCurrentYyyyMm();
  const defaultMonth = currentMonth;

  const [activeToggle, setActiveToggle] = useState(mode === "manager" ? "daily" : "tracker");
  const [monthFilter, setMonthFilter] = useState(defaultMonth);
  const [workDate, setWorkDate] = useState(() => clampDateToMonth(today, defaultMonth, today));
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [qaUserId, setQaUserId] = useState("");
  const [addQaUserId, setAddQaUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dayData, setDayData] = useState(null);
  const [listRows, setListRows] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [entries, setEntries] = useState([]);
  const [monthYearLabel, setMonthYearLabel] = useState("");
  const [qaUsers, setQaUsers] = useState([]);
  const [entryType, setEntryType] = useState("feedback");
  const [entryHours, setEntryHours] = useState("");
  const [entryNotes, setEntryNotes] = useState("");
  const [expanded, setExpanded] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editEntry, setEditEntry] = useState(null);

  const loadDay = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetchQATrackerDay({
        logged_in_user_id: userId,
        work_date: workDate,
        qa_user_id: isManager && qaUserId ? Number(qaUserId) : userId,
      });
      if (res.status !== 200) {
        throw new Error(res.message || "Failed to load QA hours");
      }
      setDayData(res.data || {});
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    }
  }, [userId, workDate, isManager, qaUserId]);

  const loadList = useCallback(async (opts = {}) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const silent = Boolean(opts.silent);
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const payload = {
        logged_in_user_id: userId,
        month_year: monthFilter,
      };
      if (qaUserId) payload.qa_user_id = Number(qaUserId);
      const res = await fetchQATrackerList(payload);
      if (res.status !== 200) {
        throw new Error(res.message || "Failed to load QA hours");
      }
      setListRows(res.data?.rows || []);
      setMonthYearLabel(res.data?.month_year || yyyyMmToMonthYear(monthFilter));
      setQaUsers(res.data?.qa_users || []);
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, monthFilter, qaUserId]);

  const loadMonthly = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        logged_in_user_id: userId,
        month_year: monthFilter,
      };
      if (qaUserId) payload.qa_user_id = Number(qaUserId);
      const res = await fetchQATrackerMonthly(payload);
      if (res.status !== 200) {
        throw new Error(res.message || "Failed to load monthly QA hours");
      }
      setMonthlyRows(res.data?.rows || []);
      setMonthYearLabel(res.data?.month_year || yyyyMmToMonthYear(monthFilter));
      setQaUsers(res.data?.qa_users || []);
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [userId, monthFilter, qaUserId]);

  const loadEntries = useCallback(async (opts = {}) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const silent = Boolean(opts.silent);
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const payload = {
        logged_in_user_id: userId,
        start_date: startDate,
        end_date: endDate,
      };
      if (qaUserId) payload.qa_user_id = Number(qaUserId);
      const res = await fetchQATrackerEntries(payload);
      if (res.status !== 200) {
        throw new Error(res.message || "Failed to load tracker entries");
      }
      setEntries((res.data?.entries || []).filter((row) => Number(row.hours) > 0));
      if (res.data?.qa_users) setQaUsers(res.data.qa_users);
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
      setEntries([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, startDate, endDate, qaUserId]);

  useEffect(() => {
    setWorkDate((prev) => clampDateToMonth(prev, monthFilter, today));
  }, [monthFilter, today]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (activeToggle === "monthly") {
      loadMonthly();
    } else if (activeToggle === "tracker") {
      if (isManager) loadList({ silent: true });
      loadEntries();
    } else {
      loadList();
    }
  }, [userId, isManager, activeToggle, loadMonthly, loadList, loadEntries]);

  useEffect(() => {
    if (!userId || isManager || activeToggle !== "daily") return;
    loadDay();
  }, [userId, isManager, activeToggle, loadDay]);

  const targetQaUserId = isManager ? Number(addQaUserId) : userId;

  const handleAddEntry = async () => {
    if (!userId) return;
    const hours = Number(entryHours);
    if (!entryType) {
      toast.error("Select Feedback or Reporting");
      return;
    }
    if (isManager && !addQaUserId) {
      toast.error("Select a QA to add hours for");
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error("Enter hours greater than 0");
      return;
    }
    setSaving(true);
    try {
      const res = await addQATrackerEntry({
        logged_in_user_id: userId,
        work_date: today,
        qa_user_id: targetQaUserId,
        activity_type: entryType,
        hours,
        notes: entryNotes,
      });
      if (res.status !== 200) {
        throw new Error(res.message || "Failed to add hours");
      }
      if (res.data) setDayData(res.data);
      setEntryHours("");
      setEntryNotes("");
      toast.success("Hours added");
      setStartDate((prev) => (today < prev ? today : prev));
      setEndDate((prev) => (today > prev ? today : prev));
      loadEntries({ silent: true });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (qaTrackerId) => {
    if (!userId || !qaTrackerId) return;
    setSaving(true);
    try {
      const res = await deleteQATrackerEntry({
        logged_in_user_id: userId,
        qa_tracker_id: qaTrackerId,
      });
      if (res.status !== 200) {
        throw new Error(res.message || "Failed to delete");
      }
      if (res.data) setDayData(res.data);
      setDeleteConfirm(null);
      toast.success("Entry removed");
      loadEntries({ silent: true });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEntry = async () => {
    if (!userId || !editEntry?.qa_tracker_id) return;
    const hours = Number(editEntry.hours);
    if (!editEntry.activity_type) {
      toast.error("Select Feedback or Reporting");
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error("Enter hours greater than 0");
      return;
    }
    setSaving(true);
    try {
      const res = await updateQATrackerEntry({
        logged_in_user_id: userId,
        qa_tracker_id: editEntry.qa_tracker_id,
        work_date: editEntry.work_date,
        activity_type: editEntry.activity_type,
        hours,
        notes: editEntry.notes || "",
      });
      if (res.status !== 200) {
        throw new Error(res.message || "Failed to update");
      }
      setEditEntry(null);
      toast.success("Entry updated");
      loadEntries({ silent: true });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const buckets = dayData?.buckets || {};
  const expected = dayData?.expected || {
    qc_tasks: 4.5,
    feedback: 1.5,
    rework_qc: 1.5,
    reporting: 1.5,
    total: 9,
  };
  const qaUserOptions = useMemo(
    () => [
      { value: "", label: "All QA" },
      ...(Array.isArray(qaUsers) ? qaUsers : []).map((u) => ({
        value: String(u.user_id),
        label: u.user_name,
      })),
    ],
    [qaUsers]
  );
  const qaAddOptions = useMemo(
    () =>
      (Array.isArray(qaUsers) ? qaUsers : []).map((u) => ({
        value: String(u.user_id),
        label: u.user_name,
      })),
    [qaUsers]
  );

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selfDailyRows = useMemo(
    () => fillMonthDays(listRows, monthFilter, today, userId),
    [listRows, monthFilter, today, userId]
  );

  const managerDailyRows = useMemo(
    () => (listRows || []).filter((row) => !isWeekendIso(row.work_date) || dayHasWork(row)),
    [listRows]
  );

  const selectWorkDate = (dateStr, key) => {
    if (dateStr) setWorkDate(dateStr);
    if (key) toggleExpand(key);
  };

  const renderHoursTable = (rows, { showDate, showMonth, showQaName = true, compact = false }) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    return (
    <div className="rounded-xl border-2 border-slate-200 bg-white shadow-sm">
      <div className={compact ? "max-h-[38vh] overflow-auto" : "max-h-[65vh] overflow-auto"}>
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-blue-600 text-white">
            <tr>
              {showQaName ? <th className="px-4 py-3 text-left text-xs font-bold uppercase">QA</th> : null}
              {showMonth ? <th className="px-4 py-3 text-left text-xs font-bold uppercase">Month Year</th> : null}
              {showDate ? <th className="px-4 py-3 text-left text-xs font-bold uppercase">Date</th> : null}
              {!showDate ? <th className="px-4 py-3 text-right text-xs font-bold uppercase">Days</th> : null}
              <th className="px-4 py-3 text-right text-xs font-bold uppercase">QC Hours</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase">Rework Hour</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase">Feedback</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase">Reporting</th>
              {showDate ? (
                <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total / 9h</th>
              ) : (
                <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Hours</th>
              )}
              {!showDate ? <th className="px-4 py-3 text-right text-xs font-bold uppercase">Expected</th> : null}
              {!showDate ? <th className="px-4 py-3 text-right text-xs font-bold uppercase">Pending</th> : null}
              <th className="px-4 py-3 text-right text-xs font-bold uppercase">Files</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase">QC Record</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                  No QA hours for {yyyyMmToMonthYear(monthFilter)}. Change Month Year to see other months.
                </td>
              </tr>
            ) : (
              safeRows.map((row) => {
                const key = showDate
                  ? `${row.qa_user_id}-${row.work_date}`
                  : `${row.qa_user_id}-${row.month_year}`;
                const open = expanded[key];
                const weekend = showDate && isWeekendIso(row.work_date);
                const selected = showDate && row.work_date === workDate;
                return (
                  <React.Fragment key={key}>
                    <tr
                      className={`border-t border-slate-100 transition-all duration-200 ${
                        weekend
                          ? "bg-orange-50 border-l-4 border-l-orange-800"
                          : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                      } ${selected && !weekend ? "bg-blue-50" : ""} ${selected && weekend ? "bg-orange-100" : ""}`}
                    >
                      {showQaName ? (
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <button
                            type="button"
                            onClick={() => toggleExpand(key)}
                            className="inline-flex items-center gap-1 text-left"
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {row.qa_user_name || row.qa_user_id}
                          </button>
                        </td>
                      ) : null}
                      {showMonth ? (
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {row.month_year || monthYearLabel || yyyyMmToMonthYear(monthFilter)}
                        </td>
                      ) : null}
                      {showDate ? (
                        <td className={`px-4 py-3 font-semibold whitespace-pre-line ${weekend ? "text-red-600 font-bold" : "text-slate-800"}`}>
                          <button
                            type="button"
                            onClick={() => selectWorkDate(row.work_date, key)}
                            className="inline-flex items-center gap-1 text-left"
                          >
                            {!showQaName ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                            {formatReportDate(row.work_date)}
                          </button>
                        </td>
                      ) : null}
                      {!showDate ? <td className="px-4 py-3 text-right">{row.days_worked || 0}</td> : null}
                      <td className="px-4 py-3 text-right">{fmt(row.qc_hours)}</td>
                      <td className="px-4 py-3 text-right">{fmt(row.rework_hours)}</td>
                      <td className="px-4 py-3 text-right">{fmt(row.feedback_hours)}</td>
                      <td className="px-4 py-3 text-right">{fmt(row.reporting_hours)}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        {showDate
                          ? `${fmt(row.total_hours)} / ${fmt(row.expected_total || 9)}`
                          : fmt(row.total_hours)}
                      </td>
                      {!showDate ? (
                        <td className="px-4 py-3 text-right">{fmt(row.expected_hours)}</td>
                      ) : null}
                      {!showDate ? (
                        <td className="px-4 py-3 text-right">{fmt(row.pending_hours)}</td>
                      ) : null}
                      <td className="px-4 py-3 text-right">{(row.qc_files || 0) + (row.rework_files || 0)}</td>
                      <td className="px-4 py-3 text-right">{row.qc_records || 0}</td>
                    </tr>
                    {open && (row.projects || []).length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={14} className="px-6 py-3">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="py-1 text-left">Project</th>
                                <th className="py-1 text-left">Task</th>
                                <th className="py-1 text-right">QC Hours</th>
                                <th className="py-1 text-right">Rework Hour</th>
                                <th className="py-1 text-right">Files</th>
                                <th className="py-1 text-right">File Record</th>
                                <th className="py-1 text-right">QC Record</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.projects.map((p) => (
                                <tr key={`${p.project_id}-${p.task_id}`}>
                                  <td className="py-1">{p.project_name}</td>
                                  <td className="py-1">{p.task_name}</td>
                                  <td className="py-1 text-right">{fmt(p.qc_hours)}</td>
                                  <td className="py-1 text-right">{fmt(p.rework_hours)}</td>
                                  <td className="py-1 text-right">{p.files}</td>
                                  <td className="py-1 text-right">{p.file_records}</td>
                                  <td className="py-1 text-right">{p.qc_records}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const entryHoursTotal = useMemo(
    () => (entries || []).reduce((sum, row) => sum + (Number(row.hours) || 0), 0),
    [entries]
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveToggle("tracker")}
            className={`relative flex-1 px-6 py-4 text-sm font-bold transition-all ${
              activeToggle === "tracker" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Tracker
            </span>
            {activeToggle === "tracker" ? (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveToggle("daily")}
            className={`relative flex-1 px-6 py-4 text-sm font-bold transition-all ${
              activeToggle === "daily" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" />
              Daily Report
            </span>
            {activeToggle === "daily" ? (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveToggle("monthly")}
            className={`relative flex-1 px-6 py-4 text-sm font-bold transition-all ${
              activeToggle === "monthly" ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Monthly Report
            </span>
            {activeToggle === "monthly" ? (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
            ) : null}
          </button>
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {activeToggle === "tracker" ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-lg">
            <div className="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3">
              <h3 className="text-base font-bold text-white">Add Feedback / Reporting</h3>
              <p className="text-xs font-medium text-blue-100">
                {isManager ? "Managers can edit any entry. QA can delete their own entry within 24 hours." : "You can delete your own entry within 24 hours."}
              </p>
            </div>
            <div className="px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="sm:w-44">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Date</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
                    {formatISTDateMedium(today, today)}
                  </div>
                </div>
                {isManager ? (
                  <div className="w-full lg:w-56">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">QA</label>
                    <select
                      value={addQaUserId}
                      onChange={(e) => setAddQaUserId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select QA</option>
                      {qaAddOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="sm:w-56">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    {ACTIVITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:w-28">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Hours</label>
                  <input
                    type="number"
                    min="0.25"
                    max="24"
                    step="0.25"
                    value={entryHours}
                    onChange={(e) => setEntryHours(e.target.value)}
                    placeholder="1"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Note</label>
                  <input
                    type="text"
                    value={entryNotes}
                    onChange={(e) => setEntryNotes(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddEntry}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
              <div className="relative min-w-[340px] shrink-0">
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  label=""
                  description={null}
                  showClearButton={false}
                  compact
                  fieldWidth="200px"
                  noWrapper
                />
              </div>
              {isManager ? (
                <div className="w-full min-w-[220px] sm:w-64 shrink-0">
                  <SearchableSelect
                    value={qaUserId}
                    onChange={setQaUserId}
                    options={qaUserOptions}
                    placeholder="All QA"
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setStartDate(today);
                  setEndDate(today);
                  setQaUserId("");
                  setWorkDate(today);
                }}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Feedback & Reporting Tracker</h3>
                <p className="text-xs font-medium text-slate-500">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"} · {fmt(entryHoursTotal)}h
                </p>
              </div>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-blue-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Date / Time</th>
                    {isManager ? <th className="px-4 py-3 text-left text-xs font-bold uppercase">QA</th> : null}
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Note</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isManager ? 6 : 5} className="px-4 py-16 text-center text-slate-500">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          Loading tracker...
                        </span>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={isManager ? 6 : 5} className="px-4 py-16 text-center text-slate-500">
                        No Feedback or Reporting entries for this date range.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const added = formatISTDateTimeParts(entry.created_at);
                      return (
                        <tr key={entry.qa_tracker_id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <div className="flex flex-col">
                              <span>{formatISTDateMedium(entry.work_date, entry.work_date)}</span>
                              <span className="text-xs text-slate-500">{added.time || added.date || "-"}</span>
                            </div>
                          </td>
                          {isManager ? (
                            <td className="px-4 py-3 font-semibold text-slate-800">{entry.qa_user_name || "-"}</td>
                          ) : null}
                          <td className="px-4 py-3 font-semibold text-slate-800">{activityLabel(entry.activity_type)}</td>
                          <td className="px-4 py-3 text-right font-bold">{fmt(entry.hours)}h</td>
                          <td className="px-4 py-3 text-slate-600">{entry.notes || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              {entry.can_edit ? (
                                <button
                                  type="button"
                                  onClick={() => setEditEntry({ ...entry })}
                                  className="inline-flex items-center justify-center rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-600 hover:text-white"
                                  title="Edit entry"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              ) : null}
                              {entry.can_delete ? (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(entry.qa_tracker_id)}
                                  disabled={saving}
                                  className="inline-flex items-center justify-center rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
                                  title="Delete entry"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <MonthYearPicker
                compact
                label="Month Year"
                selectedMonthYear={yyyyMmToMonthYear(monthFilter)}
                onMonthYearChange={(my) => {
                  const yyyyMm = monthYearToYyyyMm(my);
                  if (yyyyMm) setMonthFilter(yyyyMm);
                }}
                showAllOption={false}
              />
              {isManager ? (
                <div className="w-full lg:w-64">
                  <SearchableSelect
                    value={qaUserId}
                    onChange={setQaUserId}
                    options={qaUserOptions}
                    placeholder="All QA"
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setMonthFilter(defaultMonth);
                  setQaUserId("");
                  setWorkDate(clampDateToMonth(today, defaultMonth, today));
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="font-semibold">Loading QA hours...</span>
            </div>
          ) : activeToggle === "monthly" ? (
            renderHoursTable(monthlyRows, { showDate: false, showMonth: true, showQaName: true })
          ) : isManager ? (
            renderHoursTable(managerDailyRows, { showDate: true, showMonth: false, showQaName: true })
          ) : (
            <>
              {renderHoursTable(selfDailyRows, { showDate: true, showMonth: false, showQaName: false, compact: true })}

              <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    Details for {formatISTDateMedium(workDate, workDate)}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Total {fmt((buckets.qc_tasks?.hours || 0) + (buckets.rework_qc?.hours || 0) + (buckets.feedback?.hours || 0) + (buckets.reporting?.hours || 0))}h / {fmt(expected.total)}h
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-5">
                  {[
                    { label: "QC Tasks", value: buckets.qc_tasks?.hours, expected: expected.qc_tasks, extra: `${buckets.qc_tasks?.files || 0} files` },
                    { label: "Rework QC", value: buckets.rework_qc?.hours, expected: expected.rework_qc, extra: `${buckets.rework_qc?.files || 0} files` },
                    { label: "Feedback", value: buckets.feedback?.hours, expected: expected.feedback },
                    { label: "Reporting", value: buckets.reporting?.hours, expected: expected.reporting },
                    { label: "Total", value: (buckets.qc_tasks?.hours || 0) + (buckets.rework_qc?.hours || 0) + (buckets.feedback?.hours || 0) + (buckets.reporting?.hours || 0), expected: expected.total, highlight: true },
                  ].map((item) => (
                    <div key={item.label} className={`px-3 py-3 ${item.highlight ? "bg-blue-50" : "bg-white"}`}>
                      <p className={`text-[11px] font-bold uppercase tracking-wide ${item.highlight ? "text-blue-700" : "text-slate-500"}`}>{item.label}</p>
                      <p className={`mt-0.5 text-lg font-extrabold ${item.highlight ? "text-blue-900" : "text-slate-900"}`}>{fmt(item.value)}h</p>
                      <p className="text-[11px] font-semibold text-slate-500">Expected {fmt(item.expected)}h{item.extra ? ` · ${item.extra}` : ""}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-800">Hours by project / task</h3>
                    <span className="text-xs text-slate-500">QA target = 50% of actual target</span>
                  </div>
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] font-semibold text-slate-500">
                        <th className="px-3 py-3">Project</th>
                        <th className="px-3 py-3">Task</th>
                        <th className="px-3 py-3">File</th>
                        <th className="px-3 py-3 text-right">Actual Target</th>
                        <th className="px-3 py-3 text-right">QA Target</th>
                        <th className="px-3 py-3 text-right">QC Hours</th>
                        <th className="px-3 py-3 text-right">Rework Hour</th>
                        <th className="px-3 py-3 text-right">Files</th>
                        <th className="px-3 py-3 text-right">File Record</th>
                        <th className="px-3 py-3 text-right pr-6">QC Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dayData?.projects || []).length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                            No QC files for this date yet. Hours appear after you submit QC forms.
                          </td>
                        </tr>
                      ) : (
                        (dayData.projects || []).map((p) => {
                          const key = `${p.project_id}-${p.task_id}`;
                          const open = expanded[key];
                          return (
                            <React.Fragment key={key}>
                              <tr className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2.5 align-top font-semibold text-slate-800">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(key)}
                                    className="inline-flex w-full items-start gap-1 text-left"
                                  >
                                    {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                                    <span className="min-w-0 break-words">{p.project_name}</span>
                                  </button>
                                </td>
                                <td className="px-3 py-2.5 align-top break-words">{p.task_name}</td>
                                <td className="px-3 py-2.5 text-slate-400">-</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.actual_target)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.qa_target)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.qc_hours)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(p.rework_hours)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{(p.qc_files || 0) + (p.rework_files || 0)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{p.file_records || 0}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums font-semibold pr-6">{p.qc_records || 0}</td>
                              </tr>
                              {open &&
                                (p.files || []).map((f) => {
                                  const fileType =
                                    f.activity_type === "rework_qc"
                                      ? "Rework"
                                      : f.qc_status === "regular"
                                        ? "QC"
                                        : f.qc_status || "QC";
                                  const fileTime = fmtTrackerTime(f.tracker_time);
                                  const fileLabel = [f.agent_name || "-", fileType, fileTime].filter(Boolean).join(" | ");
                                  return (
                                    <tr key={f.qa_tracker_id} className="border-t border-slate-100 bg-slate-50 text-xs text-slate-600">
                                      <td className="px-3 py-2 pl-8 align-top break-words">{f.project_name || p.project_name}</td>
                                      <td className="px-3 py-2 align-top break-words">{f.task_name || p.task_name}</td>
                                      <td className="px-3 py-2 align-top break-words font-medium text-slate-800">{fileLabel}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{fmt(f.actual_target)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{fmt(f.qa_target)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {f.activity_type === "qc_tasks" ? fmt(f.hours) : "-"}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {f.activity_type === "rework_qc" ? fmt(f.hours) : "-"}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">1</td>
                                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{f.file_record_count}</td>
                                      <td className="px-3 py-2 text-right tabular-nums font-semibold pr-6">{f.qc_generated_count}</td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Delete entry?</h4>
                <p className="text-sm text-slate-500">This Feedback / Reporting entry will be removed.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEntry(deleteConfirm)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h4 className="text-lg font-bold text-slate-800">Edit entry</h4>
              <button type="button" onClick={() => setEditEntry(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Date</label>
                <SingleDatePicker
                  value={editEntry.work_date}
                  onChange={(value) => setEditEntry((prev) => ({ ...prev, work_date: value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
                <select
                  value={editEntry.activity_type}
                  onChange={(e) => setEditEntry((prev) => ({ ...prev, activity_type: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Hours</label>
                <input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={editEntry.hours}
                  onChange={(e) => setEditEntry((prev) => ({ ...prev, hours: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Note</label>
                <input
                  type="text"
                  value={editEntry.notes || ""}
                  onChange={(e) => setEditEntry((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setEditEntry(null)}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateEntry}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default QAHoursTracker;
