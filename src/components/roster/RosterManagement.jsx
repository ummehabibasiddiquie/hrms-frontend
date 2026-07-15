import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  Send,
  Undo2,
  Lock,
  Unlock,
  History,
  UserPlus,
  RotateCcw,
  Search,
  ChevronDown,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import {
  canGenerateRoster,
  generateEmployeeRoster,
  generateRoster,
  listChangeRequests,
  listRosterEmployees,
  listRosters,
  lockRosterMonth,
  resetRegenerateRoster,
  submitRosterBatch,
  unlockRosterMonth,
  withdrawRosterSubmission,
} from "../../services/rosterService";
import { useRosterRoles } from "../../hooks/useRosterRoles";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import {
  filterEmployeesByTeam,
  formatMonthYearLabel,
  getCurrentMonthYear,
  getNextMonthYear,
  isRosterEditable,
  isRosterLocked,
  isRosterLockable,
  canLockRosterMonthByDate,
  getRosterLockDateHint,
  isMonthCalendarLocked,
  getMonthCalendarLockMessage,
  getRosterLockMessage,
} from "../../utils/rosterUtils";
import LoadingSpinner from "../common/LoadingSpinner";
import SearchableSelect from "../common/SearchableSelect";
import { MonthYearPicker } from "../common/CustomCalendar";
import RosterCalendar from "./RosterCalendar";
import RosterDayEditor from "./RosterDayEditor";
import RosterSummaryCards from "./RosterSummaryCards";
import RosterVersionHistory from "./RosterVersionHistory";
import RosterApprovalQueue from "./RosterApprovalQueue";
import RosterSubmissionTracker from "./RosterSubmissionTracker";
import HolidayMaster from "./HolidayMaster";

const ActionBtn = ({
  children,
  onClick,
  disabled,
  loading,
  variant = "secondary",
  icon: Icon,
  title,
}) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-sm",
    secondary: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    danger: "bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300",
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {Icon && <Icon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />}
      {children}
    </button>
  );
};

