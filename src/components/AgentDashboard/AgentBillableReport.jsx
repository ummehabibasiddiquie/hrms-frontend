import { exportToCSV } from '../../utils/csvExport';
import { toast } from "react-hot-toast";
import React, { useState, useEffect, useRef } from "react";
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import ErrorMessage from '../common/ErrorMessage';
import { fetchMonthlyBillableReport } from "../../services/billableReportService";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Download, Calendar as CalendarIcon, RotateCcw, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import AgentQCReportPage from '../../pages/AgentQCReportPage';
import UserCard from "../common/UserCard";
import MonthCard from "../common/MonthCard";
import { DateRangePicker } from "../common/CustomCalendar";



const BillableReport = () => {
  // Always call hooks at the top
  const { user } = useAuth();
  
  // Simple MonthPicker component for selecting month/year in YYYY-MM format
  const MonthPicker = ({ value, onChange }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [viewYear, setViewYear] = useState(() => {
      if (value) {
        const [year] = value.split('-');
        return parseInt(year);
      }
      return new Date().getFullYear();
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const handleMonthSelect = (monthIndex) => {
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const dateStr = `${viewYear}-${monthStr}`;
      onChange(dateStr);
      setShowPicker(false);
    };

    const selectedMonth = value ? parseInt(value.split('-')[1]) - 1 : -1;
    const selectedYear = value ? parseInt(value.split('-')[0]) : -1;

    const displayValue = value ? (() => {
      const [year, month] = value.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    })() : 'Select Month';

    return (
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-2">
          <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
          Month
        </label>
        <Popover open={showPicker} onOpenChange={setShowPicker}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-left flex items-center justify-between"
            >
              <span>{displayValue}</span>
              <ChevronDown className="w-4 h-4 text-blue-600" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] border-2 border-blue-200 bg-white p-4" align="start">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setViewYear(y => y - 1)}
                className="p-1.5 hover:bg-slate-100 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="font-bold text-sm text-slate-800">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear(y => y + 1)}
                className="p-1.5 hover:bg-slate-100 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {monthNames.map((month, index) => {
                const isSelected = selectedYear === viewYear && selectedMonth === index;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleMonthSelect(index)}
                    className={cn(
                      "text-sm p-2.5 rounded-lg transition-colors font-medium",
                      isSelected
                        ? "bg-blue-600 text-white font-bold"
                        : "text-slate-700 hover:bg-blue-100"
                    )}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };
  // Export the visible monthly report table (with filters applied)
  const handleExportMonthlyTable = () => {
      try {
        console.log('Exporting monthly data:', monthlySummaryData);
        
        if (monthlySummaryData.length === 0) {
          toast.error('No data to export');
          return;
        }
        
        const exportData = monthlySummaryData.map(row => {
          // Helper to format numbers safely
          const formatNum = (val) => {
            if (val === null || val === undefined || val === '') return '-';
            const num = Number(val);
            return isNaN(num) ? '-' : num.toFixed(2);
          };
          
          return {
            'Year & Month': row.month_year || '-',
            'Billable Hours Delivered': formatNum(row.total_billable_hours ?? row.total_billable_hours_month),
            'Monthly Goal': row.monthly_total_target ?? row.monthly_goal ?? '-',
            'Pending Target': formatNum(row.pending_target),
            'Avg. QC Score': row.avg_qc_score != null && row.avg_qc_score !== '' ? `${formatNum(row.avg_qc_score)}%` : '-',
          };
        });

        // Calculate totals
        const totalBillable = exportData.reduce((sum, r) => sum + (parseFloat(r['Billable Hours Delivered']) || 0), 0);
        const totalGoal = exportData.reduce((sum, r) => sum + (parseFloat(r['Monthly Goal']) || 0), 0);
        const totalPending = exportData.reduce((sum, r) => sum + (parseFloat(r['Pending Target']) || 0), 0);
        const qcScores = exportData.map(r => parseFloat(r['Avg. QC Score'])).filter(v => !isNaN(v));
        const avgQC = qcScores.length > 0 ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%` : '-';

        exportData.push({
          'Year & Month': 'TOTAL',
          'Billable Hours Delivered': totalBillable.toFixed(2),
          'Monthly Goal': totalGoal.toFixed(2),
          'Pending Target': totalPending.toFixed(2),
          'Avg. QC Score': avgQC,
        });

        const filename = 'Monthly_Report.csv';
        exportToCSV(exportData, filename);
        toast.success('Monthly report exported!');
      } catch (err) {
        const msg = getFriendlyErrorMessage(err);
        toast.error(msg);
      }
    };
  // Export to CSV for a single monthly summary row
  const handleExportMonthlyExcelRow = (row) => {
    try {
      const exportData = [{
        'Year & Month': row.month,
        'Billable Hours Delivered': row.delivered,
        'Monthly Goal': row.goal,
        'Pending Target': row.pending,
        'Avg. QC Score': row.qc != null && row.qc !== '-' ? `${row.qc}%` : '-',
      }];
      const filename = `Monthly_Summary_${row.month}.csv`;
      exportToCSV(exportData, filename);
      toast.success(`Exported ${row.month} summary!`);
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
    }
  };

  // Export daily report for a specific month-year from /tracker/view
  const handleExportMonthDailyExcel = async (monthYear) => {
    try {
      // Build payload directly and use the same daily report API
      const payload = {
        logged_in_user_id: user?.user_id,
        month_year: monthYear
      };
      const res = await api.post("/tracker/view_daily", payload);
      console.log('Export month daily API response:', res.data);
      
      // Access trackers the same way as daily report fetch
      let trackers = res.data?.data?.trackers;
      if (trackers && !Array.isArray(trackers)) trackers = [trackers];
      trackers = Array.isArray(trackers) ? trackers : [];
      
      if (trackers.length === 0) {
        toast.error('No data available for the selected month');
        return;
      }
      
      // Format and prepare export data
      const exportData = trackers.map(row => {
        let formattedDateTime = '';
        if (row.date_time) {
          const d = new Date(row.date_time);
          const pad = (n) => n.toString().padStart(2, '0');
          formattedDateTime = `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
        }
        return {
          'Date-Time': formattedDateTime,
          'Assign Hours': '-',
          'Worked Hours': row.billable_hours ? Number(row.billable_hours).toFixed(2) : '-',
          'QC score': 'qc_score' in row ? (row.qc_score !== null ? `${Number(row.qc_score).toFixed(2)}%` : '-') : '-',
          'Tracker Count': row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-',
          'Daily Required Hours': row.tenure_target ? Number(row.tenure_target).toFixed(2) : '-',
        };
      });
      // Calculate totals for countable columns
      const totalWorked = exportData.reduce((sum, r) => sum + (parseFloat(r['Worked Hours']) || 0), 0);
      const totalRequired = exportData.reduce((sum, r) => sum + (parseFloat(r['Daily Required Hours']) || 0), 0);
      const qcScores = exportData.map(r => parseFloat(r['QC score'])).filter(v => !isNaN(v));
      const avgQC = qcScores.length > 0 ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%` : '-';
      const totalTrackers = exportData.reduce((sum, r) => {
        const count = r['Tracker Count'];
        return sum + (count !== '-' ? parseInt(count) : 0);
      }, 0);
      exportData.push({
        'Date-Time': 'TOTAL',
        'Assign Hours': '-',
        'Worked Hours': totalWorked.toFixed(2),
        'QC score': avgQC,
        'Tracker Count': totalTrackers,
        'Daily Required Hours': totalRequired.toFixed(2),
      });
      const filename = `Month_Daily_Report_${monthYear}.csv`;
      exportToCSV(exportData, filename);
      toast.success('Month daily report exported!');
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
    }
  };

  // State for tab toggle (must be first hook)
  const [activeToggle, setActiveToggle] = useState('daily');

  // Persist tab selection to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agent_billable_active_tab', activeToggle);
    }
  }, [activeToggle]);
  
  // Helper function to get current month's first and last date
  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    return {
      start: formatDate(firstDay),
      end: formatDate(lastDay),
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    };
  };
  
  // State for date range filter - default to current month
  const [startDate, setStartDate] = useState(() => getCurrentMonthRange().start);
  const [endDate, setEndDate] = useState(() => getCurrentMonthRange().end);
  // State for month filter - default to current month
  const [monthFilter, setMonthFilter] = useState(() => getCurrentMonthRange().month);
  
  // Ref to track if we're updating dates from month filter to prevent infinite loop
  const isUpdatingFromMonthFilter = useRef(false);

  // State for API data, loading, and error
  const [dailyData, setDailyData] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [errorDaily, setErrorDaily] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});

  // Update date range when month filter changes
  useEffect(() => {
    if (monthFilter) {
      const [year, month] = monthFilter.split('-');
      const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
      const lastDay = new Date(parseInt(year), parseInt(month), 0);
      
      const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      isUpdatingFromMonthFilter.current = true;
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
      setTimeout(() => {
        isUpdatingFromMonthFilter.current = false;
      }, 0);
    }
  }, [monthFilter]);

  // Update month filter when start date changes (from date picker)
  useEffect(() => {
    if (startDate && !isUpdatingFromMonthFilter.current) {
      const [year, month] = startDate.split('-');
      const newMonthFilter = `${year}-${month}`;
      if (newMonthFilter !== monthFilter) {
        setMonthFilter(newMonthFilter);
      }
    }
  }, [startDate, monthFilter]);

  // Fetch daily report data from API on mount or when date range/month changes
  useEffect(() => {
    const fetchData = async () => {
      setLoadingDaily(true);
      setErrorDaily(null);
      try {
        // Build payload for API
        const payload = {
          logged_in_user_id: user?.user_id,
          ...(startDate && { date_from: startDate }),
          ...(endDate && { date_to: endDate }),
        };
        // Call the correct API endpoint
        const res = await api.post("/tracker/view_daily", payload);
        console.log('Daily report API response:', res.data);
        // Fix: Use trackers array from response
        let data = res.data?.data?.trackers;
        if (data && !Array.isArray(data)) data = [data];
        setDailyData(Array.isArray(data) ? data : []);
      } catch (err) {
        setErrorDaily(getFriendlyErrorMessage(err));
      } finally {
        setLoadingDaily(false);
      }
    };
    fetchData();
  }, [startDate, endDate, user]);

  // State for monthly report API data, loading, and error
  const [monthlySummaryData, setMonthlySummaryData] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [errorMonthly, setErrorMonthly] = useState(null);
  const [monthlyMonth, setMonthlyMonth] = useState(() => getCurrentMonthRange().month);

  // Fetch monthly report data from API when monthly tab is active or month filter changes
  useEffect(() => {
    if (activeToggle !== 'monthly') return;
    const fetchData = async () => {
      setLoadingMonthly(true);
      setErrorMonthly(null);
      try {
        let payload = {};
        if (user?.user_id) {
          payload.logged_in_user_id = user.user_id;
        }
        if (monthlyMonth) {
          // monthlyMonth is in format YYYY-MM
          const [year, month] = monthlyMonth.split('-');
          const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          const monthLabel = monthNames[Number(month) - 1];
          payload.month_year = `${monthLabel}${year}`;
        }
        // Use the fetchMonthlyBillableReport service function
        const res = await fetchMonthlyBillableReport(payload);
        console.log('Monthly report API response:', res);
        console.log('Monthly report data:', res.data);
        setMonthlySummaryData(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setErrorMonthly(getFriendlyErrorMessage(err));
      } finally {
        setLoadingMonthly(false);
      }
    };
    fetchData();
  }, [activeToggle, monthlyMonth, user]);

  // No need to filter here, as API returns filtered data
  const filteredDailyData = dailyData;

  const mapDailyRowsForCard = (rows) =>
    rows.map(r => {
      let date = '-';
      let dayName = r.day || '';
      if (r.work_date) {
        const d = new Date(r.work_date);
        if (!isNaN(d.getTime())) {
          const pad = n => String(n).padStart(2, '0');
          const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
          dayName = r.day || d.toLocaleDateString('en-US', { weekday: 'long' });
          date = `${dateStr}\n${dayName}`;
        }
      }
      const worked_hours = r.total_billable_hours_day != null && !isNaN(Number(r.total_billable_hours_day))
        ? Number(r.total_billable_hours_day).toFixed(2)
        : '-';
      const daily_required_hours = r.daily_required_hours != null && !isNaN(Number(r.daily_required_hours))
        ? Number(r.daily_required_hours).toFixed(2)
        : '-';
      const assigned_hours = r.assigned_hours != null ? r.assigned_hours : null;
      const qc_score = r.qc_score != null ? r.qc_score : null;
      const trackers_count_day = r.trackers_count_day != null ? r.trackers_count_day : null;

      return {
        date,
        date_time: date,
        work_date: r.work_date,
        day: dayName,
        assigned_hours,
        assign_hours: assigned_hours,
        assignHours: assigned_hours,
        worked_hours,
        workedHours: worked_hours,
        billable_hours: worked_hours,
        total_billable_hours_day: r.total_billable_hours_day,
        qc_score,
        qcScore: qc_score,
        trackers_count_day,
        daily_required_hours,
        dailyRequiredHours: daily_required_hours,
        tenure_target: r.daily_required_hours,
      };
    });

  const agentCardUser = dailyData[0]
    ? {
        user_id: dailyData[0].user_id,
        user_name: dailyData[0].user_name || user?.user_name,
        team_name: dailyData[0].team_name,
      }
    : {
        user_id: user?.user_id,
        user_name: user?.user_name,
        team_name: user?.team_name,
      };

  const agentCardId = String(agentCardUser.user_id || 'agent');

  // Export filtered daily data to Excel with totals
  const handleExportDailyExcel = () => {
    try {
      if (filteredDailyData.length === 0) {
        toast.error('No data to export');
        return;
      }
      
      // Format and prepare export data
      const exportData = filteredDailyData.map(row => {
        // Only show date part from work_date
        let formattedDate = '-';
        if (row.work_date) {
          const d = new Date(row.work_date);
          if (!isNaN(d)) {
            const pad = n => String(n).padStart(2, '0');
            formattedDate = `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
          }
        }
        return {
          'Date': formattedDate,
          'Assign Hours': row.assigned_hours != null ? Number(row.assigned_hours).toFixed(2) : '-',
          'Worked Hours': row.total_billable_hours_day != null ? Number(row.total_billable_hours_day).toFixed(2) : '-',
          'QC Score': row.qc_score != null ? `${Number(row.qc_score).toFixed(2)}%` : '-',
          'Tracker Count': row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-',
          'Daily Required Hours': row.daily_required_hours != null ? Number(row.daily_required_hours).toFixed(2) : '-',
        };
      });

      // Calculate totals
      const totalAssigned = exportData.reduce((sum, r) => sum + (parseFloat(r['Assign Hours']) || 0), 0);
      const totalWorked = exportData.reduce((sum, r) => sum + (parseFloat(r['Worked Hours']) || 0), 0);
      const totalRequired = exportData.reduce((sum, r) => sum + (parseFloat(r['Daily Required Hours']) || 0), 0);
      const qcScores = exportData.map(r => parseFloat(r['QC Score'])).filter(v => !isNaN(v));
      const avgQC = qcScores.length > 0 ? `${(qcScores.reduce((a, b) => a + b, 0) / qcScores.length).toFixed(2)}%` : '-';
      const totalTrackers = exportData.reduce((sum, r) => {
        const count = r['Tracker Count'];
        return sum + (count !== '-' ? parseInt(count) : 0);
      }, 0);

      // Add totals row
      exportData.push({
        'Date': 'TOTAL',
        'Assign Hours': totalAssigned.toFixed(2),
        'Worked Hours': totalWorked.toFixed(2),
        'QC Score': avgQC,
        'Tracker Count': totalTrackers,
        'Daily Required Hours': totalRequired.toFixed(2),
      });

      const filename = 'Daily_Report.csv';
      exportToCSV(exportData, filename);
      toast.success('Daily report exported!');
    } catch {
      toast.error('Failed to export daily report');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-white">Billable Report</h2>
          <p className="text-blue-100 text-sm mt-1">View daily and monthly billable hours and performance metrics</p>
        </div>

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
            <button
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 border-2 ${activeToggle === 'qc' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md border-blue-700' : 'text-blue-700 hover:bg-blue-50 border-blue-200 hover:border-blue-400'}`}
              onClick={() => setActiveToggle('qc')}
            >
              QC Report
            </button>
          </div>
        </div>

      {activeToggle === 'daily' && (
        <div className="w-full max-w-7xl mx-auto mt-4">
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="relative">
                <MonthPicker
                  value={monthFilter}
                  onChange={setMonthFilter}
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  Date Range
                </label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  label=""
                  description={null}
                  showClearButton={false}
                  compact={true}
                  fieldWidth="180px"
                  noWrapper={true}
                  disabledMonths={monthFilter ? [monthFilter] : null}
                  showOnlySelectedMonth={true}
                />
              </div>

              <button
                onClick={() => {
                  const currentMonth = getCurrentMonthRange();
                  setStartDate(currentMonth.start);
                  setEndDate(currentMonth.end);
                  setMonthFilter(currentMonth.month);
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg px-6 py-2.5 transition-all shadow-sm hover:shadow-md group"
                type="button"
              >
                <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                Reset Filters
              </button>

              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                onClick={handleExportDailyExcel}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {loadingDaily ? (
              <div className="py-8 text-center text-blue-700 font-semibold">Loading daily report...</div>
            ) : errorDaily ? (
              <div className="p-6">
                <ErrorMessage message={errorDaily} />
              </div>
            ) : (
              <UserCard
                key={agentCardId}
                user={agentCardUser}
                team_name={agentCardUser.team_name}
                showTeam={false}
                dailyData={mapDailyRowsForCard(filteredDailyData)}
                expanded={expandedCards[agentCardId] !== false}
                onToggleExpand={(isExpanded) => {
                  setExpandedCards(prev => ({ ...prev, [agentCardId]: isExpanded }));
                }}
                selectedMonth={monthFilter}
                rangeStart={startDate}
                rangeEnd={endDate}
                formatDateTime={(dateInput) => dateInput || '-'}
                onRefresh={() => {}}
              />
            )}
          </div>
        </div>
      )}

      {activeToggle === 'monthly' && (
        <div className="w-full max-w-7xl mx-auto mt-4">
          <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 rounded-xl shadow-md border border-blue-200 p-6 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-2">
                <MonthPicker
                  value={monthlyMonth}
                  onChange={setMonthlyMonth}
                />
              </div>

              <button
                onClick={() => setMonthlyMonth(getCurrentMonthRange().month)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                title="Reset all filters"
                type="button"
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
                  users={users.map(u => ({
                    ...u,
                    user_name: u.user_name || user?.user_name,
                    team_name: u.team_name || user?.team_name,
                    total_billable_hours: u.total_billable_hours ?? u.total_billable_hours_month,
                    monthly_total_target: u.monthly_total_target ?? u.monthly_goal,
                  }))}
                  onExport={(rowUser) => handleExportMonthDailyExcel(rowUser.month_year || month)}
                  onExportMonth={handleExportMonthlyTable}
                  hideTeamColumn={true}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">No monthly data available</div>
          )}
        </div>
      )}

      {activeToggle === 'qc' && (
        <AgentQCReportPage />
      )}
      </div>
    </div>
  );
};

function groupByMonthYear(data) {
  return data.reduce((acc, item) => {
    let key = item.month_year;
    if (!key || typeof key !== 'string' || !/^[A-Z]+\d{4}$/.test(key)) {
      key = (item.month && item.year) ? `${item.month.toUpperCase()}${item.year}` : 'Unknown';
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function parseMonthYear(monthYear) {
  if (!monthYear) return { label: '-', year: '-' };
  const match = monthYear.match(/^([A-Z]+)(\d{4})$/);
  if (match) {
    return { label: match[1], year: match[2] };
  }
  return { label: monthYear, year: '' };
}

export default BillableReport;