/**
 * File Name: AddUserFormModal.jsx
 * Author: Naitik Maisuriya
 * Description: A reusable React modal component designed for administrative dashboards. 
 * Its primary purpose is to provide a comprehensive form for both creating new users 
 * and editing existing ones, featuring profile picture uploads, field validation, 
 * and dynamic dropdown population for organizational roles and hierarchies.
 */

import React, { useRef, useState, useEffect } from "react";
import { UserPlus, X, Upload, XCircle, User, Eye, EyeOff, ChevronDown, Users } from "lucide-react";
import SearchableSelect from "../../../common/SearchableSelect";
import MultiSelectWithCheckbox from "../../../common/MultiSelectWithCheckbox";
import { SingleDatePicker } from "../../../common/CustomCalendar";

/** Show joining date as dd/mm/yyyy. Accepts YYYY-MM-DD from the API. */
export function joiningDateToDisplay(value) {
     if (!value) return "";
     const s = String(value).trim();
     const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
     if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
     return s;
}

/** Convert dd/mm/yyyy (or YYYY-MM-DD) to YYYY-MM-DD for the API. */
export function joiningDateToIso(value) {
     if (!value) return "";
     const s = String(value).trim();
     const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
     if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
     const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
     if (!dmy) return "";
     const day = dmy[1].padStart(2, "0");
     const month = dmy[2].padStart(2, "0");
     const year = dmy[3];
     const dt = new Date(Number(year), Number(month) - 1, Number(day));
     if (
          dt.getFullYear() !== Number(year) ||
          dt.getMonth() !== Number(month) - 1 ||
          dt.getDate() !== Number(day)
     ) {
          return "";
     }
     return `${year}-${month}-${day}`;
}

