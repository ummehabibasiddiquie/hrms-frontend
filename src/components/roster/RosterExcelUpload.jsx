import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  applyRosterExcelChanges,
  downloadRosterExcelTemplate,
  listRosterExcelWeeks,
  previewRosterExcel,
} from "../../services/rosterService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import { formatMonthYearLabel } from "../../utils/rosterUtils";
import LoadingSpinner from "../common/LoadingSpinner";

function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const RosterExcelUpload = ({
  monthYear,
  teamId = "all",
  disabled = false,
  onApplied,
}) => {
  const [open, setOpen] = useState(false);
  const [weeks, setWeeks] = useState([]);
  const [weekNumber, setWeekNumber] = useState(null);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const selectedWeek = useMemo(
    () => weeks.find((w) => Number(w.week_number) === Number(weekNumber)) || null,
    [weeks, weekNumber]
  );

  const loadWeeks = useCallback(async () => {
    if (!monthYear) return;
    try {
      setLoadingWeeks(true);
      const res = await listRosterExcelWeeks({ month_year: monthYear });
      const list = res.data?.weeks || [];
      setWeeks(list);
      setWeekNumber((prev) => {
        if (prev && list.some((w) => Number(w.week_number) === Number(prev))) return prev;
        // Prefer current calendar week if it falls in this month
        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);
        const current = list.find(
          (w) => w.week_start <= todayIso && todayIso <= w.week_end
        );
        return current?.week_number || list[0]?.week_number || null;
      });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
      setWeeks([]);
    } finally {
      setLoadingWeeks(false);
    }
  }, [monthYear]);

  useEffect(() => {
    if (open) {
      loadWeeks();
      setPreview(null);
      setSelectedFileName("");
    }
  }, [open, loadWeeks]);

  const summary = preview?.summary;
  const hasBlockingErrors = (preview?.errors?.length || 0) > 0;
  const canApply = (preview?.changes?.length || 0) > 0 && !hasBlockingErrors;

  const handleDownloadWeek = async () => {
    if (!weekNumber) {
      toast.error("Select a week first");
      return;
    }
    try {
      setDownloading("week");
      const blob = await downloadRosterExcelTemplate({
        month_year: monthYear,
        week_number: weekNumber,
        team_id: teamId,
        prefill: true,
      });
      triggerBlobDownload(blob, `Roster_${monthYear}_Week${weekNumber}.xlsx`);
      toast.success(`${selectedWeek?.short_label || `Week ${weekNumber}`} template downloaded`);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setDownloading("");
    }
  };

  const handleDownloadAllWeeks = async () => {
    try {
      setDownloading("all");
      const blob = await downloadRosterExcelTemplate({
        month_year: monthYear,
        all_weeks: true,
        team_id: teamId,
        prefill: true,
      });
      triggerBlobDownload(blob, `Roster_${monthYear}_All_Weeks.xlsx`);
      toast.success("Full month template downloaded (Week 1–N sheets)");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setDownloading("");
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPreviewing(true);
      setSelectedFileName(file.name);
      const res = await previewRosterExcel(file, { team_id: teamId });
      setPreview(res.data || null);
      const s = res.data?.summary;
      if (s?.errors) {
        toast.error(`${s.errors} error(s) found — fix before applying`);
      } else if (s?.changes === 0) {
        toast.success("No changes detected vs current roster");
      } else {
        const sheets = s?.sheets ? ` across ${s.sheets} sheet(s)` : "";
        toast.success(`${s?.changes || 0} change(s) ready to apply${sheets}`);
      }
    } catch (err) {
      setPreview(null);
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!canApply || applying) return;
    try {
      setApplying(true);
      const res = await applyRosterExcelChanges({
        changes: preview.changes,
      });
      const created = res.data?.created || 0;
      const updated = res.data?.updated || 0;
      const failed = res.data?.failed || [];
      if (failed.length) {
        toast.error(`Applied with ${failed.length} failure(s)`);
      } else {
        toast.success(
          `Created ${created} pending request(s)${updated ? `, updated ${updated}` : ""}. Submit for approval when ready.`
        );
      }
      setOpen(false);
      setPreview(null);
      onApplied?.();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  const changePreviewRows = useMemo(() => (preview?.changes || []).slice(0, 80), [preview]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title="Download sample Excel or upload weekly roster"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Excel Upload
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Weekly Roster Excel</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {formatMonthYearLabel(monthYear)} — download Week 1 / Week 2 / … or the full month,
                  edit offline, then upload.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              <section className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">1. Choose week & download</h3>

                {loadingWeeks ? (
                  <div className="py-4 flex justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {weeks.map((w) => {
                      const active = Number(w.week_number) === Number(weekNumber);
                      return (
                        <button
                          key={w.week_start}
                          type="button"
                          onClick={() => setWeekNumber(w.week_number)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-left min-w-[7.5rem] ${
                            active
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                          title={w.date_range}
                        >
                          <span className="block">{w.short_label}</span>
                          <span className={`block mt-0.5 font-normal ${active ? "text-blue-100" : "text-slate-400"}`}>
                            {w.date_range}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadWeek}
                    disabled={!weekNumber || !!downloading}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {downloading === "week" ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download {selectedWeek?.short_label || "selected week"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAllWeeks}
                    disabled={!weeks.length || !!downloading}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    {downloading === "all" ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download all weeks ({weeks.length})
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Single-week file has one sheet. Full-month file has Week 1, Week 2, Week 3… sheets
                  so you can fill the month week by week in one Excel, or upload each week separately.
                </p>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">2. Upload filled file</h3>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl px-4 py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {previewing ? "Reading Excel…" : "Choose Excel file (.xlsx)"}
                  </span>
                  {selectedFileName && (
                    <span className="text-xs text-slate-500">{selectedFileName}</span>
                  )}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={previewing || applying}
                    onChange={handleFile}
                  />
                </label>
              </section>

              {preview && (
                <section className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 text-xs font-semibold">
                    <span className="text-slate-600">
                      {preview.week_start} → {preview.week_end}
                    </span>
                    {(preview.sheets?.length || 0) > 0 && (
                      <span className="text-slate-500">
                        {preview.sheets.map((s) => s.sheet).join(", ")}
                      </span>
                    )}
                    <span className="text-blue-700">{summary?.changes || 0} changes</span>
                    <span className="text-slate-500">{summary?.skipped || 0} unchanged</span>
                    <span className={hasBlockingErrors ? "text-red-600" : "text-slate-500"}>
                      {summary?.errors || 0} errors
                    </span>
                  </div>

                  {hasBlockingErrors && (
                    <div className="px-4 py-3 border-b border-red-100 bg-red-50">
                      <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Fix these before applying
                      </p>
                      <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                        {(preview.errors || []).slice(0, 30).map((err, i) => (
                          <li key={i}>
                            {err.sheet ? `${err.sheet} · ` : ""}
                            Row {err.row}
                            {err.name ? ` · ${err.name}` : ""}
                            {err.date ? ` · ${err.date}` : ""}
                            {err.value ? ` · "${err.value}"` : ""} — {err.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {changePreviewRows.length > 0 && (
                    <div className="overflow-x-auto max-h-56">
                      <table className="min-w-full text-xs">
                        <thead className="bg-white sticky top-0">
                          <tr className="text-left text-slate-500 border-b border-slate-100">
                            <th className="px-3 py-2 font-semibold">Employee</th>
                            <th className="px-3 py-2 font-semibold">Date</th>
                            <th className="px-3 py-2 font-semibold">Current</th>
                            <th className="px-3 py-2 font-semibold">New</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changePreviewRows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="px-3 py-2 text-slate-800">{row.user_name}</td>
                              <td className="px-3 py-2 text-slate-600">{row.date}</td>
                              <td className="px-3 py-2 text-slate-500">{row.current_label || "—"}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{row.new_label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(preview.changes?.length || 0) > changePreviewRows.length && (
                        <p className="px-3 py-2 text-[11px] text-slate-400">
                          Showing first {changePreviewRows.length} of {preview.changes.length} changes
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap justify-end gap-2 bg-white">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canApply || applying}
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {applying ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Apply as pending requests
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RosterExcelUpload;
