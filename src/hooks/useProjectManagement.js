// import { useState } from 'react';

// export const useProjectManagement = (initialProjects, onUpdateProjects) => {
//      const [newProject, setNewProject] = useState({
//           name: '',
//           description: '',
//           projectManagerId: '',
//           assistantManagerIds: [],
//           qaManagerIds: [],
//           teamIds: [],
//           files: [],
//      });

//      const [projectFiles, setProjectFiles] = useState([]);
//      const [formErrors, setFormErrors] = useState({});

//      const handleAddProject = () => {
//           // Validation
//           const errors = {};
//           if (!newProject.name.trim()) errors.name = 'Project name is required';
//           if (!newProject.projectManagerId) errors.projectManagerId = 'Project manager is required';


//           if (Object.keys(errors).length > 0) {
//                setFormErrors(errors);
//                return false;
//           }

//           const project = {
//                project_name: newProject.name.trim(),
//                project_description: newProject.description?.trim() || null,

//                // single select → STRING
//                project_manager_id: String(newProject.projectManagerId),

//                // multi select → ARRAY OF STRINGS
//                asst_project_manager_id: (newProject.assistantManagerIds || []).map(String),

//                qa_id: (newProject.qaManagerIds || []).map(String),

//                project_team_id: (newProject.teamIds || []).map(String),

//                // optional
//                files: projectFiles,
//           };

//           onUpdateProjects([...initialProjects, project]);
//           resetNewProjectForm();
//           setProjectFiles([]);
//           setFormErrors({});
//           return true;
//      };

//      const getManagerName = (id) => {
//           // This would come from your API data
//           return '';
//      };

//      const handleDeleteProject = (id) => {
//           if (window.confirm('Delete project?')) {
//                onUpdateProjects(initialProjects.filter(p => p.id !== id));
//           }
//      };

//      const handleUpdateProjectField = (id, field, value) => {
//           const updated = initialProjects.map(p =>
//                p.id === id ? { ...p, [field]: value } : p
//           );
//           onUpdateProjects(updated);
//      };

//      const handleAddTask = (projectId, taskName, target) => {
//           if (!taskName.trim() || !target) {
//                alert('Task name and target are required');
//                return;
//           }

//           const updatedProjects = initialProjects.map(p => {
//                if (p.id === projectId) {
//                     return {
//                          ...p,
//                          tasks: [
//                               ...p.tasks,
//                               {
//                                    id: crypto.randomUUID(),
//                                    name: taskName.trim(),
//                                    targetPerHour: parseInt(target)
//                               }
//                          ]
//                     };
//                }
//                return p;
//           });

//           onUpdateProjects(updatedProjects);
//      };

//      const handleDeleteTask = (projectId, taskId) => {
//           const updatedProjects = initialProjects.map(p => {
//                if (p.id === projectId) {
//                     return {
//                          ...p,
//                          tasks: p.tasks.filter(t => t.id !== taskId)
//                     };
//                }
//                return p;
//           });

//           onUpdateProjects(updatedProjects);
//      };

//      const resetNewProjectForm = () => {
//           setNewProject({
//                name: '',
//                description: '',
//                projectManagerId: '',
//                assistantManagerIds: [],
//                qaManagerIds: [],
//                teamIds: [],
//                files: []
//           });
//      };

//      const updateNewProjectField = (field, value) => {
//           setNewProject(prev => ({ ...prev, [field]: value }));
//           // Clear error for this field if it exists
//           if (formErrors[field]) {
//                setFormErrors(prev => ({ ...prev, [field]: '' }));
//           }
//      };

//      const clearFieldError = (field) => {
//           setFormErrors(prev => ({ ...prev, [field]: '' }));
//      };

//      const handleProjectFilesChange = (files) => {
//           setProjectFiles(prev => {
//                const existingNames = prev.map(f => f.name);
//                const uniqueFiles = files.filter(f => !existingNames.includes(f.name));
//                return [...prev, ...uniqueFiles];
//           });
//      };


