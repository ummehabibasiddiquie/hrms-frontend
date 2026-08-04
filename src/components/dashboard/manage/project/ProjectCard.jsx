import React, { useEffect, useState, useRef } from 'react';
import { Edit, Trash2, Plus, ChevronDown, ChevronUp, Download } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import TaskTable from './TaskTable';
import EditTaskModal from './EditTaskModal';
import TasksModal from './TasksModal';
import { useAuth } from '../../../../context/AuthContext';
import { fetchProjectsList, updateProject } from '../../../../services/projectService';
import { getFriendlyErrorMessage } from '../../../../utils/errorMessages';

// If this is a single card, keep as is. If you want to show a list, use below:
const ProjectCard = ({
  project,
  readOnly,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  openEditModal,
  openDeleteModal,
  expanded,
  setExpanded,
  fetchList,
  onStatusChanged,
}) => {
  const { user } = useAuth();
  const [editTaskModal, setEditTaskModal] = useState({ open: false, task: null });
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [taskTableRefresh, setTaskTableRefresh] = useState(Date.now());
  const [showFilesDropdown, setShowFilesDropdown] = useState(false);
  const [projectFiles, setProjectFiles] = useState([]);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const filesDropdownRef = useRef(null);
  const filesButtonRef = useRef(null);

  const isActive = Number(project.is_active ?? 1) === 1;

  const handleToggleStatus = async () => {
    if (readOnly || togglingStatus) return;
    const projectId = project.id || project.project_id;
    const next = isActive ? 0 : 1;
    try {
      setTogglingStatus(true);
      const formData = new FormData();
      formData.append('is_active', String(next));
      await updateProject(projectId, formData);
      toast.success(next === 1 ? 'Project activated' : 'Project deactivated');
      onStatusChanged?.(projectId, next);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err) || 'Failed to update project status');
    } finally {
      setTogglingStatus(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filesDropdownRef.current && !filesDropdownRef.current.contains(event.target) && 
          filesButtonRef.current && !filesButtonRef.current.contains(event.target)) {
        setShowFilesDropdown(false);
      }
    };
    
    const handleScroll = () => {
      if (showFilesDropdown) {
        setShowFilesDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // true for capture phase to catch all scrolls
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showFilesDropdown]);

  // Fetch project files when dropdown opens
  const handleFilesDropdownToggle = async () => {
    if (!showFilesDropdown) {
      try {
        const res = await fetchProjectsList(user?.user_id, { includeInactive: true });
        const projects = res.data || [];
        const current = projects.find(p => p.project_id === (project.id || project.project_id));
        if (current && current.project_files && Array.isArray(current.project_files)) {
          setProjectFiles(current.project_files);
        } else {
          setProjectFiles([]);
        }
      } catch (err) {
        console.error('[ProjectCard] Failed to fetch project files:', err);
        toast.error('Failed to load project files');
        setProjectFiles([]);
      }
    }
    setShowFilesDropdown(!showFilesDropdown);
  };

  const handleDownloadFile = (fileUrl) => {
    const fileName = fileUrl.split('/').pop() || 'project-file';
    const link = document.createElement('a');
    link.href = fileUrl;
    link.setAttribute('download', fileName);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Optionally, fetch project list if fetchList prop is true
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    if (fetchList && user?.user_id) {
      fetchProjectsList(user.user_id)
        .then(res => setProjects(res.data || []))
        .catch(() => toast.error('Failed to fetch project list'));
    }
  }, [fetchList, user]);

  // If fetchList, render all projects
  if (fetchList) {
    return (
      <div>
        {projects.map((proj) => (
          <ProjectCard
            key={proj.project_id}
            project={{
              ...proj,
              name: proj.project_name,
              id: proj.project_id,
            }}
            readOnly={readOnly}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            openEditModal={openEditModal}
            openDeleteModal={openDeleteModal}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 overflow-visible">
        {/* Card Header with White Background */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            {/* Left: Project name and icon */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-2.5 rounded-lg flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5 text-blue-700"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V6a2 2 0 012-2h14a2 2 0 012 2v1M3 7h18M3 7v11a2 2 0 002 2h14a2 2 0 002-2V7M9 17h6" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-slate-800 truncate">{project.name}</h1>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-slate-200 text-slate-600 border border-slate-300'
                  }`}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-slate-500 text-xs">Project Details & Tasks</p>
              </div>
            </div>
            
            {/* Right: Expand/Collapse Button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-4 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-all duration-200 flex-shrink-0"
              title={expanded ? 'Collapse' : 'Expand'}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="w-5 h-5 text-slate-700" /> : <ChevronDown className="w-5 h-5 text-slate-700" />}
            </button>
          </div>
        </div>

        {/* Actions Bar */}
        <div className={`bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-3 ${expanded ? 'border-b border-slate-200' : 'rounded-b-lg'}`}>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Download Project Files Button with Dropdown */}
            <div className="relative inline-block">
              <button
                ref={filesButtonRef}
                onClick={handleFilesDropdownToggle}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 shadow-sm hover:shadow group"
                title="View Project Files"
                aria-label="View Project Files"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Files</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 group-hover:translate-y-0.5 transition-transform" />
              </button>
              
              {/* Dropdown attached to button */}
              {showFilesDropdown && (
                <div 
                  ref={filesDropdownRef}
                  className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-96 overflow-hidden animate-fade-in"
                >
                  {projectFiles.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Download className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 mb-1">No files available</p>
                      <p className="text-xs text-slate-400">Upload files to get started</p>
                    </div>
                  ) : (
                    <div>
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Project Files
                        </h4>
                        <p className="text-xs text-purple-100 mt-0.5">{projectFiles.length} file{projectFiles.length !== 1 ? 's' : ''} available</p>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {projectFiles.map((fileUrl, index) => {
                          const fileName = fileUrl.split('/').pop() || `File ${index + 1}`;
                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between px-4 py-3 hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 cursor-pointer group border-b border-slate-100 last:border-0 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadFile(fileUrl);
                              }}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 flex-shrink-0">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-purple-700 transition-colors" title={fileName}>
                                    {fileName}
                                  </p>
                                  <p className="text-xs text-slate-500">Click to download</p>
                                </div>
                              </div>
                              <Download className="w-5 h-5 text-slate-400 group-hover:text-purple-600 transition-colors flex-shrink-0 group-hover:translate-y-0.5 group-hover:scale-110" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Edit Button */}
            <button
              onClick={() => openEditModal(project)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
              title="Edit Project"
              aria-label="Edit Project"
            >
              <Edit className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </button>

            {/* Active / Inactive toggle */}
            {!readOnly && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                <span className="text-xs font-semibold text-slate-600">Status</span>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={togglingStatus}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm disabled:opacity-50 ${
                    isActive
                      ? 'bg-green-500 focus:ring-green-500'
                      : 'bg-gray-300 focus:ring-gray-400'
                  }`}
                  title={isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Delete Button */}
            <button
              onClick={() => openDeleteModal(project)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-sm hover:shadow"
              title="Delete Project"
              aria-label="Delete Project"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Delete</span>
            </button>

            {/* Add Task Button */}
            <button
              onClick={() => setShowTasksModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md ml-auto"
              title="Add New Task"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Task</span>
            </button>
          </div>
        </div>

        {/* Task Table Section */}
        {expanded && (
          <div className="px-6 py-4 bg-white rounded-b-lg">
            <TaskTable
              project={project}
              readOnly={readOnly}
              onAddTask={onAddTask}
              onEditTask={(projectId, taskId, taskObj) => {
                setEditTaskModal({ open: true, task: taskObj });
              }}
              onTaskUpdated={() => setTaskTableRefresh(Date.now())}
              onDeleteTask={(projectId, taskId) => {
                if (onDeleteTask) onDeleteTask(projectId, taskId);
                setTaskTableRefresh(Date.now());
              }}
              refresh={taskTableRefresh}
            />
          </div>
        )}
      </div>

      {editTaskModal.open && (
        <EditTaskModal
          open={editTaskModal.open}
          onClose={() => setEditTaskModal({ open: false, task: null })}
          task={editTaskModal.task}
          projectId={project.id}
          onTaskUpdated={async (projectId, taskId, taskPayload) => {
            if (onUpdateTask) {
              await onUpdateTask(projectId, taskId, taskPayload);
            }
            setTaskTableRefresh(Date.now());
            setEditTaskModal({ open: false, task: null });
          }}
        />
      )}

      {showTasksModal && (
        <TasksModal
          project={project}
          onClose={() => setShowTasksModal(false)}
          onAddTask={(newTask) => {
            onAddTask && onAddTask(project.id, newTask);
            setTaskTableRefresh(Date.now());
            setShowTasksModal(false);
          }}
          onUpdateTask={(taskId, updatedTask) => {
            onUpdateTask && onUpdateTask(project.id, taskId, updatedTask);
            setTaskTableRefresh(Date.now());
          }}
          onDeleteTask={(taskId) => {
            onDeleteTask && onDeleteTask(project.id, taskId);
            setTaskTableRefresh(Date.now());
          }}
          readOnly={readOnly}
        />
      )}
    </>
  );
};



export default ProjectCard;