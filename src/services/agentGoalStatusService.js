import { fetchDailyBillableReport, fetchMonthlyBillableReport } from "./billableReportService";

const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const IST_TIMEZONE = "Asia/Kolkata";
const HALF_DAY_HOUR_IST = 12;
const ORANGE_MAX_SHORTFALL_HRS = 12;

const pad2 = (n) => String(n).padStart(2, "0");

export const getISTNow = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
};

const toDateStr = ({ year, month, day }) => `${year}-${pad2(month)}-${pad2(day)}`;

export const getEvaluationWindow = () => {
  const ist = getISTNow();
  const includeToday = ist.hour >= HALF_DAY_HOUR_IST;

  let evalYear = ist.year;
  let evalMonth = ist.month;
  let evalDay = ist.day;

  if (!includeToday) {
    const evalDate = new Date(ist.year, ist.month - 1, ist.day);
    evalDate.setDate(evalDate.getDate() - 1);
    evalYear = evalDate.getFullYear();
    evalMonth = evalDate.getMonth() + 1;
    evalDay = evalDate.getDate();
  }

  const monthStart = toDateStr({ year: ist.year, month: ist.month, day: 1 });
  const evalDateStr = toDateStr({ year: evalYear, month: evalMonth, day: evalDay });

  if (evalDateStr < monthStart) return null;

  return {
    includeToday,
    periodLabel: includeToday ? "today" : "yesterday",
    monthYear: `${MONTH_LABELS[ist.month - 1]}${ist.year}`,
    dateFrom: monthStart,
    dateTo: evalDateStr,
    evalDateStr,
  };
};

const countWeekdaysThrough = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month - 1, day);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
};

export const getGoalTier = (achieved, expectedTillToday) => {
  if (achieved + 0.0001 >= expectedTillToday) return "success";
  const shortfall = expectedTillToday - achieved;
  if (shortfall > ORANGE_MAX_SHORTFALL_HRS) return "danger";
  return "warning";
};

const fetchMonthlyRow = async (basePayload, monthKey) => {
  const res = await fetchMonthlyBillableReport({ ...basePayload, month_year: monthKey });
  const rows = Array.isArray(res?.data) ? res.data : [];
  return rows[0] || null;
};

export const computeAgentGoalStatus = async (user) => {
  const userId = user?.user_id;
  if (!userId || Number(user?.role_id) !== 6) return null;

  const evalWindow = getEvaluationWindow();
  if (!evalWindow) return null;

  const { monthYear, dateFrom, dateTo, evalDateStr, includeToday, periodLabel } = evalWindow;
  const basePayload = { logged_in_user_id: userId, user_id: userId };
  const titled = `${monthYear.slice(0, 1)}${monthYear.slice(1, 3).toLowerCase()}${monthYear.slice(3)}`;

  const [primaryRow, altRow, dailyRes] = await Promise.all([
    fetchMonthlyRow(basePayload, monthYear),
    fetchMonthlyRow(basePayload, titled),
    fetchDailyBillableReport({ ...basePayload, date_from: dateFrom, date_to: dateTo }),
  ]);

  const monthlyRow = primaryRow || altRow;
  if (!monthlyRow?.user_monthly_tracker_id) return null;

  const dailyData = dailyRes?.data || {};
  const monthSummary = Array.isArray(dailyData.month_summary) ? dailyData.month_summary[0] : null;
  const trackers = Array.isArray(dailyData.trackers) ? dailyData.trackers : [];

  const monthlyGoal = Number(monthlyRow.monthly_total_target) || Number(monthSummary?.monthly_total_target) || 0;
  const workingDays = Number(monthlyRow.working_days) || Number(trackers.find((t) => t.working_days != null)?.working_days) || 0;

  if (monthlyGoal <= 0 || workingDays <= 0) return null;

  const rowsThroughEval = trackers
    .filter((t) => t.work_date && String(t.work_date).slice(0, 10) <= evalDateStr)
    .sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)));
  const evalRow = rowsThroughEval[0];

  let achieved;
  if (includeToday) {
    achieved = Number(monthlyRow.total_billable_hours) ?? Number(monthSummary?.total_billable_hours_month) ?? 0;
  } else if (evalRow?.cumulative_billable_hours_till_day != null) {
    achieved = Number(evalRow.cumulative_billable_hours_till_day);
  } else {
    achieved = rowsThroughEval.reduce((sum, t) => sum + (Number(t.total_billable_hours_day) || 0), 0);
  }

  let workingDayNumber = 0;
  if (monthSummary?.pending_days != null && includeToday) {
    workingDayNumber = Math.max(0, Math.min(workingDays, workingDays - Number(monthSummary.pending_days)));
  } else if (monthSummary?.pending_days != null && !includeToday) {
    workingDayNumber = Math.max(0, Math.min(workingDays, workingDays - Number(monthSummary.pending_days) - 1));
  } else {
    workingDayNumber = Math.min(countWeekdaysThrough(evalDateStr), workingDays);
  }
  if (workingDayNumber <= 0) return null;

  const dailyRequired =
    Number(evalRow?.daily_required_hours) ||
    Number(monthSummary?.daily_required_hours) ||
    monthlyGoal / workingDays;

  const expectedTillToday = (monthlyGoal / workingDays) * workingDayNumber;
  const difference = achieved - expectedTillToday;

  return {
    name: user.user_name || monthlyRow.user_name || "Agent",
    monthlyGoal,
    workingDays,
    workingDayNumber,
    dailyRequired,
    expectedTillToday,
    achieved,
    difference,
    tier: getGoalTier(achieved, expectedTillToday),
    periodLabel,
  };
};

export const getGoalStatusCacheKey = (userId, sessionId) =>
  `agent_goal_status_cache_${userId || "na"}_${sessionId || "default"}`;

export const readCachedGoalStatus = (userId, sessionId) => {
  try {
    const raw = sessionStorage.getItem(getGoalStatusCacheKey(userId, sessionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeCachedGoalStatus = (userId, sessionId, status) => {
  if (!status) return;
  sessionStorage.setItem(getGoalStatusCacheKey(userId, sessionId), JSON.stringify(status));
};

/** Fire during login so popup data is ready before Tracker finishes loading. */
export const prefetchAgentGoalStatus = (user) => {
  if (!user?.user_id || Number(user.role_id) !== 6) return;
  const sessionId = sessionStorage.getItem("session_id") || "default";
  computeAgentGoalStatus(user)
    .then((status) => {
      if (status) writeCachedGoalStatus(user.user_id, sessionId, status);
    })
    .catch((err) => console.error("[AgentGoalStatus] Prefetch failed:", err));
};
