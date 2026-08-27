import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Search,
  Eye,
  ClipboardList,
  User,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  approveChangeRequest,
  approveChangeRequestsBulk,
  listChangeRequests,
  rejectChangeRequest,
} from "../../services/rosterService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import {
  statusBadgeClass,
  getCurrentMonthYear,
  formatMonthYearLabel,
  getChangeTypeLabel,
  formatChangeRequestSummary,
  getChangeRequestDetailLines,
} from "../../utils/rosterUtils";
import LoadingSpinner from "../common/LoadingSpinner";
import { MonthYearPicker } from "../common/CustomCalendar";
import { formatISTDateTimeLong } from "../../utils/dateTimeIST";

const PAGE_SIZE = 8;
const BULK_APPROVE_CHUNK = 10;

const STATUS_TABS = [
  { id: "Pending", label: "Pending" },
  { id: "Approved", label: "Approved" },
  { id: "Rejected", label: "Rejected" },
  { id: "", label: "All" },
];

const CHANGE_TYPE_STYLES = {
  DAY_UPDATE: "bg-blue-50 text-blue-700 border-blue-100",
  WEEKOFF_SWAP: "bg-violet-50 text-violet-700 border-violet-100",
  LEAVE_ADD: "bg-amber-50 text-amber-700 border-amber-100",
  LEAVE_UPDATE: "bg-amber-50 text-amber-800 border-amber-100",
  LEAVE_DELETE: "bg-orange-50 text-orange-700 border-orange-100",
  EXTRA_HOURS_UPDATE: "bg-teal-50 text-teal-700 border-teal-100",
};

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function formatSubmittedDate(value) {
  if (!value) return "—";
  return formatISTDateTimeLong(value, value);
}

