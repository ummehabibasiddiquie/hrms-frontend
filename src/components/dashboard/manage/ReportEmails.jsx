import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Mail, Plus, Trash2, Search, Users, Send, Copy } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import LoadingSpinner from "../../common/LoadingSpinner";

const REPORTS = [
  {
    key: "send_billable",
    label: "Billable hours",
    sub: "Yesterday",
    hint: "Yesterday's billable hours email",
    on: "bg-emerald-50 text-emerald-700 border-emerald-200",
    off: "bg-slate-50 text-slate-400 border-slate-200",
  },
  {
    key: "send_tracker",
    label: "Intraday tracker",
    sub: "3 times a day",
    hint: "Today's tracker from 9 AM till now. Sent three times during the day.",
    on: "bg-sky-50 text-sky-700 border-sky-200",
    off: "bg-slate-50 text-slate-400 border-slate-200",
  },
  {
    key: "send_tracker_full",
    label: "Previous-day production",
    sub: "Full day complete",
    hint: "Yesterday's complete production report, sent once after the day closes.",
    on: "bg-violet-50 text-violet-700 border-violet-200",
    off: "bg-slate-50 text-slate-400 border-slate-200",
  },
];

const to01 = (value) => {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0" || value == null) return 0;
  return Number(value) === 1 ? 1 : 0;
};

const normalizeRow = (row) => ({
  ...row,
  send_billable: to01(row?.send_billable),
  send_tracker: to01(row?.send_tracker),
  send_tracker_full: to01(row?.send_tracker_full),
});

const sameId = (a, b) => String(a) === String(b);

const initials = (email) => {
  const local = (email || "").split("@")[0] || "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
};

const displayName = (email) => {
  const local = (email || "").split("@")[0] || email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
};

const ReportChip = ({ report, active, onClick, disabled }) => (
  <button
    type="button"
    title={report.hint}
    disabled={disabled}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-left border transition-all leading-tight ${
      active ? report.on : report.off
    } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"}`}
  >
    <span className="block text-[11px] font-bold">{report.label}</span>
    <span className={`block text-[10px] font-medium ${active ? "opacity-80" : "opacity-60"}`}>
      {report.sub}
    </span>
  </button>
);

