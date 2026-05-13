/**
 * File: UserRosterReport.jsx
 * Author: Naitik Maisuriya
 * Description: User Roster Report View - Read-only weekly reports
 */

import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  TrendingUp,
  Clock,
  Briefcase,
  Coffee,
  Sun,
  Moon,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachWeekOfInterval, startOfWeek, endOfWeek, eachDayOfInterval, isWeekend } from "date-fns";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const UserRosterReport = () => {
  // Debug logging
  console.log('UserRosterReport component is rendering');
  
  const { user } = useAuth();

  // Role detection - defined early for helper functions
  const roleId = Number(user?.role_id);
  const isAgent = roleId === 6;
  const isQA = roleId === 5;
  const isAssistantManager = roleId === 4;
  const isProjectManager = roleId === 3;
  const isAdmin = roleId === 2;
  const isSuperAdmin = roleId === 1;

  // State management
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rosterData, setRosterData] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [userProfile, setUserProfile] = useState({
    name: user?.user_name || user?.name || "User",
    email: user?.user_email || user?.email || "",
    employee_id: user?.user_id || "",
    department: user?.team_name || user?.department || "",
    role: user?.role || ""
  });
  const [apiData, setApiData] = useState(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState(null); // For manager dropdown
  const [agentDropdown, setAgentDropdown] = useState([]); // From /dropdown/get API

  // Status options for display
  const statusOptions = [
    { value: 'present_office', label: 'Present/Work from office', color: 'green' },
    { value: 'present_wfh', label: 'Present/Work From Home', color: 'emerald' },
    { value: 'wfh', label: 'Work From Home', color: 'emerald' },
    { value: 'half_day_first', label: 'Half Day/First Half', color: 'yellow' },
    { value: 'half_day_second', label: 'Half Day/Second Half', color: 'amber' },
    { value: 'half_day', label: 'Half Day', color: 'yellow' },
    { value: 'holiday', label: 'Holiday', color: 'purple' },
    { value: 'leave_planned', label: 'Leave/Planned', color: 'orange' },
    { value: 'leave', label: 'Leave', color: 'orange' },
    { value: 'leave_unplanned', label: 'Leave/Unplanned', color: 'red' },
    { value: 'week_off', label: 'Week off', color: 'slate' },
    { value: 'weekoff', label: 'Week Off', color: 'slate' },
    { value: 'working', label: 'Working', color: 'green' },
  ];

  // Dummy roster data for the entire month
  const dummyMonthlyRoster = {
    "2026-04-01": { status: 'present_office' },
    "2026-04-02": { status: 'present_office' },
    "2026-04-03": { status: 'present_office' },
    "2026-04-04": { status: 'present_office' },
    "2026-04-05": { status: 'present_office' },
    "2026-04-06": { status: 'week_off' },
    "2026-04-07": { status: 'week_off' },
    "2026-04-08": { status: 'present_wfh' },
    "2026-04-09": { status: 'present_wfh' },
    "2026-04-10": { status: 'present_wfh' },
    "2026-04-11": { status: 'present_wfh' },
    "2026-04-12": { status: 'present_wfh' },
    "2026-04-13": { status: 'week_off' },
    "2026-04-14": { status: 'week_off' },
    "2026-04-15": { status: 'present_office' },
    "2026-04-16": { status: 'present_office' },
    "2026-04-17": { status: 'half_day_first' },
    "2026-04-18": { status: 'present_office' },
    "2026-04-19": { status: 'present_office' },
    "2026-04-20": { status: 'week_off' },
    "2026-04-21": { status: 'week_off' },
    "2026-04-22": { status: 'present_office' },
    "2026-04-23": { status: 'present_office' },
    "2026-04-24": { status: 'present_office' },
    "2026-04-25": { status: 'present_office' },
    "2026-04-26": { status: 'present_office' },
    "2026-04-27": { status: 'week_off' },
    "2026-04-28": { status: 'week_off' },
    "2026-04-29": { status: 'present_office' },
    "2026-04-30": { status: 'present_office' },
  };

  // Get weeks in current month
  const getWeeksInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  };

  // Get week days for a specific week
  const getWeekDays = (week) => {
    const start = startOfWeek(week, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(week, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  // Get roster data for a specific date
  const getDayData = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Use API data if available
    const userData = apiData;
    
    if (userData?.calendar) {
      const calendarEntry = userData.calendar.find(entry => entry.date === dateStr);
      if (calendarEntry) {
        return {
          status: calendarEntry.status === 'weekoff' ? 'week_off' :
                  calendarEntry.status === 'holiday' ? 'holiday' :
                  calendarEntry.status === 'leave' ? 'leave_planned' : 
                  calendarEntry.status === 'wfh' ? 'present_wfh' :
                  calendarEntry.status === 'half_day' ? 'half_day_first' : calendarEntry.status,
          color: calendarEntry.color,
          shift: calendarEntry.shift,
          editable: calendarEntry.editable,
          leave_type: calendarEntry.leave_type_name,
          is_planned: calendarEntry.is_planned,
          pending_status: calendarEntry.pending_status
        };
      }
    }
    
    // Fallback to dummy data
    return dummyMonthlyRoster[dateStr] || { status: null };
  };

  // Calculate monthly statistics
  const calculateMonthlyStats = () => {
    const stats = {
      workingDays: 0,
      weekOffs: 0,
      holidays: 0,
      leaves: 0,
      halfDays: 0,
      presentOffice: 0,
      presentWFH: 0
    };

    Object.values(dummyMonthlyRoster).forEach(day => {
      switch (day.status) {
        case 'present_office':
          stats.workingDays++;
          stats.presentOffice++;
          break;
        case 'present_wfh':
          stats.workingDays++;
          stats.presentWFH++;
          break;
        case 'half_day_first':
        case 'half_day_second':
          stats.halfDays++;
          break;
        case 'week_off':
          stats.weekOffs++;
          break;
        case 'holiday':
          stats.holidays++;
          break;
        case 'leave_planned':
        case 'leave_unplanned':
          stats.leaves++;
          break;
      }
    });

    return stats;
  };

  // Calculate week statistics
  const calculateWeekStats = (week) => {
    const weekDays = getWeekDays(week);
    const stats = {
      workingDays: 0,
      presentOffice: 0,
      presentWFH: 0
    };

    weekDays.forEach(day => {
      const dayData = getDayData(day);
      if (dayData.status === 'present_office') {
        stats.workingDays++;
        stats.presentOffice++;
      } else if (dayData.status === 'present_wfh') {
        stats.workingDays++;
        stats.presentWFH++;
      }
    });

    return stats;
  };

  // Download report
  const handleDownloadReport = async () => {
    try {
      setLoading(true);
      console.log('Calling Roster Listing API for download...');
      // await api.get('/roster/listing', { params: { month: format(currentMonth, 'yyyy-MM') } });
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Report downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download report');
    } finally {
      setLoading(false);
    }
  };

  // Format month for API (APR2026 format)
  const formatMonthForAPI = (date) => {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${month}${year}`;
  };

  // Fetch roster data from API - updated for new API structure
  const fetchRosterData = async () => {
    try {
      setLoading(true);
      const monthYear = formatMonthForAPI(currentMonth);
      const userId = user?.user_id || user?.id;

      console.log('Fetching roster data for:', { month_year: monthYear, logged_in_user_id: userId });

      const response = await api.post('/roster/get', {
        month_year: monthYear,
        logged_in_user_id: userId
      });

      console.log('Roster API Response:', response.data);

      if (response.data && response.data.status === 200) {
        const data = response.data.data;
        setApiData(data);
        
        // Update user profile from API response
        if (data) {
          setUserProfile({
            name: data.user_name,
            email: data.user_email,
            employee_id: data.user_id,
            department: data.team?.team_name || "",
            role: response.data.role || user?.role || ""
          });
        }
        toast.success('Roster data loaded successfully');
      } else {
        toast.error('Failed to load roster data');
      }
    } catch (error) {
      console.error('Error fetching roster data:', error);
      toast.error('Failed to load roster data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch agent dropdown data from API
  const fetchAgentDropdown = async () => {
    try {
      const userId = user?.user_id || user?.id || 93;
      console.log('Fetching agent dropdown...');
      
      const response = await api.post('/dropdown/get', {
        logged_in_user_id: userId,
        dropdown_type: "agent"
      });
      
      if (response.data && response.data.status === 200) {
        console.log('Agent dropdown:', response.data.data);
        setAgentDropdown(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching agent dropdown:', error);
    }
  };

  // Initialize data
  useEffect(() => {
    // Load user profile and roster data
    const weeks = getWeeksInMonth();
    if (weeks.length > 0) {
      setSelectedWeek(weeks[0]);
    }
    // Fetch roster data from API
    fetchRosterData();
    // Fetch agent dropdown for managers
    if (isAssistantManager || isProjectManager || isAdmin || isSuperAdmin) {
      fetchAgentDropdown();
    }
  }, [currentMonth]);

  // Filter data based on role
  const getFilteredData = () => {
    if (!apiData || !Array.isArray(apiData)) return [];
    
    const currentUserId = user?.user_id || user?.id;
    
    // Agent & QA: Show only their own data
    if (isAgent || isQA) {
      return apiData.filter(item => item.user_id === currentUserId);
    }
    
    // Assistant Manager & Project Manager: Show their own + team members data
    if (isAssistantManager || isProjectManager) {
      // Get current user's team
      const currentUserData = apiData.find(item => item.user_id === currentUserId);
      const userTeamId = currentUserData?.team?.team_id;
      
      if (userTeamId) {
        return apiData.filter(item => 
          item.user_id === currentUserId || item.team?.team_id === userTeamId
        );
      }
      return apiData.filter(item => item.user_id === currentUserId);
    }
    
    // Admin & Super Admin: Show all data
    if (isAdmin || isSuperAdmin) {
      return apiData;
    }
    
    // Default: Show only own data
    return apiData.filter(item => item.user_id === currentUserId);
  };

  // Get stats from API data - updated for new API structure
  const getStatsFromData = () => {
    if (!apiData?.summary) return { workingDays: 0, weekOffs: 0, holidays: 0, leaves: 0, presentOffice: 0, presentWFH: 0 };
    const summary = apiData.summary;
    return {
      workingDays: summary.working_days || 0,
      weekOffs: summary.weekoffs || 0,
      holidays: summary.holidays || 0,
      leaves: 0, // Not in API response
      presentOffice: summary.working_days || 0,
      presentWFH: 0
    };
  };

  // Use API stats if available, otherwise calculate from dummy data
  const monthlyStats = apiData?.summary ? getStatsFromData() : calculateMonthlyStats();
  const weeks = getWeeksInMonth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 mb-6 border border-blue-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  {(isAssistantManager || isProjectManager) ? 'Team Roster Report' : 
                   (isAdmin || isSuperAdmin) ? 'All Teams Roster Report' : 'My Roster Report'}
                </h1>
                <p className="text-slate-500">
                  {(isAssistantManager || isProjectManager) ? 'View your team\'s monthly schedule and attendance' : 
                   (isAdmin || isSuperAdmin) ? 'View all teams monthly schedule and attendance' : 'View your monthly schedule and attendance summary'}
                </p>
              </div>
            </div>
            
            {/* User Profile */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-semibold text-slate-800">{userProfile.name}</div>
                <div className="text-sm text-slate-500">{userProfile.email}</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {userProfile.name?.charAt(0) || 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Month Navigation and Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="text-center min-w-[200px]">
                <h3 className="text-lg font-semibold text-slate-800">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
              </div>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Team Member Dropdown - For Managers */}
            {(isAssistantManager || isProjectManager || isAdmin || isSuperAdmin) && agentDropdown.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">Select User:</span>
                <select
                  value={selectedTeamMember?.user_id || ''}
                  onChange={(e) => {
                    const selectedAgent = agentDropdown.find(m => m.user_id === parseInt(e.target.value));
                    const selectedRosterData = filteredData.find(m => m.user_id === parseInt(e.target.value));
                    // Use roster data if available, otherwise create from agent data
                    const selected = selectedRosterData || {
                      user_id: selectedAgent.user_id,
                      user_name: selectedAgent.label,
                      user_email: '',
                      team: { team_name: '' }
                    };
                    setSelectedTeamMember(selected);
                    if (selected) {
                      setUserProfile({
                        name: selected.user_name,
                        email: selected.user_email || '',
                        employee_id: selected.user_id,
                        department: selected.team?.team_name || "",
                        role: userProfile.role
                      });
                    }
                  }}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
                >
                  {agentDropdown.map((agent) => (
                    <option key={agent.user_id} value={agent.user_id}>
                      {agent.label} {agent.user_id === (user?.user_id || user?.id) ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

                      </div>
        </div>

        {/* Week Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-700">Select Week:</span>
            <div className="flex gap-2 flex-wrap">
              {weeks.map((week, index) => {
                const weekStats = calculateWeekStats(week);
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedWeek(week)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedWeek === week
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Week {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Weekly View */}
        {selectedWeek && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd')} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'MMM dd, yyyy')}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-7 gap-3">
                {getWeekDays(selectedWeek).map((day, dayIndex) => {
                  const dayData = getDayData(day);
                  const isWeekendDay = isWeekend(day);
                  const statusOption = statusOptions.find(opt => opt.value === dayData.status);

                  // Format status for display
                  const formatStatus = (status) => {
                    const statusMap = {
                      'wfh': 'Work From Home',
                      'half_day': 'Half Day',
                      'working': 'Working',
                      'leave': 'Leave',
                      'weekoff': 'Week Off',
                      'week_off': 'Week Off',
                      'holiday': 'Holiday',
                      'present_office': 'Present Office',
                      'present_wfh': 'Work From Home',
                      'leave_planned': 'Leave',
                      'leave_unplanned': 'Leave',
                      'half_day_first': 'Half Day',
                      'half_day_second': 'Half Day'
                    };
                    return statusMap[status] || status || 'Off';
                  };

                  return (
                    <div 
                      key={dayIndex} 
                      className={`text-center p-4 rounded-xl border transition-all hover:shadow-md ${
                        isWeekendDay ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-600 mb-2">
                        {format(day, 'EEE')}
                      </div>
                      <div className="text-lg font-bold text-slate-800 mb-3">
                        {format(day, 'dd')}
                      </div>

                      {/* Pending Status Badge */}
                      {dayData.pending_status === 'pending' && (
                        <div className="mb-2">
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                            Pending
                          </span>
                        </div>
                      )}

                      {/* Shift */}
                      <div className="mb-2">
                        <span className="text-xs text-slate-500 font-medium">
                          Shift: {dayData.shift || '-'}
                        </span>
                      </div>

                      {/* Status */}
                      <div className={`inline-flex flex-col items-center justify-center px-3 py-3 rounded-lg w-full mb-2 ${
                        statusOption ? `bg-${statusOption.color}-100 text-${statusOption.color}-700 border border-${statusOption.color}-200` : 'bg-slate-50 text-slate-400 border border-slate-200'
                      }`}>
                        <div className="text-xs font-semibold leading-tight text-center">
                          {formatStatus(dayData.status)}
                        </div>
                      </div>

                      {/* Leave Details */}
                      {(dayData.status === 'leave_planned' || dayData.status === 'leave_unplanned' || dayData.status === 'leave') && (
                        <div className="mt-2 space-y-1">
                          {dayData.leave_type && (
                            <div className="text-xs text-slate-600">
                              <strong>{dayData.leave_type}</strong>
                            </div>
                          )}
                          <div className="text-xs text-slate-500">
                            Planned: {dayData.is_planned === 'yes' ? 'Yes' : 'No'}
                          </div>
                        </div>
                      )}

                      {/* Status Icon */}
                      <div className="mt-3 flex justify-center">
                        {(dayData.status === 'present_office' || dayData.status === 'working') && <Briefcase className="w-4 h-4 text-green-500" />}
                        {dayData.status === 'present_wfh' && <Coffee className="w-4 h-4 text-emerald-500" />}
                        {dayData.status === 'half_day_first' && <Clock className="w-4 h-4 text-yellow-500" />}
                        {dayData.status === 'half_day_second' && <Clock className="w-4 h-4 text-amber-500" />}
                        {dayData.status === 'week_off' && <Calendar className="w-4 h-4 text-slate-400" />}
                        {dayData.status === 'leave_planned' && <AlertCircle className="w-4 h-4 text-orange-500" />}
                        {dayData.status === 'leave_unplanned' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        {dayData.status === 'holiday' && <CheckCircle className="w-4 h-4 text-purple-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>

                          </div>
          </div>
        )}

              </div>
    </div>
  );
};

export default UserRosterReport;