const ActionGroup = ({ title, children }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{title}</p>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const RosterManagement = () => {
  const {
    user,
    isSuperAdmin,
    isAdmin,
    isProjectManager,
    isAssistantManager,
    canApproveRoster,
    canResetRegenerate,
    canModifyHolidayMaster,
  } = useRosterRoles();

  const [view, setView] = useState("calendar");
  const [monthYear, setMonthYear] = useState(getCurrentMonthYear());
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [canGenerate, setCanGenerate] = useState(false);
  const [monthCalendarLocked, setMonthCalendarLocked] = useState(false);
  const [monthLockInfo, setMonthLockInfo] = useState(null);
  const [monthStatusRosters, setMonthStatusRosters] = useState([]);
  const [monthPendingAll, setMonthPendingAll] = useState([]);
  const [canWithdrawOwnSubmission, setCanWithdrawOwnSubmission] = useState(false);
  const [editorDay, setEditorDay] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showActions, setShowActions] = useState(true);

  const selectedRoster = useMemo(
    () => rosters.find((r) => String(r.user_id) === String(selectedUserId)) || null,
    [rosters, selectedUserId]
  );

  const employeeOptions = useMemo(() => {
    let list = isAssistantManager
      ? employees
      : filterEmployeesByTeam(employees, selectedTeam, teams);
    if (employeeSearch.trim()) {
      const q = employeeSearch.toLowerCase();
      list = list.filter((e) => (e.user_name || e.name || "").toLowerCase().includes(q));
    }
    return list.map((e) => ({
      value: String(e.user_id),
      label: e.user_name || `User ${e.user_id}`,
    }));
  }, [employees, selectedTeam, teams, employeeSearch, isAssistantManager]);

  const monthSubmitPendingCount = useMemo(
    () => monthPendingAll.filter((r) => (r.status || "") === "Pending" && !r.batch_id).length,
    [monthPendingAll]
  );

  const monthTotalPendingCount = useMemo(
    () => monthPendingAll.filter((r) => (r.status || "") === "Pending").length,
    [monthPendingAll]
  );

  const pendingRequests = useMemo(() => {
    return monthPendingAll.filter((r) => {
      if ((r.status || "") !== "Pending") return false;
      if (selectedRoster?.roster_month_id) {
        return String(r.roster_month_id) === String(selectedRoster.roster_month_id);
      }
      if (selectedUserId) return String(r.user_id) === String(selectedUserId);
      return false;
    });
  }, [monthPendingAll, selectedRoster?.roster_month_id, selectedUserId]);

  const pendingCount = useMemo(
    () => pendingRequests.filter((r) => !r.batch_id).length,
    [pendingRequests]
  );

  const applyPendingRows = useCallback(
    (rows) => {
      const list = Array.isArray(rows) ? rows : [];
      const loggedInUserId = String(user?.user_id ?? "");
      setMonthPendingAll(list);
      setCanWithdrawOwnSubmission(
        list.some(
          (r) =>
            (r.status || "") === "Pending" &&
            r.batch_id &&
            String(r.submitted_by) === loggedInUserId
        )
      );
    },
    [user?.user_id]
  );

  const loadMonthSummary = useCallback(async () => {
    if (!(isAdmin || isSuperAdmin)) {
      setMonthStatusRosters([]);
      return null;
    }
    try {
      const res = await listRosters({
        month_year: monthYear,
        include_days: false,
      });
      const list = res.data?.rosters || [];
      setMonthStatusRosters(list);
      setMonthCalendarLocked(Boolean(res.data?.month_calendar_locked));
      setMonthLockInfo(res.data?.month_lock_info || null);
      return {
        monthCalendarLocked: Boolean(res.data?.month_calendar_locked),
        monthLockInfo: res.data?.month_lock_info || null,
      };
    } catch {
      setMonthStatusRosters([]);
      return null;
    }
  }, [monthYear, isAdmin, isSuperAdmin]);

  const loadPendingRequests = useCallback(async () => {
    try {
      const res = await listChangeRequests({
        month_year: monthYear,
        status: "Pending",
      });
      applyPendingRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      applyPendingRows([]);
    }
  }, [monthYear, applyPendingRows]);

  const loadSelectedRoster = useCallback(
    async (userId, options = {}) => {
      const { silent = false } = options;
      if (!userId) {
        setRosters([]);
        return null;
      }
      try {
        if (!silent) setLoading(true);
        const res = await listRosters({
          month_year: monthYear,
          user_id: userId,
          include_days: true,
        });
        const list = res.data?.rosters || [];
        setRosters(list);
        setMonthCalendarLocked(Boolean(res.data?.month_calendar_locked));
        setMonthLockInfo(res.data?.month_lock_info || null);
        return list;
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err));
        setRosters([]);
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [monthYear]
  );

  const refreshRosterViews = useCallback(
    async (options = {}) => {
      const userId = options.userId || selectedUserId;
      await Promise.all([
        loadSelectedRoster(userId, { silent: options.silent }),
        loadPendingRequests(),
        loadMonthSummary(),
      ]);
    },
    [selectedUserId, loadSelectedRoster, loadPendingRequests, loadMonthSummary]
  );

  // One-time / role bootstrap
  useEffect(() => {
    if (!isAssistantManager) {
      api
        .post("/dropdown/get", {
          dropdown_type: "teams",
          logged_in_user_id: user?.user_id,
        })
        .then((res) => setTeams(res.data?.data || []))
        .catch(() => setTeams([]));
    }
    canGenerateRoster({})
      .then((res) => setCanGenerate(Boolean(res.data?.can_generate)))
      .catch(() => setCanGenerate(false));
  }, [user?.user_id, isAssistantManager]);

  // Employees when month/team changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!monthYear) return;
      try {
        const teamFilter =
          isAssistantManager && user?.team_id
            ? user.team_id
            : selectedTeam !== "all"
              ? selectedTeam
              : undefined;

        if (isAssistantManager && !teamFilter) {
          if (!cancelled) {
            setEmployees([]);
            setSelectedUserId("");
          }
          return;
        }

        const res = await listRosterEmployees({
          month_year: monthYear,
          team_id: teamFilter,
        });
        if (cancelled) return;
        const list = res.data?.employees || [];
        setEmployees(list);

        setSelectedUserId((prev) => {
          if (prev && list.some((e) => String(e.user_id) === String(prev))) return prev;
          return list.length ? String(list[0].user_id) : "";
        });
      } catch (err) {
        if (!cancelled) {
          toast.error(getFriendlyErrorMessage(err));
          setEmployees([]);
          setSelectedUserId("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthYear, selectedTeam, isAssistantManager, user?.team_id]);

  // Month-level APIs once when month changes (pending + lock summary)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pendingPromise = listChangeRequests({
          month_year: monthYear,
          status: "Pending",
        });
        const summaryPromise =
          isAdmin || isSuperAdmin
            ? listRosters({ month_year: monthYear, include_days: false })
            : Promise.resolve(null);

        const [pendingRes, summaryRes] = await Promise.all([pendingPromise, summaryPromise]);
        if (cancelled) return;

        applyPendingRows(Array.isArray(pendingRes?.data) ? pendingRes.data : []);

        if (summaryRes) {
          setMonthStatusRosters(summaryRes.data?.rosters || []);
          setMonthCalendarLocked(Boolean(summaryRes.data?.month_calendar_locked));
          setMonthLockInfo(summaryRes.data?.month_lock_info || null);
        } else {
          setMonthStatusRosters([]);
        }
      } catch {
        if (!cancelled) {
          applyPendingRows([]);
          setMonthStatusRosters([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthYear, isAdmin, isSuperAdmin, applyPendingRows]);

  // Selected employee calendar only
  useEffect(() => {
    if (!selectedUserId) {
      setRosters([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await listRosters({
          month_year: monthYear,
          user_id: selectedUserId,
          include_days: true,
        });
        if (cancelled) return;
        setRosters(res.data?.rosters || []);
        setMonthCalendarLocked(Boolean(res.data?.month_calendar_locked));
        setMonthLockInfo(res.data?.month_lock_info || null);
      } catch (err) {
        if (!cancelled) {
          toast.error(getFriendlyErrorMessage(err));
          setRosters([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthYear, selectedUserId]);

  // Soft refresh when window regains focus (once per focus, not on every render)
  useEffect(() => {
    const onFocus = () => {
      refreshRosterViews({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshRosterViews]);

  const readOnly = selectedRoster?.access_mode === "read_only" || !isRosterEditable(selectedRoster, false);
  const status = selectedRoster?.status || "";
  const rosterLocked = isRosterLocked(selectedRoster) || monthCalendarLocked;
  const calendarFrozen = monthCalendarLocked || isRosterLocked(selectedRoster);
  const lockDateAllowed = canLockRosterMonthByDate(monthYear);
  const lockDateHint = getRosterLockDateHint(monthYear);
  const monthLockableCount = useMemo(
    () =>
      lockDateAllowed
        ? monthStatusRosters.filter((r) => isRosterLockable(r)).length
        : 0,
    [monthStatusRosters, lockDateAllowed]
  );
  const hasMonthPendingRequests = monthTotalPendingCount > 0;
  const canLockMonth =
    lockDateAllowed && !hasMonthPendingRequests && monthLockableCount > 0;
  const showTeamFilter = isAdmin || isSuperAdmin || isProjectManager;
  const canLockUnlock = isAdmin || isSuperAdmin;
  const isBusy = !!actionLoading;
  const hasSubmitPending = monthSubmitPendingCount > 0;

  const runAction = async (key, fn) => {
    try {
      setActionLoading(key);
      await fn();
      try {
        await refreshRosterViews({ silent: true });
        const gen = await canGenerateRoster({});
        setCanGenerate(Boolean(gen.data?.can_generate));
      } catch {
        toast.error(
          `Action completed, but refresh timed out. Reload the page if data looks stale.`
        );
      }
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setActionLoading("");
      setConfirmAction(null);
    }
  };

  const handleGenerateNextMonth = () => {
    const nextMonth = getNextMonthYear();
    setConfirmAction({
      title: "Generate Next Month Roster",
      message: `Generate rosters for ${formatMonthYearLabel(nextMonth)}? Only employees without existing rosters will be created. Available during the last week of the current month only.`,
      onConfirm: () =>
        runAction("generate", async () => {
          const res = await generateRoster({});
          toast.success(
            `${res.message || "Generation completed"} (${res.data?.month_year || nextMonth})`
          );
        }),
    });
  };

  const handleGenerateSelectedMonth = () => {
    setConfirmAction({
      title: "Generate Missing Rosters",
      message: `Create rosters for ${formatMonthYearLabel(monthYear)} for all eligible employees who do not have one yet? Existing rosters will not be changed.`,
      onConfirm: () =>
        runAction("generate-month", async () => {
          const res = await generateRoster({ month_year: monthYear });
          const created = res.data?.created_count ?? 0;
          const skipped = res.data?.skipped_count ?? 0;
          toast.success(
            `${res.message || "Done"} — ${created} created, ${skipped} skipped (${monthYear})`
          );
        }),
    });
  };

  const handleGenerateEmployee = () => {
    if (!selectedUserId) {
      toast.error("Select an employee first");
      return;
    }
    setConfirmAction({
      title: "Generate Employee Roster",
      message: `Generate roster for selected employee for ${formatMonthYearLabel(monthYear)}?`,
      onConfirm: () =>
        runAction("gen-emp", async () => {
          const res = await generateEmployeeRoster({
            user_id: Number(selectedUserId),
            month_year: monthYear,
          });
          toast.success(res.message || "Employee roster generated");
        }),
    });
  };

  const handleResetRegenerate = () => {
    setConfirmAction({
      title: "Reset & Regenerate",
      message: `This will deactivate all rosters for ${formatMonthYearLabel(monthYear)} and regenerate. Pending requests will be cancelled. Continue?`,
      destructive: true,
      onConfirm: () =>
        runAction("reset", async () => {
          const res = await resetRegenerateRoster({
            month_year: monthYear,
            confirm_reset: true,
          });
          toast.success(
            `${res.message || "Reset complete"} (${res.data?.month_year || monthYear})`
          );
        }),
    });
  };

  const handleSubmit = () => {
    setConfirmAction({
      title: "Submit for Approval",
      message: `Submit all roster change requests for ${formatMonthYearLabel(monthYear)}?`,
      onConfirm: () =>
        runAction("submit", async () => {
          const res = await submitRosterBatch({ month_year: monthYear });
          toast.success(res.message || "Submitted for approval");
        }),
    });
  };

  const handleWithdraw = () => {
    setConfirmAction({
      title: "Withdraw Submission",
      message: "Withdraw submission and return rosters to Draft? Pending requests will be cancelled.",
      onConfirm: () =>
        runAction("withdraw", async () => {
          const res = await withdrawRosterSubmission({ month_year: monthYear });
          toast.success(res.message || "Submission withdrawn");
        }),
    });
  };

  const handleLock = () => {
    if (hasMonthPendingRequests) {
      toast.error(
        `Cannot lock: ${monthTotalPendingCount} pending request(s) must be approved, rejected, or withdrawn first.`
      );
      return;
    }
    setConfirmAction({
      title: "Lock Calendar",
      message: `Lock all agent calendars for ${formatMonthYearLabel(monthYear)}? No one will be able to edit leave, week-off, or other roster changes until unlock.`,
      onConfirm: () =>
        runAction("lock", async () => {
          const res = await lockRosterMonth({ month_year: monthYear });
          toast.success(res.message || "Calendar locked");
        }),
    });
  };

  const handleUnlock = () => {
    if (!selectedRoster) return;
    runAction("unlock", async () => {
      const res = await unlockRosterMonth({ roster_month_id: selectedRoster.roster_month_id });
      toast.success(res.message || "Roster unlocked");
    });
  };

  const handleDayClick = async (day) => {
    if (monthCalendarLocked || isRosterLocked(selectedRoster)) {
      toast.error(
        monthCalendarLocked
          ? getMonthCalendarLockMessage(monthYear, monthLockInfo)
          : getRosterLockMessage(selectedRoster)
      );
      return;
    }
    if ((selectedRoster?.status || "") === "Pending Approval") {
      toast.error("This roster is pending approval and cannot be edited.");
      return;
    }
    if (!isRosterEditable(selectedRoster, readOnly)) {
      toast.error("This roster cannot be edited right now.");
      return;
    }
    setEditorDay(day);
  };

  const tabs = [
    { id: "calendar", label: "Roster Calendar" },
    { id: "submissions", label: "My Submissions" },
    ...(canApproveRoster ? [{ id: "approval", label: "Approval Queue" }] : []),
    { id: "holidays", label: "Holiday Master" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-sm">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Roster Management</h1>
            <p className="text-sm text-slate-500">Manage rosters, approvals, and holidays</p>
          </div>
        </div>
        {pendingCount > 0 && view === "calendar" && (
          <span className="self-start sm:self-center text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                view === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {view === "submissions" && (
          <div className="p-4">
            <RosterSubmissionTracker
              variant="manager"
              defaultMonthYear={monthYear}
            />
          </div>
        )}

        {view === "approval" && canApproveRoster && (
          <div className="p-4">
            <RosterApprovalQueue
              defaultMonthYear={monthYear}
              onActionComplete={() => {
                refreshRosterViews({ silent: true });
              }}
            />
          </div>
        )}

        {view === "holidays" && (
          <div className="p-4">
            <HolidayMaster canModify={canModifyHolidayMaster} />
          </div>
        )}

        {view === "calendar" && (
          <div className="divide-y divide-slate-100">
            <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-end gap-3">
              <MonthYearPicker
                compact
                selectedMonthYear={monthYear}
                onMonthYearChange={(m) => {
                  setMonthYear(m);
                  setSelectedUserId("");
                }}
                label="Month"
                showAllOption={false}
              />

              {showTeamFilter && (
                <label className="flex-1 min-w-[140px]">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Team</span>
                  <select
                    value={selectedTeam}
                    onChange={(e) => {
                      setSelectedTeam(e.target.value);
                      setSelectedUserId("");
                    }}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  >
                    <option value="all">All Teams</option>
                    {teams.map((t) => (
                      <option key={t.team_id || t.value} value={t.team_id ?? t.value}>
                        {t.team_name || t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex-1 min-w-[200px] lg:max-w-md">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Search className="w-3 h-3" /> Employee
                </span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      value={selectedUserId}
                      onChange={(val) => setSelectedUserId(val)}
                      options={employeeOptions}
                      placeholder="Select employee..."
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 lg:pb-2 lg:ml-auto shrink-0">
                Viewing <span className="font-semibold text-slate-600">{formatMonthYearLabel(monthYear)}</span>
              </p>
            </div>

            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => setShowActions((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-2"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showActions ? "" : "-rotate-90"}`} />
                Actions
              </button>

              {showActions && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <ActionGroup title="Generate">
                    <ActionBtn
                      variant="primary"
                      icon={RefreshCw}
                      loading={actionLoading === "generate-month"}
                      disabled={isBusy}
                      onClick={handleGenerateSelectedMonth}
                      title={`Generate missing rosters for ${monthYear}`}
                    >
                      Missing ({monthYear})
                    </ActionBtn>
                    <ActionBtn
                      icon={UserPlus}
                      loading={actionLoading === "gen-emp"}
                      disabled={!selectedUserId || isBusy}
                      onClick={handleGenerateEmployee}
                    >
                      Single Employee
                    </ActionBtn>
                    <ActionBtn
                      loading={actionLoading === "generate"}
                      disabled={!canGenerate || isBusy}
                      onClick={handleGenerateNextMonth}
                      title={canGenerate ? `Generate ${getNextMonthYear()}` : "Available in last week of month"}
                    >
                      Next Month ({getNextMonthYear()})
                    </ActionBtn>
                  </ActionGroup>

                  <ActionGroup title="Workflow">
                    <ActionBtn
                      icon={Send}
                      loading={actionLoading === "submit"}
                      disabled={
                        isBusy ||
                        !hasSubmitPending ||
                        status === "Pending Approval" ||
                        calendarFrozen
                      }
                      onClick={handleSubmit}
                      title={
                        hasSubmitPending
                          ? `Submit ${monthSubmitPendingCount} pending change(s) for ${formatMonthYearLabel(monthYear)}`
                          : "Make roster edits first — nothing pending to submit"
                      }
                    >
                      Submit{hasSubmitPending ? ` (${monthSubmitPendingCount})` : ""}
                    </ActionBtn>
                    {canWithdrawOwnSubmission && (
                    <ActionBtn
                      icon={Undo2}
                      loading={actionLoading === "withdraw"}
                      disabled={isBusy}
                      onClick={handleWithdraw}
                      title="Withdraw your submitted roster changes back to Draft"
                    >
                      Withdraw
                    </ActionBtn>
                    )}
                  </ActionGroup>

                  {canLockUnlock && (
                  <ActionGroup title="Admin">
                    {lockDateAllowed && hasMonthPendingRequests && (
                      <p className="w-full text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 mb-1">
                        Cannot lock: {monthTotalPendingCount} pending request
                        {monthTotalPendingCount !== 1 ? "s" : ""} must be approved, rejected, or
                        withdrawn first.
                      </p>
                    )}
                    <ActionBtn
                      icon={Lock}
                      loading={actionLoading === "lock"}
                      disabled={isBusy || !canLockMonth}
                      onClick={handleLock}
                      title={
                        !lockDateAllowed
                          ? lockDateHint
                          : hasMonthPendingRequests
                            ? `${monthTotalPendingCount} pending request(s) — resolve before locking`
                            : monthLockableCount > 0
                              ? `Lock all agent calendars for ${monthYear}`
                              : "All rosters are already locked or pending approval"
                      }
                    >
                      Lock ({monthYear})
                    </ActionBtn>
                    <ActionBtn
                      icon={Unlock}
                      loading={actionLoading === "unlock"}
                      disabled={!selectedRoster || isBusy || status !== "Locked"}
                      onClick={handleUnlock}
                      title={status === "Locked" ? "Unlock back to Draft or Approved" : "Roster is not locked"}
                    >
                      Unlock
                    </ActionBtn>
                    <ActionBtn
                      icon={History}
                      disabled={!selectedRoster}
                      onClick={() => setShowVersionHistory(true)}
                    >
                      History
                    </ActionBtn>
                    {canResetRegenerate && (
                      <ActionBtn
                        variant="danger"
                        icon={RotateCcw}
                        loading={actionLoading === "reset"}
                        disabled={isBusy}
                        onClick={handleResetRegenerate}
                      >
                        Reset ({monthYear})
                      </ActionBtn>
                    )}
                  </ActionGroup>
                  )}
                  {!canLockUnlock && (
                  <ActionGroup title="History">
                    <ActionBtn
                      icon={History}
                      disabled={!selectedRoster}
                      onClick={() => setShowVersionHistory(true)}
                    >
                      Version History
                    </ActionBtn>
                  </ActionGroup>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {view === "calendar" && (
        loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4">
              <RosterSummaryCards
                roster={selectedRoster}
                pendingCount={pendingCount}
                monthCalendarLocked={monthCalendarLocked}
                monthLockInfo={monthLockInfo}
                monthYear={monthYear}
              />
            {selectedRoster ? (
              <RosterCalendar
                monthYear={monthYear}
                days={selectedRoster.days}
                rosterMonthId={selectedRoster.roster_month_id}
                rosterStartDate={selectedRoster.roster_start_date}
                pendingRequests={pendingRequests}
                readOnly={readOnly || calendarFrozen || status === "Pending Approval"}
                onDayClick={handleDayClick}
              />
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
                <p className="text-slate-500 text-sm">No roster for this employee and month.</p>
                <p className="text-slate-400 text-xs mt-1">Use Generate → Single Employee to create one.</p>
              </div>
            )}
          </div>
        )
      )}

      <RosterDayEditor
        isOpen={!!editorDay}
        day={editorDay}
        roster={selectedRoster}
        readOnly={readOnly || calendarFrozen || status === "Pending Approval"}
        onClose={() => setEditorDay(null)}
        onSaved={() => {
          refreshRosterViews({ silent: true });
        }}
      />

      <RosterVersionHistory
        rosterMonthId={selectedRoster?.roster_month_id}
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
      />

      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmAction.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmAction.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold ${
                  confirmAction.destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterManagement;
