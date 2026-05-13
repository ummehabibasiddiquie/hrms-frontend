import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, Save, X, ChevronUp, ChevronDown, Search, Download, Users, FileX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { exportToCSV } from '../../utils/csvExport';
import { MonthYearPicker } from '../common/CustomCalendar';
import SearchableSelect from '../common/SearchableSelect';

// Helper to get current month in format JAN2026
const getCurrentMonthYear = () => {
  const date = new Date();
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${month}${year}`;
};

const UserMonthlyReport = () => {
  const { user } = useAuth();
  
  // Role checking
  const roleId = user?.role_id;
  const role = user?.role || user?.role_name || '';
  const isAdmin = roleId === 1 || String(role).toLowerCase() === 'admin';
  const isSuperAdmin = String(role).toLowerCase().includes('super');
  const isProjectManager = roleId === 3 || String(role).toLowerCase().includes('project manager');
  const canViewTeamFilter = isAdmin || isSuperAdmin || isProjectManager;
  const canViewTeamColumn = isAdmin || isSuperAdmin || isProjectManager; // Show team column for these roles, hide for assistant manager (role_id 4)
  
  // State for users list
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Table data state
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Edit state - only for extra_assign_hours
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  
  // State for expanded/collapsed cards
  const [expandedMonths, setExpandedMonths] = useState({});
  
  // State for month filter
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  
  // State for search filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for team filter
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await api.post('/user/list', {
          user_id: String(user?.user_id),
          device_id: user?.device_id || 'web',
          device_type: user?.device_type || 'Laptop'
        });
        
        if (response.data?.data) {
          // Map user data to expected format and filter for agents only (role_id = 6)
          const usersList = response.data.data
            .filter(u => u.role_id === 6 || String(u.role || u.role_name || '').toUpperCase() === 'AGENT')
            .map(u => ({
              user_id: u.user_id,
              user_name: u.user_name,
              role_id: u.role_id,
              team_name: u.team_name
            }));
          setUsers(usersList);
        } else {
          setUsers([]);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        toast.error('Failed to load users');
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (user?.user_id) {
      fetchUsers();
    }
  }, [user?.user_id, user?.device_id, user?.device_type]);

  // Fetch teams dropdown data
  useEffect(() => {
    const loadTeams = async () => {
      if (!canViewTeamFilter || !user?.user_id) return;
      
      try {
        setLoadingTeams(true);
        const response = await api.post('/dropdown/get', {
          logged_in_user_id: user?.user_id,
          dropdown_type: 'teams'
        });
        const teamsData = response.data?.data || [];
        setTeams(teamsData);
      } catch (err) {
        console.error('Error fetching teams:', err);
        toast.error('Failed to load teams');
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };

    loadTeams();
  }, [canViewTeamFilter, user?.user_id]);

  // Fetch report data function
  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const requestBody = {
        logged_in_user_id: user?.user_id
      };
      
      // Add month_year filter if a specific month is selected
      if (selectedMonthFilter && selectedMonthFilter !== 'all') {
        requestBody.month_year = selectedMonthFilter;
      }
      
      // Add team_id filter if a specific team is selected
      if (selectedTeam && selectedTeam !== 'all') {
        requestBody.team_id = selectedTeam;
      }
      
      const response = await api.post('/user_monthly_tracker/list', requestBody);
      
      if (response.data?.data) {
        // Map API response to component format
        // Filter out records without user_monthly_tracker_id (users without tracker data)
        const mappedData = response.data.data
          .filter(record => record.user_monthly_tracker_id !== null)
          .map(record => ({
            id: record.user_monthly_tracker_id,
            user_id: record.user_id,
            user_name: record.user_name,
            team_name: record.team_name,
            month_year: record.month_year,
            monthly_target: parseFloat(record.monthly_target),
            extra_assign_hours: parseFloat(record.extra_assigned_hours),
            working_days: parseFloat(record.working_days),
            submitted: true
          }));
        
        setReportData(mappedData);
      } else {
        setReportData([]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching report data:', err);
      toast.error('Failed to fetch report data');
      setError('Failed to fetch report data');
      setLoading(false);
    }
  }, [user?.user_id, selectedMonthFilter, selectedTeam]);

  // Fetch report data on mount
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Auto-expand current month on initial load
  useEffect(() => {
    const currentMonth = getCurrentMonthYear();
    setExpandedMonths(prev => ({
      ...prev,
      [currentMonth]: true
    }));
  }, [users, reportData]);

  // Auto-expand when a specific month is selected in filter
  useEffect(() => {
    if (selectedMonthFilter !== 'all') {
      setExpandedMonths(prev => ({
        ...prev,
        [selectedMonthFilter]: true
      }));
    }
  }, [selectedMonthFilter]);

  // Handle month/year change from picker
  const handleMonthYearChange = (value) => {
    setSelectedMonthFilter(value);
  };

  // Handle team change
  const handleTeamChange = (value) => {
    setSelectedTeam(value);
  };

  // Handle clear filter
  const handleClearFilter = () => {
    setSelectedMonthFilter('all');
    setSelectedTeam('all');
  };

  // Handle edit click
  const handleEditClick = (record) => {
    setEditingId(record.id);
    setEditData({
      user_id: record.user_id,
      month_year: record.month_year,
      monthly_target: record.monthly_target,
      extra_assign_hours: record.extra_assign_hours,
      working_days: record.working_days
    });
  };

  // Handle edit save - only update extra_assigned_hours
  const handleEditSave = async (id) => {
    try {
      const payload = {
        user_id: editData.user_id,
        month_year: editData.month_year,
        extra_assigned_hours: parseFloat(editData.extra_assign_hours)
      };

      const response = await api.post('/user_monthly_tracker/update', payload);
      
      if (response.data?.status === 200) {
        toast.success(response.data.message || 'Extra assign hours updated successfully');
        
        // Refresh data from server
        await fetchReportData();
        
        setEditingId(null);
        setEditData({});
      }
    } catch (err) {
      console.error('Error updating record:', err);
      toast.error(err.response?.data?.message || 'Failed to update extra assign hours');
    }
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  // Handle edit data change
  const handleEditDataChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  if (loadingUsers) {
    return <LoadingSpinner />;
  }

  // Return report data from API
  const getTableData = () => {
    return [...reportData];
  };

  // Group data by month_year
  const groupByMonth = (data) => {
    const grouped = {};
    data.forEach(record => {
      const month = record.month_year;
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push(record);
    });
    return grouped;
  };

  // Toggle month card expansion
  const toggleMonth = (monthYear) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthYear]: !prev[monthYear]
    }));
  };

  // Export to CSV function for a specific month
  const handleExportToExcel = (monthYear) => {
    if (reportData.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Filter data for the specific month and apply search filter
      let filteredData = reportData.filter(record => record.month_year === monthYear);
      
      // Apply search filter if search term exists
      if (searchTerm) {
        filteredData = filteredData.filter(record => 
          record.user_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      // Export only submitted records (matching table display logic)
      const submittedRecords = filteredData.filter(record => record.id && record.submitted);

      if (submittedRecords.length === 0) {
        toast.error('No submitted data available to export');
        return;
      }

      const exportData = submittedRecords.map((record) => {
        const data = {
          'User Name': record.user_name || '-',
        };
        if (canViewTeamColumn) {
          data['Team'] = record.team_name || '-';
        }
        data['Month/Year'] = record.month_year || '-';
        data['Monthly Target'] = record.monthly_target || 0;
        data['Working Days'] = record.working_days || 0;
        data['Extra Assign Hours'] = record.extra_assign_hours || 0;
        return data;
      });

      // Calculate totals
      const totals = {
        'User Name': 'TOTAL',
      };
      if (canViewTeamColumn) {
        totals['Team'] = '';
      }
      totals['Month/Year'] = '';
      totals['Monthly Target'] = submittedRecords.reduce((sum, r) => sum + (Number(r.monthly_target) || 0), 0);
      totals['Working Days'] = submittedRecords.reduce((sum, r) => sum + (Number(r.working_days) || 0), 0);
      totals['Extra Assign Hours'] = submittedRecords.reduce((sum, r) => sum + (Number(r.extra_assign_hours) || 0), 0);

      // Add totals row to export data
      exportData.push(totals);

      // Generate filename
      const filename = `User_Monthly_Report_${monthYear}.csv`;

      // Export to CSV
      exportToCSV(exportData, filename);

      toast.success(`Exported ${submittedRecords.length} records successfully!`);
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to export data');
    }
  };

  const tableData = getTableData();
  const groupedData = groupByMonth(tableData);
  
  // Sort months in reverse chronological order (most recent first)
  const allMonthYears = Object.keys(groupedData).sort((a, b) => {
    // Parse month and year from format like "FEB2026"
    const parseMonthYear = (str) => {
      const monthMap = {
        'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
        'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
      };
      const month = str.substring(0, 3);
      const year = parseInt(str.substring(3));
      return { year, month: monthMap[month] };
    };
    
    const dateA = parseMonthYear(a);
    const dateB = parseMonthYear(b);
    
    // Sort by year descending, then by month descending
    if (dateB.year !== dateA.year) {
      return dateB.year - dateA.year;
    }
    return dateB.month - dateA.month;
  });
  
  // Filter months based on selected filter
  const monthYears = selectedMonthFilter === 'all' 
    ? allMonthYears 
    : allMonthYears.filter(month => month === selectedMonthFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-white">User Monthly Goal</h2>
        <p className="text-blue-100 text-sm mt-1">Manage monthly targets for users</p>
      </div>

      {/* Month/Year Filter */}
      <MonthYearPicker
        selectedMonthYear={selectedMonthFilter}
        onMonthYearChange={handleMonthYearChange}
        onClear={handleClearFilter}
        label="Filter by Month/Year"
        availableMonthYears={[]}
        showAllOption={true}
      />

      {/* User Monthly Reports by Month */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <ErrorMessage message={error} />
        </div>
      ) : monthYears.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-16">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 bg-slate-100 rounded-full">
              <FileX className="w-16 h-16 text-slate-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Data Available</h3>
              <p className="text-slate-500 max-w-md">
                {selectedMonthFilter !== 'all' || selectedTeam !== 'all'
                  ? 'No user data found for the selected filters. Try adjusting your filter criteria or clearing the filters.'
                  : 'No user monthly report data available. Data will appear here once users have monthly targets set.'}
              </p>
            </div>
            {(selectedMonthFilter !== 'all' || selectedTeam !== 'all') && (
              <button
                onClick={handleClearFilter}
                className="mt-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {monthYears.map((monthYear) => {
            const isExpanded = expandedMonths[monthYear];
            const monthData = groupedData[monthYear];
            const filteredMonthData = monthData.filter(record => 
              record.user_name.toLowerCase().includes(searchTerm.toLowerCase())
            );

            return (
              <div key={monthYear} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                {/* Month Card Header */}
                <div 
                  className="bg-white px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-200"
                  onClick={() => toggleMonth(monthYear)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-sm">
                      {monthYear}
                    </div>
                    <span className="text-slate-600 text-sm font-medium">
                      {searchTerm ? `${filteredMonthData.length} of ${monthData.length}` : filteredMonthData.length} {filteredMonthData.length === 1 ? 'user' : 'users'}
                    </span>
                  </div>
                  <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Expanded Card Content */}
                {isExpanded && (
                  <div className="p-6">
                    {/* Search Filter and Export Button */}
                    <div className="mb-4 flex gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-10 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      {/* Team Filter - Only visible for Admin, Super Admin, and Project Manager */}
                      {canViewTeamFilter && (
                        <div className="w-64">
                          <SearchableSelect
                            value={selectedTeam}
                            onChange={handleTeamChange}
                            icon={Users}
                            placeholder="All Teams"
                            disabled={loadingTeams}
                            isClearable={true}
                            options={[
                              { label: 'All Teams', value: 'all' },
                              ...teams.map(team => ({
                                label: team.label,
                                value: team.team_id
                              }))
                            ]}
                          />
                        </div>
                      )}
                      {/* Export to Excel Button */}
                      <button
                        onClick={() => handleExportToExcel(monthYear)}
                        disabled={loading || filteredMonthData.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                        title="Export this month's data to Excel"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 border-collapse">
                        <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border border-blue-500">User Name</th>
                            {canViewTeamColumn && (
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border border-blue-500">Team</th>
                            )}
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">Monthly Target</th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">Working Days</th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">Extra Assign Hours</th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {filteredMonthData.length > 0 ? (
                            <>
                            {filteredMonthData.map((record) => {
                              // Check if this record is being edited
                              const isEditing = editingId === record.id;
                              
                              if (isEditing) {
                                // Edit Mode - Show inline edit fields
                                return (
                                  <tr key={`edit-${record.id}`} className="transition-all duration-200 border-b border-slate-300 bg-white">
                                    <td className="px-6 py-4 text-slate-800 font-medium border border-slate-300">{record.user_name}</td>
                                    {canViewTeamColumn && (
                                      <td className="px-6 py-4 text-slate-600 border border-slate-300">{record.team_name || '-'}</td>
                                    )}
                                    <td className="px-6 py-4 text-center text-slate-800 font-semibold border border-slate-300">
                                      {editData.monthly_target}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-800 font-semibold border border-slate-300">
                                      {editData.working_days}
                                    </td>
                                    <td className="px-6 py-4 border border-slate-300">
                                      <input
                                        type="text"
                                        name="extra_assign_hours"
                                        value={editData.extra_assign_hours}
                                        onChange={handleEditDataChange}
                                        placeholder="Enter hours"
                                        className="w-full bg-white border-2 border-indigo-300 text-slate-800 text-sm rounded-lg px-3 py-2 text-center outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                                      />
                                    </td>
                                    <td className="px-6 py-4 border border-slate-300">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() => handleEditSave(record.id)}
                                          className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-all hover:shadow-md"
                                          title="Save"
                                        >
                                          <Save className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={handleEditCancel}
                                          className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-all hover:shadow-md"
                                          title="Cancel"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              } else {
                                // View Mode - Show data with Edit/Delete buttons
                                return (
                                  <tr key={`view-${record.id}`} className="transition-all duration-200 border-b border-slate-300 hover:bg-slate-50">
                                    <td className="px-6 py-4 text-slate-800 font-medium border border-slate-300">{record.user_name}</td>
                                    {canViewTeamColumn && (
                                      <td className="px-6 py-4 text-slate-600 border border-slate-300">{record.team_name || '-'}</td>
                                    )}
                                    <td className="px-6 py-4 text-center text-slate-800 font-semibold border border-slate-300">
                                      {record.monthly_target}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-700 font-semibold border border-slate-300">
                                      {record.working_days}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-700 font-semibold border border-slate-300">
                                      {record.extra_assign_hours}
                                    </td>
                                    <td className="px-6 py-4 border border-slate-300">
                                      <div className="flex items-center justify-center">
                                        <button
                                          onClick={() => handleEditClick(record)}
                                          className="p-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-all hover:shadow-md"
                                          title="Edit Extra Assign Hours"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }
                            })}
                            {/* Totals Row */}
                            <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-600 font-bold">
                              <td className="px-6 py-4 text-slate-800 font-bold border border-slate-300" colSpan={canViewTeamColumn ? "2" : "1"}>
                                TOTAL
                              </td>
                              <td className="px-6 py-4 text-center text-blue-700 font-bold border border-slate-300">
                                {filteredMonthData
                                  .filter(r => r.id && r.submitted)
                                  .reduce((sum, r) => sum + (Number(r.monthly_target) || 0), 0)
                                  .toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-center text-blue-700 font-bold border border-slate-300">
                                {filteredMonthData
                                  .filter(r => r.id && r.submitted)
                                  .reduce((sum, r) => sum + (Number(r.working_days) || 0), 0)
                                  .toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-center text-blue-700 font-bold border border-slate-300">
                                {filteredMonthData
                                  .filter(r => r.id && r.submitted)
                                  .reduce((sum, r) => sum + (Number(r.extra_assign_hours) || 0), 0)
                                  .toFixed(2)}
                              </td>
                              <td className="px-6 py-4 border border-slate-300"></td>
                            </tr>
                            </>
                          ) : (
                            <tr>
                              <td colSpan={canViewTeamColumn ? "6" : "5"} className="px-6 py-12 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <FileX className="w-16 h-16 text-slate-300" />
                                  <div>
                                    <p className="text-lg font-bold text-slate-700 mb-1">No Data Available</p>
                                    <p className="text-slate-500 text-sm">
                                      {searchTerm && selectedTeam !== 'all'
                                        ? `No users found matching "${searchTerm}" in the selected team`
                                        : searchTerm
                                        ? `No users found matching "${searchTerm}"`
                                        : selectedTeam !== 'all'
                                        ? 'No users found in the selected team for this month'
                                        : 'No data available for this month'}
                                    </p>
                                  </div>
                                  {(searchTerm || selectedTeam !== 'all') && (
                                    <button
                                      onClick={() => {
                                        setSearchTerm('');
                                        setSelectedTeam('all');
                                      }}
                                      className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 text-sm font-medium rounded-lg transition-all border border-blue-200"
                                    >
                                      Clear Filters
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

          </div>
  );
};

export default UserMonthlyReport;