const RosterApprovalQueue = ({ defaultMonthYear, onActionComplete }) => {
  const [monthYear, setMonthYear] = useState(defaultMonthYear || getCurrentMonthYear());
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null); // { done, total, action }
  const [comment, setComment] = useState("");
  const [modal, setModal] = useState(null);
  const [detailRequest, setDetailRequest] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listChangeRequests({
        month_year: monthYear,
      });
      setRequests(Array.isArray(res.data) ? res.data : []);
      setPage(1);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [monthYear]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, search]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, total: requests.length };
    requests.forEach((r) => {
      const s = (r.status || "").toLowerCase();
      if (s === "pending" && r.batch_id) c.pending += 1;
      else if (s === "approved") c.approved += 1;
      else if (s === "rejected") c.rejected += 1;
    });
    return c;
  }, [requests]);

  const statusFiltered = useMemo(() => {
    let rows = requests;
    if (statusFilter === "Pending") {
      rows = rows.filter((r) => (r.status || "") === "Pending" && r.batch_id);
    } else if (statusFilter) {
      rows = rows.filter((r) => (r.status || "") === statusFilter);
    }
    return rows;
  }, [requests, statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return statusFiltered;
    const q = search.toLowerCase();
    return statusFiltered.filter((r) => {
      const summary = formatChangeRequestSummary(r.change_type, r.change_payload);
      return (
        (r.user_name || "").toLowerCase().includes(q) ||
        getChangeTypeLabel(r.change_type).toLowerCase().includes(q) ||
        summary.toLowerCase().includes(q) ||
        (r.submitted_by_name || "").toLowerCase().includes(q)
      );
    });
  }, [statusFiltered, search]);

  const pendingFiltered = useMemo(
    () => filtered.filter((r) => (r.status || "") === "Pending" && r.batch_id),
    [filtered]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedCount = selectedIds.size;
  const allPendingSelected =
    pendingFiltered.length > 0 && pendingFiltered.every((r) => selectedIds.has(r.request_id));
  const somePendingSelected =
    pendingFiltered.some((r) => selectedIds.has(r.request_id)) && !allPendingSelected;

  const toggleSelect = (requestId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  };

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(pendingFiltered.map((r) => r.request_id)));
  };

  const openAction = (type, request) => {
    setModal({ type, request });
    setComment("");
  };

  const openBulkModal = (type) => {
    setModal({ type, request: null });
    setComment("");
  };

  const handleAction = async () => {
    const { type, request } = modal;
    if ((type === "reject" || type === "reject_selected") && !comment.trim()) {
      toast.error("Rejection comment is required");
      return;
    }

    try {
      if (type === "approve" || type === "reject") {
        setActionId(request.request_id);
        if (type === "approve") {
          await approveChangeRequest({
            request_id: request.request_id,
            ...(comment.trim() ? { reviewer_comment: comment.trim() } : {}),
          });
          toast.success("Request approved");
        } else {
          await rejectChangeRequest({
            request_id: request.request_id,
            reviewer_comment: comment.trim(),
          });
          toast.success("Request rejected");
        }
      } else if (type === "approve_selected") {
        setBulkLoading(true);
        const ids = Array.from(selectedIds);
        const total = ids.length;
        setBulkProgress({ done: 0, total, action: "approve" });

        let approved = 0;
        let failed = [];
        for (let i = 0; i < ids.length; i += BULK_APPROVE_CHUNK) {
          const chunk = ids.slice(i, i + BULK_APPROVE_CHUNK);
          const res = await approveChangeRequestsBulk({
            request_ids: chunk,
            ...(comment.trim() ? { reviewer_comment: comment.trim() } : {}),
          });
          approved += res.data?.approved ?? 0;
          failed = failed.concat(res.data?.failed || []);
          setBulkProgress({
            done: Math.min(i + chunk.length, total),
            total,
            action: "approve",
          });
        }

        if (failed.length) {
          toast.error(`Approved ${approved}; ${failed.length} failed`);
        } else {
          toast.success(`Approved ${approved} request(s)`);
        }
        setSelectedIds(new Set());
      } else if (type === "reject_selected") {
        setBulkLoading(true);
        const ids = Array.from(selectedIds);
        const total = ids.length;
        setBulkProgress({ done: 0, total, action: "reject" });

        let ok = 0;
        let fail = 0;
        for (let i = 0; i < ids.length; i += 1) {
          try {
            await rejectChangeRequest({
              request_id: ids[i],
              reviewer_comment: comment.trim(),
            });
            ok += 1;
          } catch {
            fail += 1;
          }
          setBulkProgress({ done: i + 1, total, action: "reject" });
        }
        if (fail) toast.error(`Rejected ${ok}; ${fail} failed`);
        else toast.success(`Rejected ${ok} request(s)`);
        setSelectedIds(new Set());
      }

      setModal(null);
      setDetailRequest(null);
      setComment("");
      await loadRequests();
      onActionComplete?.();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setActionId(null);
      setBulkLoading(false);
      setBulkProgress(null);
    }
  };

  const detailLines = detailRequest
    ? getChangeRequestDetailLines(detailRequest.change_type, detailRequest.change_payload)
    : [];

  const showBulkBar = statusFilter === "Pending" || statusFilter === "";
  const busy = !!actionId || bulkLoading;

  const modalTitle = (() => {
    if (!modal) return "";
    if (modal.type === "approve") return "Approve Request";
    if (modal.type === "reject") return "Reject Request";
    if (modal.type === "approve_selected") return `Approve (${selectedCount})`;
    if (modal.type === "reject_selected") return `Reject (${selectedCount})`;
    return "Confirm";
  })();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total", value: counts.total, className: "bg-slate-50 text-slate-700 border-slate-100" },
          { label: "Pending", value: counts.pending, className: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "Approved", value: counts.approved, className: "bg-green-50 text-green-700 border-green-100" },
          { label: "Rejected", value: counts.rejected, className: "bg-red-50 text-red-700 border-red-100" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-lg border px-3 py-2.5 ${stat.className}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{stat.label}</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <MonthYearPicker
            compact
            selectedMonthYear={monthYear}
            onMonthYearChange={setMonthYear}
            label="Month"
            showAllOption={false}
            allowFutureMonths
          />
          <div className="flex-1 min-w-[200px]">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Search className="w-3 h-3" /> Search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee, change type, details..."
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <p className="text-xs text-slate-400 lg:pb-2 shrink-0">{formatMonthYearLabel(monthYear)}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id || "all"}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {showBulkBar && pendingFiltered.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={allPendingSelected}
              ref={(el) => {
                if (el) el.indeterminate = somePendingSelected;
              }}
              onChange={toggleSelectAllPending}
              className="rounded border-slate-300"
            />
            Select all ({pendingFiltered.length})
            {selectedCount > 0 && !allPendingSelected && (
              <span className="font-normal text-slate-400">· {selectedCount} selected</span>
            )}
          </label>
          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            <button
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={() => openBulkModal("approve_selected")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve{selectedCount ? ` (${selectedCount})` : ""}
            </button>
            <button
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={() => openBulkModal("reject_selected")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject{selectedCount ? ` (${selectedCount})` : ""}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : paged.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No change requests found</p>
          <p className="text-xs text-slate-400 mt-1">Try a different month or status filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((req) => {
            const summary = formatChangeRequestSummary(req.change_type, req.change_payload);
            const typeStyle =
              CHANGE_TYPE_STYLES[req.change_type] || "bg-slate-50 text-slate-700 border-slate-100";
            const isPending = req.status === "Pending" && !!req.batch_id;
            const isSelected = selectedIds.has(req.request_id);

            return (
              <article
                key={req.request_id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-colors ${
                  isSelected
                    ? "border-blue-300 ring-1 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="p-4 flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex gap-3 min-w-0 flex-1">
                    {isPending ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(req.request_id)}
                        className="mt-3 rounded border-slate-300 shrink-0"
                        title="Select for bulk action"
                      />
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {getInitials(req.user_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{req.user_name}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${typeStyle}`}>
                          {getChangeTypeLabel(req.change_type)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusBadgeClass(req.status)}`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{summary}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {req.month_year || "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {req.submitted_by_name || "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatSubmittedDate(req.submitted_date)}
                        </span>
                      </div>
                      {!isPending && (req.reviewer_comment || req.rejection_reason) && (
                        <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
                          <span className="font-semibold text-slate-600">Reviewer note: </span>
                          {req.reviewer_comment || req.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 lg:pt-1">
                    <button
                      type="button"
                      onClick={() => setDetailRequest(req)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Details
                    </button>
                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openAction("approve", req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openAction("reject", req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages} · {filtered.length} request
                {filtered.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {detailRequest && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detailRequest.user_name} · {getChangeTypeLabel(detailRequest.change_type)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRequest(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Employee", detailRequest.user_name],
                  ["Month", detailRequest.month_year || "—"],
                  ["Submitted by", detailRequest.submitted_by_name || "—"],
                  ["Submitted on", formatSubmittedDate(detailRequest.submitted_date)],
                  ["Status", detailRequest.status],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5 break-words">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-600">Requested changes</p>
                </div>
                <div className="p-3 space-y-2">
                  {detailLines.length === 0 ? (
                    <p className="text-sm text-slate-500">No details available.</p>
                  ) : (
                    detailLines.map((line, idx) => (
                      <div
                        key={`${line.label}-${idx}`}
                        className="flex justify-between gap-4 text-sm py-1.5 border-b border-slate-50 last:border-0"
                      >
                        <span className="text-slate-500 shrink-0">{line.label}</span>
                        <span className="text-slate-800 font-medium text-right break-words">{line.value}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {detailRequest.status === "Pending" && detailRequest.batch_id && (
              <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 bg-white">
                <button
                  type="button"
                  onClick={() => setDetailRequest(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openAction("approve", detailRequest);
                    setDetailRequest(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openAction("reject", detailRequest);
                    setDetailRequest(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">{modalTitle}</h3>
              {modal.request && (
                <p className="text-xs text-slate-500 mt-1">
                  {modal.request.user_name} · {getChangeTypeLabel(modal.request.change_type)}
                </p>
              )}
              {modal.type === "approve_selected" && (
                <p className="text-xs text-slate-500 mt-1">
                  Approve {selectedCount} selected pending request(s).
                </p>
              )}
              {modal.type === "reject_selected" && (
                <p className="text-xs text-slate-500 mt-1">
                  Reject {selectedCount} selected pending request(s). A comment is required.
                </p>
              )}
            </div>
            <div className="p-5 space-y-3">
              {!bulkLoading && (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Reviewer comment
                    {(modal.type === "reject" || modal.type === "reject_selected") && (
                      <span className="text-red-500"> *</span>
                    )}
                  </span>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder={
                      modal.type === "reject" || modal.type === "reject_selected"
                        ? "Reason for rejection..."
                        : "Optional note..."
                    }
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </label>
              )}

              {bulkLoading && bulkProgress && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {bulkProgress.action === "reject" ? "Rejecting requests…" : "Approving requests…"}
                    </p>
                    <p className="text-sm font-bold tabular-nums text-slate-700">
                      {bulkProgress.done} / {bulkProgress.total}
                    </p>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out ${
                        bulkProgress.action === "reject" ? "bg-red-500" : "bg-green-500"
                      }`}
                      style={{
                        width: `${
                          bulkProgress.total
                            ? Math.min(100, Math.round((bulkProgress.done / bulkProgress.total) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {bulkProgress.total
                      ? `${Math.min(100, Math.round((bulkProgress.done / bulkProgress.total) * 100))}% complete — please keep this window open`
                      : "Please keep this window open"}
                  </p>
                </div>
              )}

              {busy && !bulkProgress && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
                  <p className="text-sm text-slate-600">Processing request…</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setModal(null)}
                className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleAction}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${
                  modal.type === "reject" || modal.type === "reject_selected"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {bulkProgress
                  ? `Processing ${bulkProgress.done}/${bulkProgress.total}`
                  : busy
                    ? "Processing…"
                    : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterApprovalQueue;
