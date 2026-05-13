// ...existing imports...
import { exportToCSV } from '../../utils/csvExport';
import { toast } from "react-hot-toast";
import React, { useState, useEffect, useRef } from "react";
import { getFriendlyErrorMessage } from '../../utils/errorMessages';
import ErrorMessage from '../common/ErrorMessage';
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);
import { fetchDailyBillableReport, fetchMonthlyBillableReport } from "../../services/billableReportService";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { Download, Calendar as CalendarIcon, FileSpreadsheet, X, RotateCcw, ChevronDown, FileText, BarChart3, Award } from "lucide-react";
import { DateRangePicker } from '../common/CustomCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import AgentQCReportPage from '../../pages/AgentQCReportPage';



const BillableReport = () => {
  // Always call hooks at the top
  const { user } = useAuth();
  
  // Helper function to get QC score color classes
  const getQCScoreColorClass = (score) => {
    if (score === null || score === undefined || score === '-' || isNaN(Number(score))) return 'text-slate-700';
    const numScore = Number(score);
    if (numScore >= 98) return 'text-green-800 bg-green-100 font-bold';
    if (numScore >= 95) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  // Helper function to get tracker count color classes
  const getTrackerCountColorClass = (count) => {
    if (count === null || count === undefined || count === '-' || isNaN(Number(count))) return 'text-slate-700';
    const numCount = Number(count);
    if (numCount >= 9) return 'text-green-800 bg-green-100 font-bold';
    if (numCount >= 7) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };
  
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
      // Build payload directly and use axios to match the daily report fetch pattern
      const payload = {
        logged_in_user_id: user?.user_id,
        month_year: monthYear
      };
      const res = await axios.post("/python/tracker/view_daily", payload);
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
        const res = await axios.post("/python/tracker/view_daily", payload);
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
    <div className="max-w-7xl mx-auto py-6 px-2 sm:px-4">
      {/* Tabs Navigation - Match QA Agent List Style */}
      <div className="bg-white rounded-2xl shadow-lg mb-6 border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveToggle('daily')}
            className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
              activeToggle === 'daily'
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Daily Billable Report</span>
            </div>
            {activeToggle === 'daily' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveToggle('monthly')}
            className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
              activeToggle === 'monthly'
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Monthly Billable Report</span>
            </div>
            {activeToggle === 'monthly' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveToggle('qc')}
            className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
              activeToggle === 'qc'
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Award className="w-4 h-4" />
              <span>QC Report</span>
            </div>
            {activeToggle === 'qc' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            )}
          </button>
        </div>
      </div>
      {/* Daily Report view (table, filter, export) */}
      {activeToggle === 'daily' && (
        <div className="w-full max-w-7xl mx-auto">
          {/* Filter Section - Enhanced Design */}
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6 mb-6">
            <div className="flex flex-col gap-4">
              {/* Filter Row */}
              <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                {/* Date Range Section */}
                <div className="flex-1">
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    noWrapper={true}
                    showClearButton={false}
                  />
                </div>
                
                {/* Month Filter */}
                <div className="flex-1 lg:flex-none lg:w-48">
                  <MonthPicker
                    value={monthFilter}
                    onChange={setMonthFilter}
                  />
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-end gap-3">
                  <button
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 group"
                    onClick={() => {
                      const currentMonth = getCurrentMonthRange();
                      setStartDate(currentMonth.start);
                      setEndDate(currentMonth.end);
                      setMonthFilter(currentMonth.month);
                    }}
                    type="button"
                  >
                    <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                    Reset Filters
                  </button>
                  
                  <button
                    onClick={handleExportDailyExcel}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                    title="Export filtered data to CSV"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Daily Report Table - Enhanced Design */}
          <div className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden">
            {loadingDaily ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
                <p className="text-blue-700 font-semibold">Loading daily report...</p>
              </div>
            ) : errorDaily ? (
              <div className="p-6">
                <ErrorMessage message={errorDaily} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-blue-100">
                  <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Assign Hours</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Worked Hours</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">QC Score</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Tracker Count</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Daily Required Hours</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-blue-50">
                    {filteredDailyData.length > 0 ? (
                      <>
                        {filteredDailyData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors duration-150">
                            {/* Show only date part from work_date */}
                            <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">{
                              (() => {
                                if (row.work_date) {
                                  const d = new Date(row.work_date);
                                  if (!isNaN(d)) {
                                    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                                    const day = d.getUTCDate();
                                    const month = monthNames[d.getUTCMonth()];
                                    const year = d.getUTCFullYear();
                                    return `${day}/${month}/${year}`;
                                  }
                                }
                                return '-';
                              })()
                            }</td>
                            <td className="px-6 py-4 text-center text-gray-900 font-medium">{
                              row.assigned_hours != null
                                ? Number(row.assigned_hours).toFixed(2)
                                : '-'
                            }</td>
                            <td className="px-6 py-4 text-center text-gray-900 font-semibold">{
                              row.total_billable_hours_day != null
                                ? Number(row.total_billable_hours_day).toFixed(2)
                                : '-'
                            }</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 rounded-lg inline-block ${getQCScoreColorClass(row.qc_score)}`}>
                                {row.qc_score != null ? `${Number(row.qc_score).toFixed(2)}%` : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 rounded-lg inline-block ${getTrackerCountColorClass(row.trackers_count_day)}`}>
                                {row.trackers_count_day !== null && row.trackers_count_day !== undefined ? row.trackers_count_day : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-gray-900 font-medium">{
                              row.daily_required_hours != null
                                ? Number(row.daily_required_hours).toFixed(2)
                                : '-'
                            }</td>
                          </tr>
                        ))}
                        {/* Totals Row */}
                        <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-t-2 border-blue-300">
                          <td className="px-6 py-4 text-gray-900 font-bold whitespace-nowrap">TOTAL</td>
                          <td className="px-6 py-4 text-center text-gray-900 font-bold">
                            {filteredDailyData.reduce((sum, row) => sum + (Number(row.assigned_hours) || 0), 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-900 font-bold">
                            {filteredDailyData.reduce((sum, row) => sum + (Number(row.total_billable_hours_day) || 0), 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-900 font-bold">
                            {(() => {
                              const scores = filteredDailyData.filter(row => row.qc_score != null).map(row => Number(row.qc_score));
                              return scores.length > 0 ? `${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)}%` : '-';
                            })()}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-900 font-bold">
                            {filteredDailyData.reduce((sum, row) => sum + (Number(row.trackers_count_day) || 0), 0)}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-900 font-bold">
                            {filteredDailyData.reduce((sum, row) => sum + (Number(row.daily_required_hours) || 0), 0).toFixed(2)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="font-medium">No data available</p>
                          <p className="text-xs mt-1">Try adjusting your filters</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly Report view (summary table, per-row export) */}
      {activeToggle === 'monthly' && (
        <div className="w-full max-w-7xl mx-auto">
          {/* Filter Section - Enhanced Design */}
          <div className="bg-white rounded-xl shadow-md border border-blue-100 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Month Filter */}
              <div className="flex-1 sm:flex-none sm:w-64">
                <MonthPicker
                  value={monthlyMonth}
                  onChange={setMonthlyMonth}
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-end gap-3">
                <button
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 group"
                  onClick={() => setMonthlyMonth(getCurrentMonthRange().month)}
                  type="button"
                >
                  <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                  Reset Filters
                </button>
                
                <button
                  onClick={handleExportMonthlyTable}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          </div>
          {/* Monthly Report Table - Enhanced Design */}
          <div className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden">
            {loadingMonthly ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
                <p className="text-blue-700 font-semibold">Loading monthly report...</p>
              </div>
            ) : errorMonthly ? (
              <div className="p-6">
                <div className="py-8 text-center text-red-600 font-semibold">{errorMonthly}</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-blue-100">
                  <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Year & Month</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Billable Hours Delivered</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Monthly Goal</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Pending Target</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Avg. QC Score</th>
                      {/* <th className="px-6 py-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Actions</th> */}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-blue-50">
                    {monthlySummaryData.length > 0 ? (
                      monthlySummaryData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors duration-150">
                          <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">{row.month_year}</td>
                          <td className="px-6 py-4 text-center text-gray-900 font-semibold">{row.total_billable_hours ? Number(row.total_billable_hours).toFixed(2) : (row.total_billable_hours_month ? Number(row.total_billable_hours_month).toFixed(2) : '-')}</td>
                          <td className="px-6 py-4 text-center text-gray-900 font-medium">{row.monthly_total_target ?? row.monthly_goal}</td>
                          <td className="px-6 py-4 text-center text-gray-900 font-medium">{row.pending_target ? Number(row.pending_target).toFixed(2) : '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-lg inline-block ${getQCScoreColorClass(row.avg_qc_score)}`}>
                              {row.avg_qc_score != null && row.avg_qc_score !== '-' ? `${Number(row.avg_qc_score).toFixed(2)}%` : '-'}
                            </span>
                          </td>
                          {/* <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleExportMonthDailyExcel(row.month_year)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                              title={`Export daily report for ${row.month_year}`}
                            >
                              <Download className="w-4 h-4" />
                              <span>Export</span>
                            </button>
                          </td> */}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="font-medium">No data available</p>
                          <p className="text-xs mt-1">Try adjusting your filters</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QC Report view */}
      {activeToggle === 'qc' && (
        <AgentQCReportPage />
      )}
    </div>
  );
};

export default BillableReport;