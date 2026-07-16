import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Plus, Edit, Trash2, Search, Calendar as CalendarIcon, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import {
  addHoliday,
  deactivateHoliday,
  listHolidays,
  updateHoliday,
  uploadHolidayExcel,
} from "../../services/holidayService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import LoadingSpinner from "../common/LoadingSpinner";
import DeleteConfirmationModal from "../common/DeleteConfirmationModal";
import TablePaginationBar from "../common/TablePaginationBar";
import { useClientPagination } from "../../hooks/useClientPagination";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => current - 3 + i);
})();

function formatDisplayDate(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(isoDate).slice(0, 10);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseIsoDate(value) {
  if (!value) return undefined;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const HolidayMaster = ({ canModify = false }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ holiday_name: "", holiday_date: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listHolidays({
        calendar_year: year,
        include_inactive: canModify,
      });
      setHolidays(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, [year, canModify]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const filtered = useMemo(() => {
    if (!search.trim()) return holidays;
    const q = search.toLowerCase();
    return holidays.filter(
      (h) =>
        (h.holiday_name || "").toLowerCase().includes(q) ||
        (h.holiday_date || "").includes(q) ||
        formatDisplayDate(h.holiday_date).toLowerCase().includes(q)
    );
  }, [holidays, search]);

  const pagination = useClientPagination(filtered, {
    initialPageSize: 10,
    resetKeys: [year, search],
  });

  const openAdd = () => {
    setForm({ holiday_name: "", holiday_date: "" });
    setModal("add");
  };

  const openEdit = (holiday) => {
    setForm({
      holiday_id: holiday.holiday_id,
      holiday_name: holiday.holiday_name || "",
      holiday_date: holiday.holiday_date?.slice(0, 10) || "",
    });
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.holiday_name?.trim() || !form.holiday_date) {
      toast.error("Holiday name and date are required");
      return;
    }
    try {
      setSubmitting(true);
      if (modal === "add") {
        await addHoliday({
          holiday_name: form.holiday_name.trim(),
          holiday_date: form.holiday_date,
          calendar_year: year,
        });
        toast.success("Holiday added");
      } else {
        await updateHoliday({
          holiday_id: form.holiday_id,
          holiday_name: form.holiday_name.trim(),
          holiday_date: form.holiday_date,
        });
        toast.success("Holiday updated");
      }
      setModal(null);
      loadHolidays();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true);
      await deactivateHoliday({ holiday_id: deleteTarget.holiday_id });
      toast.success("Holiday deactivated");
      setDeleteTarget(null);
      loadHolidays();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadHolidayExcel(file, year);
      toast.success(res.message || "Holidays uploaded");
      loadHolidays();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Holiday Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Company holidays for roster planning and leave calendars
          </p>
        </div>
        {canModify && (
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-xs font-semibold shadow-sm">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              {uploading ? "Uploading..." : "Upload Excel"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Holiday
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <label className="block shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Calendar Year
            </span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 block w-full sm:w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <div className="flex-1 min-w-[200px]">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Search className="w-3 h-3" /> Search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Holiday name or date..."
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <p className="text-xs text-slate-400 lg:pb-2 shrink-0">
            Showing {year}
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No holidays found for {year}</p>
          <p className="text-xs text-slate-400 mt-1">
            {search.trim()
              ? "Try a different search term"
              : canModify
                ? "Add a holiday or upload an Excel file to get started"
                : "No holidays are configured for this year yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Holiday Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Year</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  {canModify && (
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pagedItems.map((h) => (
                  <tr key={h.holiday_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {formatDisplayDate(h.holiday_date)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{h.holiday_name}</td>
                    <td className="px-4 py-3 text-slate-600">{h.calendar_year}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          h.is_active
                            ? "bg-green-50 text-green-700 border-green-100"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {h.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canModify && (
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(h)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {h.is_active && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(h)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deactivate"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePaginationBar
            {...pagination}
            itemLabel="holidays"
          />
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {modal === "add" ? "Add Holiday" : "Edit Holiday"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Holiday Name
                </span>
                <input
                  value={form.holiday_name}
                  onChange={(e) => setForm({ ...form, holiday_name: e.target.value })}
                  placeholder="e.g. Republic Day"
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </label>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3 text-blue-600" />
                  Date
                </span>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-left flex items-center justify-between hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      )}
                    >
                      <span className={form.holiday_date ? "text-slate-800" : "text-slate-400"}>
                        {form.holiday_date
                          ? format(parseIsoDate(form.holiday_date) || new Date(), "dd MMM yyyy")
                          : "Select date"}
                      </span>
                      <CalendarIcon className="w-4 h-4 text-blue-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-2 border-blue-200 bg-white" align="start">
                    <Calendar
                      mode="single"
                      selected={parseIsoDate(form.holiday_date)}
                      onSelect={(date) => {
                        if (!date) return;
                        setForm({ ...form, holiday_date: format(date, "yyyy-MM-dd") });
                        setShowDatePicker(false);
                      }}
                      initialFocus
                      captionLayout="dropdown"
                      fromYear={year - 1}
                      toYear={year + 1}
                      defaultMonth={parseIsoDate(form.holiday_date) || new Date(year, 0, 1)}
                      className="rounded-md bg-white"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Holiday"
        entityName={deleteTarget?.holiday_name}
        entityType="holiday"
        isDeleting={submitting}
      />
    </div>
  );
};

export default HolidayMaster;
