import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Upload, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { getISTParts, todayISTISO } from "../../utils/dateTimeIST";
import { ROUTES } from "../../routes/paths";
import { ROLE_AGENT } from "../../utils/roles";

const USE_TEST_SLOTS = false;
const PING_MINUTES = USE_TEST_SLOTS
  ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  : [0, 5, 10, 15];
const LIVE_SLOTS = [
  { id: "12", hour: 12, minute: 0, label: "12:00 PM", need: 1, fileLabel: "1st file (12 PM)" },
  { id: "16", hour: 16, minute: 0, label: "4:00 PM", need: 2, fileLabel: "2nd file (4 PM)" },
  { id: "18", hour: 18, minute: 0, label: "6:00 PM", need: 3, fileLabel: "3rd file (6 PM)" },
];
const TEST_SLOTS = [
  { id: "test-10", hour: 10, minute: 0, label: "10:00 AM (test)", need: 1, fileLabel: "1st file" },
  { id: "test-1030", hour: 10, minute: 30, label: "10:30 AM (test)", need: 2, fileLabel: "2nd file" },
  { id: "test-11", hour: 11, minute: 0, label: "11:00 AM (test)", need: 3, fileLabel: "3rd file" },
];
const SLOTS = USE_TEST_SLOTS ? TEST_SLOTS : LIVE_SLOTS;
const POPUP_MS = 8000;
const POLL_MS = USE_TEST_SLOTS ? 5000 : 15000;

function pingKey(userId, date, slotId, minute) {
  return `hrms_file_ping:${userId}:${date}:${slotId}:${minute}`;
}

function minutesNow(parts) {
  return parts.hours * 60 + parts.minutes;
}

function activePing(parts) {
  if (!parts) return null;
  for (const slot of SLOTS) {
    const start = slot.hour * 60 + (slot.minute || 0);
    const elapsed = minutesNow(parts) - start;
    if (elapsed < 0 || elapsed > 15) continue;
    const minute = PING_MINUTES.reduce((best, m) => (elapsed >= m ? m : best), 0);
    return { slot, minute };
  }
  return null;
}

function todaysFileCount(fileAt, date) {
  return (fileAt || []).filter((raw) => {
    const p = getISTParts(raw);
    if (!p) return true;
    const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    return day === date;
  }).length;
}

export function requestDesktopReminderPermission() {
  if (typeof Notification === "undefined") return Promise.resolve("denied");
  if (Notification.permission !== "default") return Promise.resolve(Notification.permission);
  return Notification.requestPermission().catch(() => "denied");
}

function isFieldAgent(user) {
  const roleId = Number(user?.role_id);
  const role = String(user?.role_name || user?.role || user?.user_role || "").toLowerCase();
  return roleId === ROLE_AGENT || (role.includes("agent") && !role.includes("qa"));
}

const ClockFileReminder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [clockedIn, setClockedIn] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const hideTimerRef = useRef(null);
  const lastPingRef = useRef("");

  const goToTracker = useCallback(() => {
    setToast(null);
    navigate(ROUTES.AGENT);
  }, [navigate]);

  const desktopNotify = useCallback((slot, minute) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification("Please submit your tracker file", {
        body: `${slot.label}: please submit your file in Tracker.`,
        tag: `hrms-file-${todayISTISO()}-${slot.id}-${minute}`,
      });
      n.onclick = () => {
        window.focus();
        goToTracker();
        n.close();
      };
      setTimeout(() => {
        try {
          n.close();
        } catch {
          /* already closed */
        }
      }, POPUP_MS);
    } catch {
      /* blocked */
    }
  }, [goToTracker]);

  const showToast = useCallback((slot, minute) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setToast({ slot, minute });
    hideTimerRef.current = setTimeout(() => setToast(null), POPUP_MS);
    desktopNotify(slot, minute);
  }, [desktopNotify]);

  const checkReminders = useCallback(async () => {
    if (!user?.user_id || !isFieldAgent(user)) return;
    try {
      const res = await api.post("/tracker/clock/status", { logged_in_user_id: user.user_id });
      const session = res.data?.data?.session;
      const date = todayISTISO();
      const fileCount = todaysFileCount(res.data?.data?.file_at, date);
      const clocked = Boolean(session?.is_clocked_in || (session?.clock_in_at && !session?.clock_out_at));
      setClockedIn(clocked);
      if (!clocked) {
        setToast(null);
        return;
      }

      const parts = getISTParts(new Date());
      const ping = activePing(parts);
      if (!ping) return;

      const id = `${date}:${ping.slot.id}:${ping.minute}`;
      if (lastPingRef.current === id) return;
      if (localStorage.getItem(pingKey(user.user_id, date, ping.slot.id, ping.minute))) return;

      if (fileCount >= ping.slot.need) {
        PING_MINUTES.forEach((m) => {
          localStorage.setItem(pingKey(user.user_id, date, ping.slot.id, m), "skip");
        });
        lastPingRef.current = id;
        return;
      }
      lastPingRef.current = id;
      localStorage.setItem(pingKey(user.user_id, date, ping.slot.id, ping.minute), "1");
      showToast(ping.slot, ping.minute);
    } catch {
      /* skip this tick */
    }
  }, [user, showToast]);

  useEffect(() => {
    checkReminders();
    const timer = setInterval(checkReminders, POLL_MS);
    document.addEventListener("visibilitychange", checkReminders);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", checkReminders);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [checkReminders]);

  const askNotify = async () => {
    const result = await requestDesktopReminderPermission();
    setNotifyPermission(result || (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  };

  if (!isFieldAgent(user)) return null;

  const notifyReady = notifyPermission === "granted";
  const notifyDenied = notifyPermission === "denied" || notifyPermission === "unsupported";

  return (
    <>
      {!notifyReady && !notifyDenied && (
        <div className="mx-auto max-w-7xl mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <Bell className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <span className="text-sm text-amber-950 flex-1">
            Click <strong>Allow</strong> so file reminders also appear as Windows notifications when you are in Excel.
          </span>
          <button
            type="button"
            onClick={askNotify}
            className="px-4 py-2 rounded-md bg-amber-700 text-white text-sm font-semibold"
          >
            Allow desktop alerts
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-[90] w-full max-w-sm rounded-xl border border-amber-300 bg-white shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-800">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Submit your file</p>
              <p className="text-xs text-slate-600 mt-1">
                {toast.slot.label} reminder
                {toast.minute ? ` · ${toast.minute} min later` : ""}. Please submit your file.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={goToTracker}
                  className="text-xs font-semibold text-blue-700"
                >
                  Open Tracker
                </button>
                {!notifyReady && !notifyDenied && (
                  <button
                    type="button"
                    onClick={askNotify}
                    className="text-xs font-semibold text-amber-800"
                  >
                    Allow desktop alerts
                  </button>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setToast(null)} className="text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ClockFileReminder;
