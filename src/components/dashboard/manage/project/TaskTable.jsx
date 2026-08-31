import React, { useEffect, useState, useRef } from 'react';
import { fetchProjectTasks, updateTask } from '../../../../services/projectService';
import { Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DeleteTaskModal from './DeleteTaskModal';
import { getFriendlyErrorMessage } from '../../../../utils/errorMessages';

const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 12;
const COMPACT_VISIBLE_ROWS = 6;

const TaskTable = ({ project, readOnly, onDeleteTask, onEditTask, onTaskUpdated, onTaskCountChange, refresh, compact = false, fillAvailable = false }) => {
  const [tasks, setTasks] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, task: null });
  const [togglingId, setTogglingId] = useState(null);
  const tableBodyRef = useRef(null);

  useEffect(() => {
    if (!project?.id) {
      return;
    }
    fetchProjectTasks(project.id, undefined, undefined, undefined, true)
      .then(res => {
        const allTasks = Array.isArray(res.data) ? res.data : [];
        const filtered = allTasks.filter(task => String(task.project_id) === String(project.id));
        setTasks(filtered);
        onTaskCountChange?.(project.id, filtered.length);
      })
      .catch(() => {
        setTasks([]);
        onTaskCountChange?.(project.id, 0);
      });
  }, [project?.id, typeof refresh === 'undefined' ? null : refresh, onTaskCountChange]);

  const handleToggleStatus = async (task) => {
    if (readOnly || togglingId) return;
    const taskId = task.id || task.task_id;
    const current = Number(task.is_active ?? 1) === 1 ? 1 : 0;
    const next = current === 1 ? 0 : 1;
    try {
      setTogglingId(taskId);
      const formData = new FormData();
      formData.append('task_id', String(taskId));
      formData.append('is_active', String(next));
      await updateTask(formData);
      setTasks((prev) =>
        prev.map((t) =>
          String(t.id || t.task_id) === String(taskId) ? { ...t, is_active: next } : t
        )
      );
      toast.success(next === 1 ? 'Task activated' : 'Task deactivated');
      onTaskUpdated?.(project.id, taskId);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err) || 'Failed to update task status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      {deleteModal.open && (
        <DeleteTaskModal
          task={deleteModal.task}
          onClose={() => setDeleteModal({ open: false, task: null })}
          onConfirm={() => {
            const taskId = deleteModal.task.id || deleteModal.task.task_id;
            console.log('[TaskTable] Deleting task:', { projectId: project.id, taskId, task: deleteModal.task });
            if (!taskId) {
              console.error('[TaskTable] No task_id found in task object:', deleteModal.task);
              alert('Task ID is missing. Cannot delete task.');
              return;
            }
            onDeleteTask(project.id, taskId);
            setDeleteModal({ open: false, task: null });
          }}
          isDeleting={false}
        />
      )}

      <div className={`rounded-lg overflow-hidden border border-slate-200 ${compact ? '' : 'shadow-sm'}`}>
        <div
          className="overflow-x-auto"
          style={
            fillAvailable
              ? undefined
              : {
                  maxHeight: `${(compact ? 36 : ROW_HEIGHT) * (compact ? COMPACT_VISIBLE_ROWS : VISIBLE_ROWS)}px`,
                  overflowY: "auto",
                }
          }
        >
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className={compact ? 'bg-slate-700 text-white' : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white'}>
                <th className={`text-left font-semibold uppercase tracking-wide ${compact ? 'py-2 px-3 text-xs' : 'py-4 px-4 text-sm font-bold'}`}>Task Name</th>
                <th className={`text-left font-semibold uppercase tracking-wide ${compact ? 'py-2 px-3 text-xs' : 'py-4 px-4 text-sm font-bold'}`}>Target / Hr</th>
                <th className={`text-left font-semibold uppercase tracking-wide ${compact ? 'py-2 px-3 text-xs' : 'py-4 px-4 text-sm font-bold'}`}>Description</th>
                <th className={`text-center font-semibold uppercase tracking-wide ${compact ? 'py-2 px-3 text-xs' : 'py-4 px-4 text-sm font-bold'}`}>Status</th>
                <th className={`text-center font-semibold uppercase tracking-wide ${compact ? 'py-2 px-3 text-xs' : 'py-4 px-4 text-sm font-bold'}`}>Actions</th>
              </tr>
            </thead>
            <tbody ref={tableBodyRef} className="bg-white divide-y divide-slate-200">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="5" className={compact ? 'px-4 py-6 text-center text-sm text-slate-500' : 'px-6 py-12 text-center'}>
                    {compact ? (
                      'No tasks — use + to add one'
                    ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                        </svg>
                      </div>
                      <p className="text-slate-600 font-medium mb-1">No tasks found</p>
                      <p className="text-sm text-slate-400">Add a new task to get started</p>
                    </div>
                    )}
                  </td>
                </tr>
              ) : (
                tasks.map((t, idx) => {
                  const key = t.id || t.task_id || idx;
                  const taskName = t.name || t.task_name || '';
                  const taskTarget = t.targetPerHour || t.task_target || '';
                  const taskDescription = t.description || t.task_description || '-';
                  const taskId = t.id || t.task_id;
                  const isActive = Number(t.is_active ?? 1) === 1;
                  const cellPad = compact ? 'py-2 px-3' : 'py-4 px-4';
                  return (
                    <tr key={key} className={`hover:bg-blue-50 transition-colors duration-150 ${!isActive ? 'opacity-75' : ''}`}>
                      <td className={`${cellPad} align-middle`}>
                        <div className="flex items-center gap-2">
                          {!compact && (
                          <div className="bg-blue-100 p-1.5 rounded-lg flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4 text-blue-700">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          )}
                          <span className="text-slate-800 font-medium truncate">{taskName}</span>
                        </div>
                      </td>
                      <td className={`${cellPad} align-middle`}>
                        <span className={`inline-flex items-center rounded-full font-semibold ${
                          compact
                            ? 'px-2 py-0.5 text-xs bg-green-100 text-green-700'
                            : 'px-3 py-1 text-sm font-bold bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200'
                        }`}>
                          {taskTarget}
                        </span>
                      </td>
                      <td className={`${cellPad} text-slate-600 align-middle`}>
                        <span className="line-clamp-2">{taskDescription}</span>
                      </td>
                      <td className={`${cellPad} text-center align-middle`}>
                        {!readOnly ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(t)}
                              disabled={togglingId === taskId}
                              className={`relative inline-flex items-center rounded-full transition-all focus:outline-none disabled:opacity-50 ${
                                compact ? 'h-5 w-9' : 'h-6 w-11 focus:ring-2 focus:ring-offset-2 shadow-sm'
                              } ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                              title={isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                            >
                              <span
                                className={`inline-block transform rounded-full bg-white shadow-sm ${
                                  compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
                                } ${isActive ? (compact ? 'translate-x-4' : 'translate-x-6') : 'translate-x-1'}`}
                              />
                            </button>
                            {!compact && (
                            <span className={`text-xs font-semibold ${isActive ? 'text-green-700' : 'text-slate-500'}`}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                            )}
                          </div>
                        ) : (
                          <span className={`text-xs font-semibold ${isActive ? 'text-green-700' : 'text-slate-500'}`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className={`${cellPad} text-center align-middle`}>
                        {!readOnly && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEditTask && onEditTask(project.id, taskId, t)}
                              className={`text-blue-600 hover:bg-blue-100 rounded-md transition-all ${compact ? 'p-1' : 'p-2 bg-blue-100 hover:bg-blue-600 hover:text-white'}`}
                              title="Edit Task"
                              aria-label="Edit Task"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ open: true, task: t })}
                              className={`text-red-600 hover:bg-red-100 rounded-md transition-all ${compact ? 'p-1' : 'p-2 bg-red-100 hover:bg-red-600 hover:text-white'}`}
                              title="Delete Task"
                              aria-label="Delete Task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TaskTable;