const AddUserFormModal = ({
     newUser,
     setNewUser,
     handleAddUser,
     handleUpdateUser,
     roles = [],
     designations = [],
     projectManagers = [],
     assistantManagers = [],
     qas = [],
     teams = [],
     isDropdownLoading,
     isSuperAdmin,
     handleCloseUserModal,
     isSubmitting,
     formErrors = {},
     clearFieldError,
     handleProfilePictureChange,
     handleRemoveProfilePicture,
     profilePreview,
     isEditMode = false,
}) => {
     // Reference for the hidden file input to trigger it via a custom button
     const fileInputRef = useRef(null);
     // Local state to track the name of the uploaded file for UI feedback
     const [fileName, setFileName] = useState("");
     // Local validation errors for live validation
     const [liveErrors, setLiveErrors] = useState({});
     // Track if form submission was attempted
     const [submitAttempted, setSubmitAttempted] = useState(false);
     // Track password visibility
     const [showPassword, setShowPassword] = useState(false);

     /**
      * Role-based field visibility configuration
      * Role IDs: 1=Super Admin, 2=Admin, 3=Project Manager, 4=Assistant Manager, 5=QA, 6=Agent
      */
     const getFieldVisibility = (selectedRoleId) => {
          const roleId = Number(selectedRoleId);
          const hidden = { visible: false, required: false };
          const optional = { visible: true, required: false };
          const required = { visible: true, required: true };

          // Super Admin (1) and Admin (2): no reporting line or team
          if (!roleId || roleId === 1 || roleId === 2) {
               return {
                    projectManager: hidden,
                    assistantManager: hidden,
                    qualityAnalyst: hidden,
                    team: hidden,
                    tenure: hidden,
                    joiningDate: optional,
               };
          }

          if (roleId === 3) {
               return {
                    projectManager: hidden,
                    assistantManager: hidden,
                    qualityAnalyst: hidden,
                    team: optional,
                    tenure: hidden,
                    joiningDate: optional,
               };
          }

          if (roleId === 4) {
               return {
                    projectManager: optional,
                    assistantManager: hidden,
                    qualityAnalyst: hidden,
                    team: required,
                    tenure: hidden,
                    joiningDate: optional,
               };
          }

          if (roleId === 5) {
               return {
                    projectManager: optional,
                    assistantManager: required,
                    qualityAnalyst: hidden,
                    team: required,
                    tenure: hidden,
                    joiningDate: required,
               };
          }

          if (roleId === 6) {
               return {
                    projectManager: optional,
                    assistantManager: required,
                    qualityAnalyst: required,
                    team: required,
                    tenure: required,
                    joiningDate: required,
               };
          }

          return {
               projectManager: optional,
               assistantManager: required,
               qualityAnalyst: required,
               team: required,
               tenure: hidden,
               joiningDate: optional,
          };
     };

     // Get current field visibility based on selected role
     const fieldVisibility = getFieldVisibility(newUser.role);

     // Prevent body scroll when modal is open and preserve scroll position
     useEffect(() => {
          const scrollY = window.scrollY;
          const body = document.body;
          
          // Save current scroll position and prevent body scroll
          body.style.top = `-${scrollY}px`;
          body.style.position = 'fixed';
          body.style.width = '100%';
          body.style.overflowY = 'scroll'; // Keep scrollbar to prevent layout shift
          
          // Cleanup: restore scroll position
          return () => {
               body.style.position = '';
               body.style.top = '';
               body.style.width = '';
               body.style.overflowY = '';
               window.scrollTo(0, scrollY);
          };
     }, []);

     /**
      * Validation functions for each field
      */
     const validateName = (name) => {
          if (!name || !name.trim()) {
               return "Please enter full name";
          }
          if (name.trim().length < 3) {
               return "Full name must be at least 3 characters";
          }
          if (!/^[a-zA-Z\s]+$/.test(name)) {
               return "Full name should only contain letters and spaces";
          }
          return "";
     };

     const validateEmail = (email) => {
          if (!email || !email.trim()) {
               return "Please enter email address";
          }
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
               return "Please enter a valid email address";
          }
          return "";
     };

     const validatePhone = (phone) => {
          // Phone is optional, only validate if provided
          if (!phone || !phone.trim()) {
               return "";
          }
          if (phone.length !== 10) {
               return "Phone number must be exactly 10 digits";
          }
          if (!/^\d{10}$/.test(phone)) {
               return "Phone number should only contain digits";
          }
          return "";
     };

     const validatePassword = (password) => {
          // In edit mode, password is optional - only validate if provided
          if (isEditMode) {
               if (!password || !password.trim()) {
                    return ""; // Allow empty password in edit mode
               }
               if (password.length < 6) {
                    return "Password must be at least 6 characters";
               }
               if (password.length > 50) {
                    return "Password must not exceed 50 characters";
               }
               return "";
          }
          
          // In create mode, password is required
          if (!password || !password.trim()) {
               return "Please enter password";
          }
          if (password.length < 6) {
               return "Password must be at least 6 characters";
          }
          if (password.length > 50) {
               return "Password must not exceed 50 characters";
          }
          return "";
     };

     const validateDropdown = (value, fieldName) => {
          if (!value || value === "") {
               return `Please select ${fieldName.toLowerCase()}`;
          }
          return "";
     };


     const validateTenure = (tenure) => {
          if (tenure === undefined || tenure === null || tenure === "") {
               return "Please enter tenure";
          }
          const num = Number(tenure);
          if (Number.isNaN(num) || num <= 0) {
               return "Tenure must be a number greater than 0";
          }
          return "";
     };

     const validateJoiningDate = (value) => {
          if (!value || !String(value).trim()) {
               return "Please enter joining date (dd/mm/yyyy)";
          }
          if (!joiningDateToIso(value)) {
               return "Use dd/mm/yyyy";
          }
          return "";
     };

     /**
      * Validate all fields at once
      */
     const validateAllFields = () => {
          // In edit mode, skip validations entirely so admin can change any single field
          if (isEditMode) return {};
          const errors = {};

          // Get field visibility based on selected role
          const visibility = getFieldVisibility(newUser.role);

          // Validate name
          const nameError = validateName(newUser.name || "");
          if (nameError) errors.name = nameError;

          // Validate email (only in create mode)
          if (!isEditMode) {
               const emailError = validateEmail(newUser.email || "");
               if (emailError) errors.email = emailError;
          }

          // Validate phone (optional field)
          if (newUser.phone && newUser.phone.trim()) {
               const phoneError = validatePhone(newUser.phone);
               if (phoneError) errors.phone = phoneError;
          }

          // Validate password (only in create mode)
          if (!isEditMode) {
               const passwordError = validatePassword(newUser.password || "");
               if (passwordError) errors.password = passwordError;
          }

          // Validate role
          const roleError = validateDropdown(newUser.role, "Role");
          if (roleError) errors.role = roleError;

          // Validate designation
          const designationError = validateDropdown(newUser.designation, "Designation");
          if (designationError) errors.designation = designationError;

          // Validate projectManagers (array - only if visible and required for this role)
          if (visibility.projectManager.visible && visibility.projectManager.required) {
               if (!newUser.projectManagers || newUser.projectManagers.length === 0) {
                    errors.projectManagers = "Please select at least one Project Manager";
               }
          }

          // Validate assistantManagers (array - only if visible and required for this role)
          if (visibility.assistantManager.visible && visibility.assistantManager.required) {
               if (!newUser.assistantManagers || newUser.assistantManagers.length === 0) {
                    errors.assistantManagers = "Please select at least one Assistant Manager";
               }
          }

          // Validate qualityAnalysts (array - only if visible and required for this role)
          if (visibility.qualityAnalyst.visible && visibility.qualityAnalyst.required) {
               if (!newUser.qualityAnalysts || newUser.qualityAnalysts.length === 0) {
                    errors.qualityAnalysts = "Please select at least one Quality Analyst";
               }
          }

          if (visibility.team?.visible && visibility.team.required) {
               const teamError = validateDropdown(newUser.team, "Team");
               if (teamError) errors.team = teamError;
          }

          // Validate tenure (only if visible and required for this role)
          if (visibility.tenure && visibility.tenure.visible && visibility.tenure.required) {
               const tenureError = validateTenure(newUser.tenure || "");
               if (tenureError) errors.tenure = tenureError;
          }

          if (visibility.joiningDate && visibility.joiningDate.visible && visibility.joiningDate.required) {
               const joiningError = validateJoiningDate(newUser.joining_date || "");
               if (joiningError) errors.joining_date = joiningError;
          }

          return errors;
     };

     /**
      * Handle field change with live validation
      */
     const handleFieldChange = (fieldName, value, validator) => {
          if (fieldName === "role") {
               const vis = getFieldVisibility(value);
               const next = { ...newUser, role: value };
               if (!vis.projectManager.visible) next.projectManagers = [];
               if (!vis.assistantManager.visible) next.assistantManagers = [];
               if (!vis.qualityAnalyst.visible) next.qualityAnalysts = [];
               if (!vis.team?.visible) next.team = "";
               if (!vis.tenure?.visible) next.tenure = "";
               setNewUser(next);
          } else {
               setNewUser({ ...newUser, [fieldName]: value });
          }
          
          // Run live validation only if submit was attempted and validator is a function
          if (submitAttempted && typeof validator === "function") {
               const error = validator(value);
               if (error) {
                    setLiveErrors({ ...liveErrors, [fieldName]: error });
               } else {
                    const updatedErrors = { ...liveErrors };
                    delete updatedErrors[fieldName];
                    setLiveErrors(updatedErrors);
               }
          }
          
          // Clear backend error when user starts typing
          clearFieldError(fieldName);
     };

     /**
      * Handle field blur with validation
      */
     const handleFieldBlur = (fieldName, validator) => {
          const error = validator(newUser[fieldName] || "");
          if (error) {
               setLiveErrors({ ...liveErrors, [fieldName]: error });
          } else {
               const updatedErrors = { ...liveErrors };
               delete updatedErrors[fieldName];
               setLiveErrors(updatedErrors);
          }
     };

     /**
      * Handle create/update button click
      */
     const handleSubmit = () => {
          if (isEditMode) {
               // No validations in edit mode; update directly
               handleUpdateUser();
               return;
          }

	  setSubmitAttempted(true);
	  const allErrors = validateAllFields();

          if (Object.keys(allErrors).length === 0) {
               handleAddUser();
          } else {
               setLiveErrors(allErrors);
               // console.warn("❌ Validation Errors Found:", allErrors);
          }
     };

     /**
      * Handles the file selection from the hidden input
      * Updates local file name state and triggers the parent-provided handler
      */
     const handleFileChange = (e) => {
          const file = e.target.files[0];
          if (file) {
               setFileName(file.name);
               handleProfilePictureChange(file);
          }
     };

     /**
      * Programmatically clicks the hidden file input
      */
     const triggerFileInput = () => {
          fileInputRef.current.click();
     };

     /**
      * Effect to reset the file name display when switching modes
      */
     // Reset state when switching to create mode
     useEffect(() => {
          if (!isEditMode) {
               setFileName("");
               setLiveErrors({});
               setSubmitAttempted(false);
               setShowPassword(false);
               setNewUser((prev) => ({
                    ...prev,
                    role: ""
               }));
          }
     }, [isEditMode]);

     // Map string values to dropdown IDs for correct selection in edit mode only
     useEffect(() => {
          if (isEditMode) {
               setNewUser((prev) => {
                    const mapped = {
                         ...prev,
                         role: roles.find(r => 
                              r.label === prev.role || 
                              r.role_id === prev.role_id || 
                              r.role_id === Number(prev.role) ||
                              String(r.role_id) === String(prev.role)
                         )?.role_id || prev.role || "",
                         designation: designations.find(d => 
                              d.label === prev.designation || 
                              d.designation_id === prev.designation_id ||
                              d.designation_id === Number(prev.designation) ||
                              String(d.designation_id) === String(prev.designation)
                         )?.designation_id || prev.designation || "",
                         projectManager: projectManagers.find(m => 
                              m.label === prev.projectManager || 
                              m.label === prev.project_manager || 
                              m.user_id === prev.project_manager_id ||
                              m.user_id === Number(prev.projectManager) ||
                              String(m.user_id) === String(prev.projectManager)
                         )?.user_id || prev.projectManager || "",
                         assistantManager: assistantManagers.find(m => 
                              m.label === prev.assistantManager || 
                              m.label === prev.asst_manager || 
                              m.user_id === prev.assistant_manager_id ||
                              m.user_id === Number(prev.assistantManager) ||
                              String(m.user_id) === String(prev.assistantManager)
                         )?.user_id || prev.assistantManager || "",
                         qualityAnalyst: qas.find(q => 
                              q.label === prev.qualityAnalyst || 
                              q.label === prev.qa || 
                              q.user_id === prev.qa_id ||
                              q.user_id === Number(prev.qualityAnalyst) ||
                              String(q.user_id) === String(prev.qualityAnalyst)
                         )?.user_id || prev.qualityAnalyst || "",
                         team: teams.find(t => 
                              t.label === prev.team || 
                              t.label === prev.team_name || 
                              t.team_id === prev.team_id ||
                              t.team_id === Number(prev.team) ||
                              String(t.team_id) === String(prev.team)
                         )?.team_id || prev.team || "",
                    };
                    // Only update if mapped values are different from prev
                    const isSame = Object.keys(mapped).every(key => mapped[key] === prev[key]);
                    return isSame ? prev : mapped;
               });
          }
     }, [isEditMode, roles, designations, projectManagers, assistantManagers, qas, teams]);

     // Helper function to get error message (prioritize backend errors)
     const getErrorMessage = (fieldName) => {
          return formErrors[fieldName] || liveErrors[fieldName] || "";
     };

     // Helper function to check if field has error
     const hasError = (fieldName) => {
          return !!getErrorMessage(fieldName);
     };

     return (
          // Modal Backdrop
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               {/* Modal Container */}
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                    
                    {/* Modal Header */}
                    <div className="p-4 bg-blue-800 text-white flex justify-between items-center shrink-0">
                         <div>
                              <h2 className="text-lg font-bold flex items-center gap-2">
                                   {isEditMode ? (
                                        <User className="w-5 h-5 text-blue-300" />
                                   ) : (
                                        <UserPlus className="w-5 h-5 text-blue-300" />
                                   )}
                                   {isEditMode ? "Edit User" : "Create New User"}
                              </h2>
                              <p className="text-blue-200 text-xs">
                                   {isEditMode
                                        ? "Update user details as needed"
                                        : "Fill all required details to create a new user account"
                                   }
                              </p>
                         </div>
                         {/* Close Button */}
                         <button
                              onClick={handleCloseUserModal}
                              className="p-1 hover:bg-white/10 rounded-full transition-colors"
                         >
                              <X className="w-5 h-5 text-white" />
                         </button>
                    </div>

                    {/* Form Body - Scrollable Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <input type="text" name="fake_username" autoComplete="username" tabIndex={-1} aria-hidden="true" className="hidden" />
                              <input type="password" name="fake_password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" className="hidden" />
                              
                              {/* Full Name Input */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Full Name <span className="text-red-600">*</span>
                                   </label>
                                   <input
                                        type="text"
                                        name="hrms_new_user_name"
                                        autoComplete="off"
                                        className={`block w-full px-3 py-3 text-sm bg-gray-50 border ${hasError("name") ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                        placeholder="John Doe"
                                        value={newUser.name || ""}
                                        onChange={(e) => handleFieldChange("name", e.target.value, validateName)}
                                        onBlur={() => handleFieldBlur("name", validateName)}
                                        required={!isEditMode}
                                   />
                                   {getErrorMessage("name") && (
                                        <p className="mt-1 text-xs text-red-600">{getErrorMessage("name")}</p>
                                   )}
                              </div>

                              {/* Email Input - Disabled in Edit Mode */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Email Address <span className="text-red-600">*</span>
                                   </label>
                                   <input
                                        type="text"
                                        inputMode="email"
                                        name="hrms_new_user_email"
                                        autoComplete="off"
                                        className={`block w-full px-3 py-3 text-sm bg-gray-50 border ${hasError("email") ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                        placeholder="user@company.com"
                                        value={newUser.email || ""}
                                        onChange={(e) => !isEditMode && handleFieldChange("email", e.target.value, validateEmail)}
                                        onBlur={() => !isEditMode && handleFieldBlur("email", validateEmail)}
                                        disabled={isEditMode}
                                        required={!isEditMode}
                                   />
                                   {!isEditMode && getErrorMessage("email") && (
                                        <p className="mt-1 text-xs text-red-600">{getErrorMessage("email")}</p>
                                   )}
                              </div>

                              {/* Role Selection Dropdown */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Role <span className="text-red-600">*</span>
                                   </label>
                                   <SearchableSelect
                                        value={String(newUser.role ?? "")}
                                        onChange={(val) => handleFieldChange("role", val, (v) => validateDropdown(v, "Role"))}
                                        options={[
                                             { value: "", label: "Select Role" },
                                             ...roles.map((r) => ({ value: String(r.role_id), label: r.label }))
                                        ]}
                                        icon={User}
                                        placeholder="Select Role"
                                        disabled={isDropdownLoading}
                                        error={hasError("role")}
                                        errorMessage={getErrorMessage("role")}
                                   />
                              </div>

                              {/* Phone Number Input - Numeric only validation */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Phone Number
                                   </label>
                                   <input
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={10}
                                        className={`block w-full px-3 py-3 text-sm bg-gray-50 border ${hasError("phone") ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                        placeholder="1234567890"
                                        value={newUser.phone || ""}
                                        onChange={(e) => {
                                             const value = e.target.value.replace(/\D/g, "");
                                             if (value.length <= 10) {
                                                  handleFieldChange("phone", value, validatePhone);
                                             }
                                        }}
                                        onBlur={() => handleFieldBlur("phone", validatePhone)}
                                        required={!isEditMode}
                                   />
                                   {getErrorMessage("phone") && (
                                        <p className="mt-1 text-xs text-red-600">{getErrorMessage("phone")}</p>
                                   )}
                              </div>

                              {/* Designation Dropdown */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Designation <span className="text-red-600">*</span>
                                   </label>
                                   <SearchableSelect
                                        value={newUser.designation ?? ""}
                                        onChange={(val) => handleFieldChange("designation", val, (v) => validateDropdown(v, "Designation"))}
                                        options={[
                                             { value: "", label: "Select Designation" },
                                             ...designations.map((d) => ({ value: d.designation_id, label: d.label }))
                                        ]}
                                        icon={User}
                                        placeholder="Select Designation"
                                        disabled={isDropdownLoading}
                                        error={hasError("designation")}
                                        errorMessage={getErrorMessage("designation")}
                                   />
                              </div>
                              {/* Project Manager Selection - Conditionally visible - MULTI SELECT */}
                              {fieldVisibility.projectManager.visible && (
                                   <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                             Project Manager {fieldVisibility.projectManager.required && <span className="text-red-600">*</span>}
                                        </label>
                                        <MultiSelectWithCheckbox
                                             value={newUser.projectManagers || []}
                                             onChange={(val) => {
                                                  setNewUser({ ...newUser, projectManagers: val });
                                                  clearFieldError && clearFieldError("projectManagers");
                                             }}
                                             options={projectManagers.map(pm => ({ value: String(pm.user_id), label: pm.label }))}
                                             icon={Users}
                                             placeholder="Select Project Managers"
                                             disabled={isDropdownLoading}
                                             error={hasError("projectManagers")}
                                             errorMessage={getErrorMessage("projectManagers")}
                                             maxDisplayCount={2}
                                        />
                                   </div>
                              )}

                              {/* Assistant Manager Selection - Conditionally visible - MULTI SELECT */}
                              {fieldVisibility.assistantManager.visible && (
                                   <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                             Assistant Manager {fieldVisibility.assistantManager.required && <span className="text-red-600">*</span>}
                                        </label>
                                        <MultiSelectWithCheckbox
                                             value={newUser.assistantManagers || []}
                                             onChange={(val) => {
                                                  setNewUser({ ...newUser, assistantManagers: val });
                                                  clearFieldError && clearFieldError("assistantManagers");
                                             }}
                                             options={assistantManagers.map(am => ({ value: String(am.user_id), label: am.label }))}
                                             icon={Users}
                                             placeholder="Select Assistant Managers"
                                             disabled={isDropdownLoading}
                                             error={hasError("assistantManagers")}
                                             errorMessage={getErrorMessage("assistantManagers")}
                                             maxDisplayCount={2}
                                        />
                                   </div>
                              )}

                              {/* Quality Analyst Selection - Conditionally visible - MULTI SELECT */}
                              {fieldVisibility.qualityAnalyst.visible && (
                                   <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                             Quality Analyst {fieldVisibility.qualityAnalyst.required && <span className="text-red-600">*</span>}
                                        </label>
                                        <MultiSelectWithCheckbox
                                             value={newUser.qualityAnalysts || []}
                                             onChange={(val) => {
                                                  setNewUser({ ...newUser, qualityAnalysts: val });
                                                  clearFieldError && clearFieldError("qualityAnalysts");
                                             }}
                                             options={qas.map(qa => ({ value: String(qa.user_id), label: qa.label }))}
                                             icon={Users}
                                             placeholder="Select Quality Analysts"
                                             disabled={isDropdownLoading}
                                             error={hasError("qualityAnalysts")}
                                             errorMessage={getErrorMessage("qualityAnalysts")}
                                             maxDisplayCount={2}
                                        />
                                   </div>
                              )}

                              {fieldVisibility.team?.visible && (
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Team {fieldVisibility.team.required && <span className="text-red-600">*</span>}
                                   </label>
                                   <SearchableSelect
                                        value={newUser.team ?? ""}
                                        onChange={(val) => handleFieldChange("team", val, (v) => validateDropdown(v, "Team"))}
                                        options={[
                                             { value: "", label: "Select Team" },
                                             ...teams.map((m) => ({ value: m.team_id, label: m.label }))
                                        ]}
                                        icon={User}
                                        placeholder="Select Team"
                                        disabled={isDropdownLoading}
                                        error={hasError("team")}
                                        errorMessage={getErrorMessage("team")}
                                   />
                              </div>
                              )}
                              {/* Password Input - Shown in both create and edit mode */}
                              <div>
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Password {!isEditMode && <span className="text-red-600">*</span>}
                                   </label>
                                   <div className="relative">
                                        <input
                                             type={showPassword ? "text" : "password"}
                                             name="hrms_new_user_password"
                                             autoComplete="new-password"
                                             className={`block w-full px-3 py-3 pr-10 text-sm bg-gray-50 border ${hasError("password") ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                             placeholder={isEditMode ? "Leave blank to keep current password" : "Enter password.."}
                                             value={newUser.password || ""}
                                             onChange={(e) => handleFieldChange("password", e.target.value, validatePassword)}
                                             onBlur={() => handleFieldBlur("password", validatePassword)}
                                             required={!isEditMode}
                                        />
                                        <button
                                             type="button"
                                             onClick={() => setShowPassword(!showPassword)}
                                             className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-200"
                                             title={showPassword ? "Hide password" : "Show password"}
                                        >
                                             {showPassword ? (
                                                  <EyeOff className="w-5 h-5" />
                                             ) : (
                                                  <Eye className="w-5 h-5" />
                                             )}
                                        </button>
                                   </div>
                                   {getErrorMessage("password") && (
                                        <p className="mt-1 text-xs text-red-600">{getErrorMessage("password")}</p>
                                   )}
                                   </div>



                              {fieldVisibility.joiningDate && fieldVisibility.joiningDate.visible && (
                                   <div className="md:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                             Joining Date {fieldVisibility.joiningDate.required && <span className="text-red-600">*</span>}
                                        </label>
                                        <SingleDatePicker
                                             value={joiningDateToIso(newUser.joining_date) || newUser.joining_date}
                                             onChange={(iso) => handleFieldChange(
                                                  "joining_date",
                                                  iso,
                                                  fieldVisibility.joiningDate.required ? validateJoiningDate : undefined
                                             )}
                                             placeholder="dd/mm/yyyy"
                                             hasError={hasError("joining_date")}
                                        />
                                        {getErrorMessage("joining_date") && (
                                             <p className="mt-1 text-xs text-red-600">{getErrorMessage("joining_date")}</p>
                                        )}
                                   </div>
                              )}

                              {/* Tenure Field - Only for Agents */}
                              {fieldVisibility.tenure && fieldVisibility.tenure.visible && (
                                   <div className="md:col-span-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                             Tenure {fieldVisibility.tenure.required && <span className="text-red-600">*</span>}
                                        </label>
                                        <input
                                             type="number"
                                             step="0.1"
                                             min="0.1"
                                             className={`block w-full px-3 py-3 text-sm bg-gray-50 border ${hasError("tenure") ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                             placeholder="e.g. 1.5"
                                             value={newUser.tenure ?? ""}
                                             onChange={(e) => handleFieldChange("tenure", e.target.value, validateTenure)}
                                             onBlur={() => handleFieldBlur("tenure", validateTenure)}
                                             required={fieldVisibility.tenure.required && !isEditMode}
                                        />
                                        {getErrorMessage("tenure") && (
                                             <p className="mt-1 text-xs text-red-600">{getErrorMessage("tenure")}</p>
                                        )}
                                   </div>
                              )}

                              {/* Address - Optional field */}
                              <div className="md:col-span-1">
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Address
                                   </label>
                                   <textarea
                                        className="block w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-12 resize-none"
                                        placeholder="Street, City, State, ZIP"
                                        value={newUser.address || ""}
                                        onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                                   />
                              </div>

                              {/* Profile Picture Upload Section */}
                              <div className="md:col-span-1">
                                   <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Profile Picture
                                   </label>
                                   <div className="flex items-center gap-4">
                                        {/* Circular Preview Area */}
                                        <div className="relative">
                                             <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                                                  {profilePreview ? (
                                                       <>
                                                            <img src={profilePreview} alt="Profile preview" className="w-full h-full object-cover" />
                                                            <button type="button" onClick={handleRemoveProfilePicture} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                                                                 <XCircle className="w-4 h-4" />
                                                            </button>
                                                       </>
                                                  ) : (
                                                       <div className="text-center p-2">
                                                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                                            <span className="text-xs text-gray-500">No image</span>
                                                       </div>
                                                  )}
                                             </div>
                                        </div>
                                        {/* Action Buttons for Upload */}
                                        <div className="flex-1">
                                             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                             <button type="button" onClick={triggerFileInput} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded text-sm font-semibold hover:bg-blue-100 transition-colors flex items-center gap-2 mb-2">
                                                  <Upload className="w-4 h-4" />
                                                  {profilePreview ? "Change Image" : "Upload Image"}
                                             </button>
                                             {fileName && <p className="text-xs text-gray-600 mt-1">Selected: <span className="font-medium">{fileName}</span></p>}
                                        </div>
                                   </div>
                              </div>
                         </div>
                    </div>

                    {/* Modal Footer - Submit Actions */}
                    <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                         <button
                              onClick={handleSubmit}
                              disabled={isSubmitting}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                         >
                              {isSubmitting ? (
                                   <>
                                        {/* Loading Spinner */}
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        {isEditMode ? "Updating..." : "Creating..."}
                                   </>
                              ) : (
                                   isEditMode ? "Update User" : "Create User"
                              )}
                         </button>
                    </div>
               </div>
          </div>
     );
};

export default AddUserFormModal;