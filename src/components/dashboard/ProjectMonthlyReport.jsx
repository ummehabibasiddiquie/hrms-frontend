import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, ChevronUp, ChevronDown, Search, Download, FileX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import * as XLSX from 'xlsx';
import { MonthYearPicker } from '../common/CustomCalendar';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import { exportToCSV } from '../../utils/csvExport';

const ProjectMonthlyReport = () => {
  const { user } = useAuth();
  
  // State for projects dropdown
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  
  // Table data state
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  
  // Add state - for new records
  const [addingProjectId, setAddingProjectId] = useState(null);
  const [addingMonthYear, setAddingMonthYear] = useState(null);
  const [addData, setAddData] = useState({});
  
  // State for expanded/collapsed cards
  const [expandedMonths, setExpandedMonths] = useState({});
  
  // State for month filter
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  
  // State for search filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper to get current month in format like FEB2026
  function getCurrentMonthYear() {
    const now = new Date();
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${monthNames[now.getMonth()]}${now.getFullYear()}`;
  }

  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const response = await api.post('/project/list', {
          logged_in_user_id: user?.user_id
        });
        
        if (response.data?.data) {
          // Extract project_id and project_name from response
          const projectsList = response.data.data.map(project => ({
            project_id: project.project_id,
            project_name: project.project_name
          }));
          setProjects(projectsList);
        }
      } catch (err) {
        console.error('Error fetching projects:', err);
        toast.error('Failed to load projects');
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    if (user?.user_id) {
      fetchProjects();
    }
  }, [user?.user_id]);

  // Fetch report data (mock data for now - replace with actual API)
  useEffect(() => {
    if (user?.user_id && projects.length > 0) {
      fetchReportData();
    }
  }, [user?.user_id, projects.length]);

  // Auto-expand current month on initial load
  useEffect(() => {
    const currentMonth = getCurrentMonthYear();
    setExpandedMonths(prev => ({
      ...prev,
      [currentMonth]: true
    }));
  }, [projects, reportData]);

  // Auto-expand when a specific month is selected in filter
  useEffect(() => {
    if (selectedMonthFilter !== 'all') {
      setExpandedMonths(prev => ({
        ...prev,
        [selectedMonthFilter]: true
      }));
    }
  }, [selectedMonthFilter]);

  // Handle month/year filter change
  const handleMonthYearChange = (value) => {
    setSelectedMonthFilter(value);
  };

  // Handle clear filter
  const handleClearFilter = () => {
    setSelectedMonthFilter('all');
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await api.post('/project_monthly_tracker/list', {});
      
      if (response.data?.data?.rows) {
        // Map API response to component data structure
        const mappedData = response.data.data.rows.map(record => ({
          id: record.project_monthly_tracker_id,
          project_id: record.project_id,
          project_name: record.project_name,
          month_year: record.month_year,
          monthly_target: parseFloat(record.monthly_target) || 0,
          achieved_monthly_target: parseFloat(record.achieved_hours) || 0,
          pending_monthly_target: parseFloat(record.pending_hours) || 0,
          tenure_achieved_hours: parseFloat(record.tenure_achieved_hours) || 0,
          tenure_pending_hours: parseFloat(record.tenure_pending_hours) || 0
        }));
        setReportData(mappedData);
      } else {
        setReportData([]);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data');
      toast.error('Failed to load report data');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle add mode - when clicking Add icon for a new project
  const handleAddClick = (project, monthYear) => {
    setAddingProjectId(project.project_id);
    setAddingMonthYear(monthYear);
    setAddData({
      project_id: project.project_id,
      project_name: project.project_name,
      month_year: monthYear,
      monthly_target: ''
    });
  };

  // Handle add data change
  const handleAddDataChange = (e) => {
    const { name, value } = e.target;
    setAddData(prev => ({ ...prev, [name]: value }));
  };

  // Handle add save
  const handleAddSave = async () => {
    if (!addData.monthly_target || addData.monthly_target === '') {
      toast.error('Please enter monthly target');
      return;
    }

    // Debug logging
    console.log('Attempting to add:', addData);
    console.log('Current reportData:', reportData);
    const existingRecord = reportData.find(
      r => r.project_id === addData.project_id && r.month_year === addData.month_year
    );
    console.log('Existing record check:', existingRecord);
    
    if (existingRecord) {
      toast.error('This project already has data for this month. Please use Edit instead.');
      handleAddCancel();
      return;
    }

    try {
      const payload = {
        project_id: Number(addData.project_id),
        month_year: addData.month_year,
        monthly_target: String(addData.monthly_target)
      };
      
      const response = await api.post('/project_monthly_tracker/add', payload);
      
      if (response.data?.status === 201) {
        toast.success(response.data?.message || 'Project monthly target added successfully!');
        // Reset add state
        setAddingProjectId(null);
        setAddingMonthYear(null);
        setAddData({});
        // Refresh the data
        await fetchReportData();
      }
    } catch (err) {
      console.error('Error adding record:', err);
      const errorMessage = err.response?.data?.message || 'Failed to add project monthly target';
      
      if (err.response?.status === 409) {
        toast.error('This record already exists. Refreshing data...');
        // Refresh data to show the latest state
        await fetchReportData();
        handleAddCancel();
      } else {
        toast.error(errorMessage);
      }
    }
  };

  // Handle add cancel
  const handleAddCancel = () => {
    setAddingProjectId(null);
    setAddingMonthYear(null);
    setAddData({});
  };

  // Handle edit click
  const handleEditClick = (record) => {
    setEditingId(record.id);
    setEditData({
      project_id: record.project_id,
      month_year: record.month_year,
      monthly_target: record.monthly_target,
      achieved_monthly_target: record.achieved_monthly_target || 0,
      pending_monthly_target: record.pending_monthly_target || 0
    });
  };

  // Handle edit save
  const handleEditSave = async (id) => {
    try {
      const payload = {
        project_monthly_tracker_id: id,
        month_year: editData.month_year,
        monthly_target: String(editData.monthly_target)
      };
      
      const response = await api.post('/project_monthly_tracker/update', payload);
      
      if (response.data?.status === 200) {
        toast.success(response.data?.message || 'Record updated successfully!');
        // Refresh the data
        await fetchReportData();
        setEditingId(null);
        setEditData({});
      }
    } catch (err) {
      console.error('Error updating record:', err);
      toast.error(err.response?.data?.message || 'Failed to update record');
    }
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  // Handle delete
  const handleDeleteClick = (record) => {
    setRecordToDelete(record);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;

    setIsDeleting(true);
    try {
      const payload = {
        project_monthly_tracker_id: recordToDelete.id
      };
      
      const response = await api.post('/project_monthly_tracker/delete', payload);
      
      if (response.data?.status === 200) {
        toast.success(response.data?.message || 'Record deleted successfully!');
        // Refresh the data
        await fetchReportData();
        
        // Close modal and reset state
        setDeleteModalOpen(false);
        setRecordToDelete(null);
      }
    } catch (err) {
      console.error('Error deleting record:', err);
      toast.error(err.response?.data?.message || 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setRecordToDelete(null);
  };

  // Handle edit data change
  const handleEditDataChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  if (loadingProjects) {
    return <LoadingSpinner />;
  }

  // Create merged data: all projects with their report data for each month
  const getTableDataByMonth = () => {
    // Get all unique months from reportData
    const monthsFromData = [...new Set(reportData.map(r => r.month_year))];
    const currentMonth = getCurrentMonthYear();
    
    // Include current month if not in data
    const allMonths = monthsFromData.includes(currentMonth) 
      ? monthsFromData 
      : [...monthsFromData, currentMonth];
    
    const result = {};
    
    // For each month, create entries for all projects
    allMonths.forEach(monthYear => {
      result[monthYear] = projects.map(project => {
        // Check if this specific project has data for this specific month
        const existingReport = reportData.find(
          r => r.project_id === project.project_id && r.month_year === monthYear
        );
        
        if (existingReport) {
          return existingReport;
        } else {
          // No data for this project-month combination
          return {
            project_id: project.project_id,
            project_name: project.project_name,
            month_year: monthYear,
            isNew: true
          };
        }
      });
    });
    
    return result;
  };

  // Toggle month card expansion
  const toggleMonth = (monthYear) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthYear]: !prev[monthYear]
    }));
  };

  // Export to CSV function
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Convert data to CSV string
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in values
          const stringValue = String(value || '');
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel function for a specific month
  const handleExportToExcel = async (monthYear) => {
    try {
      // Fetch fresh data directly from API for export
      const response = await api.post('/project_monthly_tracker/list', {});
      
      if (!response.data?.data?.rows) {
        toast.error('No data available to export');
        return;
      }

      // Filter data for the specific month
      let monthData = response.data.data.rows.filter(record => record.month_year === monthYear);
      
      // Apply search filter if search term exists
      if (searchTerm) {
        monthData = monthData.filter(record => 
          record.project_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (monthData.length === 0) {
        toast.error('No projects to export for this month');
        return;
      }

      // Export all projects with data directly from API
      const exportData = monthData.map((record) => ({
        'Project Name': record.project_name || '-',
        'Month/Year': record.month_year || '-',
        'Monthly Target': record.monthly_target || 0,
        'Achieved Monthly Target': record.achieved_hours || 0,
        'Pending Monthly Target': record.pending_hours || 0,
        'Tenure Achieved Hours': Number(record.tenure_achieved_hours || 0).toFixed(2),
        'Tenure Pending Hours': Number(record.tenure_pending_hours || 0).toFixed(2)
      }));

      // Calculate totals
      const totals = {
        'Project Name': 'TOTAL',
        'Month/Year': '',
        'Monthly Target': monthData.reduce((sum, r) => sum + (Number(r.monthly_target) || 0), 0),
        'Achieved Monthly Target': monthData.reduce((sum, r) => sum + (Number(r.achieved_hours) || 0), 0),
        'Pending Monthly Target': monthData.reduce((sum, r) => sum + (Number(r.pending_hours) || 0), 0),
        'Tenure Achieved Hours': monthData.reduce((sum, r) => sum + (Number(r.tenure_achieved_hours) || 0), 0).toFixed(2),
        'Tenure Pending Hours': monthData.reduce((sum, r) => sum + (Number(r.tenure_pending_hours) || 0), 0).toFixed(2)
      };
      exportData.push(totals);

      const filename = `Project_Monthly_Report_${monthYear}.csv`;
      exportToCSV(exportData, filename);

      toast.success(`Exported ${monthData.length} projects successfully!`);
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to export data');
    }
  };

  const groupedData = getTableDataByMonth();
  
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
        <h2 className="text-2xl font-bold text-white">Project Monthly Report</h2>
        <p className="text-blue-100 text-sm mt-1">Manage monthly targets for projects</p>
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

      {/* Project Monthly Reports by Month */}
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
                {selectedMonthFilter !== 'all'
                  ? 'No project data found for the selected month filter. Try adjusting your filter criteria or clearing the filter.'
                  : 'No project monthly report data available. Data will appear here once projects have monthly targets set.'}
              </p>
            </div>
            {selectedMonthFilter !== 'all' && (
              <button
                onClick={handleClearFilter}
                className="mt-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
              >
                Clear Filter
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
              record.project_name.toLowerCase().includes(searchTerm.toLowerCase())
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
                      {searchTerm ? `${filteredMonthData.length} of ${monthData.length}` : filteredMonthData.length} {filteredMonthData.length === 1 ? 'project' : 'projects'}
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
                          placeholder="Search projects..."
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
                      {/* Export to CSV Button */}
                      <button
                        onClick={() => handleExportToExcel(monthYear)}
                        disabled={loading || filteredMonthData.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                        title="Export this month's data to CSV"
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
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border border-blue-500">
                              Project Name
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">
                              Monthly Target
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">
                              Monthly Achieved Target
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">
                              Monthly Pending Target
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider border border-blue-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {filteredMonthData.map((record) => (
                  <tr key={`${record.project_id}-${monthYear}`} className="transition-all duration-200">
                    {record.isNew && addingProjectId === record.project_id && addingMonthYear === monthYear ? (
                      // Add Mode - for new records
                      <>
                        <td className="px-6 py-4 text-slate-800 font-medium border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {record.project_name}
                        </td>
                        <td className="px-6 py-4 border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          <input
                            type="text"
                            name="monthly_target"
                            value={addData.monthly_target}
                            onChange={handleAddDataChange}
                            className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg px-3 py-2 text-center outline-none focus:border-blue-500"
                            placeholder="Enter target"
                          />
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500 font-semibold bg-white border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          0.00
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500 font-semibold bg-white border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          0.00
                        </td>
                        <td className="px-6 py-4 border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={handleAddSave}
                              className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleAddCancel}
                              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : !record.isNew && editingId === record.id ? (
                      // Edit Mode - Only Monthly Target is editable
                      <>
                        <td className="px-6 py-4 text-slate-800 font-medium border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {record.project_name}
                        </td>
                        <td className="px-6 py-4 border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          <input
                            type="text"
                            name="monthly_target"
                            value={editData.monthly_target}
                            onChange={handleEditDataChange}
                            className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg px-3 py-2 text-center outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700 bg-white border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {(editData.achieved_monthly_target || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700 bg-white border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {(editData.pending_monthly_target || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditSave(record.id)}
                              className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleEditCancel}
                              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : record.isNew ? (
                      // View Mode for New Records - Show ADD icon
                      <>
                        <td className="px-6 py-4 text-slate-800 font-medium border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {record.project_name}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-400 italic border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          Not set
                        </td>
                        <td className="px-6 py-4 text-center text-slate-400 bg-slate-50 border border-slate-300">
                          -
                        </td>
                        <td className="px-6 py-4 text-center text-slate-400 bg-slate-50 border border-slate-300">
                          -
                        </td>
                        <td className="px-6 py-4 border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleAddClick(record, monthYear)}
                              className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                              title="Add"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode for Existing Records - Show EDIT/DELETE icons
                      <>
                        <td className="px-6 py-4 text-slate-800 font-medium border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {record.project_name}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-800 font-semibold border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {Number(record.monthly_target).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700 font-semibold bg-white border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {Number(record.achieved_monthly_target || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700 font-semibold bg-white border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          {Number(record.pending_monthly_target || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 border border-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditClick(record)}
                              className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(record)}
                              className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Totals Row - Only show if there's actual data */}
                {filteredMonthData.some(r => !r.isNew) && (
                  <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-600 font-bold">
                    <td className="px-6 py-4 text-slate-800 font-bold border border-slate-300">
                      TOTAL
                    </td>
                    <td className="px-6 py-4 text-center text-blue-700 font-bold border border-slate-300">
                      {filteredMonthData
                        .filter(r => !r.isNew)
                        .reduce((sum, r) => sum + (Number(r.monthly_target) || 0), 0)
                        .toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center text-blue-700 font-bold border border-slate-300">
                      {filteredMonthData
                        .filter(r => !r.isNew)
                        .reduce((sum, r) => sum + (Number(r.achieved_monthly_target) || 0), 0)
                        .toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center text-blue-700 font-bold border border-slate-300">
                      {filteredMonthData
                        .filter(r => !r.isNew)
                        .reduce((sum, r) => sum + (Number(r.pending_monthly_target) || 0), 0)
                        .toFixed(2)}
                    </td>
                    <td className="px-6 py-4 border border-slate-300"></td>
                  </tr>
                )}
                {filteredMonthData.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <FileX className="w-16 h-16 text-slate-300" />
                        <div>
                          <p className="text-lg font-bold text-slate-700 mb-1">No Data Available</p>
                          <p className="text-slate-500 text-sm">
                            {searchTerm
                              ? `No projects found matching "${searchTerm}"`
                              : 'No project data available for this month'}
                          </p>
                        </div>
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 text-sm font-medium rounded-lg transition-all border border-blue-200"
                          >
                            Clear Search
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Project Monthly Record"
        entityName={recordToDelete ? recordToDelete.project_name : ""}
        entityType="project monthly record"
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default ProjectMonthlyReport;
