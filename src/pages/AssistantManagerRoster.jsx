/**
 * File: AssistantManagerRoster.jsx
 * Author: Naitik Maisuriya
 * Description: Assistant Manager Roster Management - Weekly View with Editing
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  Grid3X3,
  CheckSquare,
  Sun,
  Moon,
  Clock,
  Home,
  Star
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isWeekend, addWeeks, subWeeks, startOfMonth, endOfMonth, eachWeekOfInterval } from "date-fns";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const AssistantManagerRoster = () => {
  const navigate = useNavigate();
  
  // Get logged-in user
  const { user } = useAuth();
  const loggedInUserId = user?.user_id || user?.id;
  
  // State management
  const [loading, setLoading] = useState(false);
  const [rosterData, setRosterData] = useState([]);
  const [teams, setTeams] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [changedCells, setChangedCells] = useState([]);
  const [originalRosterData, setOriginalRosterData] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]); // From API
  const [rosterStatusOptions, setRosterStatusOptions] = useState([]); // From API dropdown/get "roster status"
  const isFetchingRef = useRef(false); // Prevent duplicate API calls

  // Status options - populated from API leave types
  const [statusOptions, setStatusOptions] = useState([]);
  
  // Planned/Unplanned options
  const plannedOptions = [
    { value: 1, label: 'Planned' },
    { value: 0, label: 'Unplanned' }
  ];

  // Shift options for display - raw API shift values
  const shiftOptions = [
    { value: 'day', label: 'Day', icon: <Sun className="w-3 h-3" /> },
    { value: 'night', label: 'Night', icon: <Moon className="w-3 h-3" /> },
    { value: 'general', label: 'General', icon: <Clock className="w-3 h-3" /> },
  ];
  
  // Raw API shift options
  const rawShiftOptions = [
    { value: 'day', label: 'Day' },
    { value: 'night', label: 'Night' },
    { value: 'general', label: 'General' }
  ];

  // Get all weeks in current month (weeks starting on Monday)
  const getWeeksInMonth = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    // Use weekStartsOn: 1 to get weeks starting on Monday
    return eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
  };

  // Get current week data
  const getCurrentWeek = () => {
    const weeks = getWeeksInMonth();
    return weeks[currentWeekIndex] || weeks[0];
  };

  // Get days for current week
  const getWeekDays = () => {
    const currentWeek = getCurrentWeek();
    if (!currentWeek) return [];
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const end = endOfWeek(currentWeek, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  // Filter roster data
  const filteredRosterData = rosterData.filter(roster => {
    const matchesSearch = !searchTerm || 
      roster.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roster.user_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = !selectedTeam || String(roster.team_id) === selectedTeam;
    return matchesSearch && matchesTeam;
  });

  // Handle cell editing
  const handleCellClick = (rosterId, day, field) => {
    console.log('Cell clicked:', { rosterId, day, field });
    setEditingCell({ rosterId, day, field });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  // Handle click outside to close editing mode
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editingCell) {
        // Check if click is outside any editing cell
        const activeCell = document.querySelector('[data-editing-cell="true"]');
        // Also check if click is on a Select dropdown (radix-select-viewport)
        const isSelectDropdown = event.target.closest('[data-radix-select-viewport]') || 
                                  event.target.closest('[data-radix-popper-content-wrapper]') ||
                                  event.target.closest('[role="listbox"]');
        if (activeCell && !activeCell.contains(event.target) && !isSelectDropdown) {
          setEditingCell(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCell]);

  // Handle cell value changes
  const handleCellChange = (rosterId, day, field, value) => {
    const updatedRoster = rosterData.map(roster => {
      if (roster.roster_id === rosterId) {
        const updatedRoster = { ...roster };
        if (!updatedRoster[day]) {
          updatedRoster[day] = {};
        }
        updatedRoster[day][field] = value;
        
        // Track changes
        const changeKey = `${rosterId}-${day}-${field}`;
        const originalValue = originalRosterData.find(r => r.roster_id === rosterId)?.[day]?.[field];
        
        if (originalValue !== value) {
          setChangedCells(prev => {
            const existing = prev.findIndex(c => c.rosterId === rosterId && c.day === day && c.field === field);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { rosterId, day, field, value, originalValue };
              return updated;
            } else {
              return [...prev, { rosterId, day, field, value, originalValue }];
            }
          });
          setHasChanges(true);
        }
        
        return updatedRoster;
      }
      return roster;
    });
    
    setRosterData(updatedRoster);
  };

  // Week navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeekIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextWeek = () => {
    const weeks = getWeeksInMonth();
    setCurrentWeekIndex(prev => Math.min(weeks.length - 1, prev + 1));
  };

  const goToWeek = (index) => {
    setCurrentWeekIndex(index);
  };

  // Check if it's mid-month submission
  const isMidMonthSubmission = () => {
    const today = new Date();
    const currentMonthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    return currentDay < currentMonthDays - 3; // Allow 3 days before month end for final submission
  };

  // Get submission mode
  const getSubmissionMode = () => {
    if (changedCells.length === 0) return 'no_changes';
    if (isMidMonthSubmission()) return 'mid_month';
    return 'month_end';
  };

  // Submit roster with sequential API calls
  const handleRosterSubmit = async () => {
    try {
      if (!loggedInUserId) {
        toast.error('User not authenticated. Please login again.');
        return;
      }
      
      setLoading(true);
      
      const submissionMode = getSubmissionMode();
      
      if (submissionMode === 'no_changes') {
        toast.error('No changes to submit');
        return;
      }
      
      // Convert changes to API format
      const updates = [];
      
      changedCells.forEach(change => {
        const roster = rosterData.find(r => r.roster_id === change.rosterId);
        if (roster && roster[change.day]) {
          const dayData = roster[change.day];
          // change.day is already the date in yyyy-MM-dd format (e.g., "2026-04-01")
          const date = change.day;
          
          // Use raw_status from dropdown directly for type field
          const rawStatus = dayData.raw_status || 'working';
          
          // Extract leave_type_id from status (e.g., "leave_5" -> 5)
          let leaveTypeId = null;
          let isPlanned = dayData.planned || 0;
          
          if (rawStatus === 'leave' && dayData.status?.startsWith('leave_')) {
            // Extract ID from leave_X format
            const extractedId = parseInt(dayData.status.replace('leave_', ''));
            leaveTypeId = isNaN(extractedId) ? null : extractedId;
          }
          
          // Convert planned to "yes"/"no" as per API requirement
          const plannedValue = isPlanned === 1 ? 'yes' : 'no';
          
          const updateEntry = {
            user_id: change.rosterId,
            date: date,
            type: rawStatus, // Send exact value from dropdown (working, wfh, halfday, leave, weekoff)
            leave_type_id: leaveTypeId,
            planned: plannedValue,
            shift: dayData.raw_shift || 'day' // Include raw shift from dropdown
          };
          
          // Check if this exact update already exists (prevent duplicates)
          const duplicateIndex = updates.findIndex(u => 
            u.user_id === updateEntry.user_id && 
            u.date === updateEntry.date &&
            u.type === updateEntry.type &&
            u.leave_type_id === updateEntry.leave_type_id &&
            u.planned === updateEntry.planned &&
            u.shift === updateEntry.shift
          );
          
          if (duplicateIndex === -1) {
            updates.push(updateEntry);
          }
        }
      });
      
      if (updates.length === 0) {
        toast.error('No valid changes to submit');
        return;
      }
      
      // Show submission mode message
      const modeMessage = submissionMode === 'mid_month' 
        ? 'Submitting mid-month changes...' 
        : 'Submitting full month roster...';
      const loadingToast = toast.loading(modeMessage);
      
      // First API call: roster/update
      console.log('Calling roster/update API...', { logged_in_user_id: loggedInUserId, updates });
      const updateResponse = await api.post('/roster/update', { 
        logged_in_user_id: loggedInUserId, 
        updates: updates 
      });
      
      if (updateResponse.data.status !== 200) {
        throw new Error('Failed to update roster');
      }
      
      // Second API call: roster/submit (only if first succeeds)
      console.log('Calling roster/submit API...');
      const submitResponse = await api.post('/roster/submit', { 
        edited_by: loggedInUserId 
      });
      
      if (submitResponse.data.status !== 200) {
        throw new Error('Failed to submit roster');
      }
      
      // Reset changes after successful submission
      setOriginalRosterData(JSON.parse(JSON.stringify(rosterData)));
      setChangedCells([]);
      
      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      const successMessage = submissionMode === 'mid_month'
        ? `${updates.length} changes submitted for approval!`
        : 'Full month roster submitted for approval!';
      toast.success(successMessage);
      
      // Refresh roster data after successful submission
      await fetchRosterData();
      
    } catch (error) {
      console.error('Error submitting roster:', error);
      toast.dismiss();
      toast.error('Failed to submit roster');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown data (teams and leave types) - DEFINED BEFORE useEffect
  const fetchDropdownData = async () => {
    try {
      const userId = loggedInUserId || 93;
      
      // Fetch teams dropdown
      console.log('Fetching teams dropdown...');
      const teamsResponse = await api.post('/dropdown/get', {
        logged_in_user_id: userId,
        dropdown_type: "teams"
      });
      
      if (teamsResponse.data && teamsResponse.data.status === 200) {
        console.log('Teams dropdown:', teamsResponse.data.data);
        setTeams(teamsResponse.data.data || []);
      }
      
      // Fetch leave types dropdown
      console.log('Fetching leave types dropdown...');
      const leaveResponse = await api.post('/dropdown/get', {
        logged_in_user_id: userId,
        dropdown_type: "leave types"
      });
      
      if (leaveResponse.data && leaveResponse.data.status === 200) {
        console.log('Leave types dropdown:', leaveResponse.data.data);
        setLeaveTypes(leaveResponse.data.data || []);
        
        // Convert leave types to status options format - ONLY API DATA
        const apiStatusOptions = leaveResponse.data.data.map(leave => ({
          value: `leave_${leave.leave_type_id}`,
          label: leave.label,
          leave_code: leave.leave_code,
          leave_type_id: leave.leave_type_id,
          affects_target: leave.affects_target,
          is_planned: leave.is_planned
        }));
        
        // Set status options ONLY from API data (no static options)
        setStatusOptions(apiStatusOptions);
      }
      
      // Fetch roster status dropdown (for main status button)
      console.log('Fetching roster status dropdown...');
      const rosterStatusResponse = await api.post('/dropdown/get', {
        logged_in_user_id: userId,
        dropdown_type: "roster status"
      });
      
      if (rosterStatusResponse.data && rosterStatusResponse.data.status === 200) {
        console.log('Roster status dropdown:', rosterStatusResponse.data.data);
        // Map API response to value/label format
        const apiRosterStatus = rosterStatusResponse.data.data.map(status => ({
          value: status.value.toLowerCase().replace(/\s+/g, ''),
          label: status.label,
          originalValue: status.value
        }));
        setRosterStatusOptions(apiRosterStatus);
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      toast.error('Failed to load dropdown data');
    }
  };

  // Fetch roster data from API - only when month changes, not on every render
  useEffect(() => {
    if (loggedInUserId && !isFetchingRef.current && rosterData.length === 0) {
      isFetchingRef.current = true;
      fetchRosterData();
      fetchDropdownData();
    }
  }, [currentMonth, loggedInUserId, rosterData.length]);

  // Reset week index when month changes
  useEffect(() => {
    setCurrentWeekIndex(0);
  }, [currentMonth]);

  const fetchRosterData = async () => {
    try {
      if (!loggedInUserId) {
        toast.error('User not authenticated. Please login again.');
        return;
      }
      
      setLoading(true);
      const monthYear = format(currentMonth, 'MMMyyyy').toUpperCase();
      console.log('Calling roster/get API...', { month_year: monthYear, logged_in_user_id: loggedInUserId });
      
      const response = await api.post('/roster/get', {
        month_year: monthYear,
        logged_in_user_id: loggedInUserId
      });
      
      if (response.data.status !== 200 || !response.data.data) {
        throw new Error('Failed to fetch roster data');
      }
      
      // Convert API response to internal format
      console.log('[DEBUG] API Response data count:', response.data.data?.length);
      console.log('[DEBUG] First user full data:', response.data.data?.[0]);
      console.log('[DEBUG] First user calendar (all days):', response.data.data?.[0]?.calendar);
      
      const convertedData = response.data.data.map(user => {
        // Extract shift from multiple sources
        const shiftEntry = user.calendar?.find(day => day.shift);
        const userShift = user.shift || user.shift_type;
        const firstCalendarShift = user.calendar?.[0]?.shift;
        let extractedShift = shiftEntry?.shift || userShift || firstCalendarShift || 'day';
        
        // Normalize shift value
        if (!extractedShift || extractedShift === 'null' || extractedShift === 'undefined' || extractedShift === '') {
          extractedShift = 'day';
        }
        extractedShift = String(extractedShift).toLowerCase().trim();
        
        const rosterEntry = {
          roster_id: user.user_id,
          employee_id: user.user_id,
          team_id: user.team?.team_id || 1,
          user_name: user.user_name,
          user_email: user.user_email,
          shift_type: extractedShift
        };
        
        // Convert calendar to day-based format - store by DATE to prevent week-over-week overwriting
        user.calendar?.forEach(day => {
          const dayName = format(new Date(day.date), 'EEEE').toLowerCase();
          const dateKey = day.date; // Use actual date (e.g., '2026-04-06') as the key
          
          // Extract shift for this specific day
          let dayShift = day.shift || day.shift_type || 'day';
          if (!dayShift || dayShift === 'null' || dayShift === 'undefined' || dayShift === '') {
            dayShift = 'day';
          }
          dayShift = String(dayShift).toLowerCase().trim();
          
          // Store raw API status and shift values
          // Use exact dropdown API values without normalization
          // Handle both lowercase (from API) and capitalized formats
          const apiStatus = day.status?.toLowerCase() || 'working';
          let internalStatus;
          let rawStatus;
          
          if (apiStatus === 'working') {
            internalStatus = 'present_office';
            rawStatus = 'working';
          } else if (apiStatus === 'weekoff') {
            internalStatus = 'week_off';
            rawStatus = 'Weekoff';
          } else if (apiStatus === 'leave') {
            internalStatus = day.leave_type_id ? `leave_${day.leave_type_id}` : 'leave_planned';
            rawStatus = 'Leave';
          } else if (apiStatus === 'wfh') {
            internalStatus = 'present_wfh';
            rawStatus = 'WFH';
          } else if (apiStatus === 'half_day' || apiStatus === 'halfday') {
            internalStatus = 'half_day_first';
            rawStatus = 'Half day';
          } else {
            internalStatus = 'present_office';
            rawStatus = 'working';
          }
          
          // Debug: Log conversion for specific dates
          if (day.date === '2026-04-06' || day.date === '2026-04-07' || day.date === '2026-04-08') {
            console.log(`[DEBUG CONVERT] ${user.user_name} ${day.date} (${dayName}): apiStatus="${day.status}" -> rawStatus="${rawStatus}", leave_type_name="${day.leave_type_name}", pending_status="${day.pending_status}"`);
          }
          
          // Store by DATE to prevent overwriting across weeks
          rosterEntry[dateKey] = {
            status: internalStatus,
            raw_status: rawStatus, // Store normalized raw API status
            raw_shift: day.shift || day.shift_type || 'day', // Store raw API shift
            hours: day.status === 'working' ? 8 : 0,
            shift: dayShift,
            leave_type_id: day.leave_type_id,
            leave_type_name: day.leave_type_name, // Store leave type name from API
            planned: day.planned || 0, // Store planned flag from API
            is_planned: day.is_planned, // Store is_planned from API ('yes'/'no')
            pending_status: day.pending_status // Store pending_status from API
          };
        });
        
        return rosterEntry;
      });
      

      setRosterData(convertedData);
      setOriginalRosterData(JSON.parse(JSON.stringify(convertedData))); // Deep copy for change tracking
      setChangedCells([]); // Reset changes when loading new data
      isFetchingRef.current = false; // Reset fetching flag
      
    } catch (error) {
      console.error('Error fetching roster data:', error);
      toast.error('Failed to load roster data');
      setRosterData([]);
      isFetchingRef.current = false; // Reset fetching flag on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 mb-6 border border-blue-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Assistant Manager - Weekly Roster</h1>
                <p className="text-slate-500">Manage and edit team schedules week by week</p>
              </div>
            </div>
            
          </div>
        </div>

        {/* Month Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="text-center min-w-[200px]">
                <h3 className="text-lg font-semibold text-slate-800">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <p className="text-sm text-slate-500">
                  {getWeeksInMonth().length} weeks in month
                </p>
              </div>
              <button
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <Grid3X3 className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="bg-transparent text-sm text-slate-700 focus:outline-none"
                >
                  <option value="">All Teams</option>
                  {teams.map(team => (
                    <option key={team.team_id} value={team.team_id}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none w-48"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Week Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col gap-4">
            {/* Week Navigation */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <button
                  onClick={goToPreviousWeek}
                  disabled={currentWeekIndex === 0}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="text-center min-w-[200px]">
                  <h3 className="text-lg font-semibold text-slate-800">
                    Week {currentWeekIndex + 1} of {getWeeksInMonth().length}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {format(startOfWeek(getCurrentWeek(), { weekStartsOn: 1 }), 'MMM dd')} - {format(endOfWeek(getCurrentWeek(), { weekStartsOn: 1 }), 'MMM dd, yyyy')}
                  </p>
                </div>
                <button
                  onClick={goToNextWeek}
                  disabled={currentWeekIndex === getWeeksInMonth().length - 1}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Week Tabs */}
            <div className="flex gap-2 flex-wrap justify-center">
              {getWeeksInMonth().map((week, index) => (
                <button
                  key={index}
                  onClick={() => goToWeek(index)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    index === currentWeekIndex
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Week {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Roster Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700 sticky left-0 bg-slate-50 min-w-[250px] z-20">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Employee
                  </div>
                </th>
                {getWeekDays().map((day, idx) => (
                  <th key={idx} className="px-4 py-4 text-center text-sm font-semibold text-slate-700 min-w-[140px]">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-600">{format(day, 'EEE')}</span>
                      <span className="text-lg font-bold text-slate-800">{format(day, 'dd')}</span>
                      {isWeekend(day) && (
                        <span className="text-xs text-rose-500 font-medium">Weekend</span>
                      )}
                    </div>
                  </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRosterData.map((roster, index) => (
                  <tr key={roster.roster_id} className={`border-b border-slate-100 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  } hover:bg-blue-50/30`}>
                    <td className="px-4 py-4 sticky left-0 bg-white border-r border-slate-200 z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                          <span className="text-sm font-bold text-white">
                            {roster.user_name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">
                            {roster.user_name}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {teams.find(t => t.team_id === roster.team_id)?.label}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Shift Cell */}
                    {getWeekDays().map((day, idx) => {
                      const dayName = format(day, 'EEEE').toLowerCase();
                      const dateKey = format(day, 'yyyy-MM-dd'); // Use date for data lookup
                      const dayData = roster[dateKey]; // Look up by date, not day name
                      const isWeekendDay = isWeekend(day);
                      
                      // Debug: Log all cells for first user to see what's being rendered
                      if (roster.user_name === 'Yahya Irani' && idx <= 7) {
                        console.log(`[RENDER DEBUG] ${roster.user_name} - ${dayName} (${dateKey}): raw_status="${dayData?.raw_status}", status="${dayData?.status}"`);
                      }
                      
                      return (
                        <td 
                          key={idx} 
                          data-editing-cell={editingCell?.rosterId === roster.roster_id && editingCell?.day === dateKey && editingCell?.field === 'status' ? 'true' : undefined}
                          className={`px-2 py-3 text-center cursor-pointer transition-all min-w-[140px] ${
                            isWeekendDay ? 'bg-rose-50/50' : ''
                          } hover:bg-slate-50`}
                          onClick={() => handleCellClick(roster.roster_id, dateKey, 'status')}
                        >
                          {editingCell?.rosterId === roster.roster_id && 
                           editingCell?.day === dateKey && 
                           editingCell?.field === 'status' ? (
                            <div className="flex flex-col gap-1">
                                {/* Roster Status Dropdown - From API */}
                                <Select
                                  value={dayData?.raw_status ? dayData.raw_status.toLowerCase().replace(/\s+/g, '') : ''}
                                  onValueChange={(value) => {
                                    handleCellChange(roster.roster_id, dateKey, 'raw_status', value);
                                    // Map exact dropdown value to internal status
                                    let shouldCloseEditMode = true;
                                    
                                    if (value === 'working' || value === 'wfh' || value === 'halfday') {
                                      handleCellChange(roster.roster_id, dateKey, 'status', value === 'working' ? 'present_office' : value === 'wfh' ? 'present_wfh' : 'half_day_first');
                                    } else if (value === 'weekoff') {
                                      handleCellChange(roster.roster_id, dateKey, 'status', 'week_off');
                                    } else if (value === 'leave') {
                                      // Leave selected - keep editing mode open for dependent dropdowns
                                      shouldCloseEditMode = false;
                                    }
                                    
                                    if (shouldCloseEditMode) {
                                      setTimeout(() => handleCellBlur(), 100);
                                    }
                                  }}
                                  modal={false}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs bg-white border border-slate-300 shadow-lg rounded-lg focus:ring-2 focus:ring-slate-400 px-2 pr-8 overflow-hidden">
                                    <SelectValue placeholder="Select Status..." className="truncate block overflow-hidden text-ellipsis whitespace-nowrap w-full" />
                                  </SelectTrigger>
                                  <SelectContent 
                                    position="popper" 
                                    sideOffset={4}
                                    className="max-h-[200px] overflow-y-auto bg-white shadow-2xl border-2 border-slate-200 rounded-lg [&_[data-radix-select-item-indicator]]:left-2 w-full z-[100]"
                                  >
                                    {rosterStatusOptions.map((option) => (
                                      <SelectItem 
                                        key={option.value} 
                                        value={option.value} 
                                        className="text-xs py-2 pl-8 pr-2 cursor-pointer hover:bg-slate-50 bg-white relative"
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              
                              {/* Leave Type Dropdown - Only if status is 'leave' */}
                              {(dayData?.raw_status?.toLowerCase() === 'leave') && (
                                <div className="mt-1">
                                  <Select
                                    value={(() => {
                                      // Check if user has made a change
                                      const statusChange = changedCells.find(c => 
                                        c.rosterId === roster.roster_id && 
                                        c.day === dateKey && 
                                        c.field === 'status'
                                      );
                                      // If changed, use the changed value; otherwise use existing API value
                                      if (statusChange) {
                                        return dayData?.status || '';
                                      }
                                      // Use leave_type_id from API to find matching option
                                      if (dayData?.leave_type_id) {
                                        const matchingOption = statusOptions.find(opt => 
                                          opt.value.includes(dayData.leave_type_id) || 
                                          opt.label === dayData.leave_type_name
                                        );
                                        return matchingOption?.value || '';
                                      }
                                      return '';
                                    })()}
                                    onValueChange={(value) => {
                                      handleCellChange(roster.roster_id, dateKey, 'status', value);
                                    }}
                                    modal={false}
                                  >
                                    <SelectTrigger className="w-full h-8 text-xs bg-white border border-orange-300 shadow-lg rounded-lg focus:ring-2 focus:ring-orange-400 px-2 pr-8 pointer-events-auto overflow-hidden">
                                      <SelectValue placeholder="Select Leave Type..." className="truncate block overflow-hidden text-ellipsis whitespace-nowrap w-full" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px] overflow-y-auto bg-white shadow-2xl border-2 border-orange-200 rounded-lg [&_[data-radix-select-item-indicator]]:left-2 w-full pointer-events-auto">
                                      {statusOptions.map((option) => (
                                        <SelectItem 
                                          key={option.value} 
                                          value={option.value} 
                                          className="text-xs py-2 pl-8 pr-2 cursor-pointer hover:bg-slate-50 bg-white relative"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              
                              {/* Planned/Unplanned Dropdown - Only if status is 'leave' */}
                              {(dayData?.raw_status?.toLowerCase() === 'leave') && (
                                <div className="mt-1">
                                  <Select
                                    value={(() => {
                                      // Check if user has made a change
                                      const plannedChange = changedCells.find(c => 
                                        c.rosterId === roster.roster_id && 
                                        c.day === dateKey && 
                                        c.field === 'planned'
                                      );
                                      // Only show value if user explicitly made a selection
                                      if (plannedChange) {
                                        return String(dayData?.planned || '');
                                      }
                                      // Otherwise show placeholder (no default from API)
                                      return '';
                                    })()}
                                    onValueChange={(value) => {
                                      handleCellChange(roster.roster_id, dateKey, 'planned', parseInt(value));
                                      handleCellBlur();
                                    }}
                                    modal={false}
                                  >
                                    <SelectTrigger className="w-full h-8 text-xs bg-white border border-blue-300 shadow-lg rounded-lg focus:ring-2 focus:ring-blue-400 px-2 pr-8 pointer-events-auto overflow-hidden">
                                      <SelectValue placeholder="Planned?" className="truncate block overflow-hidden text-ellipsis whitespace-nowrap w-full" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[100px] overflow-y-auto bg-white shadow-2xl border-2 border-blue-200 rounded-lg [&_[data-radix-select-item-indicator]]:left-2 w-full pointer-events-auto">
                                      {plannedOptions.map((option) => (
                                        <SelectItem 
                                          key={option.value} 
                                          value={String(option.value)} 
                                          className="text-xs py-2 pl-8 pr-2 cursor-pointer hover:bg-slate-50 bg-white relative"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCellClick(roster.roster_id, dateKey, 'status');
                                }}
                                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 mb-1 ${
                                  dayData?.raw_status?.toLowerCase() === 'working' ? 'bg-white text-slate-700 border-2 border-slate-500 shadow-slate-100 hover:bg-slate-50' :
                                  dayData?.raw_status?.toLowerCase() === 'wfh' ? 'bg-blue-50 text-blue-600 border-2 border-blue-400 shadow-blue-100 hover:bg-blue-100' :
                                  ['half day', 'halfday', 'half_day'].includes(dayData?.raw_status?.toLowerCase()) ? 'bg-yellow-50 text-yellow-600 border-2 border-yellow-400 shadow-yellow-100 hover:bg-yellow-100' :
                                  dayData?.raw_status?.toLowerCase() === 'weekoff' ? 'bg-slate-100 text-slate-600 border-2 border-slate-300 shadow-slate-100 hover:bg-slate-200' :
                                  dayData?.raw_status?.toLowerCase() === 'leave' ? 'bg-orange-50 text-orange-600 border-2 border-orange-400 shadow-orange-100 hover:bg-orange-100' :
                                  'bg-white text-slate-400 border-2 border-dashed border-slate-300 hover:border-slate-500 hover:text-slate-600 hover:bg-slate-50'
                                } shadow-sm relative`}
                              >
                                {/* Pending Flag - Only show when pending_status is 'pending' */}
                                {dayData?.pending_status === 'pending' && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" title="Pending Approval"></span>
                                )}
                                {dayData?.raw_status?.toLowerCase() === 'working' && <Briefcase className="w-3 h-3" />}
                                {dayData?.raw_status?.toLowerCase() === 'wfh' && <Home className="w-3 h-3" />}
                                {['half day', 'halfday', 'half_day'].includes(dayData?.raw_status?.toLowerCase()) && <Clock className="w-3 h-3" />}
                                {dayData?.raw_status?.toLowerCase() === 'weekoff' && <Calendar className="w-3 h-3" />}
                                {dayData?.raw_status?.toLowerCase() === 'leave' && <CheckSquare className="w-3 h-3 text-orange-500" />}
                                <span className="text-center leading-tight">
                                  {/* Display roster status from API */}
                                  {dayData?.raw_status?.toLowerCase() === 'working' && 'Working'}
                                  {dayData?.raw_status?.toLowerCase() === 'wfh' && 'WFH'}
                                  {['half day', 'halfday', 'half_day'].includes(dayData?.raw_status?.toLowerCase()) && 'Half day'}
                                  {dayData?.raw_status?.toLowerCase() === 'weekoff' && 'Weekoff'}
                                  {dayData?.raw_status?.toLowerCase() === 'leave' && (
                                    <>
                                      {/* Show leave_type_name from API if available, otherwise show 'Leave' */}
                                      {dayData.leave_type_name || statusOptions.find(opt => opt.value === dayData.status)?.label || 'Leave'}
                                    </>
                                  )}
                                  {/* Fallback: display raw_status if it doesn't match known values */}
                                  {dayData?.raw_status && 
                                    !['working', 'WFH', 'wfh', 'Half day', 'halfday', 'half_day', 'Weekoff', 'weekoff', 'Leave', 'leave'].includes(dayData.raw_status) &&
                                    dayData.raw_status
                                  }
                                  {!dayData?.raw_status && 'Set Status'}
                                </span>
                              </button>
                              {/* Planned/Unplanned Badge - Show for Leave status using is_planned from API */}
                              {dayData?.raw_status?.toLowerCase() === 'leave' && dayData?.is_planned && (
                                <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center justify-center ${
                                  dayData.is_planned === 'yes' 
                                    ? 'bg-green-100 text-green-700 border border-green-200' 
                                    : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>
                                  {dayData.is_planned === 'yes' ? 'Planned' : 'Unplanned'}
                                </div>
                              )}
                            </>
                          )}
                          {/* Shift Display & Edit */}
                          {editingCell?.rosterId === roster.roster_id && 
                           editingCell?.day === dateKey && 
                           editingCell?.field === 'shift' ? (
                            <div className="relative z-50 min-w-[120px]">
                              <Select
                                value={dayData?.raw_shift || 'day'}
                                onValueChange={(value) => {
                                  handleCellChange(roster.roster_id, dateKey, 'raw_shift', value);
                                  handleCellChange(roster.roster_id, dateKey, 'shift', value);
                                  handleCellBlur();
                                }}
                                modal={false}
                              >
                                <SelectTrigger className="w-full h-8 text-xs bg-white border border-slate-300 shadow-lg rounded-lg focus:ring-2 focus:ring-slate-400 px-2 pr-8">
                                  <SelectValue placeholder="Select Shift..." className="truncate" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto bg-white shadow-2xl border-2 border-slate-200 rounded-lg [&_[data-radix-select-item-indicator]]:left-2 w-full pointer-events-auto">
                                  {rawShiftOptions.map((option) => (
                                    <SelectItem 
                                      key={option.value} 
                                      value={option.value} 
                                      className="text-xs py-2 pl-8 pr-2 cursor-pointer hover:bg-slate-50 bg-white relative"
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCellClick(roster.roster_id, dateKey, 'shift');
                              }}
                              className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 ${
                                dayData?.raw_shift === 'night' ? 'bg-slate-100 text-slate-700 border-2 border-slate-500 shadow-slate-200 hover:bg-slate-200' :
                                dayData?.raw_shift === 'day' ? 'bg-white text-slate-700 border-2 border-slate-500 shadow-slate-100 hover:bg-slate-50' :
                                'bg-slate-50 text-slate-600 border-2 border-slate-400 shadow-slate-100 hover:bg-slate-100'
                              } shadow-sm`}
                            >
                              {dayData?.raw_shift === 'night' && <Moon className="w-3 h-3" />}
                              {dayData?.raw_shift === 'day' && <Sun className="w-3 h-3" />}
                              {(!dayData?.raw_shift || dayData?.raw_shift === 'general') && <Clock className="w-3 h-3" />}
                              <span className="capitalize">{dayData?.raw_shift || 'day'}</span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Submit for Approval</h3>
              <p className="text-sm text-slate-500">Once submitted, the roster will be sent to the Super Admin for review</p>
            </div>
            <button
              onClick={handleRosterSubmit}
              disabled={loading || !hasChanges}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Submit Roster for Approval
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantManagerRoster;
