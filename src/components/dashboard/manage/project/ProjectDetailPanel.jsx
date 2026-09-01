import React, { useEffect, useState, useRef } from "react";
import { Edit, Trash2, Plus, Download, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import TaskTable from "./TaskTable";
import EditTaskModal from "./EditTaskModal";
import TasksModal from "./TasksModal";
import { useAuth } from "../../../../context/AuthContext";
import { fetchProjectsList, updateProject } from "../../../../services/projectService";
import { getFriendlyErrorMessage } from "../../../../utils/errorMessages";

const ProjectDetailPanel = ({
  project,
  readOnly,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  openEditModal,
  openDeleteModal,
  onStatusChanged,
  onTaskCountChange,
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
      formData.append("is_active", String(next));
      await updateProject(projectId, formData);
      toast.success(next === 1 ? "Project activated" : "Project deactivated");
      onStatusChanged?.(projectId, next);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err) || "Failed to update project status");
    } finally {
      setTogglingStatus(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filesDropdownRef.current &&
        !filesDropdownRef.current.contains(event.target) &&
        filesButtonRef.current &&
        !filesButtonRef.current.contains(event.target)
      ) {
        setShowFilesDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFilesDropdownToggle = async () => {
    if (!showFilesDropdown) {
      try {
        const res = await fetchProjectsList(user?.user_id, { includeInactive: true });
        const projects = res.data || [];
        const current = projects.find((p) => p.project_id === (project.id || project.project_id));
        setProjectFiles(
          current?.project_files && Array.isArray(current.project_files)
            ? current.project_files
            : []
        );
      } catch {
        toast.error("Failed to load project files");
        setProjectFiles([]);
      }
    }
    setShowFilesDropdown(!showFilesDropdown);
  };

  const handleDownloadFile = (fileUrl) => {
    const fileName = fileUrl.split("/").pop() || "project-file";
    const link = document.createElement("a");
    link.href = fileUrl;
    link.setAttribute("download", fileName);
    link.setAttribute("target", "_blank");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const actionBtn =
    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              ref={filesButtonRef}
              type="button"
              onClick={handleFilesDropdownToggle}
              className={`${actionBtn} bg-white border border-purple-200 text-purple-700 hover:bg-purple-50`}
            >
              <Download className="w-4 h-4" />
              Files
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showFilesDropdown && (
              <div
                ref={filesDropdownRef}
                className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto"
              >
                {projectFiles.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500 text-center">No files uploaded</p>
                ) : (
                  projectFiles.map((fileUrl, index) => {
                    const fileName = fileUrl.split("/").pop() || `File ${index + 1}`;
                    return (
                      <button
                        key={index}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 truncate border-b border-slate-100 last:border-0"
                        onClick={() => handleDownloadFile(fileUrl)}
                        title={fileName}
                      >
                        {fileName}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => openEditModal(project)}
            className={`${actionBtn} bg-white border border-blue-200 text-blue-700 hover:bg-blue-50`}
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>

          {!readOnly && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
              <span className="text-xs font-semibold text-slate-600">Status</span>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all disabled:opacity-50 ${
                  isActive ? "bg-green-500" : "bg-gray-300"
                }`}
                title={isActive ? "Deactivate project" : "Activate project"}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ${
                    isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => openDeleteModal(project)}
            className={`${actionBtn} bg-white border border-red-200 text-red-700 hover:bg-red-50`}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          <button
            type="button"
            onClick={() => setShowTasksModal(true)}
            className={`${actionBtn} ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700`}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll px-4 py-3">
        <TaskTable
          project={project}
          readOnly={readOnly}
          fillAvailable
          onTaskCountChange={onTaskCountChange}
          onEditTask={(projectId, taskId, taskObj) => {
            setEditTaskModal({ open: true, task: taskObj });
          }}
          onTaskUpdated={() => setTaskTableRefresh(Date.now())}
          onDeleteTask={(projectId, taskId) => {
            onDeleteTask?.(projectId, taskId);
            setTaskTableRefresh(Date.now());
          }}
          refresh={taskTableRefresh}
        />
      </div>

      {editTaskModal.open && (
        <EditTaskModal
          open={editTaskModal.open}
          onClose={() => setEditTaskModal({ open: false, task: null })}
          task={editTaskModal.task}
          projectId={project.id}
          onTaskUpdated={async (projectId, taskId, taskPayload) => {
            if (onUpdateTask) await onUpdateTask(projectId, taskId, taskPayload);
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
            onAddTask?.(project.id, newTask);
            setTaskTableRefresh(Date.now());
            setShowTasksModal(false);
          }}
          onUpdateTask={(taskId, updatedTask) => {
            onUpdateTask?.(project.id, taskId, updatedTask);
            setTaskTableRefresh(Date.now());
          }}
          onDeleteTask={(taskId) => {
            onDeleteTask?.(project.id, taskId);
            setTaskTableRefresh(Date.now());
          }}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};

export default ProjectDetailPanel;
