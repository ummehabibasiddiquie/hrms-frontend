import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Plus, Edit, Trash2, Search, Calendar } from "lucide-react";
import { toast } from "react-hot-toast";
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

const PAGE_SIZE = 12;

const HolidayMaster = ({ canModify = false }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ holiday_name: "", holiday_date: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listHolidays({
        calendar_year: year,
        include_inactive: canModify,
      });
      setHolidays(Array.isArray(res.data) ? res.data : []);
      setPage(1);
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
        (h.holiday_date || "").includes(q)
    );
  }, [holidays, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Calendar Year</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1 w-32 border border-slate-300 rounded-lg px-3 py-2"
              />
            </label>
            <label className="block flex-1 min-w-[200px]">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                <Search className="w-4 h-4" /> Search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or date..."
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </label>
          </div>
          {canModify && (
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 text-sm font-semibold">
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload Excel"}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Holiday
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Holiday Name</th>
                  <th className="px-4 py-3 font-semibold">Year</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canModify && <th className="px-4 py-3 font-semibold text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={canModify ? 5 : 4} className="px-4 py-12 text-center text-slate-500">
                      <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No holidays found for {year}.
                    </td>
                  </tr>
                ) : (
                  paged.map((h) => (
                    <tr key={h.holiday_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{h.holiday_date?.slice(0, 10)}</td>
                      <td className="px-4 py-3">{h.holiday_name}</td>
                      <td className="px-4 py-3">{h.calendar_year}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-full ${
                            h.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {h.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canModify && (
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(h)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {h.is_active && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(h)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">{modal === "add" ? "Add Holiday" : "Edit Holiday"}</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Holiday Name</span>
                <input
                  value={form.holiday_name}
                  onChange={(e) => setForm({ ...form, holiday_name: e.target.value })}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Date</span>
                <input
                  type="date"
                  value={form.holiday_date}
                  onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Save
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
