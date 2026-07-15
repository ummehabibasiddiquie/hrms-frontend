import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { listChangeRequests, listRosters, listRosterVersions } from "../../services/rosterService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import {
  formatMonthYearLabel,
  getCurrentMonthYear,
  parseMonthYear,
} from "../../utils/rosterUtils";
import LoadingSpinner from "../common/LoadingSpinner";
import RosterCalendar from "./RosterCalendar";
import RosterSummaryCards from "./RosterSummaryCards";
import RosterSubmissionTracker from "./RosterSubmissionTracker";
import RosterVersionHistory from "./RosterVersionHistory";
import { MonthYearPicker } from "../common/CustomCalendar";

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function shiftMonthYear(monthYear, delta) {
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return getCurrentMonthYear();
  const d = new Date(parsed.year, parsed.month + delta, 1);
  return `${MONTH_NAMES[d.getMonth()]}${d.getFullYear()}`;
}

const MyRoster = () => {
  const [monthYear, setMonthYear] = useState(getCurrentMonthYear());
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);

  const loadPendingOverlay = useCallback(async () => {
    try {
      const res = await listChangeRequests({
        month_year: monthYear,
        status: "Pending",
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      const rosterMonthId = roster?.roster_month_id;
      const scoped = rows.filter((r) => {
        if ((r.status || "") !== "Pending") return false;
        if (!r.batch_id) return false;
        if (rosterMonthId) return String(r.roster_month_id) === String(rosterMonthId);
        return true;
      });
      setPendingRequests(scoped);
    } catch {
      setPendingRequests([]);
    }
  }, [monthYear, roster?.roster_month_id]);

  const loadRoster = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listRosters({
        month_year: monthYear,
        include_days: true,
      });
      const rosters = res.data?.rosters || [];
      const mine = rosters[0] || null;
      setRoster(mine);

      if (mine?.roster_month_id) {
        const vRes = await listRosterVersions({ roster_month_id: mine.roster_month_id });
        const versions = vRes.data || [];
        setVersion(versions.length ? versions[versions.length - 1].roster_version : null);
      } else {
        setVersion(null);
      }
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
      setRoster(null);
    } finally {
      setLoading(false);
    }
  }, [monthYear]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    if (roster?.roster_month_id) {
      loadPendingOverlay();
    } else {
      setPendingRequests([]);
    }
  }, [loadPendingOverlay, roster?.roster_month_id]);

  const isCurrentMonth = monthYear === getCurrentMonthYear();
  const parsed = parseMonthYear(monthYear);
  const isFuture =
    parsed &&
    new Date(parsed.year, parsed.month, 1) > new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const hasPendingOverlay = pendingRequests.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Roster</h1>
            <p className="text-blue-100 text-sm mt-1">
              View-only calendar and request status. Only your manager, admin, or super admin can
              edit roster days, leave, or week-offs.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <MonthYearPicker
            selectedMonthYear={monthYear}
            onMonthYearChange={setMonthYear}
            label="Select Month"
            showAllOption={false}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthYear((m) => shiftMonthYear(m, -1))}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
              {formatMonthYearLabel(monthYear)}
              {isCurrentMonth && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Current</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setMonthYear((m) => shiftMonthYear(m, 1))}
              disabled={isFuture}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : !roster ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          No roster found for {formatMonthYearLabel(monthYear)}.
        </div>
      ) : (
        <>
          <RosterSummaryCards roster={roster} version={version} />
          {hasPendingOverlay && (
            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
              Blue dashed days show changes your manager submitted that are still awaiting admin approval.
            </div>
          )}
          <RosterCalendar
            monthYear={monthYear}
            days={roster.days}
            rosterMonthId={roster.roster_month_id}
            rosterStartDate={roster.roster_start_date}
            pendingRequests={pendingRequests}
            readOnly
          />
          {roster.roster_month_id && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="text-sm text-blue-700 font-semibold hover:underline"
              >
                View Version History
              </button>
            </div>
          )}
        </>
      )}

      <RosterSubmissionTracker
        variant="employee"
        defaultMonthYear={monthYear}
      />

      <RosterVersionHistory
        rosterMonthId={roster?.roster_month_id}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
};

export default MyRoster;
