import { exportToCSV } from '../../utils/csvExport';
import { toast } from "react-hot-toast";
import React, { useState, useEffect, useMemo } from "react";
import { fetchDropdown } from "../../services/dropdownService";
import { useAuth } from "../../context/AuthContext";
import MonthCard from "./MonthCard";
import UserCard from "./UserCard";
import SearchableSelect from "./SearchableSelect";
import { fetchMonthlyBillableReport } from "../../services/billableReportService";
import api from "../../services/api";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { Users, Download, RotateCcw, Calendar, FileText } from "lucide-react";
import { useClientPagination } from "../../hooks/useClientPagination";
import TablePaginationBar from "./TablePaginationBar";
import { useRoutedSubTab } from "../../hooks/useRoutedDashboardTab";
import SubTabsBar from "./SubTabsBar";
import {
  DateRangePicker,
  MonthYearPicker,
  yyyyMmToMonthYear,
  monthYearToYyyyMm,
  getCurrentYyyyMm,
} from "./CustomCalendar";

const BillableReport = ({ userId }) => {
  // Device info (declare once at top)
  const { device_id, device_type } = useDeviceInfo();
  // Helper to format date/time for display and export
  // Always return raw backend string for date/time
  function formatDateTime(dateInput) {
    if (!dateInput) return '-';
    return dateInput;
  }

  // Helper function to get day color class (Saturday/Sunday in red)
  function getDayColorClass(dayName) {
    if (!dayName) return '';
    const day = dayName.toLowerCase();
    if (day === 'saturday' || day === 'sunday') {
      return 'text-red-600 font-bold';
    }
    return '';
  }

  // Search filter state (client-side filtering by agent name)
  const [searchQuery, setSearchQuery] = useState('');

  // Team filter state
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const { user } = useAuth();

  // Check if user is Assistant Manager
  const isAssistantManager = user?.role_id === 4 || 
    (user?.role_name || user?.role || '').toLowerCase().includes('assistant');

  // Check if user can view team filter (Admin, Super Admin, Project Manager)
  const normalizedRole = (user?.role_name || user?.role || user?.user_role || '').toLowerCase();
  const isAdmin = user?.role_id === 1 || user?.role_id === 2 || normalizedRole === 'admin';
  const isSuperAdmin = normalizedRole.includes('super');
  const isProjectManager = user?.role_id === 3 || normalizedRole.includes('project manager');
  const canViewTeamFilter = isAdmin || isSuperAdmin || isProjectManager;

  // Export all users' daily data (filtered by search query if set)
  function handleExportAllUsers() {
    try {
      // Filter daily data by search query
      const exportRows = dailyData.filter(row => {
        // Filter by search query (agent name)
        if (searchQuery) {
          const userName = (row.user_name || '').toLowerCase();
          const query = searchQuery.toLowerCase();
          if (!userName.includes(query)) return false;
        }
        return true;
      });

      if (!exportRows.length) {
        toast.error('No data to export.');
        return;
      }

      // Prepare export data
      const exportData = exportRows.map(row => {
        // Format date from work_date
        let dateDisplay = '-';
        if (row.work_date) {
          const d = new Date(row.work_date);
          if (!isNaN(d.getTime())) {
            const pad = n => String(n).padStart(2, '0');
            dateDisplay = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
          }
        }
        
        // Helper to safely format number or return '-'
        const formatNumber = (val) => {
          if (val === null || val === undefined || val === '') return '-';
          const num = Number(val);
          return isNaN(num) ? '-' : num.toFixed(2);
        };
        
        const rowData = {
          'User Name': row.user_name || '-'
        };
        
        rowData['Date'] = dateDisplay;
        rowData['Day Status'] = row.roster_status || row.day_status || '—';
        rowData['Assign Hours'] = formatNumber(row.assigned_hours);
        rowData['Worked Hours'] = formatNumber(row.total_billable_hours_day);
        rowData['QC Score'] = row.qc_score != null ? `${formatNumber(row.qc_score)}%` : '-';
        rowData['Tracker Count'] = row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-';
        rowData['Daily Required Hours'] = formatNumber(row.daily_required_hours);
        
        return rowData;
      });

      // Add total row for countable columns
      if (exportData.length > 0) {
        const totalAssigned = exportData.reduce((sum, r) => sum + (parseFloat(r['Assign Hours']) || 0), 0);
        const totalWorked = exportData.reduce((sum, r) => sum + (parseFloat(r['Worked Hours']) || 0), 0);
        const totalRequired = exportData.reduce((sum, r) => sum + (parseFloat(r['Daily Required Hours']) || 0), 0);
        const qcScores = exportData.map(r => parseFloat(r['QC Score'])).filter(v => !isNaN(v));
        const avgQC = qcScores.length > 0 ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%` : '-';
        const totalTrackers = exportData.reduce((sum, r) => {
          const count = r['Tracker Count'];
          return sum + (count !== '-' ? parseInt(count) : 0);
        }, 0);
        
        const totalRow = {
          'User Name': 'TOTAL'
        };
        
        totalRow['Date'] = '';
        totalRow['Day Status'] = '';
        totalRow['Assign Hours'] = totalAssigned.toFixed(2);
        totalRow['Worked Hours'] = totalWorked.toFixed(2);
        totalRow['QC Score'] = avgQC;
        totalRow['Tracker Count'] = totalTrackers;
        totalRow['Daily Required Hours'] = totalRequired.toFixed(2);
        
        exportData.push(totalRow);
      }

      const filename = 'All_Users_Daily_Report.csv';
      exportToCSV(exportData, filename);
      toast.success('Exported all users daily report!');
    } catch {
      toast.error('Failed to export all users');
    }
  }

  // Export only the visible (filtered) table data for a month (for MonthCard)
  const handleExportMonthTable = async (monthObj, usersArr) => {
    try {
      if (!usersArr || usersArr.length === 0) {
        toast.error('No data to export for this table.');
        return;
      }
      let exportData = usersArr.map(user => {
        const rowData = {
          'User Name': user.user_name || '-'
        };
        
        // Add Team column only if not Assistant Manager (right after User Name)
        if (!isAssistantManager) {
          rowData['Team'] = user.team_name || '-';
        }
        
        rowData['Billable Hour Delivered'] = user.total_billable_hours ? Number(user.total_billable_hours).toFixed(2) : '-';
        rowData['Monthly Goal'] = user.monthly_total_target ?? '-';
        rowData['Pending Target'] = user.pending_target ? Number(user.pending_target).toFixed(2) : '-';
        rowData['Avg. QC Score'] = user.avg_qc_score ? `${Number(user.avg_qc_score).toFixed(2)}%` : '-';
        
        return rowData;
      });
      // Add totals row for numeric columns
      if (exportData.length > 0) {
        const totalBillable = exportData.reduce((sum, r) => sum + (parseFloat(r['Billable Hour Delivered']) || 0), 0);
        const totalGoal = exportData.reduce((sum, r) => sum + (parseFloat(r['Monthly Goal']) || 0), 0);
        const totalPending = exportData.reduce((sum, r) => sum + (parseFloat(r['Pending Target']) || 0), 0);
        // For Avg. QC Score, show average if all are numbers (exclude null, empty, undefined)
        const qcScores = exportData
          .filter(r => r['Avg. QC Score'] !== null && r['Avg. QC Score'] !== undefined && r['Avg. QC Score'] !== '' && r['Avg. QC Score'] !== '-')
          .map(r => parseFloat(r['Avg. QC Score']))
          .filter(v => !isNaN(v));
        const avgQC = qcScores.length > 0 ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%` : '-';
        
        const totalRow = {
          'User Name': 'TOTAL'
        };
        
        if (!isAssistantManager) {
          totalRow['Team'] = '';
        }
        
        totalRow['Billable Hour Delivered'] = totalBillable.toFixed(2);
        totalRow['Monthly Goal'] = totalGoal.toFixed(2);
        totalRow['Pending Target'] = totalPending.toFixed(2);
        totalRow['Avg. QC Score'] = avgQC;
        
        exportData.push(totalRow);
      }
      const filename = `Monthly_Table_${monthObj.label}_${monthObj.year}.csv`;
      exportToCSV(exportData, filename);
      toast.success('Table exported!');
    } catch {
      toast.error('Failed to export table');
    }
  };


  // Daily / Monthly toggle — synced to ?subtab=
  const [activeToggle, setActiveToggle] = useRoutedSubTab('daily', {
    parentTab: 'billable_report',
  });

  // Helper function to get month's first and last day
  const getMonthDateRange = (monthStr) => {
    let year, month;
    
    if (!monthStr) {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    } else {
      [year, month] = monthStr.split('-').map(Number);
    }
    
    const firstDay = 1;
    const lastDay = new Date(year, month, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');
    
    return {
      start: `${year}-${pad(month)}-${pad(firstDay)}`,
      end: `${year}-${pad(month)}-${pad(lastDay)}`
    };
  };

  // State for month filter (monthly / daily) — YYYY-MM for API
  const [monthlyMonth, setMonthlyMonth] = useState(getCurrentYyyyMm());
  const [dailyMonth, setDailyMonth] = useState(getCurrentYyyyMm());
  const [dailyStart, setDailyStart] = useState(() => getMonthDateRange(getCurrentYyyyMm()).start);
  const [dailyEnd, setDailyEnd] = useState(() => getMonthDateRange(getCurrentYyyyMm()).end);

  // State for API data, loading, and error
  const [dailyData, setDailyData] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [errorDaily, setErrorDaily] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // State to track which user cards are expanded (persists across data refetches)
  const [expandedCards, setExpandedCards] = useState({});

  // Store user information persistently (so cards remain visible even with no data)
  const [userInfoMap, setUserInfoMap] = useState({});

  // Fetch teams dropdown for team filter (Admin, Super Admin, Project Manager only)
  useEffect(() => {
    const loadTeams = async () => {
      if (!canViewTeamFilter) {
        console.log('User cannot view team filter');
        setTeams([]);
        return;
      }
      
      setLoadingTeams(true);
      try {
        console.log('Fetching teams for user:', user?.user_id);
        const response = await api.post('/dropdown/get', {
          logged_in_user_id: user?.user_id,
          dropdown_type: 'teams'
        });
        console.log('Teams API response:', response.data);
        const teamsData = response.data?.data || [];
        console.log('Teams data extracted:', teamsData);
        setTeams(teamsData);
      } catch (error) {
        console.error('Error fetching teams:', error);
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };
    if (user?.user_id) {
      loadTeams();
    }
  }, [user?.user_id, canViewTeamFilter]);

  // Reset user map when date range / month filter changes
  React.useEffect(() => {
    setUserInfoMap({});
  }, [dailyMonth, dailyStart, dailyEnd]);

  // Helper to get YYYY-MM-DD string
  const getDateString = (date) => date.toISOString().slice(0, 10);

  const monthFromDate = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return '';
    const [year, month] = dateStr.split('-');
    return `${year}-${month}`;
  };

  // Month dropdown only — sets full month range
  const handleDailyMonthChange = (my) => {
    const yyyyMm = monthYearToYyyyMm(my);
    if (!yyyyMm) return;
    const range = getMonthDateRange(yyyyMm);
    setDailyMonth(yyyyMm);
    setDailyStart(range.start);
    setDailyEnd(range.end);
  };

  // From date — keep exact day; update month label only
  const handleDailyStartChange = (next) => {
    setDailyStart(next);
    if (dailyEnd && next > dailyEnd) setDailyEnd(next);
    const nextMonth = monthFromDate(next);
    if (nextMonth) setDailyMonth(nextMonth);
  };

  // To date — keep exact day; do not reset From
  const handleDailyEndChange = (next) => {
    setDailyEnd(next);
    if (dailyStart && next < dailyStart) {
      setDailyStart(next);
      const nextMonth = monthFromDate(next);
      if (nextMonth) setDailyMonth(nextMonth);
    }
  };

  // Track if this is a date-only filter change (to avoid showing loading spinner)
  const prevFiltersRef = React.useRef({ dailyMonth, dailyStart, dailyEnd });

  React.useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.dailyMonth !== dailyMonth || prev.dailyStart !== dailyStart || prev.dailyEnd !== dailyEnd) {
      prevFiltersRef.current = { dailyMonth, dailyStart, dailyEnd };
    }
  }, [dailyMonth, dailyStart, dailyEnd]);

  // Fetch daily report data using /tracker/view_daily API
  useEffect(() => {
    const fetchData = async () => {
      setLoadingDaily(true);
      setErrorDaily(null);
      try {
        if (!user?.user_id) {
          setDailyData([]);
          setLoadingDaily(false);
          return;
        }
        let payload = {
          logged_in_user_id: user.user_id
        };
        if (dailyStart) payload.date_from = dailyStart;
        if (dailyEnd) payload.date_to = dailyEnd;
        if (dailyStart) {
          const [year, month] = dailyStart.split('-');
          const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          const monthLabel = monthNames[Number(month) - 1];
          payload.month_year = `${monthLabel}${year}`;
        }
        // Team filter
        if (selectedTeam && selectedTeam !== 'all') {
          payload.team_id = Number(selectedTeam);
        }
        // User filter (if userId is passed as prop)
        if (userId) payload.user_id = userId;
        const res = await api.post('/tracker/view_daily', payload);
        let trackers = Array.isArray(res.data?.data?.trackers) ? res.data.data.trackers : [];
        
        const newUserInfoMap = {};
        trackers.forEach(tracker => {
          if (tracker.user_id) {
            newUserInfoMap[tracker.user_id] = {
              user_id: tracker.user_id,
              user_name: tracker.user_name,
              team_name: tracker.team_name,
              team_id: tracker.team_id
            };
          }
        });
        setUserInfoMap(newUserInfoMap);
        
        setDailyData(trackers);
      } catch {
        setErrorDaily("Failed to fetch daily report data");
      } finally {
        setLoadingDaily(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [userId, dailyStart, dailyEnd, selectedTeam, refreshTrigger]);

  // Function to refresh daily data
  const handleRefreshData = () => {
    console.log('Refreshing daily report data...');
    setRefreshTrigger(prev => prev + 1);
  };

  // Fetch monthly report data from API when monthly tab is active
  const [monthlySummaryData, setMonthlySummaryData] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [errorMonthly, setErrorMonthly] = useState(null);
  useEffect(() => {
    if (activeToggle !== 'monthly') return;
    const fetchData = async () => {
      setLoadingMonthly(true);
      setErrorMonthly(null);
      try {
        let payload = {};
        if (monthlyMonth) {
          // monthlyMonth is in format YYYY-MM
          const [year, month] = monthlyMonth.split('-');
          const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          const monthLabel = monthNames[Number(month) - 1];
          payload = { month_year: `${monthLabel}${year}` };
        } else {
          // Default: last 3 months (fallback, not using month_year)
          const now = new Date();
          const firstMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          const lastMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          payload = {
            date_from: getDateString(firstMonth),
            date_to: getDateString(lastMonth)
          };
        }
        const res = await fetchMonthlyBillableReport(payload);
        setMonthlySummaryData(Array.isArray(res.data) ? res.data : []);
      } catch {
        setErrorMonthly("Failed to fetch monthly report data");
      } finally {
        setLoadingMonthly(false);
      }
    };
    fetchData();
  }, [activeToggle, userId, monthlyMonth]);

  // No longer need to filter dailyData by month, as API returns filtered data
  const filteredDailyData = dailyData;

  const dailyGroupedEntries = useMemo(() => {
    if (!Object.keys(userInfoMap).length) return [];

    const groupedData = {};
    filteredDailyData.forEach((row) => {
      const key = row.user_id || "unknown";
      if (!groupedData[key]) {
        groupedData[key] = { user: row, rows: [] };
      }
      groupedData[key].rows.push(row);
    });

    Object.keys(userInfoMap).forEach((userId) => {
      if (!groupedData[userId]) {
        groupedData[userId] = { user: userInfoMap[userId], rows: [] };
      }
    });

    return Object.entries(groupedData).filter(([, { user }]) => {
      if (!searchQuery) return true;
      const userName = (user.user_name || "").toLowerCase();
      return userName.includes(searchQuery.toLowerCase());
    });
  }, [filteredDailyData, userInfoMap, searchQuery]);

  const dailyUserPagination = useClientPagination(dailyGroupedEntries, {
    resetKeys: [searchQuery, selectedTeam, dailyMonth],
  });

  // Export all daily data for a given user and month (from monthly report)

  const handleExportMonthDailyData = async (user, monthObj) => {
    try {
      const month_year = user.month_year || monthObj?.label + monthObj?.year;
      let payload = {
        month_year,
        user_id: user.user_id,
        logged_in_user_id: user.user_id, // fallback, but API may override
        device_id,
        device_type
      };
      // Set date_from and date_to for the month (inclusive)
      if (monthObj?.label && monthObj?.year) {
        const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const monthIdx = monthNames.indexOf(monthObj.label.toUpperCase());
        if (monthIdx !== -1) {
          const firstDay = new Date(Date.UTC(Number(monthObj.year), monthIdx, 1));
          const lastDay = new Date(Date.UTC(Number(monthObj.year), monthIdx + 1, 0, 23, 59, 59, 999));
          payload.date_from = firstDay.toISOString().slice(0, 10);
          payload.date_to = lastDay.toISOString().slice(0, 10);
        }
      }
      // Use the same API as daily report for consistency
      const res = await api.post('/tracker/view', payload);
      let dailyRows = Array.isArray(res.data?.data?.trackers) ? res.data.data.trackers : [];
      // Filter by date range (inclusive, by date only)
      if (payload.date_from && payload.date_to) {
        const fromStr = payload.date_from;
        const toStr = payload.date_to;
        dailyRows = dailyRows.filter(row => {
          const rowDate = row.date_time || row.date;
          if (!rowDate) return false;
          const dStr = new Date(rowDate).toISOString().slice(0, 10);
          return dStr >= fromStr && dStr <= toStr;
        });
      }
      if (!dailyRows.length) {
        toast.error('No daily data found for this user/month');
        return;
      }
      let exportData = dailyRows.map(row => {
        // Helper for formatting numbers
        const formatNum = (val) => {
          if (val === null || val === undefined || val === '') return '-';
          const num = Number(val);
          return isNaN(num) ? '-' : num.toFixed(2);
        };
        
        return {
          'Date-Time': row.date_time ?? row.date ?? '-',
          'Day Status': row.roster_status || row.day_status || '—',
          'Assigned Hour': formatNum(row.assigned_hours ?? row.assign_hours),
          'Worked Hours': formatNum(row.total_billable_hours_day ?? row.billable_hours),
          'QC Score': row.qc_score != null && row.qc_score !== '' ? `${formatNum(row.qc_score)}%` : '-',
          'Tracker Count': row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-',
          'Daily Required Hours': formatNum(row.daily_required_hours ?? row.tenure_target)
        };
      });
      // Add total row for countable columns
      if (exportData.length > 0) {
        const totalAssigned = exportData.reduce((sum, r) => sum + (parseFloat(r['Assigned Hour']) || 0), 0);
        const totalWorked = exportData.reduce((sum, r) => sum + (parseFloat(r['Worked Hours']) || 0), 0);
        const totalRequired = exportData.reduce((sum, r) => sum + (parseFloat(r['Daily Required Hours']) || 0), 0);
        // For QC Score, calculate average instead of sum
        const qcScores = exportData.map(r => parseFloat(r['QC Score'])).filter(v => !isNaN(v));
        const avgQC = qcScores.length > 0 ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%` : '-';
        const totalTrackers = exportData.reduce((sum, r) => {
          const count = r['Tracker Count'];
          return sum + (count !== '-' ? parseInt(count) : 0);
        }, 0);
        
        exportData.push({
          'Date-Time': 'TOTAL',
          'Day Status': '',
          'Assigned Hour': totalAssigned.toFixed(2),
          'Worked Hours': totalWorked.toFixed(2),
          'QC Score': avgQC,
          'Tracker Count': totalTrackers,
          'Daily Required Hours': totalRequired.toFixed(2)
        });
      }
      const filename = `Daily_Report_${user.user_name || 'User'}_${month_year}.csv`;
      exportToCSV(exportData, filename);
      toast.success(`Exported daily data for ${user.user_name || 'User'} (${month_year})!`);
    } catch {
      toast.error('Failed to export daily data for this user/month');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-white">Billable Report</h2>
          <p className="text-blue-100 text-sm mt-1">View daily and monthly billable hours and performance metrics</p>
        </div>

        {/* Tabs */}
        <SubTabsBar
          bordered
          equalWidth
          activeTab={activeToggle}
          onChange={setActiveToggle}
          tabs={[
            { id: 'daily', label: 'Daily Report', icon: Calendar },
            { id: 'monthly', label: 'Monthly Report', icon: FileText },
          ]}
        />
      {/* Daily Report view (user cards, QA agent side only) */}
      {activeToggle === 'daily' && (
        <div className="w-full max-w-7xl mx-auto mt-4">
          {/* Filter Section - Enhanced Design */}
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-5 mb-6">
            <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1">
              {/* Search Filter */}
              <div className="w-[260px] shrink-0">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  Search Agent
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by agent name..."
                  className="w-full h-11 px-4 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all hover:border-blue-400"
                />
              </div>

              <DateRangePicker
                startDate={dailyStart}
                endDate={dailyEnd}
                onStartDateChange={handleDailyStartChange}
                onEndDateChange={handleDailyEndChange}
                noWrapper
                showClearButton={false}
                fieldWidth="170px"
              />
              
              {/* Month Filter */}
              <div className="shrink-0">
                <MonthYearPicker
                  compact
                  label="Month"
                  selectedMonthYear={yyyyMmToMonthYear(dailyMonth)}
                  onMonthYearChange={handleDailyMonthChange}
                  showAllOption={false}
                />
              </div>
              
              {/* Team Filter (Admin, Super Admin, Project Manager only) */}
              {canViewTeamFilter && (
                <div className="w-[200px] shrink-0">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Team
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'all', label: 'All Teams' },
                      ...teams.map(team => ({ value: String(team.team_id), label: team.label }))
                    ]}
                    value={selectedTeam}
                    onChange={(val) => setSelectedTeam(val)}
                    placeholder={loadingTeams ? "Loading teams..." : "Select team"}
                    disabled={loadingTeams}
                  />
                </div>
              )}
              
              <div className="flex items-end gap-3 shrink-0 ml-auto">
                <button
                  onClick={() => {
                    const current = getCurrentYyyyMm();
                    const range = getMonthDateRange(current);
                    setSearchQuery('');
                    setDailyMonth(current);
                    setDailyStart(range.start);
                    setDailyEnd(range.end);
                    setSelectedTeam('all');
                  }}
                  className="h-11 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg px-5 transition-all shadow-sm hover:shadow-md group whitespace-nowrap"
                  type="button"
                >
                  <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                  Reset Filters
                </button>
                
                <button
                  className="h-11 inline-flex items-center gap-2 px-5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap"
                  onClick={handleExportAllUsers}
                  type="button"
                >
                  <Download className="w-4 h-4" />
                  Export All
                </button>
              </div>
            </div>
            
            {/* User Guidance Message */}
            {(dailyStart || dailyEnd) && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">
                      Date Range Filter Active
                    </p>
                    <p className="text-blue-700 mt-1">
                      Showing daily data from <span className="font-semibold">{dailyStart || '—'}</span> to <span className="font-semibold">{dailyEnd || '—'}</span>.
                      Change From / To, or pick another month, to update the report.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* User Cards for QA agent daily data, each with its own date range and export */}
          <div className="space-y-6">
            {loadingDaily ? (
              <div className="py-8 text-center text-blue-700 font-semibold">Loading daily report...</div>
            ) : errorDaily ? (
              <div className="py-8 text-center text-red-600 font-semibold">{errorDaily}</div>
            ) : dailyGroupedEntries.length > 0 ? (
              <>
                {dailyUserPagination.pagedItems.map(([userId, { user, rows }]) => (
                <UserCard
                  key={userId}
                  user={user}
                  team_name={user.team_name}
                  showTeam={canViewTeamFilter}
                  dailyData={(() => {
                    const mappedData = rows.map(r => {
                      // Format date as DD-MM-YYYY with day name, never show time
                      let date = '-';
                      if (r.work_date) {
                        const d = new Date(r.work_date);
                        if (!isNaN(d.getTime())) {
                          const pad = n => String(n).padStart(2, '0');
                          const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
                          // Use day from API response if available, otherwise format from date
                          const dayName = r.day || d.toLocaleDateString('en-US', { weekday: 'long' });
                          date = `${dateStr}\n${dayName}`;
                        }
                      }
                      // Map response fields to display format
                      let worked_hours = '-';
                      if (r.total_billable_hours_day !== null && r.total_billable_hours_day !== undefined && !isNaN(Number(r.total_billable_hours_day))) {
                        worked_hours = Number(r.total_billable_hours_day).toFixed(2);
                      }
                      let daily_required_hours = '-';
                      if (r.daily_required_hours !== null && r.daily_required_hours !== undefined && !isNaN(Number(r.daily_required_hours))) {
                        daily_required_hours = Number(r.daily_required_hours).toFixed(2);
                      }
                      // Get assigned_hours from API response
                      let assigned_hours = r.assigned_hours !== null && r.assigned_hours !== undefined ? r.assigned_hours : null;
                      // Get qc_score from API response
                      let qc_score = r.qc_score !== null && r.qc_score !== undefined ? r.qc_score : null;
                      // Get trackers_count_day from API response
                      let trackers_count_day = r.trackers_count_day !== null && r.trackers_count_day !== undefined ? r.trackers_count_day : null;
                      
                      return {
                        date,
                        date_time: date, // Also set date_time for compatibility
                        work_date: r.work_date, // Keep original work_date for filtering
                        day: r.day, // Pass day field for color styling
                        roster_status: r.roster_status || '—',
                        day_type: r.day_type,
                        assigned_hours, // Use actual value from API
                        assign_hours: assigned_hours, // Alternative field name
                        assignHours: assigned_hours, // Alternative field name
                        worked_hours,
                        workedHours: worked_hours, // Alternative field name
                        billable_hours: worked_hours, // Alternative field name
                        total_billable_hours_day: r.total_billable_hours_day, // Keep original field
                        qc_score, // Use actual value from API
                        qcScore: qc_score, // Alternative field name
                        trackers_count_day, // Tracker count from API
                        daily_required_hours,
                        dailyRequiredHours: daily_required_hours, // Alternative field name
                        tenure_target: r.daily_required_hours, // Alternative field name
                      };
                    });
                    return mappedData;
                  })()}
                  expanded={expandedCards[userId] === true}
                  onToggleExpand={(isExpanded) => {
                    setExpandedCards(prev => ({ ...prev, [userId]: isExpanded }));
                  }}
                  selectedMonth={dailyMonth}
                  rangeStart={dailyStart}
                  rangeEnd={dailyEnd}
                  formatDateTime={formatDateTime}
                  onRefresh={handleRefreshData}
                />
                ))}
                <TablePaginationBar {...dailyUserPagination} itemLabel="agents" />
              </>
            ) : (
              <div className="py-8 text-center text-gray-400">No data available</div>
            )}
          </div>
        </div>
      )}




      {/* Monthly Report view (month cards with user-wise table) */}
      {activeToggle === 'monthly' && (
        <div className="w-full max-w-7xl mx-auto mt-4">
          {/* Month/Year Filter Section */}
          <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 rounded-xl shadow-md border border-blue-200 p-6 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Month Filter */}
              <MonthYearPicker
                compact
                label="Select Month"
                selectedMonthYear={yyyyMmToMonthYear(monthlyMonth)}
                onMonthYearChange={(my) => {
                  const yyyyMm = monthYearToYyyyMm(my);
                  if (yyyyMm) setMonthlyMonth(yyyyMm);
                }}
                showAllOption={false}
              />

              {/* Reset Filters Button */}
              <button
                onClick={() => {
                  setMonthlyMonth(getCurrentYyyyMm());
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                title="Reset all filters"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Filters
              </button>
            </div>
          </div>
          {loadingMonthly ? (
            <div className="py-8 text-center text-blue-700 font-semibold">Loading monthly report...</div>
          ) : errorMonthly ? (
            <div className="py-8 text-center text-red-600 font-semibold">{errorMonthly}</div>
          ) : monthlySummaryData.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupByMonthYear(monthlySummaryData)).map(([month, users]) => (
                <MonthCard
                  key={month}
                  month={parseMonthYear(month)}
                  users={users}
                  onExport={(user) => handleExportMonthDailyData(user, parseMonthYear(month))}
                  onExportMonth={handleExportMonthTable}
                  hideTeamColumn={isAssistantManager}
                  teamOptions={teams}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">No monthly data available</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// Helper to group data by month_year (robust, with fallback)
function groupByMonthYear(data) {
  return data.reduce((acc, item) => {
    let key = item.month_year;
    if (!key || typeof key !== 'string' || !/^[A-Z]+\d{4}$/.test(key)) {
      // fallback: try to build from item.month and item.year, or use 'Unknown'
      key = (item.month && item.year) ? `${item.month.toUpperCase()}${item.year}` : 'Unknown';
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}


// Helper to parse month label and year from month_year string (e.g., JAN2026)
function parseMonthYear(monthYear) {
  if (!monthYear) return { label: '-', year: '-' };
  const match = monthYear.match(/^([A-Z]+)(\d{4})$/);
  if (match) {
    return { label: match[1], year: match[2] };
  }
  return { label: monthYear, year: '' };
}

export default BillableReport;
