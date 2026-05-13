/**
 * File: QATrackerReport.jsx
 * Author: Naitik Maisuriya
 * Description: QA Tracker Report - Shows tracker entries for assigned agents with filters
 */
import React, { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Download, Filter, FileDown, Users as UsersIcon, Calendar, RotateCcw, RefreshCw, Edit, Trash2, X, ChevronDown, Briefcase, ListTodo, Info, Plus, ListChecks, Clock, TrendingUp, Target } from "lucide-react";
import { toast } from "react-hot-toast";
import { downloadCSV, jsonToCSV } from "../../utils/csvExport";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { log, logError } from "../../config/environment";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { DateRangePicker } from "../common/CustomCalendar";
import MultiSelectWithCheckbox from "../common/MultiSelectWithCheckbox";
import SearchableSelect from "../common/SearchableSelect";

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const QATrackerReport = () => {
  const { user } = useAuth();
  const { device_id, device_type } = useDeviceInfo();
  
  // Check if user is QA agent (QA agents should not see edit/delete actions)
  const roleId = user?.role_id;
  const role = user?.role_name || user?.role || '';
  const designation = user?.designation || user?.user_designation || '';
  const isQAAgent = roleId === 5 || 
                    String(designation).toLowerCase() === 'qa' || 
                    String(role).toLowerCase().includes('qa');
  
  // Check if user is PM, Admin, or Super Admin (for team filter visibility)
  const isProjectManager = roleId === 3 || String(designation).toLowerCase() === 'project manager' || String(role).toLowerCase().includes('project manager');
  const isAdmin = roleId === 1 || String(role).toLowerCase() === 'admin' || String(designation).toLowerCase() === 'admin';
  const isSuperAdmin = String(role).toLowerCase().includes('super') || String(designation).toLowerCase().includes('super');
  const canViewTeamFilter = isProjectManager || isAdmin || isSuperAdmin;
  
  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiTotals, setApiTotals] = useState(null);

  // Filter states
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [summary, setSummary] = useState([]);
  
  // Edit modal dropdown states
  const [showEditProjectDropdown, setShowEditProjectDropdown] = useState(false);
  const [showEditTaskDropdown, setShowEditTaskDropdown] = useState(false);

  // Store per-hour targets from dropdown API
  const [dropdownTaskMap, setDropdownTaskMap] = useState({});

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTracker, setEditingTracker] = useState(null);
  const [editProjects, setEditProjects] = useState([]);
  const [editTasks, setEditTasks] = useState([]);
  const [editFormData, setEditFormData] = useState({
    tracker_datetime: "",
    project_id: "",
    task_id: "",
    shift_type: "",
    production: "",
    base_target: "",
    tracker_note: "",
    tracker_file: null,
  });
  const [editFilePreview, setEditFilePreview] = useState(null);
  const [editFileBase64, setEditFileBase64] = useState(null);
  const [editFileError, setEditFileError] = useState("");
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editProductionError, setEditProductionError] = useState("");

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTracker, setDeletingTracker] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Add tracker modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addProjects, setAddProjects] = useState([]);
  const [addTasks, setAddTasks] = useState([]);
  const [addFormData, setAddFormData] = useState({
    agent_id: "",
    tracker_datetime: "",
    project_id: "",
    task_id: "",
    shift_type: "",
    production: "",
    base_target: "",
    tracker_note: "",
    tracker_file: null,
  });
  const [addFileError, setAddFileError] = useState("");
  const [loadingAddData, setLoadingAddData] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addProductionError, setAddProductionError] = useState("");
  const [addTouched, setAddTouched] = useState({});
  const [addErrors, setAddErrors] = useState({});

  // Users list for agent dropdown filter
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Teams list for team dropdown filter
  const [teamsList, setTeamsList] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Projects and Tasks lists for filter dropdowns
  const [projectsList, setProjectsList] = useState([]);
  const [tasksList, setTasksList] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Fetch projects and tasks from API for filter dropdowns
  const fetchProjectsAndTasks = async () => {
    try {
      setLoadingProjects(true);
      setLoadingTasks(true);
      log('[QATrackerReport] Fetching projects and tasks for filters');
      
      const payload = {
        logged_in_user_id: Number(user?.user_id),
        dropdown_type: "projects with tasks"
      };
      
      const res = await api.post("/dropdown/get", payload);
      const projectsData = res.data?.data || [];
      
      const projects = projectsData.map(project => ({
        project_id: project.project_id,
        project_name: project.project_name
      }));
      
      const allTasks = [];
      projectsData.forEach(project => {
        if (project.tasks && Array.isArray(project.tasks)) {
          project.tasks.forEach(task => {
            allTasks.push({
              task_id: task.task_id,
              task_name: task.label,
              task_target: task.task_target,
              project_id: project.project_id
            });
          });
        }
      });
      
      setProjectsList(projects);
      setTasksList(allTasks);
      
      log('[QATrackerReport] Projects and tasks fetched successfully:', {
        projects: projects.length,
        tasks: allTasks.length
      });
    } catch (error) {
      logError('[QATrackerReport] Error fetching projects and tasks:', error);
      setProjectsList([]);
      setTasksList([]);
      toast.error("Failed to load projects and tasks for filters");
    } finally {
      setLoadingProjects(false);
      setLoadingTasks(false);
    }
  };

  // Fetch users from dropdown/get API for agent dropdown
  const fetchUsers = async (teamId = null) => {
    try {
      setLoadingUsers(true);
      console.log('[QATrackerReport] fetchUsers called with teamId:', teamId);
      log('[QATrackerReport] Fetching agents list for agent filter');
      const payload = {
        logged_in_user_id: user?.user_id,
        dropdown_type: "agent"
      };
      if (teamId) {
        payload.team_id = Number(teamId);
        console.log('[QATrackerReport] Payload with team_id:', payload);
        log('[QATrackerReport] Filtering agents by team_id:', teamId);
      } else {
        console.log('[QATrackerReport] Payload without team_id:', payload);
      }
      const res = await api.post("/dropdown/get", payload);
      const agents = res.data?.data || [];
      console.log('[QATrackerReport] Agents received from API:', agents.length);
      const sortedAgents = agents
        .filter(a => a.label && a.user_id)
        .sort((a, b) => a.label.localeCompare(b.label));
      setUsersList(sortedAgents);
      console.log('[QATrackerReport] Agents list updated:', sortedAgents.length);
      log('[QATrackerReport] Agents fetched successfully:', sortedAgents.length);
    } catch (error) {
      console.error('[QATrackerReport] Error fetching agents:', error);
      logError('[QATrackerReport] Error fetching agents:', error);
      setUsersList([]);
      toast.error("Failed to load agents for filter");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch teams from dropdown/get API for team dropdown
  const fetchTeams = async () => {
    try {
      setLoadingTeams(true);
      log('[QATrackerReport] Fetching teams list for team filter');
      const payload = {
        logged_in_user_id: user?.user_id,
        dropdown_type: "teams"
      };
      const res = await api.post("/dropdown/get", payload);
      const teams = res.data?.data || [];
      const sortedTeams = teams
        .filter(t => t.label && (t.team_id || t.value))
        .sort((a, b) => a.label.localeCompare(b.label));
      setTeamsList(sortedTeams);
      log('[QATrackerReport] Teams fetched successfully:', sortedTeams.length);
    } catch (error) {
      logError('[QATrackerReport] Error fetching teams:', error);
      setTeamsList([]);
      toast.error("Failed to load teams for filter");
    } finally {
      setLoadingTeams(false);
    }
  };

  // Fetch projects with tasks for edit modal
  const fetchProjectsWithTasks = async () => {
    try {
      log('[QATrackerReport] Fetching projects with tasks for modals');
      const payload = {
        dropdown_type: "projects with tasks",
        logged_in_user_id: user?.user_id
      };
      const res = await api.post("/dropdown/get", payload);
      const projectsWithTasks = res.data?.data || [];
      setEditProjects(projectsWithTasks);
      setAddProjects(projectsWithTasks);
      log('[QATrackerReport] Projects with tasks fetched:', projectsWithTasks.length);
      return projectsWithTasks;
    } catch (error) {
      logError('[QATrackerReport] Error fetching projects with tasks:', error);
      setEditProjects([]);
      setAddProjects([]);
      toast.error("Failed to load projects");
      return [];
    }
  };

  // Fetch trackers and summary from tracker/view API with filters
  const fetchData = async () => {
    try {
      setLoading(true);
      let payload = {
        logged_in_user_id: user?.user_id,
        device_id: device_id,
        device_type: device_type
      };
      
      if (startDate) payload.date_from = startDate;
      if (endDate) payload.date_to = endDate;
      if (!startDate && !endDate) {
        const today = getTodayDate();
        payload.date_from = today;
        payload.date_to = today;
      }
      
      if (selectedAgents.length > 0) {
        payload.user_id = selectedAgents.map(id => Number(id));
      }
      
      if (selectedTeams) {
        payload.team_id = Number(selectedTeams);
      }
      
      if (selectedProject) {
        payload.project_id = Number(selectedProject);
      }
      
      if (selectedTask) {
        payload.task_id = Number(selectedTask);
      }
      
      log('[QATrackerReport] Fetching tracker data with payload:', payload);
      const res = await api.post("/tracker/view", payload);
      const data = res.data?.data || {};
      const fetchedTrackers = Array.isArray(data.trackers) ? data.trackers : [];
      setTrackers(fetchedTrackers);
      setSummary(Array.isArray(data.month_summary) ? data.month_summary : []);
      if (data.totals) {
        setApiTotals(data.totals);
      }
      log('[QATrackerReport] Fetched trackers:', fetchedTrackers.length, 'totals:', data.totals);
    } catch (err) {
      logError('[QATrackerReport] Error fetching tracker/view:', err);
      toast.error("Failed to load tracker data");
      setTrackers([]);
      setSummary([]);
      setApiTotals(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users, projects, and tasks list on component mount
  useEffect(() => {
    if (user?.user_id && device_id && device_type) {
      fetchUsers();
      if (canViewTeamFilter) {
        fetchTeams();
      }
      fetchProjectsAndTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, device_id, device_type]);

  // Refetch agents when team selection changes
  useEffect(() => {
    if (!user?.user_id) return;
    
    console.log('[QATrackerReport] Team selection changed:', selectedTeams);
    
    if (selectedTeams) {
      console.log('[QATrackerReport] Fetching agents for team_id:', selectedTeams);
      fetchUsers(selectedTeams);
      setSelectedAgents([]);
    } else {
      console.log('[QATrackerReport] No team selected, fetching all agents');
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeams]);

  // Fetch tracker data when filters change
  useEffect(() => {
    if (user?.user_id && device_id && device_type) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, device_id, device_type, startDate, endDate, selectedAgents, selectedTeams, selectedProject, selectedTask]);

  // Clear selected task when project changes
  useEffect(() => {
    if (selectedProject) {
      setSelectedTask('');
    }
  }, [selectedProject]);

  // Filter tasks based on selected project for cascading dropdown
  const filteredTasksList = useMemo(() => {
    if (!selectedProject) {
      return tasksList;
    }
    return tasksList.filter(task => String(task.project_id) === String(selectedProject));
  }, [tasksList, selectedProject]);

  // Format date and time to display format
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return { date: '-', time: '-' };
    
    try {
      const dt = new Date(dateTimeStr);
      if (isNaN(dt.getTime())) return { date: '-', time: '-' };
      
      const day = dt.getUTCDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[dt.getUTCMonth()];
      const year = dt.getUTCFullYear();
      const date = `${day}/${month}/${year}`;
      
      let hours = dt.getUTCHours();
      const minutes = String(dt.getUTCMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const time = `${hours}:${minutes} ${ampm}`;
      
      return { date, time };
    } catch (error) {
      return { date: '-', time: '-' };
    }
  };

  // Format number to 2 decimal places
  const formatDecimal = (value) => {
    if (value === null || value === undefined || value === '') return '0.00';
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Custom Dropdown Component for Edit Modal (single select)
  const CustomDropdown = ({ options, value, onChange, placeholder, show, onClose, disabled, valueKey, labelKey }) => {
    if (!show || disabled) return null;

    return (
      <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-xl border-2 border-blue-200 max-h-60 overflow-y-auto">
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange('');
            onClose();
          }}
          className={`px-4 py-2.5 cursor-pointer transition-all border-b border-slate-100 ${
            !value ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-blue-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {!value && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
            <span className="text-sm">{placeholder}</span>
          </div>
        </div>
        
        {options.map((option) => {
          const optionValue = valueKey ? option[valueKey] : option.user_id;
          const optionLabel = labelKey ? (option[labelKey] || option.label || 'Unknown') : option.user_name;
          
          return (
            <div
              key={optionValue}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(optionValue);
                onClose();
              }}
              className={`px-4 py-2.5 cursor-pointer transition-all ${
                String(value) === String(optionValue)
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'hover:bg-blue-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {String(value) === String(optionValue) && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
                <span className="text-sm">{optionLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Clear filters
  const handleClearFilters = () => {
    const today = getTodayDate();
    setSelectedAgents([]);
    setSelectedTeams('');
    setSelectedProject('');
    setSelectedTask('');
    setStartDate(today);
    setEndDate(today);
  };

  // Handle open add tracker modal
  const handleOpenAddModal = async () => {
    log('[QATrackerReport] Opening add tracker modal');
    setShowAddModal(true);
    setLoadingAddData(true);
    
    try {
      if (addProjects.length === 0) {
        await fetchProjectsWithTasks();
      }
      
      setAddFormData({
        agent_id: "",
        tracker_datetime: "",
        project_id: "",
        task_id: "",
        shift_type: "",
        production: "",
        base_target: "",
        tracker_note: "",
        tracker_file: null,
      });
      setAddFileError("");
      setAddTouched({});
      setAddErrors({});
      setAddProductionError("");
      
    } catch (error) {
      logError('[QATrackerReport] Error loading add modal data:', error);
      toast.error("Failed to load form data");
    } finally {
      setLoadingAddData(false);
    }
  };

  // Handle add form field changes
  const handleAddFieldChange = (field, value) => {
    setAddFormData(prev => ({ ...prev, [field]: value }));
    setAddTouched(prev => ({ ...prev, [field]: true }));
    
    if (field === 'production') {
      setAddProductionError("");
    }
    
    if (field === 'agent_id' && value) {
      const selectedAgent = usersList.find(u => String(u.user_id) === String(value));
      log('[QATrackerReport] Agent changed:', value, 'Selected agent:', selectedAgent);
      if (selectedAgent && addFormData.task_id) {
        const project = addProjects.find(p => String(p.project_id) === String(addFormData.project_id));
        const task = project?.tasks?.find(t => String(t.task_id) === String(addFormData.task_id));
        log('[QATrackerReport] Task for recalc:', task);
        const userTenure = selectedAgent.user_tenure || selectedAgent.tenure || 1;
        log('[QATrackerReport] User tenure:', userTenure);
        if (task && userTenure) {
          const perHourTarget = task.task_target || task.per_hour_target || task.target || task.label_value || 0;
          const calculated = Number(perHourTarget) * Number(userTenure);
          log('[QATrackerReport] Recalculated base target:', calculated, 'per hour:', perHourTarget, 'tenure:', userTenure);
          setAddFormData(prev => ({ ...prev, base_target: calculated.toFixed(2) }));
        }
      }
    }
    
    if (field === 'project_id') {
      const project = addProjects.find(p => String(p.project_id) === String(value));
      setAddTasks(project?.tasks || []);
      setAddFormData(prev => ({ ...prev, task_id: "", base_target: "" }));
    }
    
    if (field === 'task_id' && value) {
      const project = addProjects.find(p => String(p.project_id) === String(addFormData.project_id));
      const task = project?.tasks?.find(t => String(t.task_id) === String(value));
      log('[QATrackerReport] Task changed in add modal:', value, 'Task found:', task);
      const selectedAgent = usersList.find(u => String(u.user_id) === String(addFormData.agent_id));
      log('[QATrackerReport] Selected agent for calc:', selectedAgent);
      const userTenure = selectedAgent?.user_tenure || selectedAgent?.tenure || 1;
      log('[QATrackerReport] User tenure from agent:', userTenure);
      if (task && userTenure) {
        const perHourTarget = task.task_target || task.per_hour_target || task.target || task.label_value || 0;
        const calculated = Number(perHourTarget) * Number(userTenure);
        log('[QATrackerReport] Calculated base target:', calculated, 'per hour:', perHourTarget, 'tenure:', userTenure);
        setAddFormData(prev => ({ ...prev, base_target: calculated.toFixed(2) }));
      } else {
        log('[QATrackerReport] Could not calculate - task:', !!task, 'user_tenure:', userTenure);
      }
    }
    
    validateAddField(field, value);
  };

  // Validate add form field
  const validateAddField = (field, value) => {
    const newErrors = { ...addErrors };
    
    switch (field) {
      case 'agent_id':
        if (!value) newErrors.agent_id = 'Agent is required';
        else delete newErrors.agent_id;
        break;
      case 'tracker_datetime':
        if (!value) newErrors.tracker_datetime = 'Date & Time is required';
        else {
          const selectedDate = new Date(value);
          const now = new Date();
          if (selectedDate > now) {
            newErrors.tracker_datetime = 'Future date & time not allowed';
          } else {
            delete newErrors.tracker_datetime;
          }
        }
        break;
      case 'project_id':
        if (!value) newErrors.project_id = 'Project is required';
        else delete newErrors.project_id;
        break;
      case 'task_id':
        if (!value) newErrors.task_id = 'Task is required';
        else delete newErrors.task_id;
        break;
      case 'shift_type':
        if (!value) newErrors.shift_type = 'Shift is required';
        else delete newErrors.shift_type;
        break;
      case 'production':
        if (!value) newErrors.production = 'Production is required';
        else if (isNaN(value) || Number(value) <= 0) newErrors.production = 'Enter valid production';
        else if (addFormData.base_target && Number(value) > (Number(addFormData.base_target) * 2) && String(addFormData.task_id) !== '42') {
          newErrors.production = `Production cannot exceed ${(Number(addFormData.base_target) * 2).toFixed(2)} (double of base target)`;
        }
        else delete newErrors.production;
        break;
      default:
        break;
    }
    
    setAddErrors(newErrors);
  };

  // Handle add file upload
  const handleAddFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    setAddFileError("");
    
    if (!selectedFile) {
      setAddFormData(prev => ({ ...prev, tracker_file: null }));
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      setAddFileError("File size must be less than 10MB");
      e.target.value = "";
      return;
    }
    
    setAddFormData(prev => ({ ...prev, tracker_file: selectedFile }));
  };

  // Handle add form submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    
    setAddTouched({
      agent_id: true,
      tracker_datetime: true,
      project_id: true,
      task_id: true,
      shift_type: true,
      production: true
    });
    
    const errors = {};
    if (!addFormData.agent_id) errors.agent_id = 'Agent is required';
    if (!addFormData.tracker_datetime) {
      errors.tracker_datetime = 'Date & Time is required';
    } else {
      const selectedDate = new Date(addFormData.tracker_datetime);
      const now = new Date();
      if (selectedDate > now) {
        errors.tracker_datetime = 'Future date & time not allowed';
      }
    }
    if (!addFormData.project_id) errors.project_id = 'Project is required';
    if (!addFormData.task_id) errors.task_id = 'Task is required';
    if (!addFormData.shift_type) errors.shift_type = 'Shift is required';
    if (!addFormData.production) errors.production = 'Production is required';
    else if (isNaN(addFormData.production) || Number(addFormData.production) <= 0) {
      errors.production = 'Enter valid production';
    } else if (addFormData.base_target && Number(addFormData.production) > (Number(addFormData.base_target) * 2) && String(addFormData.task_id) !== '42') {
      errors.production = `Production cannot exceed ${(Number(addFormData.base_target) * 2).toFixed(2)} (double of base target)`;
    }
    
    setAddErrors(errors);
    
    if (Object.keys(errors).length > 0 || addFileError) {
      toast.error("Please fix all errors before submitting");
      return;
    }
    
    setSubmittingAdd(true);
    
    try {
      const dateTimeValue = addFormData.tracker_datetime;
      const formattedDateTime = dateTimeValue.replace('T', ' ') + ':00';
      
      const formData = new FormData();
      formData.append('user_id', Number(addFormData.agent_id));
      formData.append('date', formattedDateTime);
      formData.append('project_id', Number(addFormData.project_id));
      formData.append('task_id', Number(addFormData.task_id));
      formData.append('shift', addFormData.shift_type);
      formData.append('production', Number(addFormData.production));
      formData.append('tenure_target', Number(addFormData.base_target));
      
      if (addFormData.tracker_note && addFormData.tracker_note.trim()) {
        formData.append('tracker_note', addFormData.tracker_note.trim());
      }
      
      if (addFormData.tracker_file) {
        formData.append('tracker_file', addFormData.tracker_file);
      }
      
      log('[QATrackerReport] Submitting add tracker with date:', formattedDateTime);
      const res = await api.post("/tracker/add", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data?.status === 201 || res.status === 201 || res.status === 200) {
        toast.success("Tracker added successfully!");
        handleCloseAddModal();
        fetchData();
      } else {
        throw new Error('Failed to add tracker');
      }
    } catch (error) {
      logError('[QATrackerReport] Error adding tracker:', error);
      toast.error(error.response?.data?.message || "Failed to add tracker");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Close add modal
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setAddFormData({
      agent_id: "",
      tracker_datetime: "",
      project_id: "",
      task_id: "",
      shift_type: "",
      production: "",
      base_target: "",
      tracker_note: "",
      tracker_file: null,
    });
    setAddFileError("");
    setAddTouched({});
    setAddErrors({});
    setAddProductionError("");
  };

  // Handle edit tracker
  const handleEdit = async (tracker) => {
    log('[QATrackerReport] Opening edit modal for tracker:', tracker.tracker_id);
    setEditingTracker(tracker);
    setShowEditModal(true);
    setLoadingEditData(true);
    setEditProductionError("");

    try {
      let projectsData = editProjects;
      if (editProjects.length === 0) {
        projectsData = await fetchProjectsWithTasks();
      }

      const rawShift = tracker.shift_type || tracker.shift || "";
      log('[QATrackerReport] Raw shift value:', rawShift);
      
      const normalizedShift = String(rawShift).toLowerCase().includes('day') ? 'day' 
                            : String(rawShift).toLowerCase().includes('night') ? 'night' 
                            : String(rawShift).toLowerCase();
      
      log('[QATrackerReport] Normalized shift value:', normalizedShift);
      
      let formattedDateTime = '';
      if (tracker.date_time) {
        try {
          const dateObj = new Date(tracker.date_time);
          const year = dateObj.getUTCFullYear();
          const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getUTCDate()).padStart(2, '0');
          const hours = String(dateObj.getUTCHours()).padStart(2, '0');
          const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
          formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
          log('[QATrackerReport] Formatted date_time (UTC):', formattedDateTime, 'from:', tracker.date_time);
        } catch (err) {
          logError('[QATrackerReport] Error formatting date_time:', err);
        }
      }
      
      setEditFormData({
        tracker_datetime: formattedDateTime,
        project_id: tracker.project_id || "",
        task_id: tracker.task_id || "",
        shift_type: normalizedShift,
        production: tracker.production || "",
        base_target: tracker.tenure_target || tracker.actual_target || "",
        tracker_note: tracker.tracker_note || tracker.notes || "",
        tracker_file: null,
      });

      if (tracker.tracker_file) {
        setEditFilePreview(tracker.tracker_file);
      }

      if (tracker.project_id && projectsData.length > 0) {
        const project = projectsData.find(p => String(p.project_id) === String(tracker.project_id));
        log('[QATrackerReport] Found project for tasks:', project?.project_name, 'Tasks count:', project?.tasks?.length);
        setEditTasks(project?.tasks || []);
      }

      log('[QATrackerReport] Edit form data set:', {
        project_id: tracker.project_id,
        task_id: tracker.task_id,
        shift_type: normalizedShift,
        production: tracker.production,
        user_tenure: tracker.user_tenure,
        tenure: tracker.tenure
      });
    } catch (error) {
      logError('[QATrackerReport] Error loading tracker data:', error);
      toast.error("Failed to load tracker data");
    } finally {
      setLoadingEditData(false);
    }
  };

  // Handle delete tracker
  const handleDelete = (tracker) => {
    log('[QATrackerReport] Opening delete modal for tracker:', tracker.tracker_id);
    setDeletingTracker(tracker);
    setShowDeleteModal(true);
  };

  // Confirm delete tracker
  const confirmDelete = async () => {
    if (!deletingTracker) return;

    setSubmittingDelete(true);
    try {
      await api.post("/tracker/delete", { tracker_id: deletingTracker.tracker_id });
      setTrackers(trackers.filter(t => t.tracker_id !== deletingTracker.tracker_id));
      toast.success("Tracker deleted successfully!");
      log('[QATrackerReport] Tracker deleted:', deletingTracker.tracker_id);
      setShowDeleteModal(false);
      setDeletingTracker(null);
    } catch (error) {
      logError('[QATrackerReport] Delete error:', error);
      toast.error("Failed to delete tracker.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Close delete modal
  const handleCloseDeleteModal = () => {
    if (submittingDelete) return;
    setShowDeleteModal(false);
    setDeletingTracker(null);
  };

  // Handle edit form field changes
  const handleEditFieldChange = (field, value) => {
    setEditFormData(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'project_id') {
        const project = editProjects.find(p => String(p.project_id) === String(value));
        log('[QATrackerReport] Project changed:', value, 'Found project:', project);
        setEditTasks(project?.tasks || []);
        
        if (!project?.tasks?.find(t => String(t.task_id) === String(prev.task_id))) {
          updated.task_id = "";
          updated.base_target = "";
        } else {
          const task = project?.tasks?.find(t => String(t.task_id) === String(prev.task_id));
          // Use user_tenure from the tracker's API data
          const userTenure = editingTracker?.user_tenure || editingTracker?.tenure || 1;
          if (task) {
            const perHourTarget = task.task_target || task.per_hour_target || task.target || 0;
            updated.base_target = (Number(perHourTarget) * Number(userTenure)).toFixed(2);
          }
        }
      }

      if (field === 'task_id' && value) {
        const project = editProjects.find(p => String(p.project_id) === String(updated.project_id));
        const task = project?.tasks?.find(t => String(t.task_id) === String(value));
        // Use user_tenure from the tracker's API data (from /tracker/view response)
        const userTenure = editingTracker?.user_tenure || editingTracker?.tenure || 1;
        if (task) {
          const perHourTarget = task.task_target || task.per_hour_target || task.target || 0;
          const calculatedTarget = Number(perHourTarget) * Number(userTenure);
          updated.base_target = calculatedTarget.toFixed(2);
          log('[QATrackerReport] Base target calculated:', calculatedTarget, 'task_target:', perHourTarget, 'userTenure:', userTenure);
        }
      }

      return updated;
    });
    
    if (field === 'production') {
      const productionValue = Number(value);
      const baseTarget = Number(editFormData.base_target);
      
      if (isNaN(productionValue)) {
        setEditProductionError('Please enter a valid number');
      } else if (productionValue < 0) {
        setEditProductionError('Production cannot be negative');
      } else if (baseTarget && productionValue > (baseTarget * 2) && String(editFormData.task_id) !== '42') {
        setEditProductionError(`Production cannot exceed ${(baseTarget * 2).toFixed(2)} (double of base target)`);
      } else {
        setEditProductionError('');
      }
    }
  };

  // Handle edit file upload
  const handleEditFileChange = async (e) => {
    const fileObj = e.target.files[0];
    if (!fileObj) return;

    const maxSize = 10 * 1024 * 1024;
    if (fileObj.size > maxSize) {
      setEditFileError("File size must not exceed 10MB");
      setEditFormData(prev => ({ ...prev, tracker_file: null, newFile: null }));
      setEditFilePreview(null);
      toast.error("File size exceeds 10MB limit", { duration: 4000 });
      e.target.value = null;
      return;
    }

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv'
    ];

    if (!allowedTypes.includes(fileObj.type)) {
      setEditFileError("Invalid file type. Please upload Excel, PDF, Word, or CSV files.");
      setEditFormData(prev => ({ ...prev, tracker_file: null, newFile: null }));
      setEditFilePreview(null);
      toast.error("Invalid file type", { duration: 4000 });
      e.target.value = null;
      return;
    }

    setEditFileError("");
    setEditFormData(prev => ({ ...prev, tracker_file: fileObj, newFile: fileObj }));
    setEditFilePreview(fileObj.name);
    toast.success(`File selected: ${fileObj.name}`);
    log('[QATrackerReport] Edit file selected:', fileObj.name);
  };

  // Handle edit form submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!editFormData.tracker_datetime || !editFormData.project_id || !editFormData.task_id || !editFormData.production) {
      toast.error("Please fill all required fields");
      return;
    }

    if (editProductionError) {
      toast.error(editProductionError);
      return;
    }

    if (editFileError) {
      toast.error("Please fix file upload errors before submitting");
      return;
    }

    setSubmittingEdit(true);

    try {
      const formData = new FormData();
      formData.append('tracker_id', editingTracker.tracker_id);
      
      if (editFormData.tracker_datetime) {
        const formattedDateTime = editFormData.tracker_datetime.replace('T', ' ') + ':00';
        formData.append('date_time', formattedDateTime);
        log('[QATrackerReport] Formatted date_time for submission:', formattedDateTime);
      }
      
      formData.append('project_id', Number(editFormData.project_id));
      formData.append('task_id', Number(editFormData.task_id));
      formData.append('shift', editFormData.shift_type);
      formData.append('user_id', editingTracker.user_id);
      formData.append('production', Number(editFormData.production));
      formData.append('base_target', Number(editFormData.base_target));

      if (editFormData.tracker_note && editFormData.tracker_note.trim()) {
        formData.append('tracker_note', editFormData.tracker_note.trim());
      }

      if (editFormData.newFile) {
        formData.append('tracker_file', editFormData.newFile);
        log('[QATrackerReport] Uploading new file:', editFormData.newFile.name);
      }

      log('[QATrackerReport] Submitting tracker update with FormData');
      const res = await api.post("/tracker/update", formData, {
        headers: {
          'Content-Type': undefined
        }
      });

      if (res.data?.status === 200 || res.status === 200) {
        toast.success("Tracker updated successfully!");
        setShowEditModal(false);
        setEditingTracker(null);
        setEditFormData({
          tracker_datetime: "",
          project_id: "",
          task_id: "",
          production: "",
          base_target: "",
          tracker_note: "",
          tracker_file: null,
          newFile: null
        });
        setEditFilePreview(null);
        setEditFileError("");
        fetchData();
      } else {
        toast.error(res.data?.message || "Failed to update tracker");
      }
    } catch (error) {
      logError('[QATrackerReport] Error updating tracker:', error);
      toast.error(error?.response?.data?.message || "Failed to update tracker");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingTracker(null);
    setEditFormData({
      tracker_datetime: "",
      project_id: "",
      task_id: "",
      shift_type: "",
      production: "",
      base_target: "",
      tracker_note: "",
      tracker_file: null,
    });
    setEditFilePreview(null);
    setEditFileBase64(null);
    setEditFileError("");
    setEditProductionError("");
  };

  // Use API totals if available, otherwise calculate from trackers
  const totals = useMemo(() => {
    if (apiTotals) {
      return {
        activeAgents: apiTotals.total_active_agents || 0,
        assignHours: apiTotals.total_assigned_hours || 0,
        tenureTarget: apiTotals.total_tenure_target || 0,
        production: apiTotals.total_production || 0,
        billableHours: apiTotals.total_billable_hours || 0
      };
    }
    
    const uniqueAgents = new Set();
    const totalsData = trackers.reduce((acc, tracker) => {
      if (tracker.user_id) {
        uniqueAgents.add(tracker.user_id);
      }
      acc.tenureTarget += Number(tracker.tenure_target) || 0;
      acc.production += Number(tracker.production) || 0;
      acc.billableHours += Number(tracker.billable_hours) || 0;
      return acc;
    }, { tenureTarget: 0, production: 0, billableHours: 0 });
    
    return {
      ...totalsData,
      activeAgents: uniqueAgents.size,
      assignHours: totalsData.billableHours
    };
  }, [trackers, apiTotals]);

  // Calculate monthly summary from filtered trackers
  const monthlySummary = useMemo(() => {
    const monthlyData = {};
    
    trackers.forEach(tracker => {
      if (!tracker.date_time) return;
      
      const dateObj = new Date(tracker.date_time);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          year,
          month: month + 1,
          monthName: dateObj.toLocaleString('default', { month: 'long' }),
          tenureTarget: 0,
          production: 0,
          billableHours: 0
        };
      }
      
      monthlyData[monthKey].tenureTarget += Number(tracker.tenure_target) || 0;
      monthlyData[monthKey].production += Number(tracker.production) || 0;
      monthlyData[monthKey].billableHours += Number(tracker.billable_hours) || 0;
    });
    
    return Object.values(monthlyData).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [trackers]);

  // Export to Excel function
  const handleExportToExcel = () => {
    console.log('[QATrackerReport] Export function called');
    console.log('[QATrackerReport] Trackers length:', trackers.length);
    console.log('[QATrackerReport] Totals:', totals);
    
    if (trackers.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      const exportData = trackers.map((tracker) => {
        const agentName = tracker.user_name || "-";
        const projectName = tracker.project_name || "-";
        const taskName = tracker.task_name || "-";
        const agentFormatted = agentName !== "-" ? agentName.split(' ').join('\n') : "-";
        const projectFormatted = projectName !== "-" ? projectName.split(' ').join('\n') : "-";
        const taskFormatted = taskName !== "-" ? taskName.split(' ').join('\n') : "-";
        
        // Get shift value from multiple possible fields
        const shiftValue = tracker.shift_type || tracker.shift || '';
        const normalizedShift = String(shiftValue).toLowerCase();
        const shiftDisplay = normalizedShift === 'day' || normalizedShift === 'day_shift' ? 'Day' : 
                            normalizedShift === 'night' || normalizedShift === 'night_shift' ? 'Night' : '-';
        
        console.log('[QATrackerReport] Tracker shift data for export:', {
          shift_type: tracker.shift_type,
          shift: tracker.shift,
          normalized: normalizedShift,
          display: shiftDisplay
        });
        
        return {
          'Date/Time': tracker.date_time ? tracker.date_time : "-",
          'Agent': agentFormatted,
          'Project': projectFormatted,
          'Task': taskFormatted,
          'Shift': shiftDisplay,
          'Per Hour Target': tracker.tenure_target || 0,
          'Production': tracker.production || 0,
          'Billable Hours': tracker.billable_hours !== null && tracker.billable_hours !== undefined
            ? Number(tracker.billable_hours).toFixed(2)
            : "0.00",
          'Notes': tracker.tracker_note || '-',
          'Has File': tracker.tracker_file ? 'Yes' : 'No'
        };
      });

      console.log('[QATrackerReport] Export data prepared:', exportData);

      exportData.push({
        'Date/Time': '',
        'Agent': '',
        'Project': '',
        'Task': 'TOTALS',
        'Shift': '',
        'Per Hour Target': '',
        'Production': totals.production.toFixed(2),
        'Billable Hours': totals.billableHours.toFixed(2),
        'Notes': '',
        'Has File': ''
      });

      console.log('[QATrackerReport] Final export data with totals:', exportData);

      const filename = `QA_Tracker_Report_${startDate}_to_${endDate}.csv`;
      console.log('[QATrackerReport] Filename:', filename);

      // Convert data to CSV format first
      const csvContent = jsonToCSV(exportData);
      downloadCSV(csvContent, filename);
      toast.success("Report exported successfully!");
      log('[QATrackerReport] CSV export completed:', filename);
    } catch (error) {
      console.error('[QATrackerReport] Export error:', error);
      logError('[QATrackerReport] CSV export error:', error);
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight cursor-default">Tracker Report</h2>
                <p className="text-slate-600 text-sm font-medium mt-1 cursor-default">View and manage assigned agents' tracker records</p>
              </div>
            </div>
            <button
              onClick={handleExportToExcel}
              disabled={loading || trackers.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
              title="Export filtered data to CSV"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg p-3 mb-6 border border-slate-200">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            {/* Date Range Picker */}
            <div className="relative">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                label=""
                description={null}
                showClearButton={false}
                compact={true}
                fieldWidth="220px"
                noWrapper={true}
              />
            </div>

            {/* Agent Multi-Select Dropdown */}
            <div style={{ width: '180px' }}>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                <UsersIcon className="w-3.5 h-3.5 text-blue-600" />
                Agents
              </label>
              <MultiSelectWithCheckbox
                icon={UsersIcon}
                value={selectedAgents}
                onChange={setSelectedAgents}
                options={usersList.map(agent => ({ 
                  value: String(agent.user_id), 
                  label: agent.label 
                }))}
                placeholder="Select Agents"
                showSelectAll={true}
                maxDisplayCount={1}
              />
            </div>

            {/* Team Dropdown - Only for PM, Admin, Super Admin */}
            {canViewTeamFilter && (
              <div style={{ width: '180px' }}>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  <UsersIcon className="w-3.5 h-3.5 text-blue-600" />
                  Teams
                </label>
                <SearchableSelect
                  icon={UsersIcon}
                  value={selectedTeams}
                  onChange={setSelectedTeams}
                  options={teamsList.map(team => ({ 
                    value: String(team.team_id || team.value), 
                    label: team.label 
                  }))}
                  placeholder="Select Team"
                  isClearable={true}
                  disabled={loadingTeams}
                />
              </div>
            )}

            {/* Project Dropdown */}
            <div style={{ width: '180px' }}>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                Project
              </label>
              <SearchableSelect
                icon={Briefcase}
                value={selectedProject}
                onChange={setSelectedProject}
                options={projectsList.map(project => ({ 
                  value: String(project.project_id), 
                  label: project.project_name 
                }))}
                placeholder="Select Project"
                isClearable={true}
                disabled={loadingProjects}
              />
            </div>

            {/* Task Dropdown */}
            <div style={{ width: '182px' }}>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                <ListTodo className="w-3.5 h-3.5 text-blue-600" />
                Task
              </label>
              <SearchableSelect
                icon={ListTodo}
                value={selectedTask}
                onChange={setSelectedTask}
                options={filteredTasksList.map(task => ({ 
                  value: String(task.task_id), 
                  label: task.task_name 
                }))}
                placeholder="Select Task"
                isClearable={true}
                disabled={loadingTasks}
              />
            </div>

            {/* Add Tracker Button - Only visible to AM, PM, Admin, Super Admin (not QA) */}
            {!isQAAgent && (
              <div className="flex items-end">
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                  type="button"
                  title="Add new tracker entry"
                >
                  <Plus className="w-4 h-4" />
                  Tracker
                </button>
              </div>
            )}

            {/* Reset Filters Button */}
            <div className="flex items-end">
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 group"
                type="button"
              >
                <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                Reset
              </button>
            </div>
            
            {/* Refresh Button */}
            <div className="flex items-end">
              <button
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 group"
                type="button"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Table Container */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="min-w-full text-sm text-slate-700 table-fixed">
                <colgroup>
                  <col style={{ width: isQAAgent ? '8%' : '7%' }}/>
                  <col style={{ width: isQAAgent ? '12%' : '10%' }}/>
                  <col style={{ width: isQAAgent ? '10%' : '9%' }}/>
                  <col style={{ width: isQAAgent ? '10%' : '9%' }}/>
                  <col style={{ width: isQAAgent ? '8%' : '7%' }}/>
                  <col style={{ width: isQAAgent ? '9%' : '8%' }}/>
                  <col style={{ width: isQAAgent ? '9%' : '8%' }}/>
                  <col style={{ width: isQAAgent ? '16%' : '14%' }}/>
                  <col style={{ width: isQAAgent ? '10%' : '8%' }}/>
                  <col style={{ width: isQAAgent ? '8%' : '7%' }}/>
                  {!isQAAgent && <col style={{ width: '13%' }}/>}
                </colgroup>
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Date/Time</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">{canViewTeamFilter ? 'Agent / Team' : 'Agent'}</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Project</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Task</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Per Hour Target</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Production</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Billable Hours</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Notes</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">File</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Shift</th>
                    {!isQAAgent && <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={isQAAgent ? "10" : "11"} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
                          <p className="text-slate-600 font-medium text-base">Loading tracker data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : trackers.length === 0 ? (
                    <tr>
                      <td colSpan={isQAAgent ? "10" : "11"} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-slate-600 font-medium text-base">No tracker data found for the selected filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : trackers.map((tracker, index) => {
                    const { date, time } = formatDateTime(tracker.date_time);
                    return (
                      <tr 
                        key={tracker.tracker_id || index} 
                        className={`hover:bg-slate-50 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-5 py-3 align-middle">
                          <div className="flex flex-col">
                            <span className="text-slate-800 font-semibold">{date}</span>
                            <span className="text-slate-600 text-xs">{time}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 align-middle">
                          {canViewTeamFilter ? (
                            <div className="flex flex-col">
                              <div className="font-semibold text-blue-700 whitespace-pre-line">
                                {(tracker.user_name || "-").split(' ').join('\n')}
                              </div>
                              <span className="text-slate-600 text-xs">{tracker.team_name || "-"}</span>
                            </div>
                          ) : (
                            <div className="font-semibold text-blue-700 whitespace-pre-line">
                              {(tracker.user_name || "-").split(' ').join('\n')}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 align-middle text-slate-800 text-sm">
                          {tracker.project_name ? (
                            <div className="whitespace-pre-line">
                              {tracker.project_name.split(' ').join('\n')}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 align-middle text-slate-800 text-sm">
                          {tracker.task_name ? (
                            <div className="whitespace-pre-line">
                              {tracker.task_name.split(' ').join('\n')}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 align-middle whitespace-nowrap text-slate-800">
                          {formatDecimal(tracker.tenure_target || dropdownTaskMap[tracker.task_id])}
                        </td>
                        <td className="px-5 py-3 align-middle font-bold text-green-700 whitespace-nowrap">
                          {formatDecimal(tracker.production)}
                        </td>
                        <td className="px-5 py-3 align-middle font-bold text-purple-700 whitespace-nowrap">
                          {formatDecimal(tracker.billable_hours)}
                        </td>
                        <td className="px-5 py-3 align-middle text-slate-600 text-sm">
                          {tracker.tracker_note || tracker.notes ? (
                            <div className="relative inline-flex items-center gap-1">
                              <span>
                                {(tracker.tracker_note || tracker.notes).length > 10
                                  ? `${(tracker.tracker_note || tracker.notes).substring(0, 10)}...`
                                  : tracker.tracker_note || tracker.notes}
                              </span>
                              {/* Copy button */}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(tracker.tracker_note || tracker.notes);
                                  toast.success('Note copied to clipboard!');
                                }}
                                className="ml-1 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                title="Copy full note"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                                </svg>
                              </button>
                              {(tracker.tracker_note || tracker.notes).length > 10 && (
                                <div className="relative group/notes">
                                  <Info className="w-4 h-4 text-blue-500 cursor-pointer hover:text-blue-700 transition-colors" />
                                  <div className={`absolute right-0 ${index >= trackers.length - 3 ? 'bottom-full mb-2' : 'top-full mt-2'} hidden group-hover/notes:block z-50 pointer-events-none`}>
                                    <div className="bg-white text-slate-800 text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-200 min-w-[400px] max-w-2xl max-h-32 break-words whitespace-normal">
                                      {tracker.tracker_note || tracker.notes}
                                      {index >= trackers.length - 3 ? (
                                        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                                      ) : (
                                        <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white"></div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 align-middle text-center">
                          {tracker.tracker_file ? (
                            <a
                              href={tracker.tracker_file}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 group-hover:bg-blue-100 rounded-full p-2 shadow-sm"
                              title="Download file"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 align-middle whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            (tracker.shift || tracker.shift_type || '').toLowerCase() === 'day' || (tracker.shift || tracker.shift_type) === 'day_shift'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : (tracker.shift || tracker.shift_type || '').toLowerCase() === 'night' || (tracker.shift || tracker.shift_type) === 'night_shift'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {(tracker.shift || tracker.shift_type || '').toLowerCase() === 'day' || (tracker.shift || tracker.shift_type) === 'day_shift' ? 'Day' : (tracker.shift || tracker.shift_type || '').toLowerCase() === 'night' || (tracker.shift || tracker.shift_type) === 'night_shift' ? 'Night' : '—'}
                          </span>
                        </td>
                        {!isQAAgent && (
                          <td className="px-5 py-3 align-middle">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(tracker)}
                                className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 rounded-full p-2 shadow-sm"
                                title="Edit tracker"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tracker)}
                                className="inline-flex items-center justify-center text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 rounded-full p-2 shadow-sm"
                                title="Delete tracker"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Totals Summary Card */}
        {!loading && trackers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200 mt-6">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-700 rounded-full"></div>
              Summary Totals
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Active Agents */}
              <div className="relative p-5 flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Total Active Agents</p>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totals.activeAgents}</h3>
                </div>
                <div className="p-3 rounded-xl shadow-sm flex-shrink-0 z-10 bg-blue-100">
                  <UsersIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              
              {/* Total Assign Hours */}
              <div className="relative p-5 flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Total Assign Hours</p>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totals.assignHours.toFixed(2)}</h3>
                </div>
                <div className="p-3 rounded-xl shadow-sm flex-shrink-0 z-10 bg-green-100">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
              </div>
              
              {/* Total Production */}
              <div className="relative p-5 flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Total Production</p>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totals.production.toFixed(2)}</h3>
                </div>
                <div className="p-3 rounded-xl shadow-sm flex-shrink-0 z-10 bg-orange-100">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              
              {/* Total Billable Hours */}
              <div className="relative p-5 flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Total Billable Hours</p>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totals.billableHours.toFixed(2)}</h3>
                </div>
                <div className="p-3 rounded-xl shadow-sm flex-shrink-0 z-10 bg-indigo-100">
                  <Briefcase className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loader spinner style */}
        <style>{`
          .loader {
            border: 4px solid #e0e7ef;
            border-top: 4px solid #2563eb;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full transform transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Confirm Delete</h3>
              </div>
              <p className="mb-6 text-slate-600 leading-relaxed">
                Are you sure you want to delete this tracker entry for <span className="font-semibold text-slate-800">{deletingTracker?.user_name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseDeleteModal}
                  disabled={submittingDelete}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={submittingDelete}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submittingDelete ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Tracker Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <Edit className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Edit Tracker</h3>
                    <p className="text-blue-100 text-sm">Update tracker details for {editingTracker?.user_name}</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseEditModal}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleEditSubmit} className="p-6">
                {loadingEditData ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-slate-600 font-medium">Loading tracker data...</p>
                  </div>
                ) : (
                  <>
                    {/* Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                      {/* Date & Time Selection */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          Date & Time
                          <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="mb-2">
                          <div className="[&>*]:!flex-row [&>*]:!items-start [&>*>*:nth-child(1)_label]:!hidden [&>*>*:nth-child(2)]:!hidden [&>*>*:nth-child(3)]:!hidden">
                            <DateRangePicker
                              startDate={editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[0] : ''}
                              endDate={editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[0] : ''}
                              onStartDateChange={(date) => {
                                const time = editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[1] : '00:00';
                                setEditFormData(prev => ({ ...prev, tracker_datetime: date ? `${date}T${time}` : '' }));
                              }}
                              onEndDateChange={() => {}}
                              showClearButton={false}
                              noWrapper={true}
                              fieldWidth="100%"
                            />
                          </div>
                        </div>
                        
                        {/* Time Picker - 12 Hour Format */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Hour Dropdown */}
                          <div className="relative">
                            <select
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-sm hover:bg-white"
                              value={editFormData.tracker_datetime ? (() => {
                                const time = editFormData.tracker_datetime.split('T')[1] || '00:00';
                                let hour = parseInt(time.split(':')[0]);
                                if (hour === 0) return 12;
                                if (hour > 12) return hour - 12;
                                return hour;
                              })() : 12}
                              onChange={(e) => {
                                const date = editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
                                const time = editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[1] : '00:00';
                                const currentHour = parseInt(time.split(':')[0]);
                                const minute = time.split(':')[1];
                                const isPM = currentHour >= 12;
                                let newHour = parseInt(e.target.value);
                                if (isPM && newHour !== 12) newHour += 12;
                                else if (!isPM && newHour === 12) newHour = 0;
                                setEditFormData(prev => ({ ...prev, tracker_datetime: `${date}T${String(newHour).padStart(2, '0')}:${minute}` }));
                              }}
                            >
                              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(hour => (
                                <option key={hour} value={hour}>{hour}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Minute Dropdown */}
                          <div className="relative">
                            <select
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-sm hover:bg-white"
                              value={editFormData.tracker_datetime ? (editFormData.tracker_datetime.split('T')[1] || '00:00').split(':')[1] : '00'}
                              onChange={(e) => {
                                const date = editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
                                const time = editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[1] : '00:00';
                                const hour = time.split(':')[0];
                                setEditFormData(prev => ({ ...prev, tracker_datetime: `${date}T${hour}:${e.target.value}` }));
                              }}
                            >
                              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(min => (
                                <option key={min} value={min}>{min}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* AM/PM Dropdown */}
                          <div className="relative">
                            <select
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-sm hover:bg-white"
                              value={editFormData.tracker_datetime ? (() => {
                                const time = editFormData.tracker_datetime.split('T')[1] || '00:00';
                                const hour = parseInt(time.split(':')[0]);
                                return hour >= 12 ? 'PM' : 'AM';
                              })() : 'AM'}
                              onChange={(e) => {
                                const date = editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
                                const time = editFormData.tracker_datetime ? editFormData.tracker_datetime.split('T')[1] : '00:00';
                                let hour = parseInt(time.split(':')[0]);
                                const minute = time.split(':')[1];
                                const newIsPM = e.target.value === 'PM';
                                const currentIsPM = hour >= 12;
                                
                                if (newIsPM && !currentIsPM) {
                                  hour = hour === 12 ? 12 : hour + 12;
                                } else if (!newIsPM && currentIsPM) {
                                  hour = hour === 12 ? 0 : hour - 12;
                                }
                                
                                setEditFormData(prev => ({ ...prev, tracker_datetime: `${date}T${String(hour).padStart(2, '0')}:${minute}` }));
                              }}
                            >
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Project Selection */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <path d="M2 20h20"></path>
                            <path d="m5 9 3-3 3 3"></path>
                            <path d="M2 4h20"></path>
                            <path d="m19 15-3 3-3-3"></path>
                          </svg>
                          Project Name
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowEditProjectDropdown(!showEditProjectDropdown)}
                            className="w-full px-3 py-2.5 pr-10 text-sm text-left border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all"
                          >
                            {editFormData.project_id ? (
                              <span className="text-slate-700">{editProjects.find(p => String(p.project_id) === String(editFormData.project_id))?.project_name || 'Select Project'}</span>
                            ) : (
                              <span className="text-slate-500">Select a project...</span>
                            )}
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                          <CustomDropdown
                            options={editProjects}
                            value={editFormData.project_id}
                            onChange={(value) => handleEditFieldChange('project_id', value)}
                            placeholder="Select a project..."
                            show={showEditProjectDropdown}
                            onClose={() => setShowEditProjectDropdown(false)}
                            disabled={false}
                            valueKey="project_id"
                            labelKey="project_name"
                          />
                        </div>
                      </div>

                      {/* Task Selection */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <path d="M9 11 4 6l5-5 5 5-5 5Z"></path>
                            <path d="M13 13 8 8l5-5 5 5-5 5Z"></path>
                            <path d="m20 16-5 5-5-5 5-5 5 5Z"></path>
                          </svg>
                          Task Name
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => editFormData.project_id && setShowEditTaskDropdown(!showEditTaskDropdown)}
                            disabled={!editFormData.project_id}
                            className="w-full px-3 py-2.5 pr-10 text-sm text-left border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {!editFormData.project_id ? (
                              <span className="text-slate-400">Select project first...</span>
                            ) : editFormData.task_id ? (
                              <span className="text-slate-700">{editTasks.find(t => String(t.task_id) === String(editFormData.task_id))?.task_name || editTasks.find(t => String(t.task_id) === String(editFormData.task_id))?.label || 'Select Task'}</span>
                            ) : (
                              <span className="text-slate-500">Select a task...</span>
                            )}
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                          <CustomDropdown
                            options={editTasks}
                            value={editFormData.task_id}
                            onChange={(value) => handleEditFieldChange('task_id', value)}
                            placeholder="Select a task..."
                            show={showEditTaskDropdown}
                            onClose={() => setShowEditTaskDropdown(false)}
                            disabled={!editFormData.project_id}
                            valueKey="task_id"
                            labelKey="task_name"
                          />
                        </div>
                      </div>

                      {/* Shift Selection */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          Shift
                          <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          value={editFormData.shift_type}
                          onChange={(value) => handleEditFieldChange('shift_type', value)}
                          options={[
                            { value: 'day', label: 'Day' },
                            { value: 'night', label: 'Night' }
                          ]}
                          icon={Clock}
                          placeholder="Select shift..."
                          disabled={false}
                        />
                      </div>

                      {/* Base Target */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="6"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                          </svg>
                          Base Target
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="w-full bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-300 rounded-lg px-4 py-3 text-sm font-bold text-slate-700 shadow-sm flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                              <rect width="14" height="10" x="5" y="11" rx="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>{editFormData.base_target ? Number(editFormData.base_target).toFixed(2) : '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Production Target */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <line x1="12" x2="12" y1="2" y2="22"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                          </svg>
                          Production
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none">
                            <line x1="12" x2="12" y1="2" y2="22"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                          </svg>
                          <input
                            type="text"
                            className={`w-full bg-slate-50 border rounded-lg pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all shadow-sm hover:bg-white ${
                              editProductionError
                                ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                            }`}
                            value={editFormData.production}
                            onChange={(e) => handleEditFieldChange('production', e.target.value)}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && !isNaN(value)) {
                                handleEditFieldChange('production', parseFloat(value).toFixed(2));
                              }
                            }}
                            placeholder="Enter production"
                          />
                        </div>
                        {editProductionError && (
                          <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" x2="12" y1="8" y2="12"></line>
                              <line x1="12" x2="12.01" y1="16" y2="16"></line>
                            </svg>
                            {editProductionError}
                          </p>
                        )}
                      </div>

                      {/* File Upload Section */}
                      <div className="space-y-2 md:row-span-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          Project Files
                        </label>
                        
                        {editFilePreview && !editFormData.tracker_file && (
                          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              </svg>
                              <span className="text-xs font-medium text-blue-700">Existing file</span>
                            </div>
                            <a
                              href={editFilePreview}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                            >
                              View
                            </a>
                          </div>
                        )}

                        <div
                          onClick={() => document.getElementById('edit-file-upload').click()}
                          className={`relative h-[120px] flex items-center justify-center border-2 border-dashed rounded-lg px-4 py-4 text-center transition-all cursor-pointer group ${
                            editFileError 
                              ? 'border-red-300 bg-red-50/30 hover:border-red-400' 
                              : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors ${
                              editFileError ? 'bg-red-100' : 'bg-blue-100'
                            }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={editFileError ? 'text-red-600' : 'text-blue-600'}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" x2="12" y1="3" y2="15"></line>
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">
                                {editFormData.tracker_file ? (
                                  <span className="text-blue-600 break-all">{editFormData.tracker_file.name}</span>
                                ) : (
                                  <>Click to <span className="text-blue-600">upload</span></>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">Max: 10MB</p>
                            </div>
                          </div>
                          <input
                            id="edit-file-upload"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                            onChange={handleEditFileChange}
                            className="hidden"
                          />
                        </div>
                        {editFileError && (
                          <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" x2="12" y1="8" y2="12"></line>
                              <line x1="12" x2="12.01" y1="16" y2="16"></line>
                            </svg>
                            {editFileError}
                          </p>
                        )}
                      </div>

                      {/* Notes Field */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="flex items-center justify-between text-sm font-bold text-slate-700 uppercase tracking-wide">
                          <span className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" x2="8" y1="13" y2="13"></line>
                              <line x1="16" x2="8" y1="17" y2="17"></line>
                              <line x1="10" x2="8" y1="9" y2="9"></line>
                            </svg>
                            Notes
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const textToCopy = editFormData.tracker_note || '';
                              if (textToCopy) {
                                navigator.clipboard.writeText(textToCopy);
                                toast.success('Note copied to clipboard!');
                              } else {
                                toast.error('No note to copy');
                              }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-md transition-colors border border-blue-200 shadow-sm"
                            title="Copy note to clipboard"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                            </svg>
                            Copy
                          </button>
                        </label>
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-3 text-blue-600 pointer-events-none">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" x2="8" y1="13" y2="13"></line>
                            <line x1="16" x2="8" y1="17" y2="17"></line>
                            <line x1="10" x2="8" y1="9" y2="9"></line>
                          </svg>
                          <textarea
                            rows="3"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition-all shadow-sm hover:bg-white resize-none"
                            value={editFormData.tracker_note}
                            onChange={(e) => handleEditFieldChange('tracker_note', e.target.value)}
                            placeholder="Enter any additional notes or comments..."
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleCloseEditModal}
                        className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingEdit}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {submittingEdit ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Update Tracker
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Add Tracker Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleAddSubmit}>
                {loadingAddData ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <>
                    {/* Modal Header */}
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl px-6 py-4 flex items-center justify-between">
                      <h3 className="text-xl font-bold text-white">Add New Tracker</h3>
                      <button
                        type="button"
                        onClick={handleCloseAddModal}
                        className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Agent Name Selection */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <UsersIcon className="w-4 h-4 text-blue-600" />
                            Agent Name
                            <span className="text-red-500">*</span>
                          </label>
                          <SearchableSelect
                            value={addFormData.agent_id}
                            onChange={(value) => handleAddFieldChange('agent_id', value)}
                            options={[
                              { value: '', label: 'Select an agent...' },
                              ...usersList.map(u => ({ value: String(u.user_id), label: u.label }))
                            ]}
                            icon={UsersIcon}
                            placeholder="Select an agent..."
                            error={addTouched.agent_id && addErrors.agent_id}
                          />
                          {addTouched.agent_id && addErrors.agent_id && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              {addErrors.agent_id}
                            </p>
                          )}
                        </div>

                        {/* Date & Time Selection */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            Date & Time
                            <span className="text-red-500">*</span>
                          </label>
                          
                          <div className={`mb-2 ${addTouched.tracker_datetime && addErrors.tracker_datetime ? 'ring-2 ring-red-200 rounded-lg' : ''}`}>
                            <div className="[&>*]:!flex-row [&>*]:!items-start [&>*>*:nth-child(1)_label]:!hidden [&>*>*:nth-child(2)]:!hidden [&>*>*:nth-child(3)]:!hidden">
                              <DateRangePicker
                                startDate={addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[0] : ''}
                                endDate={addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[0] : ''}
                                onStartDateChange={(date) => {
                                  const time = addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[1] : '00:00';
                                  handleAddFieldChange('tracker_datetime', date ? `${date}T${time}` : '');
                                }}
                                onEndDateChange={() => {}}
                                showClearButton={false}
                                noWrapper={true}
                                fieldWidth="100%"
                              />
                            </div>
                          </div>
                          
                          {/* Time Picker - 12 Hour Format */}
                          <div className="grid grid-cols-3 gap-2">
                            {/* Hour Dropdown */}
                            <div className="relative">
                              <select
                                className={`w-full bg-slate-50 border rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all shadow-sm hover:bg-white ${
                                  addTouched.tracker_datetime && addErrors.tracker_datetime
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                                }`}
                                value={addFormData.tracker_datetime ? (() => {
                                  const time = addFormData.tracker_datetime.split('T')[1] || '00:00';
                                  let hour = parseInt(time.split(':')[0]);
                                  if (hour === 0) return 12;
                                  if (hour > 12) return hour - 12;
                                  return hour;
                                })() : 12}
                                onChange={(e) => {
                                  const date = addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
                                  const time = addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[1] : '00:00';
                                  const currentHour = parseInt(time.split(':')[0]);
                                  const minute = time.split(':')[1];
                                  const isPM = currentHour >= 12;
                                  let newHour = parseInt(e.target.value);
                                  if (isPM && newHour !== 12) newHour += 12;
                                  else if (!isPM && newHour === 12) newHour = 0;
                                  handleAddFieldChange('tracker_datetime', `${date}T${String(newHour).padStart(2, '0')}:${minute}`);
                                }}
                              >
                                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(hour => (
                                  <option key={hour} value={hour}>{hour}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Minute Dropdown */}
                            <div className="relative">
                              <select
                                className={`w-full bg-slate-50 border rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all shadow-sm hover:bg-white ${
                                  addTouched.tracker_datetime && addErrors.tracker_datetime
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                                }`}
                                value={addFormData.tracker_datetime ? (addFormData.tracker_datetime.split('T')[1] || '00:00').split(':')[1] : '00'}
                                onChange={(e) => {
                                  const date = addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
                                  const time = addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[1] : '00:00';
                                  const hour = time.split(':')[0];
                                  handleAddFieldChange('tracker_datetime', `${date}T${hour}:${e.target.value}`);
                                }}
                              >
                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(min => (
                                  <option key={min} value={min}>{min}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* AM/PM Dropdown */}
                            <div className="relative">
                              <select
                                className={`w-full bg-slate-50 border rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all shadow-sm hover:bg-white ${
                                  addTouched.tracker_datetime && addErrors.tracker_datetime
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                                }`}
                                value={addFormData.tracker_datetime ? (() => {
                                  const time = addFormData.tracker_datetime.split('T')[1] || '00:00';
                                  const hour = parseInt(time.split(':')[0]);
                                  return hour >= 12 ? 'PM' : 'AM';
                                })() : 'AM'}
                                onChange={(e) => {
                                  const date = addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
                                  const time = addFormData.tracker_datetime ? addFormData.tracker_datetime.split('T')[1] : '00:00';
                                  let hour = parseInt(time.split(':')[0]);
                                  const minute = time.split(':')[1];
                                  const newIsPM = e.target.value === 'PM';
                                  const currentIsPM = hour >= 12;
                                  
                                  if (newIsPM && !currentIsPM) {
                                    hour = hour === 12 ? 12 : hour + 12;
                                  } else if (!newIsPM && currentIsPM) {
                                    hour = hour === 12 ? 0 : hour - 12;
                                  }
                                  
                                  handleAddFieldChange('tracker_datetime', `${date}T${String(hour).padStart(2, '0')}:${minute}`);
                                }}
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          </div>
                          
                          {addTouched.tracker_datetime && addErrors.tracker_datetime && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              {addErrors.tracker_datetime}
                            </p>
                          )}
                        </div>

                        {/* Project Selection */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <Briefcase className="w-4 h-4 text-blue-600" />
                            Project Name
                            <span className="text-red-500">*</span>
                          </label>
                          <SearchableSelect
                            value={addFormData.project_id}
                            onChange={(value) => handleAddFieldChange('project_id', value)}
                            options={[
                              { value: '', label: 'Select a project...' },
                              ...addProjects.map(p => ({ value: String(p.project_id), label: p.project_name }))
                            ]}
                            icon={Briefcase}
                            placeholder="Select a project..."
                            error={addTouched.project_id && addErrors.project_id}
                          />
                          {addTouched.project_id && addErrors.project_id && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              {addErrors.project_id}
                            </p>
                          )}
                        </div>

                        {/* Task Selection */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <ListChecks className="w-4 h-4 text-blue-600" />
                            Task Name
                            <span className="text-red-500">*</span>
                          </label>
                          <SearchableSelect
                            value={addFormData.task_id}
                            onChange={(value) => handleAddFieldChange('task_id', value)}
                            options={[
                              { value: '', label: 'Select a task...' },
                              ...addTasks.map(t => ({ value: String(t.task_id), label: t.task_name || t.label }))
                            ]}
                            icon={ListChecks}
                            placeholder="Select a task..."
                            disabled={!addFormData.project_id}
                            error={addTouched.task_id && addErrors.task_id}
                          />
                          {addTouched.task_id && addErrors.task_id && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              {addErrors.task_id}
                            </p>
                          )}
                        </div>

                        {/* Shift Selection */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <Clock className="w-4 h-4 text-blue-600" />
                            Shift
                            <span className="text-red-500">*</span>
                          </label>
                          <SearchableSelect
                            value={addFormData.shift_type}
                            onChange={(value) => handleAddFieldChange('shift_type', value)}
                            options={[
                              { value: '', label: 'Select shift...' },
                              { value: 'day', label: 'Day' },
                              { value: 'night', label: 'Night' }
                            ]}
                            icon={Clock}
                            placeholder="Select shift..."
                            error={addTouched.shift_type && addErrors.shift_type}
                          />
                          {addTouched.shift_type && addErrors.shift_type && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              {addErrors.shift_type}
                            </p>
                          )}
                        </div>

                        {/* Base Target */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                              <circle cx="12" cy="12" r="10"></circle>
                              <circle cx="12" cy="12" r="6"></circle>
                              <circle cx="12" cy="12" r="2"></circle>
                            </svg>
                            Base Target
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="w-full bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-300 rounded-lg px-4 py-3 text-sm font-bold text-slate-700 shadow-sm flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                <rect width="14" height="10" x="5" y="11" rx="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                              </svg>
                              <span>{addFormData.base_target ? Number(addFormData.base_target).toFixed(2) : '—'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Production Target */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                              <line x1="12" x2="12" y1="2" y2="22"></line>
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            Production
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none">
                              <line x1="12" x2="12" y1="2" y2="22"></line>
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            <input
                              type="text"
                              className={`w-full bg-slate-50 border rounded-lg pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all shadow-sm hover:bg-white ${
                                addTouched.production && addErrors.production
                                  ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                              }`}
                              value={addFormData.production}
                              onChange={(e) => handleAddFieldChange('production', e.target.value)}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value && !isNaN(value)) {
                                  handleAddFieldChange('production', parseFloat(value).toFixed(2));
                                }
                              }}
                              placeholder="Enter production"
                            />
                          </div>
                          {addTouched.production && addErrors.production && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              {addErrors.production}
                            </p>
                          )}
                        </div>

                        {/* File Upload Section */}
                        <div className="space-y-2 md:col-span-2 md:row-span-2">
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            Project Files
                          </label>
                          <div
                            onClick={() => document.getElementById('add-file-upload').click()}
                            className={`relative h-[120px] flex items-center justify-center border-2 border-dashed rounded-lg px-4 py-4 text-center transition-all cursor-pointer group ${
                              addFileError 
                                ? 'border-red-300 bg-red-50/30 hover:border-red-400' 
                                : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors ${
                                addFileError ? 'bg-red-100' : 'bg-blue-100'
                              }`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={addFileError ? 'text-red-600' : 'text-blue-600'}>
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                  <polyline points="17 8 12 3 7 8"></polyline>
                                  <line x1="12" x2="12" y1="3" y2="15"></line>
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-700">
                                  {addFormData.tracker_file ? (
                                    <span className="text-blue-600 break-all">{addFormData.tracker_file.name}</span>
                                  ) : (
                                    <>Click to <span className="text-blue-600">upload</span></>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">Max: 10MB</p>
                              </div>
                            </div>
                            <input
                              id="add-file-upload"
                              type="file"
                              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                              onChange={handleAddFileChange}
                              className="hidden"
                            />
                          </div>
                          {addFileError && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              {addFileError}
                            </p>
                          )}
                        </div>

                        {/* Notes Field */}
                        <div className="space-y-2 md:col-span-3">
                          <label className="flex items-center justify-between text-sm font-bold text-slate-700 uppercase tracking-wide">
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" x2="8" y1="13" y2="13"></line>
                                <line x1="16" x2="8" y1="17" y2="17"></line>
                                <line x1="10" x2="8" y1="9" y2="9"></line>
                              </svg>
                              Notes
                            </span>
                          </label>
                          <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-3 text-blue-600 pointer-events-none">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" x2="8" y1="13" y2="13"></line>
                              <line x1="16" x2="8" y1="17" y2="17"></line>
                              <line x1="10" x2="8" y1="9" y2="9"></line>
                            </svg>
                            <textarea
                              rows="3"
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition-all shadow-sm hover:bg-white resize-none"
                              value={addFormData.tracker_note}
                              onChange={(e) => handleAddFieldChange('tracker_note', e.target.value)}
                              placeholder="Enter any additional notes or comments..."
                            ></textarea>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-center gap-4 pt-3 pb-6 px-6 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleCloseAddModal}
                        className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingAdd}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {submittingAdd ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Submit
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QATrackerReport;
