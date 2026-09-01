import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  Unlock,
  Lock,
  UserPlus,
  RotateCcw,
  Search,
  ChevronDown,
  Mail,
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
  resetRegenerateRoster,
  resetRegenerateEmployeeRoster,
  lockRosterMonth,
  unlockRosterMonth,
  unlockRosterWeek,
  emailRosterWeek,
} from "../../services/rosterService";
import { useRosterRoles } from "../../hooks/useRosterRoles";
import { useRoutedSubTab } from "../../hooks/useRoutedDashboardTab";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import SubTabsBar from "../common/SubTabsBar";
import {
  filterEmployeesByTeam,
  formatMonthYearLabel,
  getCurrentMonthYear,
  getNextMonthYear,
  getMonthCalendarLockMessage,
  getRosterLockDateHint,
  getWeekLockMessage,
  canLockRosterMonthByDate,
} from "../../utils/rosterUtils";
import LoadingSpinner from "../common/LoadingSpinner";
import { MonthYearPicker } from "../common/CustomCalendar";
import RosterTeamWeekGrid from "./RosterTeamWeekGrid";
import RosterApprovalQueue from "./RosterApprovalQueue";
import RosterSubmissionTracker from "./RosterSubmissionTracker";
import HolidayMaster from "./HolidayMaster";
import RosterExcelUpload from "./RosterExcelUpload";
import RosterLockedBanner from "./RosterLockedBanner";

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

  const [view, setView] = useRoutedSubTab("team_week", {
    parentTab: "manage",
  });
  const [monthYear, setMonthYear] = useState(getCurrentMonthYear());
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [canGenerateNextMonth, setCanGenerateNextMonth] = useState(false);
  const [nextMonthTarget, setNextMonthTarget] = useState(getNextMonthYear());
  const [nextMonthNeedsGenerate, setNextMonthNeedsGenerate] = useState(false);
  const [monthCalendarLocked, setMonthCalendarLocked] = useState(false);
  const [monthLockInfo, setMonthLockInfo] = useState(null);
  const [weekLocks, setWeekLocks] = useState([]);
  const [monthStatusRosters, setMonthStatusRosters] = useState([]);
  const [monthPendingAll, setMonthPendingAll] = useState([]);
  const [teamWeekRosters, setTeamWeekRosters] = useState([]);
  const [teamWeekLoading, setTeamWeekLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showActions, setShowActions] = useState(true);

  const selectedRoster = useMemo(
    () => rosters.find((r) => String(r.user_id) === String(selectedUserId)) || null,
    [rosters, selectedUserId]
  );

  const filteredEmployees = useMemo(() => {
    let list = isAssistantManager
      ? employees
      : filterEmployeesByTeam(employees, selectedTeam, teams);
    if (employeeSearch.trim()) {
      const q = employeeSearch.toLowerCase();
      list = list.filter((e) => (e.user_name || e.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [employees, selectedTeam, teams, employeeSearch, isAssistantManager]);

  // Single-employee actions use the one person left after search (or explicit pick via 1 match)
  const actionUserId = useMemo(() => {
    if (filteredEmployees.length === 1) return String(filteredEmployees[0].user_id);
    return "";
  }, [filteredEmployees]);

  // Keep selectedUserId aligned with search when exactly one employee matches
  useEffect(() => {
    setSelectedUserId(actionUserId);
  }, [actionUserId]);

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

  const applyPendingRows = useCallback((rows) => {
    setMonthPendingAll(Array.isArray(rows) ? rows : []);
  }, []);

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
      setWeekLocks(Array.isArray(res.data?.week_locks) ? res.data.week_locks : []);
      return {
        monthCalendarLocked: Boolean(res.data?.month_calendar_locked),
        monthLockInfo: res.data?.month_lock_info || null,
        weekLocks: Array.isArray(res.data?.week_locks) ? res.data.week_locks : [],
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
        setWeekLocks(Array.isArray(res.data?.week_locks) ? res.data.week_locks : []);
        return list;
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err));
        setRosters([]);
        setMonthCalendarLocked(false);
        setMonthLockInfo(null);
        setWeekLocks([]);
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [monthYear]
  );

  const loadTeamWeekRosters = useCallback(
    async (options = {}) => {
      const { silent = false } = options;
      try {
        if (!silent) setTeamWeekLoading(true);
        const res = await listRosters({
          month_year: monthYear,
          include_days: true,
        });
        const list = res.data?.rosters || [];
        setTeamWeekRosters(list);
        setMonthCalendarLocked(Boolean(res.data?.month_calendar_locked));
        setMonthLockInfo(res.data?.month_lock_info || null);
        setWeekLocks(Array.isArray(res.data?.week_locks) ? res.data.week_locks : []);
        return list;
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err));
        setTeamWeekRosters([]);
        setMonthCalendarLocked(false);
        setMonthLockInfo(null);
        setWeekLocks([]);
        return null;
      } finally {
        if (!silent) setTeamWeekLoading(false);
      }
    },
    [monthYear]
  );

  const refreshRosterViews = useCallback(
    async (options = {}) => {
      const userId = options.userId || selectedUserId;
      const tasks = [
        loadPendingRequests(),
        loadMonthSummary(),
        loadTeamWeekRosters({ silent: options.silent }),
      ];
      // Keep single-employee roster in sync when an employee is selected (generate/reset)
      if (userId) {
        tasks.push(loadSelectedRoster(userId, { silent: true }));
      }
      await Promise.all(tasks);
    },
    [
      selectedUserId,
      loadSelectedRoster,
      loadTeamWeekRosters,
      loadPendingRequests,
      loadMonthSummary,
    ]
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
  }, [user?.user_id, isAssistantManager]);

  const refreshNextMonthGenerateState = useCallback(async () => {
    try {
      const gen = await canGenerateRoster({});
      const allowed = Boolean(gen.data?.can_generate);
      const target = gen.data?.target_month_year || getNextMonthYear();
      setCanGenerateNextMonth(allowed);
      setNextMonthTarget(target);

      if (!allowed) {
        setNextMonthNeedsGenerate(false);
        return;
      }

      const [empRes, rosterRes] = await Promise.all([
        listRosterEmployees({ month_year: target }),
        listRosters({ month_year: target, include_days: false }),
      ]);
      const empList = empRes.data?.employees || [];
      const rosterList = rosterRes.data?.rosters || [];
      const rosterUserIds = new Set(rosterList.map((r) => String(r.user_id)));
      const hasMissing = empList.some((e) => !rosterUserIds.has(String(e.user_id)));
      setNextMonthNeedsGenerate(hasMissing);
    } catch {
      setCanGenerateNextMonth(false);
      setNextMonthNeedsGenerate(false);
    }
  }, []);

  useEffect(() => {
    refreshNextMonthGenerateState();
  }, [refreshNextMonthGenerateState]);

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
            : listRosters({ month_year: monthYear, include_days: false });

        const [pendingRes, summaryRes] = await Promise.all([pendingPromise, summaryPromise]);
        if (cancelled) return;

        applyPendingRows(Array.isArray(pendingRes?.data) ? pendingRes.data : []);

        if (summaryRes) {
          setMonthStatusRosters(summaryRes.data?.rosters || []);
          setMonthCalendarLocked(Boolean(summaryRes.data?.month_calendar_locked));
          setMonthLockInfo(summaryRes.data?.month_lock_info || null);
          setWeekLocks(
            Array.isArray(summaryRes.data?.week_locks) ? summaryRes.data.week_locks : []
          );
        } else {
          setMonthStatusRosters([]);
          setMonthCalendarLocked(false);
          setMonthLockInfo(null);
          setWeekLocks([]);
        }
      } catch {
        if (!cancelled) {
          applyPendingRows([]);
          setMonthStatusRosters([]);
          setMonthCalendarLocked(false);
          setMonthLockInfo(null);
          setWeekLocks([]);
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
        setWeekLocks(Array.isArray(res.data?.week_locks) ? res.data.week_locks : []);
      } catch (err) {
        if (!cancelled) {
          toast.error(getFriendlyErrorMessage(err));
          setRosters([]);
          setMonthCalendarLocked(false);
          setMonthLockInfo(null);
          setWeekLocks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthYear, selectedUserId]);

  // Team week grid — load all scoped rosters with days
  useEffect(() => {
    if (view !== "team_week") return undefined;
    let cancelled = false;
    (async () => {
      setTeamWeekLoading(true);
      try {
        const res = await listRosters({
          month_year: monthYear,
          include_days: true,
        });
        if (cancelled) return;
        setTeamWeekRosters(res.data?.rosters || []);
        setMonthCalendarLocked(Boolean(res.data?.month_calendar_locked));
        setMonthLockInfo(res.data?.month_lock_info || null);
        setWeekLocks(Array.isArray(res.data?.week_locks) ? res.data.week_locks : []);
      } catch (err) {
        if (!cancelled) {
          toast.error(getFriendlyErrorMessage(err));
          setTeamWeekRosters([]);
          setMonthCalendarLocked(false);
          setMonthLockInfo(null);
          setWeekLocks([]);
        }
      } finally {
        if (!cancelled) setTeamWeekLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, monthYear]);

  // Team week is the main manage view — migrate old ?subtab=calendar links
  useEffect(() => {
    if (view === "calendar") setView("team_week");
  }, [view, setView]);

  // Soft refresh when window regains focus (once per focus, not on every render)
  useEffect(() => {
    const onFocus = () => {
      refreshRosterViews({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshRosterViews]);

  const canManageWeekLocks = isAdmin || isSuperAdmin;
  const showTeamFilter = isAdmin || isSuperAdmin || isProjectManager;
  const isBusy = !!actionLoading;

  const runAction = async (key, fn) => {
    // Close confirm dialog immediately so it doesn't stick during long API/refresh work
    setConfirmAction(null);
    try {
      setActionLoading(key);
      await fn();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
      setActionLoading("");
      return;
    }
    // Drop the blocking overlay as soon as the API finishes; refresh in the background
    setActionLoading("");
    try {
      await refreshRosterViews({ silent: true });
      await refreshNextMonthGenerateState();
    } catch {
      toast.error(
        `Action completed, but refresh timed out. Reload the page if data looks stale.`
      );
    }
  };

  const handleGenerateSelectedMonth = () => {
    setConfirmAction({
      title: "Generate Missing Rosters",
      message: `Create rosters for ${formatMonthYearLabel(monthYear)} only for eligible employees who do not have a roster yet? Existing rosters will not be changed.`,
      onConfirm: () =>
        runAction("generate-month", async () => {
          const res = await generateRoster({ month_year: monthYear });
          const created = res.data?.created_count ?? 0;
          const skipped = res.data?.skipped_count ?? 0;
          toast.success(
            `${res.message || "Done"} — ${created} created, ${skipped} already had a roster (${monthYear})`
          );
        }),
    });
  };

  const handleGenerateNextMonth = () => {
    const nextMonth = nextMonthTarget || getNextMonthYear();
    setConfirmAction({
      title: "Generate Next Month Rosters",
      message: `Create rosters for ${formatMonthYearLabel(nextMonth)} only for eligible employees who do not have a roster yet? Available at the end of the current month.`,
      onConfirm: () =>
        runAction("generate-next", async () => {
          const res = await generateRoster({});
          const created = res.data?.created_count ?? 0;
          const skipped = res.data?.skipped_count ?? 0;
          const resolvedMonth = res.data?.month_year || nextMonth;
          toast.success(
            `${res.message || "Done"} — ${created} created, ${skipped} already had a roster (${resolvedMonth})`
          );
          setMonthYear(resolvedMonth);
        }),
    });
  };

  const handleGenerateEmployee = () => {
    if (!actionUserId) {
      toast.error("Search until one employee remains, then generate");
      return;
    }
    setConfirmAction({
      title: "Generate Employee Roster",
      message: `Generate roster for selected employee for ${formatMonthYearLabel(monthYear)}?`,
      onConfirm: () =>
        runAction("gen-emp", async () => {
          const res = await generateEmployeeRoster({
            user_id: Number(actionUserId),
            month_year: monthYear,
          });
          toast.success(res.message || "Employee roster generated");
        }),
    });
  };

  const handleResetRegenerate = () => {
    setConfirmAction({
      title: "Reset & Regenerate (All)",
      message: `This will deactivate all rosters for ${formatMonthYearLabel(monthYear)}, clear Pending/Approved/Rejected request history for the month, and regenerate. Continue?`,
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

  const handleResetEmployee = () => {
    if (!actionUserId) {
      toast.error("Search until one employee remains, then reset");
      return;
    }
    const empName =
      employees.find((e) => String(e.user_id) === String(actionUserId))?.user_name ||
      "selected employee";
    setConfirmAction({
      title: "Reset & Regenerate (Employee)",
      message: `Reset roster for ${empName} for ${formatMonthYearLabel(monthYear)}? Their Pending/Approved/Rejected requests for this month will be cleared, then the roster will be regenerated.`,
      destructive: true,
      onConfirm: () =>
        runAction("reset-emp", async () => {
          const res = await resetRegenerateEmployeeRoster({
            user_id: Number(actionUserId),
            month_year: monthYear,
            confirm_reset: true,
          });
          toast.success(res.message || "Employee roster reset complete");
        }),
    });
  };

  const handleUnlockWeek = (lockOrWeekNumber) => {
    const wn =
      typeof lockOrWeekNumber === "object"
        ? lockOrWeekNumber.week_number
        : lockOrWeekNumber;
    setConfirmAction({
      title: `Unlock Week ${wn}`,
      message: `Unlock Week ${wn} for ${formatMonthYearLabel(monthYear)}? Managers and assistant managers will be able to edit that week again. Other locked weeks stay locked.`,
      onConfirm: () =>
        runAction(`unlock-week-${wn}`, async () => {
          const res = await unlockRosterWeek({
            month_year: monthYear,
            week_number: wn,
          });
          toast.success(res.message || `Week ${wn} unlocked`);
        }),
    });
  };

  const handleLockMonth = () => {
    setConfirmAction({
      title: `Lock ${formatMonthYearLabel(monthYear)}`,
      message: `Lock the entire ${formatMonthYearLabel(monthYear)} calendar? No roster edits will be allowed until an admin unlocks it.`,
      onConfirm: () =>
        runAction("lock-month", async () => {
          const res = await lockRosterMonth({ month_year: monthYear });
          toast.success(res.message || `${monthYear} locked`);
        }),
    });
  };

  const handleUnlockMonth = () => {
    setConfirmAction({
      title: `Unlock ${formatMonthYearLabel(monthYear)}`,
      message: `Unlock the ${formatMonthYearLabel(monthYear)} calendar? Managers will be able to edit unlocked weeks again.`,
      onConfirm: () =>
        runAction("unlock-month", async () => {
          const res = await unlockRosterMonth({ month_year: monthYear });
          toast.success(res.message || `${monthYear} unlocked`);
        }),
    });
  };

  const handleEmailApprovedWeeks = (locks = weekLocks) => {
    const weeks = (locks || []).filter((l) => l?.week_number != null);
    if (!weeks.length) {
      toast.error(
        "No approved week to email. Approve roster requests first; only that week is mailed."
      );
      return;
    }
    const labels = weeks.map((w) => `Week ${w.week_number}`).join(", ");
    setConfirmAction({
      title: "Email approved week roster",
      message: `Send the roster mail only for ${labels} of ${formatMonthYearLabel(monthYear)}? Other weeks will not be emailed.`,
      onConfirm: () =>
        runAction("email-weeks", async () => {
          let sent = 0;
          let lastError = "";
          for (const w of weeks) {
            try {
              const res = await emailRosterWeek({
                month_year: monthYear,
                week_number: w.week_number,
              });
              if ((res.data?.weekly_roster_emails || []).some((e) => e.sent)) sent += 1;
            } catch (err) {
              lastError = err?.response?.data?.message || err.message || lastError;
            }
          }
          if (sent) toast.success(`Emailed approved ${labels}`);
          else toast.error(lastError || "Weekly roster email was not sent");
        }),
    });
  };

  const canLockThisMonth =
    canManageWeekLocks && canLockRosterMonthByDate(monthYear) && !monthCalendarLocked;

  const tabs = [
    { id: "team_week", label: "Roster Calendar" },
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
        {view === "team_week" && monthTotalPendingCount > 0 && (
          <span className="self-start sm:self-center text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {monthTotalPendingCount} pending request
            {monthTotalPendingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <SubTabsBar
          activeTab={view}
          onChange={setView}
          tabs={tabs}
          bordered={false}
        />

        {view === "submissions" && (
          <div className="p-4">
            <RosterSubmissionTracker
              variant="manager"
              monthYear={monthYear}
              onMonthYearChange={setMonthYear}
            />
          </div>
        )}

        {view === "approval" && canApproveRoster && (
          <div className="p-4">
            <RosterApprovalQueue
              monthYear={monthYear}
              onMonthYearChange={setMonthYear}
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

        {view === "team_week" && (
          <div className="divide-y divide-slate-100">
            <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-end gap-3">
              <MonthYearPicker
                compact
                selectedMonthYear={monthYear}
                onMonthYearChange={(m) => {
                  setMonthYear(m);
                  setEmployeeSearch("");
                }}
                label="Month"
                showAllOption={false}
                allowFutureMonths
              />

              {showTeamFilter && (
                <label className="flex-1 min-w-[140px]">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Team</span>
                  <select
                    value={selectedTeam}
                    onChange={(e) => {
                      setSelectedTeam(e.target.value);
                      setEmployeeSearch("");
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

              <label className="flex-1 min-w-[200px] lg:max-w-md">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Search className="w-3 h-3" /> Employee
                </span>
                <input
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search name — leave empty for all"
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <p className="text-xs text-slate-400 lg:pb-2 shrink-0">
                {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? "s" : ""} ·{" "}
                <span className="font-semibold text-slate-600">{formatMonthYearLabel(monthYear)}</span>
                {actionUserId ? " · single actions ready" : ""}
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
                      title={`Create rosters for ${formatMonthYearLabel(monthYear)} only for employees who do not have one yet`}
                    >
                      Generate Missing Rosters
                    </ActionBtn>
                    <ActionBtn
                      icon={UserPlus}
                      loading={actionLoading === "gen-emp"}
                      disabled={!actionUserId || isBusy}
                      onClick={handleGenerateEmployee}
                      title={
                        actionUserId
                          ? `Generate roster for the selected employee for ${formatMonthYearLabel(monthYear)}`
                          : "Search until one employee remains"
                      }
                    >
                      Single Employee
                    </ActionBtn>
                    {canGenerateNextMonth && (
                      <ActionBtn
                        loading={actionLoading === "generate-next"}
                        disabled={isBusy || !nextMonthNeedsGenerate}
                        onClick={handleGenerateNextMonth}
                        title={
                          nextMonthNeedsGenerate
                            ? `Creates rosters for ${formatMonthYearLabel(nextMonthTarget)} for employees who don't have one yet`
                            : `All eligible employees already have a roster for ${formatMonthYearLabel(nextMonthTarget)}`
                        }
                      >
                        Generate Next Month Rosters
                      </ActionBtn>
                    )}
                  </ActionGroup>

                  <ActionGroup title="Workflow">
                    <RosterExcelUpload
                      monthYear={monthYear}
                      teamId={selectedTeam}
                      disabled={isBusy || monthCalendarLocked}
                      weekLocks={weekLocks}
                      onApplied={() => refreshRosterViews({ silent: true })}
                    />
                  </ActionGroup>

                  {canManageWeekLocks && (
                    <ActionGroup title="Admin">
                      {monthCalendarLocked ? (
                        <ActionBtn
                          icon={Unlock}
                          loading={actionLoading === "unlock-month"}
                          disabled={isBusy}
                          onClick={handleUnlockMonth}
                          title={getMonthCalendarLockMessage(monthYear, monthLockInfo)}
                        >
                          Unlock Calendar
                        </ActionBtn>
                      ) : (
                        <ActionBtn
                          icon={Lock}
                          loading={actionLoading === "lock-month"}
                          disabled={isBusy || !canLockThisMonth}
                          onClick={handleLockMonth}
                          title={
                            canLockThisMonth
                              ? `Lock all rosters for ${formatMonthYearLabel(monthYear)}`
                              : getRosterLockDateHint(monthYear)
                          }
                        >
                          Lock Calendar
                        </ActionBtn>
                      )}
                      <ActionBtn
                        icon={Mail}
                        loading={actionLoading === "email-weeks"}
                        disabled={isBusy || weekLocks.length === 0}
                        onClick={() => handleEmailApprovedWeeks()}
                        title={
                          weekLocks.length
                            ? `Email only the approved/locked week(s): ${weekLocks
                                .map((l) => `Week ${l.week_number}`)
                                .join(", ")}`
                            : "Approve a roster request first. Only that week is emailed."
                        }
                      >
                        Email approved week
                      </ActionBtn>
                      {weekLocks.length === 0 ? (
                        <p className="w-full text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mb-1">
                          Weeks lock automatically when you approve submitted roster
                          changes. Unlock a week here to allow edits again.
                        </p>
                      ) : (
                        <p className="w-full text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-1">
                          {weekLocks.length} locked week
                          {weekLocks.length !== 1 ? "s" : ""} — other weeks stay
                          editable.
                        </p>
                      )}
                      {weekLocks.map((lock) => (
                        <React.Fragment key={lock.week_number}>
                          <ActionBtn
                            icon={Unlock}
                            loading={actionLoading === `unlock-week-${lock.week_number}`}
                            disabled={isBusy}
                            onClick={() => handleUnlockWeek(lock)}
                            title={getWeekLockMessage(lock) || `Unlock Week ${lock.week_number}`}
                          >
                            Unlock Week {lock.week_number}
                          </ActionBtn>
                          <ActionBtn
                            icon={Mail}
                            loading={actionLoading === "email-weeks"}
                            disabled={isBusy}
                            onClick={() => handleEmailApprovedWeeks([lock])}
                            title={`Email only Week ${lock.week_number} (the approved week)`}
                          >
                            Email Week {lock.week_number}
                          </ActionBtn>
                        </React.Fragment>
                      ))}
                      {canResetRegenerate && (
                        <>
                          <ActionBtn
                            variant="danger"
                            icon={RotateCcw}
                            loading={actionLoading === "reset-emp"}
                            disabled={!actionUserId || isBusy}
                            onClick={handleResetEmployee}
                            title={
                              actionUserId
                                ? "Reset & regenerate roster for the employee matching search"
                                : "Search until one employee remains"
                            }
                          >
                            Reset Employee
                          </ActionBtn>
                          <ActionBtn
                            variant="danger"
                            icon={RotateCcw}
                            loading={actionLoading === "reset"}
                            disabled={isBusy}
                            onClick={handleResetRegenerate}
                            title={`Reset & regenerate all rosters for ${monthYear}`}
                          >
                            Reset All ({monthYear})
                          </ActionBtn>
                        </>
                      )}
                    </ActionGroup>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {view === "team_week" && (
        <div className="space-y-4">
          {monthCalendarLocked && (
            <RosterLockedBanner
              title="Calendar locked"
              message={getMonthCalendarLockMessage(monthYear, monthLockInfo)}
              action={
                canManageWeekLocks ? (
                  <ActionBtn
                    icon={Unlock}
                    loading={actionLoading === "unlock-month"}
                    disabled={isBusy}
                    onClick={handleUnlockMonth}
                  >
                    Unlock Calendar
                  </ActionBtn>
                ) : null
              }
            />
          )}
          {weekLocks.length > 0 && !monthCalendarLocked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
              <p className="text-xs font-semibold text-amber-900">
                Locked weeks (approved — edits blocked until admin unlock)
              </p>
              {weekLocks.map((lock) => (
                <div
                  key={lock.week_number}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <p className="text-xs text-amber-800">{getWeekLockMessage(lock)}</p>
                  {canManageWeekLocks && (
                    <div className="flex flex-wrap gap-1.5">
                      <ActionBtn
                        icon={Mail}
                        loading={actionLoading === "email-weeks"}
                        disabled={isBusy}
                        onClick={() => handleEmailApprovedWeeks([lock])}
                      >
                        Email Week {lock.week_number}
                      </ActionBtn>
                      <ActionBtn
                        icon={Unlock}
                        loading={actionLoading === `unlock-week-${lock.week_number}`}
                        disabled={isBusy}
                        onClick={() => handleUnlockWeek(lock)}
                      >
                        Unlock Week {lock.week_number}
                      </ActionBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {monthTotalPendingCount > 0 && !monthCalendarLocked && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {monthTotalPendingCount} change(s) pending approval — working days update after approval.
              Use Excel Upload to apply and submit more changes.
            </p>
          )}
          {teamWeekLoading ? (
            <LoadingSpinner />
          ) : (
            <RosterTeamWeekGrid
              monthYear={monthYear}
              rosters={teamWeekRosters}
              employees={filteredEmployees}
              pendingRequests={monthPendingAll}
              monthCalendarLocked={monthCalendarLocked}
              weekLocks={weekLocks}
              readOnly
              canUnlockWeeks={canManageWeekLocks}
              unlockingWeek={
                String(actionLoading).startsWith("unlock-week-") ? actionLoading : ""
              }
              onUnlockWeek={(weekNumber) => handleUnlockWeek(weekNumber)}
            />
          )}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmAction.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmAction.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isBusy}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                disabled={isBusy}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${
                  confirmAction.destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {isBusy && (
        <div className="fixed inset-0 bg-slate-900/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl px-6 py-5 flex items-center gap-3 max-w-sm w-full">
            <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Working…</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {actionLoading.startsWith("reset")
                  ? "Reset & regenerate can take a minute for a full month. Please wait."
                  : "Please wait while this action finishes."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterManagement;