//      const handleRemoveProjectFile = (index) => {
//           setProjectFiles(prev => prev.filter((_, i) => i !== index));
//      };

//      return {
//           newProject,
//           projectFiles,
//           formErrors,
//           updateNewProjectField,
//           handleAddProject,
//           handleDeleteProject,
//           handleUpdateProjectField,
//           handleAddTask,
//           handleDeleteTask,
//           resetNewProjectForm,
//           clearFieldError,
//           handleProjectFilesChange,
//           handleRemoveProjectFile
//      };
// };












// useProjectManagement.js
import { useState } from 'react';
import { addTask, createProject, updateProject, deleteProject, updateTask, deleteTask as deleteTaskApi, fetchProjectsList } from '../services/projectService';
import { toast } from "react-hot-toast";
import { useDeviceInfo } from "./useDeviceInfo";

export const useProjectManagement = (initialProjects, onUpdateProjects, loadProjects, userId) => {
     const deviceInfo = useDeviceInfo();
     const [newProject, setNewProject] = useState({
          name: '',
          code: '',
          description: '',
          projectManagerId: '',
          assistantManagerIds: [],
          qaManagerIds: [],
          teamIds: [],
          projectCategoryId: '',
          requires_ai_evaluation: false,
          requires_duplicate_check: false,
     });

     const [projectFiles, setProjectFiles] = useState([]);
     const [formErrors, setFormErrors] = useState({});
     const [isSubmitting, setIsSubmitting] = useState(false);
     const [submitSuccess, setSubmitSuccess] = useState(false);
     const [isEditMode, setIsEditMode] = useState(false);
     const [editingProjectId, setEditingProjectId] = useState(null);
     const [showEditModal, setShowEditModal] = useState(false);
     const [showDeleteModal, setShowDeleteModal] = useState(false);
     const [deletingProject, setDeletingProject] = useState(null);
     const [isDeleting, setIsDeleting] = useState(false);

     const handleAddProject = async () => {
          const errors = {};

          if (!newProject.name?.trim()) {
               errors.name = "This field is required";
          }

          if (!newProject.assistantManagerIds?.length) {
               errors.assistantManagerIds = "This field is required";
          }

          if (!newProject.qaManagerIds?.length) {
               errors.qaManagerIds = "This field is required";
          }

          if (!newProject.teamIds?.length) {
               errors.teamIds = "This field is required";
          }

          if (Object.keys(errors).length > 0) {
               setFormErrors(errors);
               return false; // ⛔ STOP HERE
          }

          setIsSubmitting(true);

          try {
               // Create FormData instead of JSON payload
               const formData = new FormData();
               
               // Append basic fields
               formData.append('project_name', newProject.name.trim());
               formData.append('project_code', newProject.code.trim());
               formData.append('project_description', newProject.description?.trim() || '');
               if (newProject.projectManagerId) {
                    formData.append('project_manager_id', Number(newProject.projectManagerId));
               }
               
               // Append project category if selected
               if (newProject.projectCategoryId) {
                    formData.append('project_category_id', Number(newProject.projectCategoryId));
               }
               
               // Append array fields as JSON strings (backend expects this format)
               formData.append('asst_project_manager_id', JSON.stringify(newProject.assistantManagerIds.map(id => Number(id))));
               formData.append('project_qa_id', JSON.stringify(newProject.qaManagerIds.map(id => Number(id))));
               formData.append('project_team_id', JSON.stringify(newProject.teamIds.map(id => Number(id))));
               
               // Append validation requirement fields
               formData.append('requires_ai_evaluation', newProject.requires_ai_evaluation ? 'true' : 'false');
               formData.append('requires_duplicate_check', newProject.requires_duplicate_check ? 'true' : 'false');
               
               // Append all files
               if (projectFiles && projectFiles.length > 0) {
                    console.log('[AddProject] Appending files:', projectFiles.length, projectFiles);
                    projectFiles.forEach((file) => {
                         formData.append('file', file);
                    });
               }
               
               // Append device info
               formData.append('device_id', deviceInfo.device_id);
               formData.append('device_type', deviceInfo.device_type);
               
               // Debug log
               console.log('[AddProject] FormData entries:');
               for (let pair of formData.entries()) {
                    console.log(pair[0], pair[1]);
               }

               const response = await createProject(formData);

               if (response?.status === 200 || response?.status === 201) {
                    resetNewProjectForm();
                    setProjectFiles([]);
                    setFormErrors({});
                    // Show success message
                    toast.success("Project created successfully!", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });
                    
                    // Refresh the project list
                    if (loadProjects) {
                         await loadProjects();
                    }
                    
                    return true; // ✅ SUCCESS
               } else {
                    throw new Error(response.message || "Failed to create project");
               }

          } catch (err) {
               console.error("Error adding project:", err);
               toast.error(`Error creating project: ${err.message}`, {
                    className: "toast-error toast-animate",
                    duration: 4000,
               });
               return false;
          } finally {
               setIsSubmitting(false);
          }
     };

     // Add function to open edit modal with project data
     const openEditModal = async (project) => {
          if (!project) return;
          
          try {
               // Fetch the full project details including project_category_name and project_files
               if (userId && project.project_id) {
                    const response = await fetchProjectsList(userId, { includeInactive: true });
                    const fullProject = response.data?.find(p => p.project_id === project.project_id);
                    
                    if (fullProject) {
                         console.log('[openEditModal] Full project from API:', fullProject);
                         console.log('[openEditModal] project_files:', fullProject.project_files);
                         // Use the full project data from API
                         project = {
                              ...project,
                              project_category_name: fullProject.project_category_name,
                              project_category_id: fullProject.project_category_id,
                              project_files: fullProject.project_files,
                              requires_ai_evaluation: fullProject.requires_ai_evaluation,
                              requires_duplicate_check: fullProject.requires_duplicate_check
                         };
                    }
               }
          } catch (error) {
               console.error('[openEditModal] Error fetching project details:', error);
               toast.error('Failed to load project details');
          }
          
          // Map API project fields to newProject state for editing
          setNewProject({
               name: project.name || project.project_name || '',
               code: project.code || project.project_code || '',
               description: project.description || project.project_description || '',
               projectManagerId: String(project.projectManagerId || project.project_manager_id || ''),
               assistantManagerIds: (project.assistantManagerIds
                    ? project.assistantManagerIds.map(String)
                    : project.asst_project_managers?.map(u => String(u.user_id)) || project.asst_project_manager_id?.map(String) || []),
               qaManagerIds: (project.qaManagerIds
                    ? project.qaManagerIds.map(String)
                    : project.qa_users?.map(u => String(u.user_id)) || project.project_qa_id?.map(String) || []),
               teamIds: (project.teamIds
                    ? project.teamIds.map(String)
                    : project.project_team?.map(u => String(u.user_id)) || project.project_team_id?.map(String) || []),
               projectCategoryId: String(project.projectCategoryId || project.project_category_id || ''),
               requires_ai_evaluation: project.requires_ai_evaluation ?? false,
               requires_duplicate_check: project.requires_duplicate_check ?? false,
          });
          
          // Set projectFiles from project.project_files array (URLs)
          console.log('[openEditModal] Setting project files from:', project.project_files);
          if (project.project_files && Array.isArray(project.project_files) && project.project_files.length > 0) {
               const existingFiles = project.project_files.map((fileUrl, index) => {
                    const fileName = fileUrl.split('/').pop() || `File ${index + 1}`;
                    return {
                         name: fileName,
                         url: fileUrl,
                         isExisting: true,
                         type: '',
                         size: 0,
                    };
               });
               console.log('[openEditModal] Setting existingFiles:', existingFiles);
               setProjectFiles(existingFiles);
          } else if (project.project_file) {
               // Fallback for singular project_file field
               const fileName = project.project_file.split('/').pop() || 'project-file';
               setProjectFiles([
                    {
                         name: fileName,
                         url: project.project_file,
                         isExisting: true,
                         type: '',
                         size: 0,
                    }
               ]);
          } else {
               setProjectFiles([]);
          }
          setEditingProjectId(project.project_id || project.id);
          setIsEditMode(true);
          setShowEditModal(true);
          // Clear any existing errors
          setFormErrors({});
     };

     // Add function to handle project update
     const handleUpdateProject = async (editedProject) => {
          // Similar validation as handleAddProject
          const errors = {};

          const projectData = editedProject || newProject;
          if (!projectData.name?.trim()) {
               errors.name = "This field is required";
          }

          if (!projectData.code?.trim()) {
               errors.code = "This field is required";
          }

          if (!projectData.assistantManagerIds?.length) {
               errors.assistantManagerIds = "This field is required";
          }

          if (!projectData.qaManagerIds?.length) {
               errors.qaManagerIds = "This field is required";
          }

          if (!projectData.teamIds?.length) {
               errors.teamIds = "This field is required";
          }

          if (Object.keys(errors).length > 0) {
               setFormErrors(errors);
               return false;
          }

          setIsSubmitting(true);

          try {
               // Create FormData instead of JSON payload
               const formData = new FormData();
               
               // Append basic fields
               formData.append('project_name', projectData.name.trim());
               formData.append('project_code', projectData.code.trim());
               formData.append('project_description', projectData.description?.trim() || '');
               if (projectData.projectManagerId) {
                    formData.append('project_manager_id', Number(projectData.projectManagerId));
               }
               
               // Append project category if provided
               if (projectData.projectCategoryId) {
                    formData.append('project_category_id', Number(projectData.projectCategoryId));
               }
               
               // Append array fields as JSON strings (backend expects this format)
               formData.append('asst_project_manager_id', JSON.stringify(projectData.assistantManagerIds.map(id => Number(id))));
               formData.append('project_qa_id', JSON.stringify(projectData.qaManagerIds.map(id => Number(id))));
               formData.append('project_team_id', JSON.stringify(projectData.teamIds.map(id => Number(id))));
               
               // Append validation requirement fields
               formData.append('requires_ai_evaluation', projectData.requires_ai_evaluation ? 'true' : 'false');
               formData.append('requires_duplicate_check', projectData.requires_duplicate_check ? 'true' : 'false');
               
               // Process ALL files - both existing (to keep) and new (to upload)
               const existingFileUrls = [];
               const newFilesToUpload = [];
               
               console.log('[UpdateProject] ========== FILE PROCESSING START ==========');
               console.log('[UpdateProject] Total projectFiles:', projectFiles?.length || 0);
               
               if (projectFiles && projectFiles.length > 0) {
                    projectFiles.forEach((file, index) => {
                         console.log(`[UpdateProject] File ${index}:`, {
                              name: file.name,
                              isFile: file instanceof File,
                              isExisting: file.isExisting,
                              hasUrl: !!file.url,
                              url: file.url
                         });
                         
                         // Check if it's a real File object (new upload) vs existing file metadata
                         if (file instanceof File) {
                              console.log(`[UpdateProject] ✓ New file to upload: ${file.name}`);
                              newFilesToUpload.push(file);
                         } else if (file.isExisting && file.url) {
                              console.log(`[UpdateProject] ✓ Existing file to keep: ${file.url}`);
                              existingFileUrls.push(file.url);
                         } else {
                              console.warn(`[UpdateProject] ⚠️ File not categorized:`, file);
                         }
                    });
               }
               
               const totalFiles = existingFileUrls.length + newFilesToUpload.length;
               console.log('[UpdateProject] SUMMARY:');
               console.log('[UpdateProject] - Total files after update:', totalFiles);
               console.log('[UpdateProject] - Existing files to keep:', existingFileUrls.length, existingFileUrls);
               console.log('[UpdateProject] - New files to upload:', newFilesToUpload.length);
               console.log('[UpdateProject] ========== FILE PROCESSING END ==========');
               
               // Send existing file URLs (files to keep) as JSON array
               formData.append('existing_files', JSON.stringify(existingFileUrls));
               
               // Append all new files to upload
               if (newFilesToUpload.length > 0) {
                    console.log('[UpdateProject] Appending new files to FormData...');
                    newFilesToUpload.forEach((file, idx) => {
                         console.log(`[UpdateProject] Adding file[${idx}]:`, file.name);
                         formData.append('file', file);
                    });
               }
               
               // Log the complete file operation
               console.log('[UpdateProject] Final file configuration:');
               console.log(`[UpdateProject] - Will keep ${existingFileUrls.length} existing file(s)`);
               console.log(`[UpdateProject] - Will upload ${newFilesToUpload.length} new file(s)`);
               console.log(`[UpdateProject] - Final total: ${totalFiles} file(s)`);
               
               // Append device info
               formData.append('device_id', deviceInfo.device_id);
               formData.append('device_type', deviceInfo.device_type);
               
               // Debug log - Show ALL FormData entries
               console.log('[UpdateProject] ========== FORMDATA TO BE SENT ==========');
               console.log('[UpdateProject] Project ID:', editingProjectId);
               const formDataEntries = {};
               for (let pair of formData.entries()) {
                    if (pair[1] instanceof File) {
                         formDataEntries[pair[0]] = `[File: ${pair[1].name}]`;
                    } else {
                         formDataEntries[pair[0]] = pair[1];
                    }
               }
               console.log('[UpdateProject] FormData contents:', JSON.stringify(formDataEntries, null, 2));
               console.log('[UpdateProject] ========================================');

               const response = await updateProject(editingProjectId, formData);

               if (response?.status === 200 || response?.status === 201) {
                    toast.success("Project updated successfully!", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });

                    // Refresh the project list
                    if (loadProjects) {
                         await loadProjects();
                    }

                    closeEditModal();
                    return true;

               } else {
                    throw new Error(response.message || "Failed to update project");
               }

          } catch (err) {
               console.error("Error updating project:", err);
               toast.error(`Error updating project: ${err.message}`, {
                    className: "toast-error toast-animate",
                    duration: 4000,
               });
               return false;
          } finally {
               setIsSubmitting(false);
          }
     };

     // Add function to close edit modal
     const closeEditModal = () => {
          setShowEditModal(false);
          setIsEditMode(false);
          setEditingProjectId(null);
          resetNewProjectForm();
     };

     // Add function to open delete modal
     const openDeleteModal = (project) => {
          setDeletingProject(project);
          setShowDeleteModal(true);
     };

     // Add function to close delete modal
     const closeDeleteModal = () => {
          setShowDeleteModal(false);
          setDeletingProject(null);
     };

     // Add function to handle project deletion
     const handleDeleteProject = async () => {
          if (!deletingProject) return;

          setIsDeleting(true);

          try {
               const response = await deleteProject(deletingProject.id);

               if (response?.status === 200 || response?.status === 201) {
                    toast.success("Project deleted successfully!", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });

                    // Refresh the project list
                    if (loadProjects) {
                         await loadProjects();
                    }

                    closeDeleteModal();
                    return true;

               } else {
                    throw new Error(response.message || "Failed to delete project");
               }

          } catch (err) {
               console.error("Error deleting project:", err);
               console.error("Error response:", err.response);
               toast.error(`Error deleting project: ${err.response?.data?.message || err.message}`, {
                    className: "toast-error toast-animate",
                    duration: 4000,
               });
               return false;
          } finally {
               setIsDeleting(false);
          }
     };

     const handleUpdateProjectField = async (id, field, value) => {
          const projectToUpdate = initialProjects.find(p => p.id === id);
          if (!projectToUpdate) return;

          try {
               const updatePayload = {
                    [field]: value
               };

               await updateProject(id, updatePayload);

               // Update local state
               const updated = initialProjects.map(p =>
                    p.id === id ? { ...p, [field]: value } : p
               );
               onUpdateProjects(updated);
          } catch (error) {
               console.error('Failed to update project:', error);
               alert('Failed to update project. Please try again.');
          }
     };

     const handleAddTask = async (projectId, taskPayload) => {
          if (!projectId) {
               toast.error("Missing project id for task");
               return false;
          }

          const name = taskPayload?.name?.trim();
          const target = taskPayload?.target;
          const teamIds = taskPayload?.teamIds || [];

          if (!name || !target || teamIds.length === 0) {
               toast.error("Please fill task name, target, and select at least one agent");
               return false;
          }

          // Create FormData for file upload support
          const formData = new FormData();
          formData.append('project_id', Number(projectId));
          formData.append('task_name', name);
          formData.append('task_description', taskPayload?.description?.trim() || "");
          formData.append('task_target', String(target));
          formData.append('device_id', deviceInfo.device_id);
          formData.append('device_type', deviceInfo.device_type);
          
          // Append team IDs as JSON array
          formData.append('task_team_id', JSON.stringify(teamIds.map(id => Number(id))));
          
          // Append QC percentage
          const qcValue = taskPayload?.qcPercentage && taskPayload.qcPercentage !== '' ? taskPayload.qcPercentage : '0';
          formData.append('qc_percentage', qcValue);
          
          // Append important columns if provided
          if (taskPayload?.importantColumns && taskPayload.importantColumns.length > 0) {
               formData.append('important_columns', JSON.stringify(taskPayload.importantColumns));
          }
          
          // Append file if provided
          if (taskPayload?.file) {
               formData.append('task_file', taskPayload.file);
          }

          try {
               const response = await addTask(formData);

               if (response?.status === 200 || response?.status === 201) {
                    toast.success("Task added successfully", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });

                    if (loadProjects) {
                         await loadProjects();
                    }

                    return true;
               }

               throw new Error(response?.message || "Failed to add task");
          } catch (error) {
               console.error("Error adding task:", error);
               toast.error(error.response?.data?.message || error.message || "Failed to add task", {
                    className: "toast-error toast-animate",
                    duration: 4000,
               });
               return false;
          }
     };

     const handleUpdateTask = async (projectId, taskId, taskPayload) => {
          if (!projectId || !taskId) {
               toast.error("Missing project or task id");
               return false;
          }

          // Validate only if fields are present (since we're sending only changed fields)
          if (taskPayload?.name !== undefined && !taskPayload.name?.trim()) {
               toast.error("Task name cannot be empty");
               return false;
          }
          if (taskPayload?.target !== undefined && (!taskPayload.target || Number(taskPayload.target) <= 0)) {
               toast.error("Target must be greater than 0");
               return false;
          }
          if (taskPayload?.teamIds !== undefined && (!taskPayload.teamIds || taskPayload.teamIds.length === 0)) {
               toast.error("Select at least one agent");
               return false;
          }

          // Create FormData with only changed fields
          const formData = new FormData();
          formData.append('project_id', Number(projectId));
          formData.append('task_id', Number(taskId));
          formData.append('device_id', deviceInfo.device_id);
          formData.append('device_type', deviceInfo.device_type);
          
          // Append only fields that are present in taskPayload (changed fields)
          if (taskPayload?.name !== undefined) {
               formData.append('task_name', taskPayload.name.trim());
          }
          if (taskPayload?.description !== undefined) {
               formData.append('task_description', taskPayload.description?.trim() || "");
          }
          if (taskPayload?.target !== undefined) {
               formData.append('task_target', String(taskPayload.target));
          }
          if (taskPayload?.teamIds !== undefined) {
               formData.append('task_team_id', JSON.stringify(taskPayload.teamIds.map(id => Number(id))));
          }
          if (taskPayload?.qcPercentage !== undefined) {
               const qcValue = taskPayload.qcPercentage && taskPayload.qcPercentage !== '' ? taskPayload.qcPercentage : '0';
               formData.append('qc_percentage', qcValue);
          }
          if (taskPayload?.importantColumns !== undefined && taskPayload.importantColumns.length > 0) {
               formData.append('important_columns', JSON.stringify(taskPayload.importantColumns));
          }
          if (taskPayload?.file !== undefined) {
               formData.append('task_file', taskPayload.file);
          }

          try {
               const response = await updateTask(formData);

               if (response?.status === 200 || response?.status === 201) {
                    toast.success("Task updated successfully", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });

                    if (loadProjects) {
                         await loadProjects();
                    }

                    return true;
               }

               throw new Error(response?.message || "Failed to update task");
          } catch (error) {
               console.error("Error updating task:", error);
               toast.error(error.response?.data?.message || error.message || "Failed to update task", {
                    className: "toast-error toast-animate",
                    duration: 4000,
               });
               return false;
          }
     };

     const handleDeleteTask = async (projectId, taskId) => {
          if (!taskId) return false;

          try {
               const response = await deleteTaskApi(projectId, taskId);

               if (response?.status === 200 || response?.status === 201) {
                    toast.success("Task deleted successfully", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });

                    if (loadProjects) {
                         await loadProjects();
                    }

                    return true;
               }

               throw new Error(response?.message || "Failed to delete task");
          } catch (error) {
               console.error("Error deleting task:", error);
               toast.error(error.response?.data?.message || error.message || "Failed to delete task", {
                    className: "toast-error toast-animate",
                    duration: 4000,
               });
               return false;
          }
     };

     const resetNewProjectForm = () => {
          setNewProject({
               name: '',
               code: '',
               description: '',
               projectManagerId: '',
               assistantManagerIds: [],
               qaManagerIds: [],
               teamIds: [],
               projectCategoryId: '',
               requires_ai_evaluation: false,
               requires_duplicate_check: false,
          });
          setProjectFiles([]);
          setFormErrors({});
          setSubmitSuccess(false);
          setIsEditMode(false);
          setEditingProjectId(null);
     };

     const updateNewProjectField = (field, value) => {
          setNewProject(prev => ({ ...prev, [field]: value }));
          // Clear error for this field if it exists
          if (formErrors[field]) {
               setFormErrors(prev => ({ ...prev, [field]: '' }));
          }
     };

     const clearFieldError = (field) => {
          setFormErrors(prev => ({ ...prev, [field]: '' }));
     };

     // const handleProjectFilesChange = (files) => {
     //      setProjectFiles(prev => {
     //           const existingNames = prev.map(f => f.name);
     //           const uniqueFiles = files.filter(f => !existingNames.includes(f.name));
     //           return [...prev, ...uniqueFiles];
     //      });
     // };

     const handleProjectFilesChange = (files) => {
          // files can be a FileList, array, or single File
          let newFiles = [];
          if (Array.isArray(files)) {
               newFiles = files;
          } else if (files instanceof FileList) {
               newFiles = Array.from(files);
          } else if (files instanceof File) {
               newFiles = [files];
          }
          setProjectFiles(prev => {
               // Prevent duplicates by name
               const existingNames = prev.map(f => f.name);
               const uniqueFiles = newFiles.filter(f => !existingNames.includes(f.name));
               return [...prev, ...uniqueFiles];
          });
     };

     const handleRemoveProjectFile = (index) => {
          console.log('[handleRemoveProjectFile] Removing file at index:', index);
          setProjectFiles(prev => {
               console.log('[handleRemoveProjectFile] Current files before removal:', prev);
               const updated = prev.filter((_, i) => i !== index);
               console.log('[handleRemoveProjectFile] Files after removal:', updated);
               return updated;
          });
     };

     // Add modal close handler
     const handleModalClose = () => {
          resetNewProjectForm();
          setProjectFiles([]);
          setFormErrors({});
     };

     return {
          newProject,
          projectFiles,
          formErrors,
          isSubmitting,
          submitSuccess,
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
          resetNewProjectForm,
          clearFieldError,
          handleProjectFilesChange,
          handleRemoveProjectFile,
          handleModalClose,
          openEditModal, 
          closeEditModal,
          openDeleteModal,
          closeDeleteModal,
     };
};