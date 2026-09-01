import React, { useEffect, useMemo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { Lock, FolderKanban, Search, RotateCcw } from 'lucide-react';
import { useAuth } from "../../../../context/AuthContext";
import { useProjectManagement } from "../../../../hooks/useProjectManagement";


import AddProjectForm from './AddProjectForm';
import EditProjectModal from './EditProjectModal';
import ProjectManagementPanel from './ProjectManagementPanel';
import DeleteProjectModal from './DeleteProjectModal';
import { useUserDropdowns } from "../../../../hooks/useUserDropdowns";
import { fetchProjectsList } from '../../../../services/projectService';

// Utility to normalize dropdown data
const normalizeDropdown = (arr, type = 'user') => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (Array.isArray(item) && item.length > 0) item = item[0];
    return {
      id: item.project_category_id ?? item.afd_id ?? item.user_id ?? item.team_id ?? item.id,
      user_id: item.user_id ?? item.team_id ?? item.id,
      team_id: item.team_id,
      afd_id: item.afd_id,
      project_category_id: item.project_category_id,
      label: item.label || item.name || item.user_name || item.team_name || '',
      name: item.name || item.label || item.user_name || item.team_name || '',
    };
  });
};


const ProjectsManagement = ({
  projects = [],
  onUpdateProjects,
  loading = false,
  loadProjects,
  projectManagers = [],
  assistantManagers = [],
  qaManagers = [],
  // eslint-disable-next-line no-unused-vars
  teams = [],
  readOnly = false
}) => {
  const { canManageProjects, isSuperAdmin, user } = useAuth();
  const isAdmin = user?.role_name === 'admin';

  const {
    dropdowns,
    loading: dropdownLoading,
    loadDropdowns
  } = useUserDropdowns();

  // Wrapper to load dropdowns with user ID
  const loadDropdownsWithUser = useCallback(async () => {
    await loadDropdowns(user?.user_id);
  }, [loadDropdowns, user?.user_id]);

  // Load dropdowns on component mount
  useEffect(() => {
    if (user?.user_id) {
      loadDropdownsWithUser();
    }
  }, [user?.user_id, loadDropdownsWithUser]);

  const {
    newProject,
    projectFiles,
    formErrors,
    isSubmitting,
    isEditMode,
    showEditModal,
    editingProjectId,
    showDeleteModal,
    deletingProject,
    isDeleting,
    updateNewProjectField,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleUpdateProjectField,
    handleAddTask,
    handleUpdateTask,
    handleDeleteTask,
    clearFieldError,
    handleProjectFilesChange,
    handleRemoveProjectFile,
    handleModalClose,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
  } = useProjectManagement(projects, onUpdateProjects, loadProjects, user?.user_id);

  // Only show if user has permission to edit projects
  if (!canManageProjects && !isSuperAdmin && !isAdmin) {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border border-yellow-200 shadow-md text-yellow-800">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-200 p-3 rounded-lg">
            <Lock className="w-6 h-6 text-yellow-700" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Access Denied</h3>
            <p className="text-sm text-yellow-700">You don't have permission to manage projects.</p>
          </div>
        </div>
      </div>
    );
  }


  // Wrapper function to load dropdowns before opening edit modal
  const handleOpenEditModal = async (project) => {
    console.log('[ProjectsManagement] ========== OPENING EDIT MODAL ==========');
    console.log('[ProjectsManagement] Opening edit for project:', project);
    console.log('[ProjectsManagement] Current dropdowns before loading:', dropdowns);
    
    // Load dropdowns with user ID to ensure fresh data
    await loadDropdownsWithUser();
    
    console.log('[ProjectsManagement] Dropdowns after loading:', dropdowns);
    console.log('[ProjectsManagement] Dropdowns.projectManagers:', dropdowns.projectManagers);
    console.log('[ProjectsManagement] Dropdowns.assistantManagers:', dropdowns.assistantManagers);
    console.log('[ProjectsManagement] Dropdowns.qas:', dropdowns.qas);
    console.log('[ProjectsManagement] Dropdowns.agents:', dropdowns.agents);
    
    let fullProject = project;
    
    console.log('[ProjectsManagement] Opening edit for project:', project);
    
    try {
      const res = await fetchProjectsList(user?.user_id, { includeInactive: true });
      console.log('[ProjectsManagement] Fetched projects list:', res);
      
      if (res && Array.isArray(res.data)) {
        // Find the project by project_id (API uses project_id, not id)
        const found = res.data.find(p => String(p.project_id) === String(project.project_id || project.id));
        console.log('[ProjectsManagement] Found project from API:', found);
        if (found) fullProject = found;
      }
    } catch (e) {
      console.error('[ProjectsManagement] Failed to fetch project:', e);
      // fallback to passed project if fetch fails
    }
    
    console.log('[ProjectsManagement] Full project before mapping:', fullProject);
    
    // Map API response arrays to expected fields for EditProjectModal
    // API response structure: project_qa_id, asst_project_manager_id, project_team_id
    let qaManagerIds = [];
    if (Array.isArray(fullProject.project_qa_id) && fullProject.project_qa_id.length > 0) {
      qaManagerIds = fullProject.project_qa_id;
    }

    let assistantManagerIds = [];
    if (Array.isArray(fullProject.asst_project_manager_id) && fullProject.asst_project_manager_id.length > 0) {
      assistantManagerIds = fullProject.asst_project_manager_id;
    }

    let teamIds = [];
    if (Array.isArray(fullProject.project_team_id) && fullProject.project_team_id.length > 0) {
      teamIds = fullProject.project_team_id;
    }
    
    console.log('[ProjectsManagement] Extracted IDs:');
    console.log('  - assistantManagerIds:', assistantManagerIds);
    console.log('  - qaManagerIds:', qaManagerIds);
    console.log('  - teamIds:', teamIds);

    fullProject = {
      ...fullProject,
      // Map all possible selected fields for EditProjectModal
      assistantManagerIds: assistantManagerIds || fullProject.assistantManagerIds || fullProject.asst_project_managers || [],
      qaManagerIds: qaManagerIds || fullProject.qaManagerIds || fullProject.qa_users || [],
      teamIds: teamIds || fullProject.teamIds || fullProject.project_team || [],
      asst_project_managers: fullProject.asst_project_managers || [],
      qa_users: fullProject.qa_users || [],
      project_team: fullProject.project_team || [],
      assistantManagers: normalizeDropdown(dropdowns.assistantManagers),
      qaManagers: normalizeDropdown(dropdowns.qas),
      teams: normalizeDropdown(dropdowns.agents, 'team'),
      projectManagers: normalizeDropdown(dropdowns.projectManagers),
      requires_ai_evaluation: fullProject.requires_ai_evaluation ?? false,
      requires_duplicate_check: fullProject.requires_duplicate_check ?? false,
    };
    
    console.log('[ProjectsManagement] Final project with mapped arrays:', fullProject);
    console.log('[ProjectsManagement] requires_ai_evaluation:', fullProject.requires_ai_evaluation);
    console.log('[ProjectsManagement] requires_duplicate_check:', fullProject.requires_duplicate_check);
    openEditModal(fullProject);
  };

  // Normalize dropdowns for AddProjectForm and EditProjectModal (memoized to update when dropdowns change)
  const normalizedProjectManagers = useMemo(() => normalizeDropdown(dropdowns.projectManagers), [dropdowns.projectManagers]);
  const normalizedAssistantManagers = useMemo(() => normalizeDropdown(dropdowns.assistantManagers), [dropdowns.assistantManagers]);
  const normalizedQaManagers = useMemo(() => normalizeDropdown(dropdowns.qas), [dropdowns.qas]);
  const normalizedTeams = useMemo(() => normalizeDropdown(dropdowns.agents, 'team'), [dropdowns.agents]);
  const normalizedProjectCategories = useMemo(() => normalizeDropdown(dropdowns.projectCategories), [dropdowns.projectCategories]);
  
  console.log('[ProjectsManagement] ===== NORMALIZED DROPDOWNS =====');
  console.log('[ProjectsManagement] Raw dropdowns.projectManagers:', dropdowns.projectManagers);
  console.log('[ProjectsManagement] Raw dropdowns.assistantManagers:', dropdowns.assistantManagers);
  console.log('[ProjectsManagement] Raw dropdowns.qas:', dropdowns.qas);
  console.log('[ProjectsManagement] Raw dropdowns.agents:', dropdowns.agents);
  console.log('[ProjectsManagement] Raw dropdowns.projectCategories:', dropdowns.projectCategories);
  console.log('[ProjectsManagement] Normalized:');
  console.log('  - projectManagers:', normalizedProjectManagers);
  console.log('  - assistantManagers:', normalizedAssistantManagers);
  console.log('  - qaManagers:', normalizedQaManagers);
  console.log('  - teams:', normalizedTeams);
  console.log('  - projectCategories:', normalizedProjectCategories);

  const [projectNameSearch, setProjectNameSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredProjects = useMemo(() => {
    let list = [...projects];

    if (projectNameSearch.trim()) {
      const q = projectNameSearch.trim().toLowerCase();
      list = list.filter((p) =>
        (p.name || p.project_name || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter === "active") {
      list = list.filter((p) => Number(p.is_active ?? 1) === 1);
    } else if (statusFilter === "inactive") {
      list = list.filter((p) => Number(p.is_active ?? 1) !== 1);
    }

    return list.sort((a, b) =>
      (a.name || a.project_name || "").localeCompare(b.name || b.project_name || "", undefined, { sensitivity: "base" })
    );
  }, [projects, projectNameSearch, statusFilter]);

  const activeCount = useMemo(
    () => projects.filter((p) => Number(p.is_active ?? 1) === 1).length,
    [projects]
  );

  const handleResetFilters = () => {
    setProjectNameSearch("");
    setStatusFilter("all");
  };

  const shellRef = useRef(null);

  // Fill remaining viewport height — same approach as Billable Report (~10–15 visible rows)
  useLayoutEffect(() => {
    const applyHeight = () => {
      const el = shellRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const height = Math.max(680, window.innerHeight - top - 8);
      el.style.setProperty("height", `${height}px`, "important");
      el.style.setProperty("min-height", `${height}px`, "important");
      el.style.setProperty("max-height", `${height}px`, "important");
    };

    applyHeight();
    const rafId = requestAnimationFrame(applyHeight);
    const timeoutId = window.setTimeout(applyHeight, 150);
    window.addEventListener("resize", applyHeight);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", applyHeight);
      const el = shellRef.current;
      if (el) {
        el.style.removeProperty("height");
        el.style.removeProperty("min-height");
        el.style.removeProperty("max-height");
      }
    };
  }, [loading, filteredProjects.length]);

  const filterCardClass =
    "bg-gradient-to-r from-blue-50 via-white to-indigo-50 rounded-xl shadow-md border border-blue-200 p-6";

  const resetFiltersButtonClass =
    "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
      <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-white text-2xl flex items-center gap-3">
                <FolderKanban className="w-7 h-7" />
                Project Management
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Manage projects and tasks — {activeCount} active of {projects.length} total
              </p>
            </div>
            {!readOnly && !isEditMode && (
              <AddProjectForm
                newProject={newProject}
                onFieldChange={updateNewProjectField}
                onSubmit={handleAddProject}
                projectManagers={normalizedProjectManagers}
                assistantManagers={normalizedAssistantManagers}
                qaManagers={normalizedQaManagers}
                teams={normalizedTeams}
                projectCategories={normalizedProjectCategories}
                loadDropdowns={loadDropdownsWithUser}
                dropdownLoading={dropdownLoading}
                isSubmitting={isSubmitting}
                formErrors={formErrors}
                clearFieldError={clearFieldError}
                projectFiles={projectFiles}
                handleProjectFilesChange={handleProjectFilesChange}
                handleRemoveProjectFile={handleRemoveProjectFile}
                handleModalClose={handleModalClose}
                projectNameSearch={projectNameSearch}
                setProjectNameSearch={setProjectNameSearch}
              />
            )}
          </div>
        </div>

        <div className={filterCardClass}>
          <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-end gap-4">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Search Project
              </label>
              <input
                type="text"
                placeholder="Search by project name..."
                value={projectNameSearch}
                onChange={(e) => setProjectNameSearch(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all hover:border-blue-400"
              />
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status
              </label>
              <div className="flex items-center gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      statusFilter === value
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-white border border-slate-300 text-slate-600 hover:border-blue-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={handleResetFilters} className={resetFiltersButtonClass}>
              <RotateCcw className="w-4 h-4" />
              Reset Filters
            </button>
          </div>
        </div>

        {showEditModal && isEditMode && newProject && (
          <EditProjectModal
            key={`edit-${editingProjectId}-${Date.now()}`}
            project={newProject}
            onClose={closeEditModal}
            onUpdate={handleUpdateProject}
            projectManagers={normalizedProjectManagers}
            assistantManagers={normalizedAssistantManagers}
            qaManagers={normalizedQaManagers}
            teams={normalizedTeams}
            projectCategories={normalizedProjectCategories}
            formErrors={formErrors}
            isSubmitting={isSubmitting}
            handleProjectFilesChange={handleProjectFilesChange}
            handleRemoveProjectFile={handleRemoveProjectFile}
            projectFiles={projectFiles}
            onFieldChange={updateNewProjectField}
            clearFieldError={clearFieldError}
          />
        )}

        <div ref={shellRef} className="flex flex-col min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-full min-h-[480px] flex flex-col items-center justify-center bg-white rounded-xl shadow-md border border-blue-100">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3" />
              <p className="text-slate-600 text-sm font-medium">Loading projects...</p>
            </div>
          ) : (
            <ProjectManagementPanel
              projects={filteredProjects}
              readOnly={readOnly || !canManageProjects}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              openEditModal={handleOpenEditModal}
              openDeleteModal={openDeleteModal}
              onStatusChanged={() => loadProjects && loadProjects()}
            />
          )}
        </div>
      </div>

      {showDeleteModal && (
        <DeleteProjectModal
          project={deletingProject}
          onClose={closeDeleteModal}
          onConfirm={handleDeleteProject}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
export default ProjectsManagement;