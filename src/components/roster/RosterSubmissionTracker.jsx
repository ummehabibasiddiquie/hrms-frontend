import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  ClipboardList,
  User,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Undo2,
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { listChangeRequests, withdrawDraftChangeRequest } from "../../services/rosterService";
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

const PAGE_SIZE = 8;

const STATUS_TABS = [
  { id: "Draft", label: "Draft" },
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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReviewNote(request) {
  return (
    request.reviewer_comment ||
    request.rejection_reason ||
    (request.status === "Cancelled due to Withdrawal" ? "Withdrawn by manager" : "")
  );
}

function isDraftRequest(r) {
  return r.status === "Pending" && !r.batch_id;
}

/**
 * Tracker for managers (own submissions) and agents (changes on their roster).
 * Styled to match Roster Approval Queue / other roster pages.
 * variant: "manager" | "employee"
 */
const RosterSubmissionTracker = ({
  variant = "manager",
  defaultMonthYear,
  title,
  subtitle,
}) => {
  const [monthYear, setMonthYear] = useState(defaultMonthYear || getCurrentMonthYear());
  const [statusFilter, setStatusFilter] = useState(variant === "manager" ? "Draft" : "Pending");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [detailRequest, setDetailRequest] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listChangeRequests({ month_year: monthYear });
      setRequests(Array.isArray(res.data) ? res.data : []);
      setPage(1);
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
  }, [statusFilter, search]);

  const counts = useMemo(() => {
    const c = { draft: 0, pending: 0, approved: 0, rejected: 0, total: requests.length };
    requests.forEach((r) => {
      const s = (r.status || "").toLowerCase();
      if (isDraftRequest(r)) c.draft += 1;
      else if (s === "pending") c.pending += 1;
      else if (s === "approved") c.approved += 1;
      else if (s === "rejected") c.rejected += 1;
    });
    return c;
  }, [requests]);

  const statusFiltered = useMemo(() => {
    if (!statusFilter) return requests;
    if (statusFilter === "Draft") return requests.filter((r) => isDraftRequest(r));
    if (statusFilter === "Pending") {
      return requests.filter((r) => r.status === "Pending" && !!r.batch_id);
    }
    return requests.filter((r) => (r.status || "") === statusFilter);
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
        (r.submitted_by_name || "").toLowerCase().includes(q) ||
        (r.reviewed_by_name || "").toLowerCase().includes(q) ||
        (getReviewNote(r) || "").toLowerCase().includes(q)
      );
    });
  }, [statusFiltered, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const detailLines = detailRequest
    ? getChangeRequestDetailLines(detailRequest.change_type, detailRequest.change_payload)
    : [];

  const handleWithdrawDraft = (req) => {
    if (!window.confirm("Withdraw this draft request? It will be removed before submit.")) {
      return;
    }
    setWithdrawingId(req.request_id);
    withdrawDraftChangeRequest({ request_id: req.request_id })
      .then((res) => {
        toast.success(res.message || "Draft withdrawn");
        loadRequests();
      })
      .catch((err) => toast.error(getFriendlyErrorMessage(err)))
      .finally(() => setWithdrawingId(null));
  };

  const heading =
    title || (variant === "employee" ? "Roster Change Requests" : "My Submissions");
  const desc =
    subtitle ||
    (variant === "employee"
      ? "Changes requested by your manager — track approval status and reviewer notes"
      : "Track roster changes you created or submitted for approval");

  const statusTabs =
    variant === "manager"
      ? STATUS_TABS
      : STATUS_TABS.filter((t) => t.id !== "Draft");

  const summaryStats =
    variant === "manager"
      ? [
          { label: "Total", value: counts.total, className: "bg-slate-50 text-slate-700 border-slate-100" },
          { label: "Draft", value: counts.draft, className: "bg-slate-100 text-slate-700 border-slate-200" },
          { label: "Pending", value: counts.pending, className: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "Approved", value: counts.approved, className: "bg-green-50 text-green-700 border-green-100" },
          { label: "Rejected", value: counts.rejected, className: "bg-red-50 text-red-700 border-red-100" },
        ]
      : [
          { label: "Total", value: counts.total, className: "bg-slate-50 text-slate-700 border-slate-100" },
          { label: "Pending", value: counts.pending, className: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "Approved", value: counts.approved, className: "bg-green-50 text-green-700 border-green-100" },
          { label: "Rejected", value: counts.rejected, className: "bg-red-50 text-red-700 border-red-100" },
        ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {heading}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>

      {/* Summary strip — same style as Approval Queue */}
      <div
        className={`grid grid-cols-2 gap-2 ${
          variant === "manager" ? "sm:grid-cols-5" : "sm:grid-cols-4"
        }`}
      >
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-lg border px-3 py-2.5 ${stat.className}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{stat.label}</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <MonthYearPicker
            compact
            selectedMonthYear={monthYear}
            onMonthYearChange={setMonthYear}
            label="Month"
            showAllOption={false}
          />
          <div className="flex-1 min-w-[200px]">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Search className="w-3 h-3" /> Search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                variant === "manager"
                  ? "Employee, change type, details..."
                  : "Change type, details, reviewer..."
              }
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <p className="text-xs text-slate-400 lg:pb-2 shrink-0">
            {formatMonthYearLabel(monthYear)}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map((tab) => (
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

      {/* List */}
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
            const reviewNote = getReviewNote(req);
            const draftPending = isDraftRequest(req);
            const displayStatus = draftPending ? "Draft" : req.status;
            const typeStyle =
              CHANGE_TYPE_STYLES[req.change_type] || "bg-slate-50 text-slate-700 border-slate-100";
            const canWithdrawDraft = variant === "manager" && draftPending;
            const primaryName =
              variant === "manager" ? req.user_name : req.submitted_by_name || "Manager";

            return (
              <article
                key={req.request_id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
              >
                <div className="p-4 flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {getInitials(primaryName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {variant === "manager" ? req.user_name || "Employee" : primaryName}
                        </h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${typeStyle}`}>
                          {getChangeTypeLabel(req.change_type)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusBadgeClass(displayStatus)}`}
                        >
                          {displayStatus}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{summary}</p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {req.month_year || monthYear || "—"}
                        </span>
                        {variant === "manager" ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" />
                            You · {req.submitted_by_name || "—"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <UserCheck className="w-3 h-3" />
                            Requested by {req.submitted_by_name || "your manager"}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatSubmittedDate(req.submitted_date)}
                        </span>
                        {req.reviewed_by_name && (
                          <span>Reviewed by {req.reviewed_by_name}</span>
                        )}
                      </div>

                      {reviewNote && (
                        <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
                          <span className="font-semibold text-slate-600">Note: </span>
                          {reviewNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 lg:pt-1">
                    {canWithdrawDraft && (
                      <button
                        type="button"
                        disabled={withdrawingId === req.request_id}
                        onClick={() => handleWithdrawDraft(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        title="Withdraw this draft before submitting for approval"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        {withdrawingId === req.request_id ? "Withdrawing..." : "Withdraw"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailRequest(req)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Details
                    </button>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Request Details</h3>
              <button
                type="button"
                onClick={() => setDetailRequest(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                    CHANGE_TYPE_STYLES[detailRequest.change_type] ||
                    "bg-slate-50 text-slate-700 border-slate-100"
                  }`}
                >
                  {getChangeTypeLabel(detailRequest.change_type)}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusBadgeClass(
                    isDraftRequest(detailRequest) ? "Draft" : detailRequest.status
                  )}`}
                >
                  {isDraftRequest(detailRequest) ? "Draft" : detailRequest.status}
                </span>
              </div>

              {variant === "employee" ? (
                <p className="text-sm text-slate-600">
                  Requested by{" "}
                  <strong className="text-slate-800">
                    {detailRequest.submitted_by_name || "your manager"}
                  </strong>
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Employee:{" "}
                  <strong className="text-slate-800">{detailRequest.user_name}</strong>
                </p>
              )}

              <dl className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                {detailLines.map((line) => (
                  <div key={line.label} className="flex gap-2 text-sm">
                    <dt className="text-slate-500 min-w-[120px]">{line.label}</dt>
                    <dd className="text-slate-800 font-medium">{line.value}</dd>
                  </div>
                ))}
              </dl>

              {getReviewNote(detailRequest) && (
                <div className="text-sm bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <p className="font-semibold text-slate-700 mb-1">Reviewer note</p>
                  <p className="text-slate-600">{getReviewNote(detailRequest)}</p>
                </div>
              )}

              {variant === "manager" && isDraftRequest(detailRequest) && (
                <button
                  type="button"
                  disabled={withdrawingId === detailRequest.request_id}
                  onClick={() => handleWithdrawDraft(detailRequest)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Withdraw draft
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterSubmissionTracker;