const TypeToggle = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
    {["to", "cc"].map((opt) => {
      const selected = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${
            selected
              ? opt === "to"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

const ReportEmails = () => {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState("to");
  const [reports, setReports] = useState({
    send_billable: true,
    send_tracker: true,
    send_tracker_full: true,
  });
  const [removingId, setRemovingId] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchRows = useCallback(async (showSpinner = true) => {
    if (!userId) return;
    try {
      if (showSpinner) setLoading(true);
      const response = await api.post("/report_email/list", {
        logged_in_user_id: userId,
      });
      if (response.data.status === 200) {
        setRows((response.data.data?.rows || []).map(normalizeRow));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load report emails");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const stats = useMemo(() => {
    const toCount = rows.filter((r) => (r.recipient_type || "").toLowerCase() !== "cc").length;
    const ccCount = rows.length - toCount;
    return {
      total: rows.length,
      to: toCount,
      cc: ccCount,
      billable: rows.filter((r) => to01(r.send_billable) === 1).length,
      tracker: rows.filter((r) => to01(r.send_tracker) === 1).length,
      full: rows.filter((r) => to01(r.send_tracker_full) === 1).length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const type = (r.recipient_type || "to").toLowerCase() === "cc" ? "cc" : "to";
      if (filter !== "all" && type !== filter) return false;
      if (!q) return true;
      return (r.email || "").toLowerCase().includes(q) || displayName(r.email).toLowerCase().includes(q);
    });
  }, [rows, query, filter]);

  const handleAdd = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      toast.error("Enter an email address");
      return;
    }
    if (rows.some((r) => (r.email || "").trim().toLowerCase() === nextEmail)) {
      toast.error("This email is already in the list");
      return;
    }
    if (!reports.send_billable && !reports.send_tracker && !reports.send_tracker_full) {
      toast.error("Select at least one report");
      return;
    }
    try {
      setSubmitting(true);
      const response = await api.post("/report_email/add", {
        logged_in_user_id: userId,
        email: email.trim(),
        recipient_type: kind,
        send_billable: reports.send_billable ? 1 : 0,
        send_tracker: reports.send_tracker ? 1 : 0,
        send_tracker_full: reports.send_tracker_full ? 1 : 0,
      });
      if (response.data.status === 201) {
        toast.success("Email added");
        setEmail("");
        fetchRows();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add email");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeChange = async (row, nextType) => {
    if ((row.recipient_type || "to").toLowerCase() === nextType) return;
    try {
      const response = await api.post("/report_email/update", {
        logged_in_user_id: userId,
        recipient_id: row.recipient_id,
        recipient_type: nextType,
      });
      if (response.data.status === 200) {
        toast.success("Updated");
        const saved = response.data.data;
        setRows((cur) =>
          cur.map((r) =>
            sameId(r.recipient_id, row.recipient_id)
              ? normalizeRow({ ...r, recipient_type: nextType, ...(saved || {}) })
              : r
          )
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update");
    }
  };

  const handleReportToggle = async (row, field, checked) => {
    const nextVal = checked ? 1 : 0;
    const previous = rows;
    setRows((cur) =>
      cur.map((r) =>
        sameId(r.recipient_id, row.recipient_id) ? { ...r, [field]: nextVal } : r
      )
    );
    try {
      const current = {
        send_billable: to01(row.send_billable),
        send_tracker: to01(row.send_tracker),
        send_tracker_full: to01(row.send_tracker_full),
        [field]: nextVal,
      };
      const response = await api.post("/report_email/update", {
        logged_in_user_id: userId,
        recipient_id: row.recipient_id,
        recipient_type: row.recipient_type,
        send_billable: current.send_billable,
        send_tracker: current.send_tracker,
        send_tracker_full: current.send_tracker_full,
      });
      if (response.data.status === 200) {
        toast.success("Updated");
        const saved = response.data.data;
        setRows((cur) =>
          cur.map((r) =>
            sameId(r.recipient_id, row.recipient_id)
              ? normalizeRow({ ...r, ...current, ...(saved || {}) })
              : r
          )
        );
      } else {
        setRows(previous);
      }
    } catch (error) {
      setRows(previous);
      toast.error(error.response?.data?.message || "Failed to update");
    }
  };

  const isOn = (row, field) => to01(row?.[field]) === 1;

  const handleDelete = async (row) => {
    try {
      setRemovingId(row.recipient_id);
      const response = await api.post("/report_email/delete", {
        logged_in_user_id: userId,
        recipient_id: row.recipient_id,
      });
      if (response.data.status === 200) {
        toast.success("Email removed");
        fetchRows();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove email");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-16 right-20 w-48 h-48 bg-white/5 rounded-full" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Report emails</h2>
              <p className="text-blue-100 text-sm mt-1 max-w-xl">
                Choose who receives each email: billable hours, the intraday
                tracker (3 times a day), and previous-day production.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[280px]">
            {[
              { label: "People", value: stats.total, icon: Users },
              { label: "To", value: stats.to, icon: Send },
              { label: "Cc", value: stats.cc, icon: Copy },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/10"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-blue-100 uppercase tracking-wide">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </div>
                <p className="text-2xl font-extrabold leading-tight mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {REPORTS.map((card) => {
          const value =
            card.key === "send_billable"
              ? stats.billable
              : card.key === "send_tracker"
                ? stats.tracker
                : stats.full;
          const color =
            card.key === "send_billable"
              ? "text-emerald-700 bg-emerald-50 border-emerald-100"
              : card.key === "send_tracker"
                ? "text-sky-700 bg-sky-50 border-sky-100"
                : "text-violet-700 bg-violet-50 border-violet-100";
          return (
            <div key={card.key} className={`rounded-xl border px-4 py-3 ${color}`}>
              <p className="text-xs font-semibold tracking-wide opacity-80">{card.label}</p>
              <p className="text-[11px] opacity-70">{card.sub} · recipients</p>
              <p className="text-xl font-extrabold mt-1">
                {value}
                <span className="text-sm font-semibold opacity-60"> / {stats.total}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Add a recipient</h3>
        <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@transformsolution.net"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Send as
            </label>
            <TypeToggle value={kind} onChange={setKind} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Reports
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REPORTS.map((report) => (
                <ReportChip
                  key={report.key}
                  report={report}
                  active={!!reports[report.key]}
                  onClick={() =>
                    setReports((prev) => ({ ...prev, [report.key]: !prev[report.key] }))
                  }
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              ["all", "All"],
              ["to", "To"],
              ["cc", "Cc"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                  filter === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16">
            <LoadingSpinner />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No matching emails</p>
            <p className="text-xs text-slate-400 mt-1">Add someone above or clear the search.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleRows.map((row) => {
              const type = (row.recipient_type || "to").toLowerCase() === "cc" ? "cc" : "to";
              return (
                <li
                  key={row.recipient_id}
                  className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        type === "cc"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {initials(row.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {displayName(row.email)}
                      </p>
                      <p className="text-xs text-slate-500 break-all">{row.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {REPORTS.map((report) => (
                      <ReportChip
                        key={report.key}
                        report={report}
                        active={isOn(row, report.key)}
                        onClick={() =>
                          handleReportToggle(row, report.key, !isOn(row, report.key))
                        }
                      />
                    ))}
                    <TypeToggle
                      value={type}
                      onChange={(next) => handleTypeChange(row, next)}
                    />
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={removingId === row.recipient_id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ReportEmails;
