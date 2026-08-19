import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Lock, FolderKanban, Plus, Search, Filter, Briefcase } from 'lucide-react';
import { useAuth } from "../../../../context/AuthContext";
import { useProjectManagement } from "../../../../hooks/useProjectManagement";


import AddProjectForm from './AddProjectForm';
import EditProjectModal from './EditProjectModal';
import ProjectCard from './ProjectCard';
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

  // Map the data for the old form compatibility
  const potentialOwners = projectManagers.map(pm => ({
    id: pm.id,
    name: pm.name
  }));

  const potentialAPMs = assistantManagers.map(am => ({
    id: am.id,
    name: am.name
  }));

  const potentialQAs = qaManagers.map(qa => ({
    id: qa.id,
    name: qa.name
  }));

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

  // Expanded state for each project card
  const [expandedCards, setExpandedCards] = useState({});

  const handleExpandCard = (projectId, value) => {
    setExpandedCards(prev => ({ ...prev, [projectId]: value }));
  };

  // Project Name filter state
  const [projectNameSearch, setProjectNameSearch] = useState("");

  // Filtered projects by project name
  const filteredProjects = useMemo(() => {
    if (!projectNameSearch.trim()) return projects;
    return projects.filter(p => (p.name || p.project_name || "").toLowerCase().includes(projectNameSearch.trim().toLowerCase()));
  }, [projects, projectNameSearch]);

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0 w-full overflow-x-hidden">
      {/* Modern Header with Gradient */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Project Management</h2>
              <p className="text-blue-100 text-sm">Manage projects, tasks, and teams</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
            <Briefcase className="w-5 h-5" />
            <span className="font-semibold">{filteredProjects.length} Projects</span>
          </div>
        </div>
      </div>

      {/* Modern Filter Bar with Add Project */}
      {!readOnly && !isEditMode && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-lg">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Search & Add Projects</h3>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Project Name
              </label>
              <input
                type="text"
                placeholder="Search by project name"
                value={projectNameSearch || ""}
                onChange={e => setProjectNameSearch(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
            <div className="flex items-end">
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
            </div>
          </div>
        </div>
      )}

      {showEditModal && isEditMode && newProject && (
        <>
          {console.log('[ProjectsManagement] Rendering EditProjectModal with newProject:', newProject)}
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
        </>
      )}

      {/* Projects Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-slate-600 font-medium">Loading projects...</p>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12">
          <div className="text-center">
            <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">No projects found</h3>
            <p className="text-slate-500">Create your first project using the form above</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map(proj => (
            <ProjectCard
              key={proj.id}
              project={proj}
              readOnly={readOnly || !canManageProjects}
              potentialOwners={potentialOwners}
              potentialAPMs={potentialAPMs}
              potentialQAs={potentialQAs}
              onDeleteProject={handleDeleteProject}
              onUpdateTarget={(id, v) => handleUpdateProjectField(id, 'monthlyHoursTarget', v)}
              onUpdateOwner={(id, v) => handleUpdateProjectField(id, 'teamOwner', v)}
              onUpdateAPM={(id, v) => handleUpdateProjectField(id, 'apmOwner', v)}
              onUpdateQA={(id, v) => handleUpdateProjectField(id, 'qaOwner', v)}
              onUpdateName={(id, v) => handleUpdateProjectField(id, 'name', v)}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              openEditModal={handleOpenEditModal}
              openDeleteModal={openDeleteModal}
              expanded={!!expandedCards[proj.id]}
              setExpanded={value => handleExpandCard(proj.id, value)}
              onStatusChanged={() => loadProjects && loadProjects()}
            />
          ))}
        </div>
      )}

      {/* Delete Project Modal */}
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