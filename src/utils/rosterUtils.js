import { formatISTDateTimeLong } from "./dateTimeIST";

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function getCurrentMonthYear() {
  const date = new Date();
  return `${MONTH_NAMES[date.getMonth()]}${date.getFullYear()}`;
}

export function getNextMonthYear() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  return `${MONTH_NAMES[date.getMonth()]}${date.getFullYear()}`;
}

export function parseMonthYear(monthYear) {
  if (!monthYear || monthYear.length < 5) return null;
  const year = parseInt(monthYear.slice(-4), 10);
  const monthStr = monthYear.slice(0, -4).toUpperCase();
  const month = MONTH_NAMES.indexOf(monthStr);
  if (month < 0 || Number.isNaN(year)) return null;
  return { year, month, monthYear };
}

export function monthYearToDate(monthYear) {
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return new Date();
  return new Date(parsed.year, parsed.month, 1);
}

export function formatMonthYearLabel(monthYear) {
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return monthYear;
  const monthLabel = new Date(parsed.year, parsed.month, 1).toLocaleString("en-US", { month: "long" });
  return `${monthLabel} ${parsed.year}`;
}

export function formatLocalDateString(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Normalize API / Date values to YYYY-MM-DD without UTC shift. */
export function toDateOnlyString(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDateString(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

export function getCalendarDays(monthYear) {
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return [];
  const { year, month } = parsed;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days = [];

  for (let i = 0; i < startPad; i += 1) {
    days.push({ date: null, pad: true });
  }
  for (let d = 1; d <= lastDay.getDate(); d += 1) {
    const date = new Date(year, month, d);
    days.push({
      date,
      dateStr: formatLocalDateString(year, month, d),
      pad: false,
    });
  }
  return days;
}

/**
 * Calendar weeks (Mon–Sun) that touch this month — same numbering as Excel Week 1..N.
 * @returns {{ week_number: number, week_start: string, week_end: string, label: string, short_label: string, dates: { date: Date, dateStr: string, inMonth: boolean }[] }[]}
 */
export function getWeeksInMonth(monthYear) {
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return [];
  const { year, month } = parsed;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  // Monday of the week containing the 1st (JS: Sun=0 … Sat=6)
  const start = new Date(first);
  const dow = start.getDay(); // 0 Sun … 6 Sat
  const toMonday = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + toMonday);
  start.setHours(0, 0, 0, 0);

  const weeks = [];
  const cursor = new Date(start);
  while (cursor <= last) {
    const dates = [];
    let touchesMonth = false;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      const inMonth = d.getMonth() === month && d.getFullYear() === year;
      if (inMonth) touchesMonth = true;
      dates.push({
        date: d,
        dateStr: formatLocalDateString(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth,
      });
    }
    if (touchesMonth) {
      const n = weeks.length + 1;
      const rangeStart = dates[0].date;
      const rangeEnd = dates[6].date;
      const fmt = (dt) =>
        dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      const fmtY = (dt) =>
        dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      weeks.push({
        week_number: n,
        week_start: dates[0].dateStr,
        week_end: dates[6].dateStr,
        short_label: `Week ${n}`,
        label: `Week ${n} (${fmt(rangeStart)} – ${fmtY(rangeEnd)})`,
        dates,
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/** Hours shown on calendar; half-day days never display a full-day total. */
function displayHoursForDay(day, treatAsHalf) {
  if (day?.working_hours == null || day.working_hours === "") return null;
  const wh = Number(day.working_hours);
  if (!Number.isFinite(wh)) return null;
  // Pending half-leave / stale DB can still hold full hours (e.g. 9) with Half type
  if (treatAsHalf && wh > 5.4) {
    return Math.round((wh / 2) * 100) / 100;
  }
  return wh;
}

export function getDayDisplayInfo(day, options = null) {
  const pending = options?.pending;
  const leaveRemovalPending = options?.leaveRemovalPending;

  let effectiveDay = day;
  if (pending?.preview) {
    const preview = { ...pending.preview };
    const leaveType = preview._pendingLeaveType;
    delete preview._pendingLeaveType;
    effectiveDay = day
      ? { ...day, ...preview }
      : { roster_date: options?.dateStr, ...preview };
    if (leaveType && effectiveDay.day_type === "Leave") {
      effectiveDay.leave_type = leaveType;
    }
    // Preview overrides day_type but keeps base flags like is_holiday_on_week_off.
    // Recompute so a Working draft on a holiday week-off day shows Working, not Week Off.
    const dt = (effectiveDay.day_type || "").trim();
    effectiveDay.is_holiday_on_week_off =
      dt === "WeekOff" && Boolean(effectiveDay.holiday_id);
  }

  if (!effectiveDay) {
    return {
      primaryLabel: "",
      badges: [],
      cellClass: "bg-slate-50",
      isEditable: false,
      hasPending: false,
      pendingTooltip: "",
    };
  }

  const badges = [];
  let primaryLabel = effectiveDay.day_type || "";
  let cellClass = "bg-white border-slate-200";

  const isHalfLeave =
    effectiveDay.day_type === "Leave" &&
    (effectiveDay.working_type === "Half" ||
      Number(effectiveDay.leave_is_half_day) === 1 ||
      effectiveDay.leave_is_half_day === true ||
      Number(effectiveDay.is_half_day) === 1 ||
      effectiveDay.is_half_day === true ||
      effectiveDay.display_as_half_working === true);

  const isHalfWorking =
    effectiveDay.day_type === "Working" && effectiveDay.working_type === "Half";

  const isNightShift = String(effectiveDay.shift || "").toUpperCase() === "NIGHT";

  // Half-day leave and Half Working feel the same: Half Working + hours
  if (isHalfLeave || isHalfWorking) {
    cellClass = isNightShift
      ? "bg-teal-100 border-teal-500"
      : "bg-emerald-50 border-emerald-200";
    primaryLabel = "Half Working";
    badges.push("Half Day");
    if (isHalfLeave) {
      badges.push("Leave");
    }
  } else if (effectiveDay.day_type === "Leave") {
    cellClass = "bg-amber-50 border-amber-200";
    primaryLabel = "Leave";
    badges.push("Full Day");
  } else if (effectiveDay.is_holiday_on_week_off) {
    cellClass = "bg-slate-100 border-slate-300";
    primaryLabel = "Week Off";
    badges.push("Holiday");
  } else if (effectiveDay.day_type === "WeekOff") {
    cellClass = "bg-slate-100 border-slate-300";
    primaryLabel = "Week Off";
  } else if (effectiveDay.day_type === "Holiday") {
    cellClass = "bg-purple-50 border-purple-200";
    primaryLabel = "Holiday";
  } else if (effectiveDay.day_type === "Working") {
    cellClass = isNightShift
      ? "bg-teal-100 border-teal-500"
      : "bg-green-50 border-green-200";
    primaryLabel = "Working";
    if (effectiveDay.shift) badges.push(isNightShift ? "Night" : "Day");
    badges.push("Full Day");
  }

  // Shift badge for half working / other day types (Working already added above)
  if (
    effectiveDay.shift &&
    effectiveDay.day_type !== "Working" &&
    !(isHalfLeave || isHalfWorking)
  ) {
    badges.push(isNightShift ? "Night" : "Day");
  }
  if (isHalfLeave || isHalfWorking) {
    if (effectiveDay.shift) {
      // Keep Night/Day near the front so it stays visible with "Awaiting approval"
      badges.splice(1, 0, isNightShift ? "Night" : "Day");
    }
  }
  // Show hours for half working, half leave, and full working days
  const hoursBadge = displayHoursForDay(
    effectiveDay,
    isHalfLeave || isHalfWorking
  );
  if (
    hoursBadge != null &&
    (isHalfLeave || isHalfWorking || effectiveDay.day_type === "Working")
  ) {
    badges.push(`${hoursBadge}h`);
  }
  if (effectiveDay.holiday_name && effectiveDay.day_type !== "Leave" && !effectiveDay.is_holiday_on_week_off) {
    badges.push(effectiveDay.holiday_name);
  }

  const hasPending = Boolean(pending || leaveRemovalPending);
  let pendingTooltip = pending?.tooltip || "";
  if (leaveRemovalPending) {
    pendingTooltip = pendingTooltip
      ? `${pendingTooltip} • Leave removal pending approval`
      : "Leave removal pending approval";
    if (!badges.includes("Removal pending")) badges.push("Removal pending");
  }

  if (hasPending) {
    cellClass = `${cellClass} ring-2 ring-dashed ring-blue-400`;
    const pendingBadge = "Awaiting approval";
    if (!badges.some((b) => b === pendingBadge)) {
      badges.unshift(pendingBadge);
    }
  }

  // Keep Night/Day visible when badges are truncated in the week grid
  const shiftBadgeIdx = badges.findIndex((b) => b === "Night" || b === "Day");
  if (shiftBadgeIdx > 1) {
    const [shiftBadge] = badges.splice(shiftBadgeIdx, 1);
    badges.splice(hasPending ? 1 : 0, 0, shiftBadge);
  }

  return {
    primaryLabel,
    badges,
    cellClass,
    isEditable: true,
    hasPending,
    pendingTooltip,
  };
}

export function statusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "pending approval":
      return "bg-amber-100 text-amber-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "locked":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-blue-100 text-blue-800";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "cancelled due to withdrawal":
    case "cancelled due to regeneration":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function isRosterEditable(roster, readOnly) {
  if (readOnly || !roster) return false;
  const status = roster.status || "";
  return status === "Draft" || status === "Approved";
}

export function isRosterLocked(roster) {
  return (roster?.status || "").toLowerCase() === "locked";
}

export function isRosterLockable(roster) {
  const status = (roster?.status || "").trim();
  return status === "Draft" || status === "Approved";
}

/** Last calendar day of the roster month (local time). */
export function getRosterMonthLastDate(monthYear) {
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return null;
  const { year, month } = parsed;
  return new Date(year, month + 1, 0);
}

function toLocalDateOnly(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Lock is allowed on or after the last day of the roster month.
 * e.g. JUL2026 from 31 Jul; JUN2026 remains lockable throughout July.
 */
export function canLockRosterMonthByDate(monthYear, referenceDate = new Date()) {
  const lastDate = getRosterMonthLastDate(monthYear);
  if (!lastDate) return false;
  return toLocalDateOnly(referenceDate).getTime() >= toLocalDateOnly(lastDate).getTime();
}

export function getRosterLockDateHint(monthYear) {
  const lastDate = getRosterMonthLastDate(monthYear);
  if (!lastDate) return "Invalid roster month.";
  const label = lastDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Lock is available on or after ${label} (last day of ${monthYear}). Previous months stay lockable after their last day.`;
}

export function formatRosterMonthLastDate(monthYear) {
  const lastDate = getRosterMonthLastDate(monthYear);
  if (!lastDate) return monthYear;
  return lastDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatLockedDate(value) {
  if (!value) return "";
  // Prefer pre-formatted IST wall-clock from API
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return value;
  }
  return formatISTDateTimeLong(value, String(value));
}

export function getRosterLockMessage(roster) {
  if (!isRosterLocked(roster)) return null;
  const locker = roster.locked_by_name || "Super Admin / Admin";
  const when =
    roster.locked_date_display || formatLockedDate(roster.locked_date);
  return when
    ? `This roster is locked by ${locker} on ${when}. No changes or new requests can be made until it is unlocked.`
    : `This roster is locked by ${locker}. No changes or new requests can be made until it is unlocked.`;
}

export function getMonthCalendarLockMessage(monthYear, lockInfo) {
  const locker = lockInfo?.locked_by_name || "Super Admin / Admin";
  const when =
    lockInfo?.locked_date_display || formatLockedDate(lockInfo?.locked_date);
  return when
    ? `The ${monthYear} calendar has been locked by ${locker} on ${when}. No changes can be made until it is unlocked.`
    : `The ${monthYear} calendar has been locked by ${locker}. No changes can be made until it is unlocked.`;
}

export function getWeekLockMessage(lock) {
  if (!lock) return null;
  const wn = lock.week_number;
  const locker = lock.locked_by_name || "Super Admin / Admin";
  const when = lock.locked_date_display || formatLockedDate(lock.locked_date);
  const range =
    lock.week_start && lock.week_end
      ? ` (${lock.week_start} – ${lock.week_end})`
      : "";
  return when
    ? `Week ${wn}${range} is locked by ${locker} on ${when}. Managers cannot edit this week until an admin unlocks it.`
    : `Week ${wn}${range} is locked by ${locker}. Managers cannot edit this week until an admin unlocks it.`;
}

export function isWeekNumberLocked(weekLocks, weekNumber) {
  return (weekLocks || []).some(
    (l) => Number(l.week_number) === Number(weekNumber)
  );
}

export function isMonthCalendarLocked(rosterList, monthCalendarLockedFlag) {
  if (monthCalendarLockedFlag) return true;
  return (rosterList || []).some((r) => isRosterLocked(r));
}

export function countWorkingDaysFromCalendar(days) {
  if (!Array.isArray(days)) return null;
  let total = 0;
  for (const d of days) {
    if (d.day_type === "Working") {
      total += (d.working_type || "Full") === "Half" ? 0.5 : 1;
    } else if (d.day_type === "Leave" && (d.leave_is_half_day || d.is_half_day)) {
      // Half-day leave: employee still worked half the day
      total += 0.5;
    }
  }
  return total;
}

export function filterEmployeesByTeam(employees, teamId, teams = []) {
  if (!teamId || teamId === "all") return employees;
  const team = teams.find(
    (t) => String(t.team_id ?? t.value ?? "") === String(teamId)
  );
  const teamName = team?.team_name || team?.label || "";
  return employees.filter((e) => {
    const idMatch = String(e.team_id ?? e.team ?? "") === String(teamId);
    const nameMatch = teamName && String(e.team_name || "") === String(teamName);
    return idMatch || nameMatch;
  });
}

export function isAgentOrQA(user) {
  if (!user) return false;
  const roleName = String(user.role_name || user.role || "").trim().toLowerCase();
  const designation = String(user.designation || user.designation_name || "").trim().toLowerCase();
  const roleId = Number(user.role_id);
  return (
    roleName === "agent" ||
    roleName === "qa" ||
    designation === "agent" ||
    designation === "qa" ||
    roleId === 5 ||
    roleId === 6
  );
}

const CHANGE_TYPE_LABELS = {
  DAY_UPDATE: "Day Update",
  WEEKOFF_SWAP: "Week-Off Swap",
  LEAVE_ADD: "Add Leave",
  LEAVE_UPDATE: "Update Leave",
  LEAVE_DELETE: "Delete Leave",
  EXTRA_HOURS_UPDATE: "Extra Hours (Monthly)",
};

export function getChangeTypeLabel(changeType) {
  return CHANGE_TYPE_LABELS[changeType] || changeType || "Change";
}

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload;
}

export function formatChangeRequestSummary(changeType, payload) {
  const p = parsePayload(payload);
  switch (changeType) {
    case "DAY_UPDATE": {
      const parts = [p.roster_date || "—"];
      if (p.day_type) parts.push(p.day_type);
      if (p.working_type) parts.push(p.working_type);
      if (p.working_hours != null) parts.push(`${p.working_hours}h`);
      if (p.shift) parts.push(`${p.shift} shift`);
      return parts.join(" · ");
    }
    case "WEEKOFF_SWAP": {
      const changes = p.changes || [];
      if (changes.length === 0) return "No day changes";
      if (changes.length === 1) {
        const c = changes[0];
        return `${c.roster_date}: ${c.current_day_type} → ${c.proposed_day_type}`;
      }
      return `${changes.length} days updated (week-off swap)`;
    }
    case "LEAVE_ADD":
    case "LEAVE_UPDATE": {
      const range = [p.start_date, p.end_date].filter(Boolean).join(" → ") || "—";
      const flags = [
        p.is_half_day ? "Half day" : null,
        p.affect_target ? "Affects target" : null,
      ].filter(Boolean);
      const reason = p.reason ? ` — ${p.reason}` : "";
      return `${p.leave_type || "Leave"} (${range})${flags.length ? ` [${flags.join(", ")}]` : ""}${reason}`;
    }
    case "LEAVE_DELETE":
      return `Remove leave record #${p.leave_id ?? "—"}`;
    case "EXTRA_HOURS_UPDATE":
      return `Monthly extra hours → ${p.extra_assigned_hours ?? "—"}h`;
    default:
      return Object.keys(p).length ? JSON.stringify(p) : "—";
  }
}

export function getChangeRequestDetailLines(changeType, payload) {
  const p = parsePayload(payload);
  const lines = [];

  switch (changeType) {
    case "DAY_UPDATE":
      if (p.roster_date) lines.push({ label: "Date", value: p.roster_date });
      if (p.day_type) lines.push({ label: "Day type", value: p.day_type });
      if (p.shift) lines.push({ label: "Shift", value: p.shift });
      if (p.working_type) lines.push({ label: "Working type", value: p.working_type });
      if (p.working_hours != null) lines.push({ label: "Working hours", value: `${p.working_hours}h` });
      break;
    case "WEEKOFF_SWAP":
      (p.changes || []).forEach((c) => {
        lines.push({
          label: c.roster_date || "Date",
          value: `${c.current_day_type || "—"} → ${c.proposed_day_type || "—"}`,
        });
      });
      if (!lines.length) lines.push({ label: "Changes", value: "None" });
      break;
    case "LEAVE_ADD":
    case "LEAVE_UPDATE":
      if (p.leave_type) lines.push({ label: "Leave type", value: p.leave_type });
      if (p.start_date) lines.push({ label: "Start date", value: p.start_date });
      if (p.end_date) lines.push({ label: "End date", value: p.end_date });
      if (p.reason) lines.push({ label: "Reason", value: p.reason });
      lines.push({ label: "Half day", value: p.is_half_day ? "Yes" : "No" });
      lines.push({ label: "Affects target", value: p.affect_target ? "Yes" : "No" });
      lines.push({ label: "Rostered leave", value: p.is_rostered !== 0 ? "Yes" : "No" });
      if (p.leave_id) lines.push({ label: "Leave ID", value: String(p.leave_id) });
      break;
    case "LEAVE_DELETE":
      lines.push({ label: "Leave ID to remove", value: String(p.leave_id ?? "—") });
      break;
    case "EXTRA_HOURS_UPDATE":
      lines.push({
        label: "Extra assigned hours (monthly)",
        value: p.extra_assigned_hours != null ? `${p.extra_assigned_hours}h` : "—",
      });
      break;
    default:
      Object.entries(p).forEach(([key, val]) => {
        lines.push({ label: key, value: typeof val === "object" ? JSON.stringify(val) : String(val) });
      });
  }

  return lines;
}

function eachDateInRange(startStr, endStr) {
  if (!startStr || !endStr) return [];
  const dates = [];
  const [sy, sm, sd] = startStr.slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = endStr.slice(0, 10).split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function mergePendingDate(byDate, dateStr, preview, summary, { submitted = false } = {}) {
  if (!dateStr) return;
  const key = dateStr.slice(0, 10);
  const existing = byDate[key] || { preview: {}, summaries: [], submitted: false };
  const summaries = [...existing.summaries, summary];
  const phaseLabel = "Submitted — awaiting approval";
  byDate[key] = {
    preview: { ...existing.preview, ...preview },
    summaries,
    submitted: true,
    tooltip: `${phaseLabel}: ${summaries.join(" • ")}`,
  };
}

/**
 * Build a per-date overlay from pending change requests for calendar preview.
 */
export function buildPendingCalendarOverlay(requests, rosterMonthId) {
  const byDate = {};
  const leaveDeleteIds = new Set();

  const relevant = (requests || []).filter(
    (r) =>
      r.status === "Pending" &&
      Boolean(r.batch_id) &&
      (!rosterMonthId || String(r.roster_month_id) === String(rosterMonthId))
  );

  for (const req of relevant) {
    const p = parsePayload(req.change_payload);
    const summary = formatChangeRequestSummary(req.change_type, p);
    const submitted = Boolean(req.batch_id);
    const overlayOpts = { submitted };

    switch (req.change_type) {
      case "DAY_UPDATE":
        mergePendingDate(byDate, p.roster_date, {
          day_type: p.day_type,
          shift: p.shift,
          working_type: p.working_type,
          working_hours: p.working_hours,
        }, summary, overlayOpts);
        break;
      case "WEEKOFF_SWAP":
        (p.changes || []).forEach((c) => {
          mergePendingDate(
            byDate,
            c.roster_date,
            { day_type: c.proposed_day_type },
            `${c.roster_date}: ${c.current_day_type} → ${c.proposed_day_type}`,
            overlayOpts
          );
        });
        break;
      case "LEAVE_ADD":
      case "LEAVE_UPDATE":
        eachDateInRange(p.start_date, p.end_date).forEach((d) => {
          const half = Boolean(Number(p.is_half_day) === 1 || p.is_half_day === true);
          mergePendingDate(byDate, d, {
            day_type: "Leave",
            working_type: half ? "Half" : "Full",
            leave_is_half_day: half,
            is_half_day: half,
            display_as_half_working: half,
            _pendingLeaveType: "Leave",
          }, summary, overlayOpts);
        });
        break;
      case "LEAVE_DELETE":
        if (p.leave_id != null) leaveDeleteIds.add(Number(p.leave_id));
        break;
      default:
        break;
    }
  }

  return { byDate, leaveDeleteIds };
}
