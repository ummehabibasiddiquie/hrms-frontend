import { useRef } from "react";
import { exportToCSV } from '../../utils/csvExport';
import { toast } from "react-hot-toast";
import React, { useState, useEffect } from "react";
import { fetchDropdown } from "../../services/dropdownService";
import { useAuth } from "../../context/AuthContext";
import MonthCard from "./MonthCard";
import UserCard from "./UserCard";
import SearchableSelect from "./SearchableSelect";
import { fetchMonthlyBillableReport } from "../../services/billableReportService";
import api from "../../services/api";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { Users, Calendar, Download, RotateCcw } from "lucide-react";
import { Calendar as CalendarComponent } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";

const BillableReport = ({ userId }) => {
  // Device info (declare once at top)
  const { device_id, device_type } = useDeviceInfo();

  // Helper to format date/time for display and export
  // Always return raw backend string for date/time
  function formatDateTime(dateInput) {
    if (!dateInput) return '-';
    return dateInput;
  }

  // Search filter state (client-side filtering by agent name)
  const [searchQuery, setSearchQuery] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showMonthlyMonthPicker, setShowMonthlyMonthPicker] = useState(false);

  // Team filter state
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Refs for pickers
  const monthPickerRef = useRef(null);
  const monthlyMonthPickerRef = useRef(null);

  // Close pickers on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (showMonthPicker && monthPickerRef.current && !monthPickerRef.current.contains(event.target)) {
        setShowMonthPicker(false);
      }
      if (showMonthlyMonthPicker && monthlyMonthPickerRef.current && !monthlyMonthPickerRef.current.contains(event.target)) {
        setShowMonthlyMonthPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPicker, showMonthlyMonthPicker]);
  const { user } = useAuth();

  // Check if user is Assistant Manager
  const isAssistantManager = user?.role_id === 4 || 
    (user?.role_name || user?.role || '').toLowerCase().includes('assistant');

  // Check if user can view team filter (Admin, Super Admin, Project Manager)
  const isAdmin = user?.role_id === 1;
  const isSuperAdmin = (user?.role_name || user?.role || '').toLowerCase().includes('super');
  const isProjectManager = user?.role_id === 3;
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


  // State for tab toggle (must be first hook)
  const [activeToggle, setActiveToggle] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('billable_active_tab') || 'daily';
    }
    return 'daily';
  });

  // Persist tab selection to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('billable_active_tab', activeToggle);
    }
  }, [activeToggle]);
  // (Date range filter removed)
  // Helper function to get current month in YYYY-MM format
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  // State for month filter (monthly) - default to current month
  const [monthlyMonth, setMonthlyMonth] = useState(getCurrentMonth());
  // State for month filter (daily report) - default to current month
  const [dailyMonth, setDailyMonth] = useState(getCurrentMonth());

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

  // Reset user map when month filter changes (not for search query changes)
  React.useEffect(() => {
    setUserInfoMap({});
  }, [dailyMonth]);

  // Helper to get YYYY-MM-DD string
  const getDateString = (date) => date.toISOString().slice(0, 10);

  // Track if this is a date-only filter change (to avoid showing loading spinner)
  const prevFiltersRef = React.useRef({ dailyMonth });

  React.useEffect(() => {
    const prev = prevFiltersRef.current;
    // Check if month changed
    if (prev.dailyMonth !== dailyMonth) {
      prevFiltersRef.current = { dailyMonth };
    }
  }, [dailyMonth]);

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
        // Month filter
        if (dailyMonth) {
          const [year, month] = dailyMonth.split('-');
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
        // Call the /tracker/view_daily API
        const res = await api.post('/tracker/view_daily', payload);
        console.log('Daily report API response:', res.data);
        console.log('Payload sent:', payload);
        // Get trackers from API response
        let trackers = Array.isArray(res.data?.data?.trackers) ? res.data.data.trackers : [];
        console.log('Trackers extracted:', trackers);
        
        // Store user information for all users (persists across date filter changes)
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
  }, [userId, dailyMonth, selectedTeam, refreshTrigger]);

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

  // Removed unused handleExportDailyExcel and related code

  // Month-Year Picker Component (Only Month/Year Selection - No Dates)
  const MonthPickerComponent = ({ value, onChange, show, onClose }) => {
    const [viewYear, setViewYear] = useState(() => {
      if (value) {
        const [year] = value.split('-');
        return parseInt(year);
      }
      return new Date().getFullYear();
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const handlePrevYear = () => setViewYear(viewYear - 1);
    const handleNextYear = () => {
      if (viewYear < currentYear) {
        setViewYear(viewYear + 1);
      }
    };

    const handleYearChange = (e) => {
      setViewYear(parseInt(e.target.value));
    };

    const handleMonthSelect = (monthIndex) => {
      // Check if selecting a future month
      const isFutureMonth = viewYear > currentYear || (viewYear === currentYear && monthIndex > currentMonth);
      if (isFutureMonth) return;
      
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      onChange(`${viewYear}-${monthStr}`);
      onClose();
    };

    if (!show) return null;

    const [selectedYear, selectedMonth] = value ? value.split('-').map(Number) : [null, null];

    // Generate year options (current year - 10 to current year)
    const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 10 + i);

    return (
      <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-2xl border-2 border-blue-300 p-3 w-64">
        {/* Year Header with Navigation and Dropdown */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-blue-100 gap-2">
          <button 
            onClick={handlePrevYear} 
            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
            title="Previous Year"
            type="button"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Year Dropdown */}
          <select
            value={viewYear}
            onChange={handleYearChange}
            className="flex-1 px-2 py-1.5 text-sm font-bold text-slate-800 bg-blue-50 border-2 border-blue-300 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer text-center"
          >
            {yearOptions.map((y) => {
              const isYearDisabled = y > currentYear;
              return (
                <option key={y} value={y} disabled={isYearDisabled}>
                  {y}
                </option>
              );
            })}
          </select>
          
          <button 
            onClick={handleNextYear}
            disabled={viewYear >= currentYear}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              viewYear >= currentYear 
                ? 'opacity-50 cursor-not-allowed bg-slate-100' 
                : 'hover:bg-blue-50'
            }`}
            title={viewYear >= currentYear ? "Cannot select future dates" : "Next Year"}
            type="button"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Month Grid - 3 columns */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {monthNames.map((month, index) => {
            const isSelected = selectedYear === viewYear && selectedMonth === index + 1;
            const isCurrent = viewYear === currentYear && index === currentMonth;
            const isFutureMonth = viewYear > currentYear || (viewYear === currentYear && index > currentMonth);
            
            return (
              <button
                key={month}
                type="button"
                onClick={() => handleMonthSelect(index)}
                disabled={isFutureMonth}
                className={`text-xs py-2 px-1.5 rounded-lg font-bold transition-all ${
                  isFutureMonth
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : isSelected 
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg scale-105' 
                      : isCurrent
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-400 hover:bg-blue-200 shadow-sm'
                        : 'bg-blue-50 text-slate-700 hover:bg-blue-100 border-2 border-blue-200 hover:border-blue-400 hover:shadow-md'
                }`}
              >
                {month}
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <button 
          type="button"
          onClick={onClose}
          className="w-full px-3 py-2 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-all border-2 border-slate-300 shadow-sm hover:shadow-md"
        >
          Close
        </button>
      </div>
    );
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
        <div className="bg-white rounded-xl shadow-md border-2 border-blue-100 p-6">
          <div className="flex items-center gap-2">
            <button
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 border-2 ${activeToggle === 'daily' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md border-blue-700' : 'text-blue-700 hover:bg-blue-50 border-blue-200 hover:border-blue-400'}`}
              onClick={() => setActiveToggle('daily')}
            >
              Daily Report
            </button>
            <button
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 border-2 ${activeToggle === 'monthly' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md border-blue-700' : 'text-blue-700 hover:bg-blue-50 border-blue-200 hover:border-blue-400'}`}
              onClick={() => setActiveToggle('monthly')}
            >
              Monthly Report
            </button>
          </div>
        </div>
      {/* Daily Report view (user cards, QA agent side only) */}
      {activeToggle === 'daily' && (
        <div className="w-full max-w-7xl mx-auto mt-4">
          {/* Filter Section - Enhanced Design */}
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Search Filter */}
              <div className="relative w-96">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  Search Agent
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by agent name..."
                  className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all hover:border-blue-400"
                />
              </div>
              
              {/* Month Filter */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Month
                </label>
                <div className="relative" ref={monthPickerRef}>
                  <input
                    type="text"
                    value={dailyMonth ? (() => {
                      const [year, month] = dailyMonth.split('-');
                      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                      return `${monthNames[parseInt(month) - 1]} ${year}`;
                    })() : ''}
                    readOnly
                    className="w-full px-4 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all min-w-[160px] cursor-pointer"
                    placeholder="Select month"
                    onClick={() => setShowMonthPicker(!showMonthPicker)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMonthPicker(!showMonthPicker)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-blue-100 rounded transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </button>
                  <MonthPickerComponent
                    value={dailyMonth}
                    onChange={(val) => setDailyMonth(val)}
                    show={showMonthPicker}
                    onClose={() => setShowMonthPicker(false)}
                  />
                </div>
              </div>
              
              {/* Team Filter (Admin, Super Admin, Project Manager only) */}
              {canViewTeamFilter && (
                <div className="relative w-[220px]">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Team
                  </label>
                  <SearchableSelect
                    options={(() => {
                      const opts = [
                        { value: 'all', label: 'All Teams' },
                        ...teams.map(team => ({ value: String(team.team_id), label: team.label }))
                      ];
                      console.log('SearchableSelect options:', opts);
                      console.log('teams state:', teams);
                      return opts;
                    })()}
                    value={selectedTeam}
                    onChange={(val) => setSelectedTeam(val)}
                    placeholder={loadingTeams ? "Loading teams..." : "Select team"}
                    disabled={loadingTeams}
                  />
                </div>
              )}
              
              {/* Reset Filters Button */}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDailyMonth(getCurrentMonth());
                  setSelectedTeam('all');
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg px-6 py-2.5 transition-all shadow-sm hover:shadow-md group"
                type="button"
              >
                <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                Reset Filters
              </button>
              
              {/* Export All Button */}
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                onClick={handleExportAllUsers}
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            </div>
          </div>
          {/* User Cards for QA agent daily data, each with its own date range and export */}
          <div className="space-y-6">
            {loadingDaily ? (
              <div className="py-8 text-center text-blue-700 font-semibold">Loading daily report...</div>
            ) : errorDaily ? (
              <div className="py-8 text-center text-red-600 font-semibold">{errorDaily}</div>
            ) : Object.keys(userInfoMap).length > 0 ? (
              // Show cards for all users that have ever appeared
              (() => {
                // First, group current data by user_id
                const groupedData = {};
                
                filteredDailyData.forEach(row => {
                  const key = row.user_id || 'unknown';
                  if (!groupedData[key]) {
                    groupedData[key] = { user: row, rows: [] };
                  }
                  groupedData[key].rows.push(row);
                });

                // Then, ensure ALL stored users have an entry (even if no data for current date range)
                Object.keys(userInfoMap).forEach(userId => {
                  const userInfo = userInfoMap[userId];
                  
                  if (!groupedData[userId]) {
                    // User has no data for current date range, but keep card visible
                    groupedData[userId] = { user: userInfo, rows: [] };
                  }
                });

                // Apply client-side search filter by agent name
                const filteredGroupedData = Object.entries(groupedData).filter(([userId, { user }]) => {
                  if (!searchQuery) return true; // No search query, show all
                  const userName = (user.user_name || '').toLowerCase();
                  const query = searchQuery.toLowerCase();
                  return userName.includes(query);
                });

                return filteredGroupedData.map(([userId, { user, rows }]) => (
                <UserCard
                  key={userId}
                  user={user}
                  team_name={user.team_name}
                  showTeam={canViewTeamFilter}
                  dailyData={(() => {
                    const mappedData = rows.map(r => {
                      // Format date as DD-MM-YYYY, never show time
                      let date = '-';
                      if (r.work_date) {
                        const d = new Date(r.work_date);
                        if (!isNaN(d.getTime())) {
                          const pad = n => String(n).padStart(2, '0');
                          date = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
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
                    console.log('Mapped data for UserCard:', mappedData);
                    return mappedData;
                  })()}
                  expanded={expandedCards[userId] === true}
                  onToggleExpand={(isExpanded) => {
                    setExpandedCards(prev => ({ ...prev, [userId]: isExpanded }));
                  }}
                  selectedMonth={dailyMonth}
                  formatDateTime={formatDateTime}
                  onRefresh={handleRefreshData}
                />
                ));
              })()
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
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Select Month
                </label>
                <div className="relative" ref={monthlyMonthPickerRef}>
                  <button
                    onClick={() => setShowMonthlyMonthPicker(!showMonthlyMonthPicker)}
                    className="w-48 px-4 py-2.5 bg-white border-2 border-blue-300 rounded-lg text-sm font-semibold text-slate-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all shadow-sm flex items-center justify-between"
                  >
                    <span>{monthlyMonth ? (() => {
                      const [year, month] = monthlyMonth.split('-');
                      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                      return `${monthNames[parseInt(month) - 1]} ${year}`;
                    })() : 'All Months'}</span>
                    <Calendar className="w-4 h-4" />
                  </button>
                  <MonthPickerComponent
                    value={monthlyMonth}
                    onChange={(val) => setMonthlyMonth(val)}
                    show={showMonthlyMonthPicker}
                    onClose={() => setShowMonthlyMonthPicker(false)}
                  />
                </div>
              </div>

              {/* Reset Filters Button */}
              <button
                onClick={() => {
                  setMonthlyMonth(getCurrentMonth());
                  setShowMonthlyMonthPicker(false);
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