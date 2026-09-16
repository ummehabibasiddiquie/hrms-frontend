import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { X, Upload, ChevronDown, ExternalLink, Users, Table } from 'lucide-react';
import { updateTask } from '../../../../services/projectService';
import { fetchDropdown } from '../../../../services/dropdownService';
import { useAuth } from '../../../../context/AuthContext';
import MultiSelectWithCheckbox from '../../../common/MultiSelectWithCheckbox';
import * as XLSX from 'xlsx';
import SearchableSelect from '../../../common/SearchableSelect';
import QaTargetFieldsEditor from './QaTargetFieldsEditor';
import { emptyQaTargetFields, parseQaTargetFieldsFromTask, serializeQaTargetPayload } from './qaTargetFields';

const EditTaskModal = ({
  open,
  onClose,
  task,
  projectId,
  onTaskUpdated
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target: '',
    teamIds: [],
    file: null,
    existingFileUrl: '',
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
    if (open && task) {
      let teamIds = [];
      if (Array.isArray(task.task_team)) {
        teamIds = task.task_team.map(id => String(id));
      } else if (Array.isArray(task.task_team_id)) {
        teamIds = task.task_team_id.map(id => String(id));
      } else if (Array.isArray(task.teamIds)) {
        teamIds = task.teamIds.map(id => String(id));
      }
      
      // Parse important columns if exists
      let importantColumns = [];
      if (task.important_columns) {
        try {
          importantColumns = typeof task.important_columns === 'string' 
            ? JSON.parse(task.important_columns) 
            : task.important_columns;
          if (!Array.isArray(importantColumns)) importantColumns = [];
        } catch (e) {
          console.error('Error parsing important columns:', e);
          importantColumns = [];
        }
      }
      
      // Get file URL
      const fileUrl = task.task_file || task.file || '';
      
      // If there is an existing file, fetch and parse it for columns
      if (fileUrl) {
        fetch(fileUrl)
          .then(response => response.arrayBuffer())
          .then(data => {
            try {
              const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              let fileColumns = [];
              if (jsonData && jsonData.length > 0 && jsonData[0]) {
                fileColumns = jsonData[0].filter(header => header && String(header).trim()).map(String);
              }
              // Merge file columns and importantColumns, preselect those in importantColumns
              setExcelColumnHeaders(fileColumns);
              setFormData({
                name: task.task_name || task.name || '',
                description: task.task_description || task.description || '',
                target: task.task_target || task.target || '',
                teamIds,
                file: null,
                existingFileUrl: fileUrl,
                importantColumns: importantColumns.filter(col => fileColumns.includes(col)),
                qcPercentage: task.qc_percentage !== undefined && task.qc_percentage !== null ? String(task.qc_percentage) : '',
                ...parseQaTargetFieldsFromTask(task),
              });
            } catch (err) {
              // fallback to just importantColumns
              setExcelColumnHeaders(importantColumns.length > 0 ? importantColumns : []);
              setFormData({
                name: task.task_name || task.name || '',
                description: task.task_description || task.description || '',
                target: task.task_target || task.target || '',
                teamIds,
                file: null,
                existingFileUrl: fileUrl,
                importantColumns,
                qcPercentage: task.qc_percentage !== undefined && task.qc_percentage !== null ? String(task.qc_percentage) : '',
                ...parseQaTargetFieldsFromTask(task),
              });
            }
          })
          .catch(() => {
            // fallback to just importantColumns
            setExcelColumnHeaders(importantColumns.length > 0 ? importantColumns : []);
            setFormData({
              name: task.task_name || task.name || '',
              description: task.task_description || task.description || '',
              target: task.task_target || task.target || '',
              teamIds,
              file: null,
              existingFileUrl: fileUrl,
              importantColumns,
              qcPercentage: task.qc_percentage !== undefined && task.qc_percentage !== null ? String(task.qc_percentage) : '',
                ...parseQaTargetFieldsFromTask(task),
            });
          });
      } else {
        // No file, fallback to just importantColumns
        setExcelColumnHeaders(importantColumns.length > 0 ? importantColumns : []);
        setFormData({
          name: task.task_name || task.name || '',
          description: task.task_description || task.description || '',
          target: task.task_target || task.target || '',
          teamIds,
          file: null,
          existingFileUrl: fileUrl,
          importantColumns,
          qcPercentage: task.qc_percentage !== undefined && task.qc_percentage !== null ? String(task.qc_percentage) : '',
                ...parseQaTargetFieldsFromTask(task),
        });
      }
    } else if (!open) {
      // Reset form data when modal closes to avoid stale data
      setFormData({
        name: '',
        description: '',
        target: '',
        teamIds: [],
        file: null,
        existingFileUrl: '',
        importantColumns: [],
        qcPercentage: '',
        ...emptyQaTargetFields(),
      });
      setExcelColumnHeaders([]);
    }
  }, [open, task]);

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
          console.error('[EditTaskModal] Failed to parse user from sessionStorage:', e);
        }
      }
      
      console.log('[EditTaskModal] Loading agents with userId:', userId, 'projectId:', projectId);
      
      // Don't proceed if we don't have required data
      if (!userId || !projectId) {
        console.warn('[EditTaskModal] Missing required data - userId:', userId, 'projectId:', projectId);
        setAgents([]);
        return;
      }
      
      setAgentsLoading(true);
      setAgentsError('');
      try {
        const data = await fetchDropdown('agent', userId, projectId);
        const normalized = (data || []).map((item) => {
          const candidate = Array.isArray(item) ? item[0] : item;
          const id = candidate?.user_id || candidate?.team_id || candidate?.id;
          const label = candidate?.label || candidate?.name || candidate?.user_name || candidate?.team_name || '';
          return id ? { id: String(id), label } : null;
        }).filter(Boolean);
        console.log('[EditTaskModal] Agents loaded:', normalized.length);
        setAgents(normalized);
      } catch (error) {
        console.error('[EditTaskModal] Error loading agents:', error);
        setAgentsError('Unable to load agents');
      } finally {
        setAgentsLoading(false);
      }
    };
    loadAgents();
  }, [projectId, user?.user_id]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    const isValidType = validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (!isValidType) {
      toast.error('Please upload a valid Excel file (.xlsx or .xls)');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setFormData((prev) => ({ ...prev, file }));
    
    // Read Excel file and extract column headers
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target.result;
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error('File is empty or could not be read');
          }
          
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No sheets found in Excel file');
          }
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Get first row (column headers)
          if (jsonData && jsonData.length > 0 && jsonData[0]) {
            const headers = jsonData[0].filter(header => header && String(header).trim());
            if (headers.length === 0) {
              toast.error('No column headers found in Excel file');
              return;
            }
            setExcelColumnHeaders(headers.map(h => String(h)));
            // Clear previously selected important columns when new file is uploaded
            setFormData((prev) => ({ ...prev, importantColumns: [] }));
            toast.success(`Found ${headers.length} columns in Excel file`);
          } else {
            toast.error('Excel file appears to be empty');
          }
        } catch (error) {
          console.error('Error reading Excel file:', error);
          toast.error(`Failed to read Excel file: ${error.message || 'Invalid file format'}`);
          // Reset file input on error
          setFormData((prev) => ({ ...prev, file: null }));
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      
      reader.onerror = () => {
        toast.error('Failed to read file');
        setFormData((prev) => ({ ...prev, file: null }));
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process Excel file');
      setFormData((prev) => ({ ...prev, file: null }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleRemoveFile = () => {
    setFormData((prev) => ({ ...prev, file: null }));
    
    // Restore original important columns from task if exists
    if (task && task.important_columns) {
      try {
        const originalImportantColumns = typeof task.important_columns === 'string' 
          ? JSON.parse(task.important_columns) 
          : task.important_columns;
        if (Array.isArray(originalImportantColumns) && originalImportantColumns.length > 0) {
          setExcelColumnHeaders(originalImportantColumns);
          setFormData((prev) => ({ ...prev, importantColumns: originalImportantColumns }));
        } else {
          setExcelColumnHeaders([]);
          setFormData((prev) => ({ ...prev, importantColumns: [] }));
        }
      } catch (e) {
        setExcelColumnHeaders([]);
        setFormData((prev) => ({ ...prev, importantColumns: [] }));
      }
    } else {
      setExcelColumnHeaders([]);
      setFormData((prev) => ({ ...prev, importantColumns: [] }));
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const toggleImportantColumn = (column) => {
    setFormData((prev) => {
      const exists = prev.importantColumns.includes(column);
      const updated = exists
        ? prev.importantColumns.filter((c) => c !== column)
        : [...prev.importantColumns, column];
      return { ...prev, importantColumns: updated };
    });
  };
  
  const handleSelectAllImportantColumns = (isChecked) => {
    if (isChecked) {
      setFormData((prev) => ({ ...prev, importantColumns: [...excelColumnHeaders] }));
    } else {
      setFormData((prev) => ({ ...prev, importantColumns: [] }));
    }
  };

  const handleTeamChange = (newTeamIds) => {
    setFormData((prev) => ({ ...prev, teamIds: newTeamIds }));
    if (formErrors.teamIds) {
      setFormErrors((prev) => ({ ...prev, teamIds: '' }));
    }
  };

  const handleImportantColumnsChange = (newColumns) => {
    setFormData((prev) => ({ ...prev, importantColumns: newColumns }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Task name is required';
    if (!formData.target) {
      errors.target = 'Target is required';
    } else if (Number(formData.target) <= 0) {
      errors.target = 'Target must be greater than 0';
    }
    if (formData.teamIds.length === 0) errors.teamIds = 'Select at least one agent';
    // Removed Assistant/QA validation
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    
    // Prepare payload with all fields including file and important columns
    const taskPayload = {
      name: formData.name,
      description: formData.description,
      target: formData.target,
      teamIds: formData.teamIds,
      file: formData.file, // New file if uploaded
      importantColumns: formData.importantColumns,
      qcPercentage: formData.qcPercentage, // FIX: use camelCase key
      ...serializeQaTargetPayload(formData),
    };
    
    try {
      // Parent returns false on API failure (and usually toasts already)
      if (onTaskUpdated) {
        const ok = await onTaskUpdated(projectId, task.task_id || task.id, taskPayload);
        if (ok === false) {
          setIsSubmitting(false);
          return;
        }
      }
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      console.error('Error updating task:', err);
      toast.error(err?.message || 'Failed to update task');
      setFormErrors({ submit: err?.message || 'Failed to update task' });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        <div className="p-4 bg-blue-800 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-left">Edit Task</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
            title="Close"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700 mb-3 text-left">Edit Task</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Task Name <span className="text-red-600">*</span></label>
                <input
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter task name"
                  value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  disabled={isSubmitting}
                />
                {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Target <span className="text-red-600">*</span></label>
                <input
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Target"
                  type="number"
                  value={formData.target}
                  onChange={e => handleChange('target', e.target.value)}
                  disabled={isSubmitting}
                />
                {formErrors.target && <p className="text-xs text-red-600 mt-1">{formErrors.target}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Task Description</label>
                <textarea
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[70px]"
                  placeholder="Add a short description"
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* QC and Sample File Side by Side */}
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Generate Data for QC Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Generate Data for QC</label>
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
                    <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Sample File ( Excel Only )</label>
                    <div className="space-y-2">
                      {/* Existing file display - only show when no new file is selected */}
                      {formData.existingFileUrl && !formData.file && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                          <span className="text-slate-700">Current file:</span>
                          <a
                            href={formData.existingFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 underline truncate"
                          >
                            {formData.existingFileUrl.split('/').pop() || 'View file'}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                      )}
                      {/* New file display - only show when new file is selected */}
                      {formData.file && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                          <span className="text-blue-800 truncate">{formData.file.name}</span>
                          <button
                            onClick={handleRemoveFile}
                            className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                            title="Remove new file"
                            disabled={isSubmitting}
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
                          id="task-file-upload-edit"
                          accept=".xlsx,.xls"
                          disabled={isSubmitting}
                        />
                        <label
                          htmlFor="task-file-upload-edit"
                          className={`inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Upload className="w-4 h-4" />
                          {formData.file ? 'Choose Different File' : formData.existingFileUrl ? 'Replace Excel File' : 'Choose Excel File'}
                        </label>
                      </div>
                      {excelColumnHeaders.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {formData.file ? `Found ${excelColumnHeaders.length} columns in Excel file` : `${excelColumnHeaders.length} columns available`}
                        </p>
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
                <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Important Columns</label>
                <MultiSelectWithCheckbox
                  value={formData.importantColumns}
                  onChange={handleImportantColumnsChange}
                  options={excelColumnHeaders.map(col => ({ value: col, label: col }))}
                  icon={Table}
                  placeholder={excelColumnHeaders.length === 0 ? "Upload Excel file first" : "Select important columns"}
                  disabled={excelColumnHeaders.length === 0 || isSubmitting}
                  showSelectAll={true}
                  maxDisplayCount={2}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Team (Agents) <span className="text-red-600">*</span></label>
                <MultiSelectWithCheckbox
                  value={formData.teamIds}
                  onChange={handleTeamChange}
                  options={agents.map(agent => ({ value: agent.id, label: agent.label }))}
                  icon={Users}
                  placeholder={agentsLoading ? "Loading agents..." : agents.length === 0 ? (agentsError || "No agents available") : "Select agents"}
                  disabled={agentsLoading || agents.length === 0 || isSubmitting}
                  showSelectAll={true}
                  error={!!formErrors.teamIds}
                  errorMessage={formErrors.teamIds}
                  maxDisplayCount={2}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            {formErrors.submit && <div className="text-red-500 text-xs mb-2">{formErrors.submit}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTaskModal;
