import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, Plus, Loader2, ChevronDown, Pencil, Trash2, Upload, Users, Table } from 'lucide-react';
import { fetchDropdown } from '../../../../services/dropdownService';
import { fetchProjectTasks } from '../../../../services/projectService';
import { useAuth } from '../../../../context/AuthContext';
import MultiSelectWithCheckbox from '../../../common/MultiSelectWithCheckbox';
import * as XLSX from 'xlsx';
import SearchableSelect from '../../../common/SearchableSelect';
import QaTargetFieldsEditor from './QaTargetFieldsEditor';
import { emptyQaTargetFields, serializeQaTargetPayload } from './qaTargetFields';

const TasksModal = ({
  project,
  onClose,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  readOnly = false
}) => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [editTaskId, setEditTaskId] = useState(null);
    const [editFormData, setEditFormData] = useState(null);
    const [editFormErrors, setEditFormErrors] = useState({});
    const [editSubmitting, setEditSubmitting] = useState(false);
    // Fetch tasks for this project
    useEffect(() => {
      if (!project?.id) return;
      setTasksLoading(true);
      fetchProjectTasks(
        project.id,
        user?.user_id,
        user?.device_id || 'web',
        user?.device_type || 'Laptop'
      )
        .then(res => {
          setTasks(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => setTasks([]))
        .finally(() => setTasksLoading(false));
    }, [project?.id, user?.user_id, user?.device_id, user?.device_type]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target: '',
    teamIds: [],
    file: null,
    importantColumns: [],
    qcPercentage: '',
    ...emptyQaTargetFields(),
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState('');
  const fileInputRef = useRef(null);
  
  // Dynamic important columns options from Excel file
  const [excelColumnHeaders, setExcelColumnHeaders] = useState([]);

  useEffect(() => {
    const loadAgents = async () => {
      // Get user_id from context or fallback to sessionStorage
      let userId = user?.user_id;
      
      if (!userId) {
        try {
          const storedUser = sessionStorage.getItem('user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            userId = parsed?.user_id || parsed?.id;
          }
        } catch (e) {
          console.error('[TasksModal] Failed to parse user from sessionStorage:', e);
        }
      }
      
      console.log('[TasksModal] Loading agents with userId:', userId, 'projectId:', project?.id);
      
      // Don't proceed if we don't have required data
      if (!userId || !project?.id) {
        console.warn('[TasksModal] Missing required data - userId:', userId, 'projectId:', project?.id);
        setAgents([]);
        return;
      }
      
      setAgentsLoading(true);
      setAgentsError('');
      try {
        const data = await fetchDropdown('agent', userId, project?.id);
        const normalized = (data || []).map((item) => {
          const candidate = Array.isArray(item) ? item[0] : item;
          const id = candidate?.user_id || candidate?.team_id || candidate?.id;
          const label = candidate?.label || candidate?.name || candidate?.user_name || candidate?.team_name || '';
          return id ? { id: String(id), label } : null;
        }).filter(Boolean);
        console.log('[TasksModal] Agents loaded:', normalized.length);
        setAgents(normalized);
      } catch (error) {
        console.error('[TasksModal] Failed to fetch agents:', error);
        setAgentsError('Unable to load agents');
      } finally {
        setAgentsLoading(false);
      }
    };
    loadAgents();
  }, [project?.id, user?.user_id]);

  const handleTeamChange = (newTeamIds) => {
    setFormData((prev) => ({ ...prev, teamIds: newTeamIds }));
    if (formErrors.teamIds) {
      setFormErrors((prev) => ({ ...prev, teamIds: '' }));
    }
  };

  const handleImportantColumnsChange = (newColumns) => {
    setFormData((prev) => ({ ...prev, importantColumns: newColumns }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, file }));
      
      // Read Excel file and extract column headers
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Get first row (column headers)
            if (jsonData && jsonData.length > 0 && jsonData[0]) {
              const headers = jsonData[0].filter(header => header && String(header).trim());
              setExcelColumnHeaders(headers.map(h => String(h)));
              // Clear previously selected important columns when new file is uploaded
              setFormData((prev) => ({ ...prev, importantColumns: [] }));
            }
          } catch (error) {
            console.error('Error reading Excel file:', error);
            toast.error('Failed to read Excel file');
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error('Failed to process Excel file');
      }
    }
  };
  
  const handleRemoveFile = () => {
    setFormData((prev) => ({ ...prev, file: null, importantColumns: [] }));
    setExcelColumnHeaders([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    const errors = {};

    console.log('Validating form data:', formData);
    console.log('teamIds:', formData.teamIds, 'length:', formData.teamIds.length);

    if (!formData.name.trim()) errors.name = 'Task name is required';

    if (!formData.target) {
      errors.target = 'Target is required';
    } else if (Number(formData.target) <= 0) {
      errors.target = 'Target must be greater than 0';
    }

    if (!formData.teamIds || formData.teamIds.length === 0) errors.teamIds = 'Select at least one agent';

    console.log('Validation errors:', errors);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddTask = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    const success = await onAddTask({
      ...formData,
      ...serializeQaTargetPayload(formData),
    });
    setIsSubmitting(false);
    if (success) {
      setFormData({ name: '', description: '', target: '', teamIds: [], file: null, importantColumns: [], qcPercentage: '', ...emptyQaTargetFields() });
      setExcelColumnHeaders([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Refetch tasks
      setTasksLoading(true);
      fetchProjectTasks(
        project.id,
        user?.user_id,
        user?.device_id || 'web',
        user?.device_type || 'Laptop'
      )
        .then(res => setTasks(Array.isArray(res.data) ? res.data : []))
        .finally(() => setTasksLoading(false));
    }
  };

  // Edit logic
  const [originalTaskData, setOriginalTaskData] = useState(null);
  
  const startEditTask = (task) => {
    setEditTaskId(task.task_id || task.id);
    // API returns task_team (not task_team_id)
    const teamArray = task.task_team || task.task_team_id || [];
    const taskData = {
      name: task.task_name || task.name || '',
      description: task.task_description || task.description || '',
      target: task.task_target || task.target || '',
      teamIds: Array.isArray(teamArray) ? teamArray.map(String) : [],
      qcPercentage: task.qc_percentage || '',
    };
    setEditFormData(taskData);
    setOriginalTaskData(taskData); // Store original data for comparison
    setEditFormErrors({});
  };

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
    if (editFormErrors[field]) setEditFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleEditTeamToggle = (id) => {
    setEditFormData(prev => {
      const exists = prev.teamIds.includes(id);
      const updated = exists ? prev.teamIds.filter(t => t !== id) : [...prev.teamIds, id];
      return { ...prev, teamIds: updated };
    });
    if (editFormErrors.teamIds) setEditFormErrors(prev => ({ ...prev, teamIds: '' }));
  };

  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.name?.trim()) errors.name = 'Task name is required';
    if (!editFormData.target) errors.target = 'Target is required';
    else if (Number(editFormData.target) <= 0) errors.target = 'Target must be greater than 0';
    if (!editFormData.teamIds?.length) errors.teamIds = 'Select at least one agent';
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditTask = async () => {
    if (!validateEditForm()) return;
    setEditSubmitting(true);
    
    // Build object with only changed fields
    const changedFields = {};
    if (editFormData.name !== originalTaskData.name) changedFields.name = editFormData.name;
    if (editFormData.description !== originalTaskData.description) changedFields.description = editFormData.description;
    if (editFormData.target !== originalTaskData.target) changedFields.target = editFormData.target;
    if (JSON.stringify(editFormData.teamIds) !== JSON.stringify(originalTaskData.teamIds)) {
      changedFields.teamIds = editFormData.teamIds;
    }
    if (editFormData.qcPercentage !== originalTaskData.qcPercentage) {
      changedFields.qcPercentage = editFormData.qcPercentage;
    }
    
    const success = await onUpdateTask(project.id, editTaskId, changedFields);
    setEditSubmitting(false);
    if (success) {
      setEditTaskId(null);
      setEditFormData(null);
      // Refetch tasks
      setTasksLoading(true);
      fetchProjectTasks(
        project.id,
        user?.user_id,
        user?.device_id || 'web',
        user?.device_type || 'Laptop'
      )
        .then(res => setTasks(Array.isArray(res.data) ? res.data : []))
        .finally(() => setTasksLoading(false));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    setTasksLoading(true);
    await onDeleteTask(project.id, taskId, formData.qcPercentage);
    fetchProjectTasks(
      project.id,
      user?.user_id,
      user?.device_id || 'web',
      user?.device_type || 'Laptop'
    )
      .then(res => setTasks(Array.isArray(res.data) ? res.data : []))
      .finally(() => setTasksLoading(false));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        <div className="p-4 bg-blue-800 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold">Project Tasks</h2>
            <p className="text-blue-200 text-xs">{project.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
          {/* Add Task Form */}
          {!readOnly && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Add Task</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Task Name <span className="text-red-600">*</span></label>
                  <input
                    className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter task name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                  {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Target <span className="text-red-600">*</span></label>
                  <input
                    className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Target"
                    type="number"
                    value={formData.target}
                    onChange={(e) => handleChange('target', e.target.value)}
                  />
                  {formErrors.target && <p className="text-xs text-red-600 mt-1">{formErrors.target}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Task Description</label>
                  <textarea
                    className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[70px]"
                    placeholder="Add a short description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />
                </div>

                {/* QC and Sample File Side by Side */}
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Generate Data for QC Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Generate Data for QC</label>
                      <div className="mb-3">
                        <SearchableSelect
                          value={formData.qcPercentage || ''}
                          onChange={val => handleChange('qcPercentage', val)}
                          options={[
                            { value: '10', label: '10%' },
                            { value: '25', label: '25%' },
                            { value: '50', label: '50%' },
                            { value: '75', label: '75%' },
                            { value: '100', label: '100%' },
                          ]}
                          placeholder="Please select how much % you want to generate the data for QC"
                          className="w-full"
                        />
                      </div>
                    </div>
                    {/* Sample File Upload - Excel Only */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Sample File ( Excel Only )</label>
                      <div className="space-y-2">
                        {/* Selected file display - only show when file is selected */}
                        {formData.file && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                            <span className="text-blue-800 truncate">{formData.file.name}</span>
                            <button
                              onClick={handleRemoveFile}
                              className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                              title="Remove file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {/* File upload button */}
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileChange}
                            className="hidden"
                            id="task-file-upload"
                            accept=".xlsx,.xls"
                          />
                          <label
                            htmlFor="task-file-upload"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm"
                          >
                            <Upload className="w-4 h-4" />
                            {formData.file ? 'Choose Different File' : 'Choose Excel File'}
                          </label>
                        </div>
                        {excelColumnHeaders.length > 0 && (
                          <p className="text-xs text-green-600 mt-1">✓ Found {excelColumnHeaders.length} columns in Excel file</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <QaTargetFieldsEditor
                  formData={formData}
                  setFormData={setFormData}
                  excelColumnHeaders={excelColumnHeaders}
                  disabled={isSubmitting}
                />

                {/* Important Columns Dropdown - Populated from Excel */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Important Columns</label>
                  <MultiSelectWithCheckbox
                    value={formData.importantColumns}
                    onChange={handleImportantColumnsChange}
                    options={excelColumnHeaders.map(col => ({ value: col, label: col }))}
                    icon={Table}
                    placeholder={excelColumnHeaders.length === 0 ? "Upload Excel file first" : "Select important columns"}
                    disabled={excelColumnHeaders.length === 0}
                    showSelectAll={true}
                    maxDisplayCount={2}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Team (Agents) <span className="text-red-600">*</span></label>
                  <MultiSelectWithCheckbox
                    value={formData.teamIds}
                    onChange={handleTeamChange}
                    options={agents.map(agent => ({ value: agent.id, label: agent.label }))}
                    icon={Users}
                    placeholder={agentsLoading ? "Loading agents..." : agents.length === 0 ? (agentsError || "No agents available") : "Select agents"}
                    disabled={agentsLoading || agents.length === 0}
                    showSelectAll={true}
                    error={!!formErrors.teamIds}
                    errorMessage={formErrors.teamIds}
                    maxDisplayCount={2}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleAddTask}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TasksModal;
