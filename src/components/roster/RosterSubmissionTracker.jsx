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
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { listChangeRequests } from "../../services/rosterService";
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

/**
 * Read-only tracker for managers (own submissions) and agents (changes on their roster).
 * variant: "manager" | "employee"
 */
const RosterSubmissionTracker = ({
  variant = "manager",
  defaultMonthYear,
  title,
  subtitle,
}) => {
  const [monthYear, setMonthYear] = useState(defaultMonthYear || getCurrentMonthYear());
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [detailRequest, setDetailRequest] = useState(null);

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
    const c = { pending: 0, approved: 0, rejected: 0, total: requests.length };
    requests.forEach((r) => {
      const s = (r.status || "").toLowerCase();
      if (s === "pending") c.pending += 1;
      else if (s === "approved") c.approved += 1;
      else if (s === "rejected") c.rejected += 1;
    });
    return c;
  }, [requests]);

  const statusFiltered = useMemo(() => {
    if (!statusFilter) return requests;
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

  const heading =
    title ||
    (variant === "employee" ? "Roster Change Requests" : "My Submissions");
  const desc =
    subtitle ||
    (variant === "employee"
      ? "Changes requested by your manager — track approval status and reviewer notes"
      : "Track roster changes you submitted for approval");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {heading}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{desc}</p>
        </div>
        <MonthYearPicker
          selectedMonthYear={monthYear}
          onMonthYearChange={setMonthYear}
          label="Month"
          showAllOption={false}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total", value: counts.total, className: "bg-slate-50 text-slate-700 border-slate-100" },
          { label: "Pending", value: counts.pending, className: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "Approved", value: counts.approved, className: "bg-green-50 text-green-700 border-green-100" },
          { label: "Rejected", value: counts.rejected, className: "bg-red-50 text-red-700 border-red-100" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border px-3 py-2 ${stat.className}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{stat.label}</p>
            <p className="text-xl font-extrabold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id || "all"}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requests..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No requests found for {formatMonthYearLabel(monthYear)}.
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {paged.map((req) => {
                const summary = formatChangeRequestSummary(req.change_type, req.change_payload);
                const reviewNote = getReviewNote(req);
                const isDraftPending = req.status === "Pending" && !req.batch_id;
                const displayStatus = isDraftPending ? "Draft (not submitted)" : req.status;

                return (
                  <div key={req.request_id} className="p-4 hover:bg-slate-50/80 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-3 justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                              CHANGE_TYPE_STYLES[req.change_type] || "bg-slate-50 text-slate-600 border-slate-100"
                            }`}
                          >
                            {getChangeTypeLabel(req.change_type)}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadgeClass(displayStatus)}`}>
                            {displayStatus}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-slate-800">{summary}</p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {variant === "manager" && (
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {req.user_name || "Employee"}
                            </span>
                          )}
                          {variant === "employee" && (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                              <UserCheck className="w-3 h-3" />
                              Requested by {req.submitted_by_name || "your manager"}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatMonthYearLabel(req.month_year || monthYear)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatSubmittedDate(req.submitted_date)}
                          </span>
                          {req.reviewed_by_name && (
                            <span>Reviewed by {req.reviewed_by_name}</span>
                          )}
                        </div>

                        {reviewNote && (
                          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            <span className="font-semibold text-slate-700">Note: </span>
                            {reviewNote}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setDetailRequest(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-100 rounded-lg hover:bg-blue-50 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {detailRequest && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Request Details</h3>
              <button type="button" onClick={() => setDetailRequest(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadgeClass(detailRequest.status)}`}>
                  {detailRequest.status}
                </span>
                <span className="text-xs text-slate-500">{getChangeTypeLabel(detailRequest.change_type)}</span>
              </div>
              {variant === "employee" && (
                <p className="text-sm text-blue-700">
                  Requested by <strong>{detailRequest.submitted_by_name || "your manager"}</strong>
                </p>
              )}
              {variant === "manager" && (
                <p className="text-sm text-slate-600">
                  Employee: <strong>{detailRequest.user_name}</strong>
                </p>
              )}
              <dl className="space-y-2">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterSubmissionTracker;
