import React, { useRef, useState, useEffect } from "react";
import { Briefcase, X, Upload, XCircle, User, Users } from "lucide-react";
import SearchableSelect from "../../../common/SearchableSelect";
import MultiSelectWithCheckbox from "../../../common/MultiSelectWithCheckbox";

const AddProjectFormModal = ({
     newProject,
     onFieldChange,
     onSubmit,
     onClose,
     projectManagers = [],
     assistantManagers = [],
     qaManagers = [],
     teams = [],
     projectCategories = [],
     formErrors = {},
     clearFieldError,
     isSubmitting = false,
     handleProjectFilesChange,
     handleRemoveProjectFile,
     projectFiles,
     isEditMode = false,
}) => {
     console.log('[AddProjectFormModal] ========== COMPONENT RENDER ==========');
     console.log('[AddProjectFormModal] Props received:');
     console.log('  - projectManagers:', projectManagers, 'length:', projectManagers?.length);
     console.log('  - assistantManagers:', assistantManagers, 'length:', assistantManagers?.length);
     console.log('  - qaManagers:', qaManagers, 'length:', qaManagers?.length);
     console.log('  - teams:', teams, 'length:', teams?.length);
     console.log('  - projectCategories:', projectCategories, 'length:', projectCategories?.length);
     console.log('  - isEditMode:', isEditMode);
     console.log('  - newProject:', newProject);
     
     const fileInputRef = useRef(null);
     const dropdownRefs = {
          assistantManagers: useRef(null),
          qaManagers: useRef(null),
          teams: useRef(null),
     };
     const [dropdownOpen, setDropdownOpen] = useState({
          assistantManagers: false,
          qaManagers: false,
          teams: false,
     });

     // Debug logs for edit mode
     // In edit mode, ensure selected IDs are set from project data if not already set
     useEffect(() => {
          if (isEditMode && newProject) {
               // Helper to extract string IDs from any array of IDs or objects
               const extractIds = (arr, key = 'user_id') => {
                    if (!arr) return [];
                    if (Array.isArray(arr) && typeof arr[0] === 'object') {
                         return arr.map(u => String(u[key] ?? u.id)).filter(Boolean);
                    }
                    return arr.map(id => String(id)).filter(Boolean);
               };

               // Only update if not already set (avoid overwriting user changes)
               if ((!newProject.assistantManagerIds || newProject.assistantManagerIds.length === 0) && newProject.asst_project_managers) {
                    const ids = extractIds(newProject.asst_project_managers, 'user_id');
                    onFieldChange('assistantManagerIds', ids);
               }
               if ((!newProject.qaManagerIds || newProject.qaManagerIds.length === 0) && newProject.qa_users) {
                    const ids = extractIds(newProject.qa_users, 'user_id');
                    onFieldChange('qaManagerIds', ids);
               }
               if ((!newProject.teamIds || newProject.teamIds.length === 0) && newProject.project_team) {
                    const ids = extractIds(newProject.project_team, 'user_id');
                    onFieldChange('teamIds', ids);
               }
          }
     }, [isEditMode, newProject, onFieldChange]);

     // Handle multiple selection - Updated to handle array of objects
     const handleMultipleSelect = (field, userId, isChecked) => {
          const currentValues = newProject[field] || [];
          let updatedValues;

          if (isChecked) {
               // Add userId if not already present
               if (!currentValues.includes(userId)) {
                    updatedValues = [...currentValues, userId];
               } else {
                    updatedValues = currentValues;
               }
          } else {
               // Remove userId
               updatedValues = currentValues.filter(id => id !== userId);
          }

          onFieldChange(field, updatedValues);
     };

     // Handle Select All functionality for multi-select dropdowns
     const handleSelectAll = (field, allItems, isChecked) => {
          if (isChecked) {
               // Select all items
               const allIds = allItems.map(item => item.user_id || item.team_id);
               onFieldChange(field, allIds);
          } else {
               // Deselect all items
               onFieldChange(field, []);
          }
     };

     // Check if item is selected
     const isSelected = (field, userId) => {
          const currentValues = newProject[field] || [];
          return currentValues.includes(userId);
     };

     // Get selected items labels for display
     const getSelectedItemsDisplay = (field, items) => {
          const currentValues = newProject[field] || [];
          if (currentValues.length === 0) return "Select...";

          const selectedItems = items.filter(item => currentValues.includes(item.user_id || item.team_id));

          if (selectedItems.length > 2) {
               return `${selectedItems.length} selected`;
          }
          return selectedItems.map(item => item.label).join(", ");
     };

     // Helper function to get items with consistent structure
     const getItemsWithConsistentStructure = (items) => {
          if (!items || items.length === 0) return [];

          // Handle different data structures
          return items
               .map(item => {
                    // If it's an array of arrays, get the first object
                    if (Array.isArray(item) && item.length > 0) {
                         const firstItem = item[0];
                         return {
                              id: firstItem.project_category_id ?? firstItem.afd_id ?? firstItem.user_id ?? firstItem.team_id,
                              label: firstItem.label,
                              user_id: firstItem.user_id || firstItem.team_id,
                              team_id: firstItem.team_id,
                              afd_id: firstItem.afd_id,
                              project_category_id: firstItem.project_category_id,
                         };
                    }

                    // If it's already an object
                    return {
                         id: item.project_category_id ?? item.afd_id ?? item.user_id ?? item.team_id,
                         label: item.label,
                         user_id: item.user_id || item.team_id,
                         team_id: item.team_id,
                         afd_id: item.afd_id,
                         project_category_id: item.project_category_id,
                    };
               })
               .filter(item => item.id !== null && item.id !== undefined && String(item.id) !== 'undefined');
     };

     // Get processed items
     const processedAssistantManagers = getItemsWithConsistentStructure(assistantManagers);
     const processedQaManagers = getItemsWithConsistentStructure(qaManagers);
     const processedTeams = getItemsWithConsistentStructure(teams);
     const processedProjectManagers = getItemsWithConsistentStructure(projectManagers);
     const processedProjectCategories = getItemsWithConsistentStructure(projectCategories);
     
     console.log('[AddProjectFormModal] ===== PROCESSED ITEMS =====');
     console.log('  - processedProjectManagers:', processedProjectManagers);
     console.log('  - processedAssistantManagers:', processedAssistantManagers);
     console.log('  - processedQaManagers:', processedQaManagers);
     console.log('  - processedTeams:', processedTeams);
     console.log('  - processedProjectCategories:', processedProjectCategories);
     
     console.log('[AddProjectFormModal] Project Categories:', {
          raw: projectCategories,
          processed: processedProjectCategories
     });
     
     // Build options for project category
     const projectCategoryOptions = [
          { value: "", label: "Select Category" },
          ...processedProjectCategories
               .filter((cat) => {
                    const id = cat.project_category_id ?? cat.afd_id ?? cat.id;
                    return id !== null && id !== undefined && String(id) !== 'undefined';
               })
               .map((cat) => ({ 
                    value: String(cat.project_category_id ?? cat.afd_id ?? cat.id), 
                    label: cat.label 
               }))
     ];
     
     // Build options for project managers
     const projectManagerOptions = [
          { value: "", label: "Select Project Manager" },
          ...processedProjectManagers.map((pm) => ({ 
               value: String(pm.user_id), 
               label: pm.label 
          }))
     ];
     
     // Build options for dropdowns
     const assistantManagerOptions = processedAssistantManagers.map((am) => ({ 
          value: String(am.user_id), 
          label: am.label 
     }));
     
     const qaManagerOptions = processedQaManagers.map((qa) => ({ 
          value: String(qa.user_id), 
          label: qa.label 
     }));
     
     const teamOptions = processedTeams.map((team) => ({ 
          value: String(team.user_id), 
          label: team.label 
     }));
     
     console.log('[AddProjectFormModal] ===== FINAL DROPDOWN OPTIONS =====');
     console.log('  - projectCategoryOptions:', projectCategoryOptions);
     console.log('  - projectManagerOptions:', projectManagerOptions);
     console.log('  - assistantManagerOptions:', assistantManagerOptions);
     console.log('  - qaManagerOptions:', qaManagerOptions);
     console.log('  - teamOptions:', teamOptions);
     console.log('[AddProjectFormModal] Final category options:', projectCategoryOptions);

     const toggleDropdown = (dropdown) => {
          setDropdownOpen(prev => ({
               // Close all dropdowns first
               assistantManagers: false,
               qaManagers: false,
               teams: false,
               // Open the clicked one
               [dropdown]: !prev[dropdown]
          }));
     };

     const handleFileChange = (e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
               handleProjectFilesChange(files);
          }
          e.target.value = "";
     };

     const triggerFileInput = () => {
          fileInputRef.current.click();
     };

     // Close all dropdowns when clicking outside
     const handleClickOutside = (e) => {
          if (!e.target.closest('.dropdown-container')) {
               setDropdownOpen({
                    assistantManagers: false,
                    qaManagers: false,
                    teams: false,
               });
          }
     };

     useEffect(() => {
          document.addEventListener('mousedown', handleClickOutside);
          return () => {
               document.removeEventListener('mousedown', handleClickOutside);
          };
     }, []);

     // Reset scroll position when dropdown opens
     useEffect(() => {
          if (dropdownOpen.assistantManagers && dropdownRefs.assistantManagers.current) {
               dropdownRefs.assistantManagers.current.scrollTop = 0;
          }
          if (dropdownOpen.qaManagers && dropdownRefs.qaManagers.current) {
               dropdownRefs.qaManagers.current.scrollTop = 0;
          }
          if (dropdownOpen.teams && dropdownRefs.teams.current) {
               dropdownRefs.teams.current.scrollTop = 0;
          }
     }, [dropdownOpen]);

     return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[98vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-3 bg-blue-800 text-white flex justify-between items-center shrink-0">
                         <div>
                              <h2 className="text-lg font-bold flex items-center gap-2">
                                   <Briefcase className="w-5 h-5 text-blue-300" />
                                   {isEditMode ? "Edit Project" : "Create New Project"}
                              </h2>
                              <p className="text-blue-200 text-xs">
                                   {isEditMode
                                        ? "Update project details as needed"
                                        : "Fill all required details to create a new project"}
                              </p>
                         </div>
                         <button
                              onClick={onClose}
                              className="p-1 hover:bg-white/10 rounded-full transition-colors"
                         >
                              <X className="w-5 h-5 text-white" />
                         </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-white">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              {/* Project Name */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Project Name <span className="text-red-600">*</span>
                                   </label>
                                   <input
                                        type="text"
                                        className="block w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. MoveEasy Platform"
                                        value={newProject.name}
                                        onChange={(e) => {
                                             onFieldChange("name", e.target.value);
                                             clearFieldError?.("name");
                                        }}
                                        required
                                   />
                                   {formErrors.name && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                                   )}
                              </div>

                              {/* Project Code */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Project Code <span className="text-red-600">*</span>
                                   </label>
                                   <input
                                        type="text"
                                        className="block w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. MOVE123"
                                        value={newProject.code}
                                        onChange={(e) => {
                                             onFieldChange("code", e.target.value);
                                             clearFieldError?.("code");
                                        }}
                                        required
                                   />
                                   {formErrors.code && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors.code}</p>
                                   )}
                              </div>

                              {/* Description */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Project Description
                                   </label>
                                   <textarea
                                        className="block w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 h-10 resize-none"
                                        placeholder="Describe the project scope and features..."
                                        value={newProject.description}
                                        onChange={(e) => onFieldChange("description", e.target.value)}
                                   />
                              </div>

                              {/* Project Category */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Project Category
                                   </label>
                                   <SearchableSelect
                                        value={newProject.projectCategoryId ? String(newProject.projectCategoryId) : ""}
                                        onChange={(val) => {
                                             onFieldChange("projectCategoryId", val);
                                             clearFieldError?.("projectCategoryId");
                                        }}
                                        options={projectCategoryOptions}
                                        icon={Briefcase}
                                        placeholder="Select Category"
                                        error={!!formErrors.projectCategoryId}
                                        errorMessage={formErrors.projectCategoryId}
                                   />
                              </div>

                              {/* Project Manager */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Project Manager
                                   </label>
                                   <SearchableSelect
                                        value={newProject.projectManagerId ? String(newProject.projectManagerId) : ""}
                                        onChange={(val) => {
                                             onFieldChange("projectManagerId", val);
                                             clearFieldError?.("projectManagerId");
                                        }}
                                        options={projectManagerOptions}
                                        icon={User}
                                        placeholder="Select Project Manager"
                                        error={!!formErrors.projectManagerId}
                                        errorMessage={formErrors.projectManagerId}
                                   />
                              </div>

                              {/* Assistant Project Manager - Multi Select */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Assistant Project Manager(s) <span className="text-red-600">*</span>
                                   </label>
                                   <MultiSelectWithCheckbox
                                        value={newProject.assistantManagerIds || []}
                                        onChange={(val) => {
                                             onFieldChange("assistantManagerIds", val);
                                             clearFieldError?.("assistantManagerIds");
                                        }}
                                        options={assistantManagerOptions}
                                        icon={Users}
                                        placeholder="Select Assistant Project Managers"
                                        error={!!formErrors.assistantManagerIds}
                                        errorMessage={formErrors.assistantManagerIds}
                                        maxDisplayCount={2}
                                   />
                              </div>

                              {/* Quality Analyst - Multi Select */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Quality Analyst(s) <span className="text-red-600">*</span>
                                   </label>
                                   <MultiSelectWithCheckbox
                                        value={newProject.qaManagerIds || []}
                                        onChange={(val) => {
                                             onFieldChange("qaManagerIds", val);
                                             clearFieldError?.("qaManagerIds");
                                        }}
                                        options={qaManagerOptions}
                                        icon={Users}
                                        placeholder="Select Quality Analysts"
                                        error={!!formErrors.qaManagerIds}
                                        errorMessage={formErrors.qaManagerIds}
                                        maxDisplayCount={2}
                                   />
                              </div>

                              {/* Team Assignment - Multi Select */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Agent(s) <span className="text-red-600">*</span>
                                   </label>
                                   <MultiSelectWithCheckbox
                                        value={newProject.teamIds || []}
                                        onChange={(val) => {
                                             onFieldChange("teamIds", val);
                                             clearFieldError?.("teamIds");
                                        }}
                                        options={teamOptions}
                                        icon={Users}
                                        placeholder="Select Agents"
                                        error={!!formErrors.teamIds}
                                        errorMessage={formErrors.teamIds}
                                        maxDisplayCount={2}
                                   />
                              </div>

                              {/* AI Evaluation Requirement Toggle */}
                              <div className="md:col-span-1">
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Requires AI Evaluation
                                   </label>
                                   <div className="flex items-center gap-3">
                                        <button
                                             type="button"
                                             onClick={() => {
                                                  const newValue = !newProject.requires_ai_evaluation;
                                                  onFieldChange("requires_ai_evaluation", newValue);
                                             }}
                                             className={`
                                                  relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                                                  ${
                                                       newProject.requires_ai_evaluation
                                                            ? 'bg-purple-600'
                                                            : 'bg-gray-300'
                                                  }
                                             `}
                                        >
                                             <span
                                                  className={`
                                                       inline-block h-5 w-5 transform rounded-full bg-white transition-transform
                                                       ${
                                                            newProject.requires_ai_evaluation
                                                                 ? 'translate-x-6'
                                                                 : 'translate-x-1'
                                                       }
                                                  `}
                                             />
                                        </button>
                                        <span className="text-sm text-gray-600">
                                             {newProject.requires_ai_evaluation ? 'Yes' : 'No'}
                                        </span>
                                   </div>
                                   <p className="mt-1 text-xs text-gray-500">
                                        Enable if this project requires AI evaluation checks for tracker submissions
                                   </p>
                              </div>

                              {/* Duplicate Check Requirement Toggle */}
                              <div className="md:col-span-1">
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Requires Duplicate Check
                                   </label>
                                   <div className="flex items-center gap-3">
                                        <button
                                             type="button"
                                             onClick={() => {
                                                  const newValue = !newProject.requires_duplicate_check;
                                                  onFieldChange("requires_duplicate_check", newValue);
                                             }}
                                             className={`
                                                  relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                                  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                                                  ${
                                                       newProject.requires_duplicate_check
                                                            ? 'bg-orange-600'
                                                            : 'bg-gray-300'
                                                  }
                                             `}
                                        >
                                             <span
                                                  className={`
                                                       inline-block h-5 w-5 transform rounded-full bg-white transition-transform
                                                       ${
                                                            newProject.requires_duplicate_check
                                                                 ? 'translate-x-6'
                                                                 : 'translate-x-1'
                                                       }
                                                  `}
                                             />
                                        </button>
                                        <span className="text-sm text-gray-600">
                                             {newProject.requires_duplicate_check ? 'Yes' : 'No'}
                                        </span>
                                   </div>
                                   <p className="mt-1 text-xs text-gray-500">
                                        Enable if this project requires duplicate check validation for tracker submissions
                                   </p>
                              </div>

                              {/* Project Files Upload */}
                              {/* <div className="md:col-span-1">
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Project Files
                                   </label>

                                   <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        multiple
                                        onChange={handleFileChange}
                                   />

                                   <div className="flex items-center gap-3">
                                        <div
                                             onClick={triggerFileInput}
                                             className="
                                               flex items-center justify-between
                                               w-full px-3 py-3
                                               text-sm bg-gray-50
                                               border border-gray-200 rounded-lg
                                               cursor-pointer
                                               hover:bg-gray-100
                                               focus-within:ring-2 focus-within:ring-blue-500
                                             "
                                        >
                                             <div className="flex items-center gap-2 text-gray-600">
                                                  <Upload className="w-4 h-4" />
                                                  {projectFiles.length > 0 ? (
                                                       <span>{projectFiles.length} file(s) selected</span>
                                                  ) : (
                                                       <span>Select project files</span>
                                                  )}
                                             </div>

                                             <span className="text-blue-600 text-xs font-medium">
                                                  Browse
                                             </span>
                                        </div>
                                   </div>

                                   {projectFiles.length > 0 && (
                                        <div className="mt-1 space-y-1">
                                             {projectFiles.map((file, index) => (
                                                  <div
                                                       key={`${file.name}-${index}`}
                                                       className="
                                                         flex items-center justify-between
                                                         px-3 py-1
                                                         border border-gray-200
                                                         rounded-md
                                                         text-sm
                                                         bg-white
                                                       "
                                                  >
                                                       <span className="truncate text-red-600 text-xs max-w-[85%]">
                                                            {file.name}
                                                       </span>

                                                       <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 handleRemoveProjectFile(index);
                                                            }}
                                                            className="text-gray-400 hover:text-red-500"
                                                            title="Remove file"
                                                       >
                                                            <XCircle className="w-4 h-4" />
                                                       </button>
                                                  </div>
                                             ))}
                                        </div>
                                   )}
                              </div> */}

                              <div className="md:col-span-1">
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Project Files
                                   </label>

                                   <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        multiple
                                        onChange={handleFileChange}
                                   />

                                   <div className="flex items-center gap-3">
                                        <div
                                             onClick={triggerFileInput}
                                             className="
        flex items-center justify-between
        w-full px-3 py-2.5
        text-sm bg-gray-50
        border border-gray-200 rounded-lg
        cursor-pointer
        hover:bg-gray-100
        focus-within:ring-2 focus-within:ring-blue-500
      "
                                        >
                                             <div className="flex items-center gap-2 text-gray-600">
                                                  <Upload className="w-4 h-4" />
                                                  {projectFiles && projectFiles.length > 0 ? (
                                                       <span>{projectFiles.length} file(s) selected</span>
                                                  ) : (
                                                       <span>Select project files</span>
                                                  )}
                                             </div>

                                             <span className="text-blue-600 text-xs font-medium">
                                                  Browse
                                             </span>
                                        </div>
                                   </div>

                                   {projectFiles && projectFiles.length > 0 && (
                                        <div className="mt-1 space-y-1">
                                             {projectFiles.map((file, index) => {
                                                  const isExistingFile = !(file instanceof File);
                                                  return (
                                                       <div
                                                            key={`${file.name}-${index}`}
                                                            className="
          flex items-center justify-between
          px-3 py-1
          border border-gray-200
          rounded-md
          text-sm
          bg-white
        "
                                                       >
                                                            <span className={`truncate text-xs max-w-[85%] ${isExistingFile ? 'text-blue-600' : 'text-red-600'}`}>
                                                                 {file.name}
                                                            </span>
                                                            {isExistingFile ? (
                                                                 <span className="text-green-600 text-xs font-medium">Existing</span>
                                                            ) : (
                                                                 <button
                                                                      type="button"
                                                                      onClick={(e) => {
                                                                           e.stopPropagation();
                                                                           handleRemoveProjectFile(index);
                                                                      }}
                                                                      className="text-gray-400 hover:text-red-500"
                                                                      title="Remove file"
                                                                 >
                                                                      <XCircle className="w-4 h-4" />
                                                                 </button>
                                                            )}
                                                       </div>
                                                  );
                                             })}
                                        </div>
                                   )}
                              </div>

                         </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                         <button
                              onClick={onSubmit}
                              disabled={isSubmitting}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                         >
                              {isSubmitting ? (
                                   <>
                                        <svg
                                             className="animate-spin h-4 w-4 text-white"
                                             xmlns="http://www.w3.org/2000/svg"
                                             fill="none"
                                             viewBox="0 0 24 24"
                                        >
                                             <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                             ></circle>
                                             <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                             ></path>
                                        </svg>
                                        {isEditMode ? "Updating..." : "Creating..."}
                                   </>
                              ) : isEditMode ? (
                                   "Update Project"
                              ) : (
                                   "Create Project"
                              )}
                         </button>
                    </div>
               </div>
          </div>
     );
};

export default AddProjectFormModal;









{
     /* Monthly Hours Target */
}
{
     /* <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Monthly Hours Target <span className="text-red-600">*</span>
                 </label>
                 <input
                   type="number"
                   className="block w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="e.g. 720"
                   value={newProject.monthlyHoursTarget}
                   onChange={(e) => {
                     onFieldChange('monthlyHoursTarget', e.target.value);
                     clearFieldError?.("monthlyHoursTarget");
                   }}
                   min="0"
                   required
                 />
                 {formErrors.monthlyHoursTarget && (
                   <p className="mt-1 text-xs text-red-600">{formErrors.monthlyHoursTarget}</p>
                 )}
               </div> */
}

{
     /* Start Date */
}
{
     /* <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Project Start Date
                 </label>
                 <input
                   type="date"
                   className="block w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                   value={newProject.startDate}
                   onChange={(e) => onFieldChange('startDate', e.target.value)}
                 />
               </div> */
}

{
     /* End Date */
}
{
     /* <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Project End Date (Estimated)
                 </label>
                 <input
                   type="date"
                   className="block w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                   value={newProject.endDate}
                   onChange={(e) => onFieldChange('endDate', e.target.value)}
                 />
               </div> */
}

{
     /* Project Status */
}
{
     /* <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Project Status
                 </label>
                 <select
                   className="block w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                   value={newProject.status}
                   onChange={(e) => onFieldChange('status', e.target.value)}
                 >
                   <option value="PLANNING">Planning</option>
                   <option value="ACTIVE">Active</option>
                   <option value="ON_HOLD">On Hold</option>
                   <option value="COMPLETED">Completed</option>
                   <option value="CANCELLED">Cancelled</option>
                 </select>
               </div> */
}

{
     /* Budget
               <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Project Budget ($)
                 </label>
                 <div className="relative">
                   <span className="absolute left-3 top-3 text-gray-500">$</span>
                   <input
                     type="number"
                     className="block w-full pl-8 pr-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
                     placeholder="0.00"
                     value={newProject.budget}
                     onChange={(e) => onFieldChange('budget', e.target.value)}
                     min="0"
                     step="0.01"
                   />
                 </div>
               </div>
   
               Client Name 
               <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Client Name
                 </label>
                 <input
                   type="text"
                   className="block w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="Client Company Name"
                   value={newProject.clientName}
                   onChange={(e) => onFieldChange('clientName', e.target.value)}
                 />
               </div>
   
                Client Email
               <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Client Email
                 </label>
                 <input
                   type="email"
                   className="block w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="client@company.com"
                   value={newProject.clientEmail}
                   onChange={(e) => onFieldChange('clientEmail', e.target.value)}
                 />
               </div> */
}
