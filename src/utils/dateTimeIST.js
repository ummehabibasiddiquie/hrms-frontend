/**
 * India Standard Time (IST, Asia/Kolkata) display helpers.
 *
 * Rules:
 * - Naive MySQL/API datetimes ("YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DDTHH:MM:SS")
 *   are treated as IST wall-clock (no UTC shift).
 * - Values with Z / GMT / explicit offset are converted to Asia/Kolkata.
 */

export const IST_TIMEZONE = "Asia/Kolkata";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_UPPER = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const NAIVE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?/;

function hasExplicitZone(raw) {
  const s = String(raw).trim();
  return (
    /[zZ]$/.test(s) ||
    /[+-]\d{2}:?\d{2}$/.test(s) ||
    /\bGMT\b/i.test(s) ||
    /\bUTC\b/i.test(s)
  );
}

/**
 * @returns {{
 *   year: number, month: number, day: number,
 *   hours: number, minutes: number, seconds: number
 * } | null}
 */
export function getISTParts(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return partsFromDateInIST(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (hasExplicitZone(raw)) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return partsFromDateInIST(d);
  }

  const m = raw.match(NAIVE_RE);
  if (m) {
    return {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hours: Number(m[4] ?? 0),
      minutes: Number(m[5] ?? 0),
      seconds: Number(m[6] ?? 0),
    };
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return partsFromDateInIST(d);
}

function partsFromDateInIST(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hours: Number(bag.hour),
    minutes: Number(bag.minute),
    seconds: Number(bag.second),
  };
}

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

function to12Hour(hours24) {
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const h = hours24 % 12 || 12;
  return { hours12: h, ampm };
}

/** e.g. 31/07/2026 4:01 PM */
export function formatISTDateTime(value, fallback = "-") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  const { hours12, ampm } = to12Hour(p.hours);
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${hours12}:${pad(p.minutes)} ${ampm}`;
}

/** e.g. 31 Jul 2026, 04:01 pm */
export function formatISTDateTimeLong(value, fallback = "-") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  const { hours12, ampm } = to12Hour(p.hours);
  return `${p.day} ${MONTH_SHORT[p.month - 1]} ${p.year}, ${pad(hours12)}:${pad(p.minutes)} ${ampm.toLowerCase()}`;
}

/** e.g. 31/Jul/2026 */
export function formatISTDateSlash(value, fallback = "-") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  return `${p.day}/${MONTH_SHORT[p.month - 1]}/${p.year}`;
}

/** e.g. 31-07-2026 */
export function formatISTDateDash(value, fallback = "-") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  return `${pad(p.day)}-${pad(p.month)}-${p.year}`;
}

/** e.g. 31 Jul 2026 */
export function formatISTDateMedium(value, fallback = "-") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  return `${pad(p.day)} ${MONTH_SHORT[p.month - 1]} ${p.year}`;
}

/** Today's calendar date in IST as YYYY-MM-DD */
export function todayISTISO() {
  return formatISTDateISO(new Date());
}

/** e.g. 31/JUL/2026 */
export function formatISTDateUpper(value, fallback = "-") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  return `${p.day}/${MONTH_UPPER[p.month - 1]}/${p.year}`;
}

/** e.g. 4:01 PM */
export function formatISTTime(value, fallback = "-") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  const { hours12, ampm } = to12Hour(p.hours);
  return `${hours12}:${pad(p.minutes)} ${ampm}`;
}

/** { date: '31/Jul/2026', time: '4:01 PM' } */
export function formatISTDateTimeParts(value) {
  const p = getISTParts(value);
  if (!p) {
    return { date: value ? String(value) : "-", time: "" };
  }
  const { hours12, ampm } = to12Hour(p.hours);
  return {
    date: `${p.day}/${MONTH_SHORT[p.month - 1]}/${p.year}`,
    time: `${hours12}:${pad(p.minutes)} ${ampm}`,
  };
}

/** For exports: 31-07-2026 16:01 */
export function formatISTDateTimeExport(value, fallback = "") {
  const p = getISTParts(value);
  if (!p) return value ? String(value) : fallback;
  return `${pad(p.day)}-${pad(p.month)}-${p.year} ${pad(p.hours)}:${pad(p.minutes)}`;
}

/** YYYY-MM-DD in IST (for filters / keys) */
export function formatISTDateISO(value, fallback = "") {
  const p = getISTParts(value);
  if (!p) return fallback;
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
