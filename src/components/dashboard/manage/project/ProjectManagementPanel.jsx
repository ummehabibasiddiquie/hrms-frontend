import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FolderKanban } from "lucide-react";
import ProjectDetailPanel from "./ProjectDetailPanel";
import { useAuth } from "../../../../context/AuthContext";
import { fetchProjectTasks } from "../../../../services/projectService";

export default function ProjectManagementPanel({
  projects = [],
  readOnly = false,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  openEditModal,
  openDeleteModal,
  onStatusChanged,
}) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [taskCounts, setTaskCounts] = useState({});

  const loadTaskCounts = useCallback(async () => {
    const userId = user?.user_id || user?.id;
    if (!userId) return;
    try {
      const res = await fetchProjectTasks(null, userId, undefined, undefined, true);
      const allTasks = Array.isArray(res.data) ? res.data : [];
      const counts = {};
      allTasks.forEach((t) => {
        const pid = String(t.project_id);
        counts[pid] = (counts[pid] || 0) + 1;
      });
      setTaskCounts(counts);
    } catch {
      setTaskCounts({});
    }
  }, [user?.user_id, user?.id]);

  useEffect(() => {
    loadTaskCounts();
  }, [loadTaskCounts, projects.length]);

  const handleTaskCountChange = useCallback((projectId, count) => {
    setTaskCounts((prev) => ({ ...prev, [String(projectId)]: count }));
  }, []);

  const prepared = useMemo(
    () =>
      projects.map((p) => {
        const id = String(p.id || p.project_id);
        return {
          id,
          project: p,
          name: p.name || p.project_name || "Untitled",
          code: p.code || p.project_code || "—",
          isActive: Number(p.is_active ?? 1) === 1,
          taskCount: taskCounts[id] ?? 0,
        };
      }),
    [projects, taskCounts]
  );
  useEffect(() => {
    if (!prepared.length) {
      setSelectedProjectId(null);
      return;
    }
    const stillVisible = prepared.some((p) => p.id === String(selectedProjectId));
    if (!stillVisible) {
      setSelectedProjectId(prepared[0].id);
    }
  }, [prepared, selectedProjectId]);

  const selected = prepared.find((p) => p.id === String(selectedProjectId)) || prepared[0];

  if (!prepared.length) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-xl shadow-md border border-blue-100 text-slate-500">
        No projects match your filters
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-l-4 border-blue-500 rounded-xl shadow-lg overflow-hidden flex flex-col">
      {/* Unified header — same pattern as DailyReportAgentPanel */}
      <div className="shrink-0 flex items-stretch border-b border-blue-100 bg-white/90 backdrop-blur rounded-t-xl">
        <div className="w-[260px] xl:w-[280px] shrink-0 flex items-center gap-3 px-6 py-4 border-r border-blue-100">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-sm shrink-0">
            <FolderKanban className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-blue-900 leading-tight">Projects</p>
          </div>
          <span className="ml-auto shrink-0 text-xs font-bold text-white bg-blue-600 rounded-full min-w-[1.75rem] h-7 px-2 flex items-center justify-center">
            {prepared.length}
          </span>
        </div>

        {selected && (
          <div className="flex-1 flex items-center gap-4 px-6 py-4 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900 truncate leading-tight">
                {selected.name}
              </h3>
              <p className="text-sm text-slate-500 font-medium truncate mt-0.5">
                {selected.code}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  selected.isActive
                    ? "bg-green-50 text-green-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {selected.isActive ? "Active" : "Inactive"}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                {selected.taskCount} tasks
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 h-full flex-col lg:flex-row">
        <aside className="lg:w-[260px] xl:w-[280px] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-blue-100 bg-gradient-to-b from-white/80 to-blue-50/40 h-full min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto panel-scroll px-3 py-3 space-y-2">
            {prepared.map((item) => {
              const active = item.id === selected?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedProjectId(item.id)}
                  className={`relative w-full text-left rounded-xl px-3 py-2.5 transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 shadow-md ring-1 ring-blue-200/60"
                      : "bg-white border border-slate-200/80 hover:border-blue-200 hover:shadow-sm hover:bg-blue-50/30"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600" />
                  )}

                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${
                        active
                          ? "bg-gradient-to-br from-blue-600 to-indigo-600"
                          : "bg-gradient-to-br from-slate-50 to-blue-50 ring-1 ring-blue-100"
                      }`}
                    >
                      <FolderKanban
                        className={`w-4 h-4 ${active ? "text-white" : "text-blue-600"}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-sm truncate leading-tight ${
                          active ? "text-blue-900" : "text-slate-800"
                        }`}
                      >
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {item.code}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold tabular-nums">
                          {item.taskCount} {item.taskCount === 1 ? "task" : "tasks"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            item.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              item.isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden bg-white">
          {selected && (
            <ProjectDetailPanel
              key={selected.id}
              project={selected.project}
              readOnly={readOnly}
              onAddTask={async (...args) => {
                const result = await onAddTask?.(...args);
                await loadTaskCounts();
                return result;
              }}
              onUpdateTask={onUpdateTask}
              onDeleteTask={async (...args) => {
                const result = await onDeleteTask?.(...args);
                await loadTaskCounts();
                return result;
              }}
              onTaskCountChange={handleTaskCountChange}
              openEditModal={openEditModal}
              openDeleteModal={openDeleteModal}
              onStatusChanged={onStatusChanged}
            />          )}
        </div>
      </div>
    </div>
  );
}
