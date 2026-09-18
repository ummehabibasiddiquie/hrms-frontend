import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Save,
  Target,
  Award,
  CalendarDays,
  FileCheck2,
  Percent,
  Funnel,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { MonthYearPicker, getCurrentYyyyMm, yyyyMmToMonthYear } from "../common/CustomCalendar";
import SearchableSelect from "../common/SearchableSelect";
import { exportKraReport, fetchKraReport, fetchKraUsers, saveKraNotes } from "../../services/kraService";

/** KRA is month-wise and live from this month (must match backend KRA_GO_LIVE_MONTH). */
const KRA_GO_LIVE_MONTH = "SEP2026";

const STATUS_STYLE = {
  PRESENT: "bg-green-50 text-green-700 border border-green-200",
  "HALF DAY": "bg-amber-50 text-amber-700 border border-amber-200",
  ABSENT: "bg-red-50 text-red-700 border border-red-200",
  LEAVE: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  "WEEK OFF": "bg-sky-50 text-sky-700 border border-sky-200",
  WFH: "bg-teal-50 text-teal-700 border border-teal-200",
  UNROSTERED: "bg-orange-50 text-orange-700 border border-orange-300",
  HOLIDAY: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

const STATUS_ROW_TINT = {
  "WEEK OFF": "bg-sky-50/70",
  HOLIDAY: "bg-indigo-50/50",
  LEAVE: "bg-yellow-50/60",
  ABSENT: "bg-red-50/40",
  "HALF DAY": "bg-amber-50/40",
};

function flagClass(value) {
  if (value === "YES") return "bg-green-50 text-green-700 border border-green-200";
  if (value === "NO") return "bg-red-50 text-red-700 border border-red-200";
  return "text-slate-300";
}

function formatScore(value) {
  if (value == null || value === "") return "—";
  return Number(value).toFixed(2);
}

function notesFromReport(report) {
  return Object.fromEntries((report?.days || []).map((day) => [day.work_date, day.note || ""]));
}

function defaultKraMonth() {
  const current = yyyyMmToMonthYear(getCurrentYyyyMm());
  return current < KRA_GO_LIVE_MONTH ? KRA_GO_LIVE_MONTH : current;
}

export default function KraReport() {
  const [monthYear, setMonthYear] = useState(defaultKraMonth);
  const [users, setUsers] = useState([]);
  const [usersReady, setUsersReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [report, setReport] = useState(null);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchKraUsers()
      .then((res) => {
        if (cancelled || res.status !== 200) return;
        const list = res.data?.users || [];
        setUsers(list);
        setUserId((current) => current || (list[0] ? String(list[0].user_id) : ""));
      })
      .catch(() => toast.error("Could not load agents"))
      .finally(() => {
        if (!cancelled) setUsersReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadReport = useCallback(async () => {
    if (!userId || !monthYear || monthYear === "all") return;
    if (monthYear < KRA_GO_LIVE_MONTH) {
      setMonthYear(KRA_GO_LIVE_MONTH);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchKraReport({ user_id: Number(userId), month_year: monthYear });
      if (res.status !== 200) {
        toast.error(res.message || "Could not load KRA");
        setReport(null);
        setNotes({});
        return;
      }
      setReport(res.data);
      setNotes(notesFromReport(res.data));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not load KRA");
    } finally {
      setLoading(false);
    }
  }, [userId, monthYear]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const dirty = useMemo(() => {
    if (!report) return false;
    return JSON.stringify(notesFromReport(report)) !== JSON.stringify(notes);
  }, [report, notes]);

  const onSaveNotes = async () => {
    if (!report || !dirty) return false;
    setSaving(true);
    try {
      const res = await saveKraNotes({
        user_id: Number(userId),
        month_year: monthYear,
        notes: (report.days || []).map((day) => ({
          work_date: day.work_date,
          note: notes[day.work_date] || "",
        })),
      });
      if (res.status !== 200) {
        toast.error(res.message || "Could not save notes");
        return false;
      }
      setReport(res.data);
      setNotes(notesFromReport(res.data));
      toast.success("Notes saved");
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save notes");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onExport = async () => {
    if (dirty) {
      const saved = await onSaveNotes();
      if (!saved) return;
    }
    try {
      const res = await exportKraReport({ user_id: Number(userId), month_year: monthYear });
      const blob = res.data;
      if (blob?.type?.includes("json")) {
        const text = await blob.text();
        toast.error(JSON.parse(text).message || "Could not download");
        return;
      }
      const header = res.headers?.["content-disposition"] || "";
      const match = header.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      const fromHeader = match ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : "";
      const fallback = `KRA ${report?.user_name || "Agent"} - ${monthYear}${report?.period_end ? ` through ${report.period_end}` : ""}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fromHeader || fallback;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch {
      toast.error("Could not download the KRA sheet");
    }
  };

  const counts = report?.counts || {};
  const scores = Object.fromEntries((report?.scores || []).map((row) => [row.key, row.earned]));
  const throughLabel = report?.period_end
    ? report.is_current_month
      ? `Through ${report.period_end} (today)`
      : `Full month through ${report.period_end}`
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 lg:mr-auto">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm">
              <Funnel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">Monthly KRA</h3>
              <p className="text-xs text-slate-500 font-medium">
                From {KRA_GO_LIVE_MONTH}
                {throughLabel ? ` · ${throughLabel}` : ""}
                {report?.user_name ? ` · ${report.user_name}` : ""}
              </p>
            </div>
          </div>
          <div className="w-full lg:w-56">
            <MonthYearPicker
              compact
              label="Month"
              showAllOption={false}
              selectedMonthYear={monthYear}
              minMonthYear={KRA_GO_LIVE_MONTH}
              onMonthYearChange={(next) => {
                if (!next || next === "all") return;
                setMonthYear(next < KRA_GO_LIVE_MONTH ? KRA_GO_LIVE_MONTH : next);
              }}
            />
          </div>
          {users.length > 1 && (
            <div className="w-full lg:w-72">
              <SearchableSelect
                value={userId}
                onChange={setUserId}
                placeholder="Select agent"
                options={users.map((user) => ({
                  value: String(user.user_id),
                  label: user.team_name ? `${user.user_name} · ${user.team_name}` : user.user_name,
                }))}
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveNotes}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving" : "Save notes"}
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={!report || saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-bold disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-slate-500 font-medium">
          Loading KRA…
        </div>
      )}

      {!loading && usersReady && !report && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-slate-500 font-medium">
          {userId ? "No KRA to show for this month." : "No agents are available for KRA."}
        </div>
      )}

      {!loading && report && (
        <>
          {!report.roster_found && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              No roster was found for this month, so attendance is blank.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <ScoreCard
              title="Productivity"
              weight="33%"
              value={scores.productivity}
              hint={`${counts.productivity_yes || 0} of ${counts.working_days || 0} days ≥ 9h`}
              icon={Target}
            />
            <ScoreCard
              title="Quality"
              weight="33%"
              value={scores.quality}
              hint={`${counts.quality_yes || 0} of ${counts.working_days || 0} days ≥ 98%`}
              icon={Award}
            />
            <ScoreCard
              title="Roster"
              weight="10%"
              value={scores.schedule}
              hint={`${counts.present_days || 0} present / ${counts.working_days || 0} working`}
              icon={CalendarDays}
            />
            <ScoreCard
              title="Reporting"
              weight="14%"
              value={scores.reporting}
              hint={`${counts.low_tracker_days || 0} days under 7 trackers`}
              icon={FileCheck2}
            />
            <ScoreCard
              title="KRA"
              weight={`${report.totals?.applicable_weight || 90}%`}
              value={report.totals?.kra_percent}
              hint="Earned / applicable (points 1–4)"
              icon={Percent}
              accent
            />
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <tr>
                    {["Date", "Day", "Attendance", "Billable hours", "Productivity", "QC score", "Quality", "Trackers", "Note"].map((label) => (
                      <th key={label} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report.days || []).map((day) => (
                    <tr
                      key={day.work_date}
                      className={`border-t border-slate-100 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 ${STATUS_ROW_TINT[day.attendance] || ""}`}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800">{day.work_date}</td>
                      <td className="px-4 py-2.5 text-slate-600">{day.day}</td>
                      <td className="px-4 py-2.5">
                        {day.attendance ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-bold ${STATUS_STYLE[day.attendance] || "text-slate-500"}`}>
                            {day.attendance}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-800">
                        {day.billable_hours == null ? "—" : Number(day.billable_hours).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold inline-block ${flagClass(day.productivity)}`}>
                          {day.productivity || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-800">
                        {day.qc_score == null ? "—" : Number(day.qc_score).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold inline-block ${flagClass(day.quality)}`}>
                          {day.quality || "—"}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 tabular-nums font-semibold ${day.low_tracker ? "text-red-600" : "text-slate-800"}`}>
                        {day.tracker_count == null ? "—" : day.tracker_count}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          value={notes[day.work_date] || ""}
                          onChange={(e) => setNotes((current) => ({ ...current, [day.work_date]: e.target.value }))}
                          placeholder="Add note if needed"
                          maxLength={500}
                          className="w-full min-w-[180px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ScoreCard({ title, weight, value, hint, icon: Icon, accent = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border-2 ${
        accent
          ? "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 border-blue-600 text-white"
          : "bg-white border-slate-200 hover:border-blue-300"
      }`}
    >
      {!accent && <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-12 translate-x-12" />}
      <div className="relative p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className={`text-xs font-bold uppercase tracking-wide truncate ${accent ? "text-blue-100" : "text-slate-600"}`}>
              {title}
            </p>
            <span className={`text-[11px] font-bold ${accent ? "text-blue-100" : "text-blue-600"}`}>{weight}</span>
          </div>
          <h3 className={`text-xl sm:text-2xl font-extrabold tabular-nums ${accent ? "text-white" : "text-slate-900"}`}>
            {accent && value != null ? `${formatScore(value)}%` : formatScore(value)}
          </h3>
          <p className={`text-xs font-semibold mt-1 truncate ${accent ? "text-blue-100" : "text-slate-500"}`}>{hint}</p>
        </div>
        <div className={`p-3 rounded-xl shadow-sm flex-shrink-0 ${accent ? "bg-white/15" : "bg-blue-100"}`}>
          <Icon className={`w-5 h-5 ${accent ? "text-white" : "text-blue-600"}`} />
        </div>
      </div>
    </div>
  );
}
