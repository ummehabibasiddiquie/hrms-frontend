import React, { useEffect, useMemo, useState } from "react";
import { X, Trophy, AlertTriangle, Target, Clock, CalendarDays, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchDailyBillableReport, fetchMonthlyBillableReport } from "../../services/billableReportService";

const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Same MonYYYY format as Agent Billable Report → user_monthly_tracker.month_year */
const getCurrentMonthYear = () => {
  const now = new Date();
  return `${MONTH_LABELS[now.getMonth()]}${now.getFullYear()}`;
};

const getCurrentMonthDateRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pad = (n) => String(n).padStart(2, "0");
  return {
    dateFrom: `${year}-${pad(month)}-01`,
    dateTo: `${year}-${pad(month)}-${pad(now.getDate())}`,
  };
};

const countWeekdaysTillToday = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
};

const formatHours = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
};

const CONFETTI_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fb7185", "#facc15", "#2dd4bf"];

/** success = met/exceeded | warning = behind by up to 12 hrs | danger = behind by more than 12 hrs */
const ORANGE_MAX_SHORTFALL_HRS = 12;

const getGoalTier = (achieved, expectedTillToday) => {
  if (achieved + 0.0001 >= expectedTillToday) return "success";
  const shortfall = expectedTillToday - achieved;
  if (shortfall > ORANGE_MAX_SHORTFALL_HRS) return "danger";
  return "warning";
};

const TIER_THEME = {
  success: {
    label: "You're on track",
    title: (name) => `Congratulations, ${name}!`,
    subtitle: "You have achieved (or exceeded) the hours expected till today. Keep this pace going!",
    border: "border-emerald-200",
    header: "bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500",
    achievedBox: "border-emerald-200 bg-emerald-50",
    achievedText: "text-emerald-700",
    trendIcon: "text-emerald-600",
    progressBar: "bg-gradient-to-r from-emerald-500 to-teal-500",
    diffText: "text-emerald-700",
    infoBox: "bg-emerald-50 text-emerald-800",
    infoExtra: "Great work — stay consistent and you will close the month comfortably.",
    button: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700",
    buttonLabel: "Let's keep going",
    showCelebration: true,
    Icon: Trophy,
  },
  warning: {
    label: "Almost there",
    title: (name) => `Keep pushing, ${name}!`,
    subtitle: "You are behind by up to 12 hours on today's expected target. A focused push today can get you back on track.",
    border: "border-amber-300",
    header: "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600",
    achievedBox: "border-amber-200 bg-amber-50",
    achievedText: "text-amber-800",
    trendIcon: "text-amber-600",
    progressBar: "bg-gradient-to-r from-amber-400 to-orange-500",
    diffText: "text-amber-800",
    infoBox: "bg-amber-50 text-amber-900 border border-amber-200",
    infoExtra: null,
    button: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700",
    buttonLabel: "I'll catch up today",
    showCelebration: false,
    Icon: AlertTriangle,
  },
  danger: {
    label: "Target alert",
    title: (name) => `Action needed, ${name}`,
    subtitle: "You are significantly behind the hours expected till today. Please review your target and catch up as soon as possible.",
    border: "border-red-300",
    header: "bg-gradient-to-r from-red-600 via-rose-600 to-red-700",
    achievedBox: "border-red-200 bg-red-50",
    achievedText: "text-red-700",
    trendIcon: "text-red-600",
    progressBar: "bg-gradient-to-r from-red-500 to-rose-600",
    diffText: "text-red-700",
    infoBox: "bg-red-50 text-red-900 border border-red-200",
    infoExtra: null,
    button: "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800",
    buttonLabel: "Understood — I'll improve",
    showCelebration: false,
    Icon: AlertTriangle,
  },
};

const AgentGoalStatusModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);

  const storageKey = useMemo(() => {
    const sessionId = sessionStorage.getItem("session_id") || "default";
    return `agent_goal_popup_${user?.user_id || "na"}_${sessionId}`;
  }, [user?.user_id]);

  useEffect(() => {
    const roleId = Number(user?.role_id);
    if (!user?.user_id || roleId !== 6) return;
    if (sessionStorage.getItem(storageKey) === "shown") return;

    let cancelled = false;

    const loadGoalStatus = async () => {
      try {
        const monthYear = getCurrentMonthYear();
        const { dateFrom, dateTo } = getCurrentMonthDateRange();
        const basePayload = {
          logged_in_user_id: user.user_id,
          user_id: user.user_id,
        };

        // Same sources as Billable Report:
        // - monthly goal, working days, achieved → user_monthly_tracker via /user_monthly_report/list
        // - working days elapsed & daily required → /tracker/view_daily month_summary (uses same UMT row)
        const fetchMonthlyRow = async (monthKey) => {
          const res = await fetchMonthlyBillableReport({ ...basePayload, month_year: monthKey });
          const rows = Array.isArray(res?.data) ? res.data : [];
          return rows[0] || null;
        };

        let monthlyRow = await fetchMonthlyRow(monthYear);
        if (!monthlyRow) {
          // Backend stores month_year as Jan2026 — try title-case variant
          const titled = `${monthYear.slice(0, 1)}${monthYear.slice(1, 3).toLowerCase()}${monthYear.slice(3)}`;
          monthlyRow = await fetchMonthlyRow(titled);
        }
        if (!monthlyRow?.user_monthly_tracker_id) return;

        const dailyRes = await fetchDailyBillableReport({
          ...basePayload,
          date_from: dateFrom,
          date_to: dateTo,
        });
        const dailyData = dailyRes?.data || {};
        const monthSummary = Array.isArray(dailyData.month_summary) ? dailyData.month_summary[0] : null;
        const trackers = Array.isArray(dailyData.trackers) ? dailyData.trackers : [];

        // user_monthly_tracker: monthly_target + extra_assigned_hours = monthly_total_target
        const monthlyGoal = Number(monthlyRow.monthly_total_target) || Number(monthSummary?.monthly_total_target) || 0;
        const workingDays = Number(monthlyRow.working_days) || Number(trackers.find((t) => t.working_days != null)?.working_days) || 0;
        const achieved = Number(monthlyRow.total_billable_hours) ?? Number(monthSummary?.total_billable_hours_month) ?? 0;

        if (monthlyGoal <= 0 || workingDays <= 0) return;

        // Working day index till today — same logic as billable daily (UMT working_days − pending_days)
        let workingDayNumber = 0;
        if (monthSummary?.pending_days != null) {
          workingDayNumber = Math.max(0, Math.min(workingDays, workingDays - Number(monthSummary.pending_days)));
        } else {
          workingDayNumber = Math.min(countWeekdaysTillToday(), workingDays);
        }
        if (workingDayNumber <= 0) return;

        const dailyRequired =
          Number(monthSummary?.daily_required_hours) ||
          Number(trackers.find((t) => t.daily_required_hours != null)?.daily_required_hours) ||
          monthlyGoal / workingDays;

        const expectedTillToday = (monthlyGoal / workingDays) * workingDayNumber;
        const difference = achieved - expectedTillToday;
        const tier = getGoalTier(achieved, expectedTillToday);

        if (cancelled) return;

        setStatus({
          name: user.user_name || monthlyRow.user_name || "Agent",
          monthlyGoal,
          workingDays,
          workingDayNumber,
          dailyRequired,
          expectedTillToday,
          achieved,
          difference,
          tier,
        });
        setOpen(true);
        sessionStorage.setItem(storageKey, "shown");
      } catch (error) {
        console.error("[AgentGoalStatus] Failed to load goal status:", error);
      }
    };

    loadGoalStatus();
    return () => {
      cancelled = true;
    };
  }, [user?.user_id, user?.role_id, user?.user_name, storageKey]);

  if (!open || !status) return null;

  const theme = TIER_THEME[status.tier] || TIER_THEME.warning;
  const TierIcon = theme.Icon;
  const progressPct = Math.min(100, Math.max(0, (status.achieved / status.expectedTillToday) * 100));
  const isAhead = status.difference >= 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <style>{`
        @keyframes agentConfettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
        }
        @keyframes agentFireworkBurst {
          0% { transform: scale(0); opacity: 1; }
          70% { opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .agent-confetti-piece {
          position: absolute;
          top: -12px;
          width: 10px;
          height: 16px;
          border-radius: 2px;
          animation: agentConfettiFall linear forwards;
        }
        .agent-firework {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          animation: agentFireworkBurst 1.1s ease-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {theme.showCelebration && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 42 }).map((_, i) => (
            <span
              key={`confetti-${i}`}
              className="agent-confetti-piece"
              style={{
                left: `${(i * 7.3) % 100}%`,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDuration: `${2.4 + (i % 5) * 0.35}s`,
                animationDelay: `${(i % 8) * 0.08}s`,
              }}
            />
          ))}
          {[18, 38, 62, 82].map((left, i) => (
            <span
              key={`fw-${i}`}
              className="agent-firework"
              style={{
                left: `${left}%`,
                top: `${12 + i * 8}%`,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                boxShadow: `0 0 18px ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`,
                animationDelay: `${i * 0.25}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl border-2 bg-white ${theme.border}`}>
        <div className={`px-6 py-5 ${theme.header}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <TierIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-white/90 text-xs font-semibold uppercase tracking-wide">
                  {theme.label}
                </p>
                <h2 className="text-2xl font-extrabold text-white leading-tight">
                  {theme.title(status.name)}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-3 text-white text-sm font-medium">
            {theme.subtitle}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase">
                <Target className="w-3.5 h-3.5 text-blue-600" /> Expected till today
              </div>
              <p className="mt-1 text-xl font-extrabold text-slate-800">{formatHours(status.expectedTillToday)} hrs</p>
            </div>
            <div className={`rounded-xl border p-3 ${theme.achievedBox}`}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase">
                {isAhead ? (
                  <TrendingUp className={`w-3.5 h-3.5 ${theme.trendIcon}`} />
                ) : (
                  <TrendingDown className={`w-3.5 h-3.5 ${theme.trendIcon}`} />
                )}
                Achieved
              </div>
              <p className={`mt-1 text-xl font-extrabold ${theme.achievedText}`}>
                {formatHours(status.achieved)} hrs
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase">
                <Clock className="w-3.5 h-3.5 text-indigo-600" /> Daily required
              </div>
              <p className="mt-1 text-xl font-extrabold text-slate-800">{formatHours(status.dailyRequired)} hrs</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase">
                <CalendarDays className="w-3.5 h-3.5 text-violet-600" /> Working day
              </div>
              <p className="mt-1 text-xl font-extrabold text-slate-800">
                {status.workingDayNumber} / {status.workingDays}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
              <span>Progress vs expected till today</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${theme.progressBar}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className={`mt-2 text-sm font-semibold ${theme.diffText}`}>
              {isAhead
                ? `Ahead by ${formatHours(status.difference)} hrs`
                : `Short by ${formatHours(Math.abs(status.difference))} hrs`}
            </p>
          </div>

          <div className={`rounded-xl p-4 text-sm ${theme.infoBox}`}>
            <p className="font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Monthly goal: {formatHours(status.monthlyGoal)} hrs across {status.workingDays} working days
            </p>
            <p className="mt-1">
              {theme.infoExtra ||
                `You need about ${formatHours(status.dailyRequired)} billable hours each remaining working day to stay aligned with your monthly goal.`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`w-full py-2.5 rounded-xl font-bold text-white shadow-md transition-all ${theme.button}`}
          >
            {theme.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentGoalStatusModal;
