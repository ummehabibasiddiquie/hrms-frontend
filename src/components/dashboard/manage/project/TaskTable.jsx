import React, { useEffect, useState, useRef } from 'react';
import { fetchProjectTasks } from '../../../../services/projectService';
import { Edit, Trash2 } from 'lucide-react';
import DeleteTaskModal from './DeleteTaskModal'; // Adjust the import path as necessary

const ROW_HEIGHT = 48; // px, adjust if your row height is different
const VISIBLE_ROWS = 5;

const TaskTable = ({ project, readOnly, onDeleteTask, onEditTask, onTaskUpdated, refresh }) => {
  const [tasks, setTasks] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, task: null });
  const tableBodyRef = useRef(null);

  useEffect(() => {
    if (!project?.id) {
      return;
    }
    fetchProjectTasks(project.id)
      .then(res => {
        const allTasks = Array.isArray(res.data) ? res.data : [];
        const filtered = allTasks.filter(task => String(task.project_id) === String(project.id));
        setTasks(filtered);
      })
      .catch(() => {
        setTasks([]);
      });
  }, [project?.id, typeof refresh === 'undefined' ? null : refresh]);

  return (
    <div>
      {/* Delete confirmation modal */}
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
      
      {/* Task Table with Modern Design */}
      <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <div
          className="overflow-x-auto"
          style={{
            maxHeight: `${ROW_HEIGHT * VISIBLE_ROWS}px`,
            overflowY: 'auto',
          }}
        >
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '40%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white">
                <th className="text-left py-4 px-4 text-sm font-bold uppercase tracking-wide">Task Name</th>
                <th className="text-left py-4 px-4 text-sm font-bold uppercase tracking-wide">Target / Hr</th>
                <th className="text-left py-4 px-4 text-sm font-bold uppercase tracking-wide">Description</th>
                <th className="text-center py-4 px-4 text-sm font-bold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody ref={tableBodyRef} className="bg-white divide-y divide-slate-200">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                        </svg>
                      </div>
                      <p className="text-slate-600 font-medium mb-1">No tasks found</p>
                      <p className="text-sm text-slate-400">Add a new task to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map((t, idx) => {
                  const key = t.id || t.task_id || idx;
                  const taskName = t.name || t.task_name || '';
                  const taskTarget = t.targetPerHour || t.task_target || '';
                  const taskDescription = t.description || t.task_description || '-';
                  const taskId = t.id || t.task_id;
                  return (
                    <tr key={key} className="hover:bg-blue-50 transition-colors duration-150">
                      <td className="py-4 px-4 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="bg-blue-100 p-1.5 rounded-lg flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4 text-blue-700">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <span className="text-slate-800 font-semibold truncate">{taskName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 align-middle">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200">
                          {taskTarget}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-600 align-middle">
                        <span className="line-clamp-2">{taskDescription}</span>
                      </td>
                      <td className="py-4 px-4 text-center align-middle">
                        {!readOnly && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onEditTask && onEditTask(project.id, taskId, t)}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-200"
                              title="Edit Task"
                              aria-label="Edit Task"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ open: true, task: t })}
                              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all duration-200"
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