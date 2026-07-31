import React, { useState, useMemo, useEffect } from "react";
import { UserPlus, Key, Users, Plus, Search, Filter, Mail, Phone, Shield, Briefcase, Edit, Trash2 } from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import AddUserFormModal from "./AddUserFormModal";
import EditUserFormModal from "./EditUserFormModal";
import UsersTable from "./UsersTable";
import TaskAssignmentModal from "./TaskAssignmentModal";
import { addUser, updateUser } from "../../../../services/authService";
import { toast } from "react-hot-toast";
import { fetchDropdownOptions } from "../../../../services/dropdownApi";
import { useDeviceInfo } from "../../../../hooks/useDeviceInfo";
import DeleteUserModal from "./DeleteUserModal";
import { deleteUser } from "../../../../services/authService";
import LoadingSpinner from "../../../common/LoadingSpinner";
import ErrorMessage from "../../../common/ErrorMessage";
import SearchableSelect from "../../../common/SearchableSelect";
import config from "../../../../config/environment";
import { log, logError } from "../../../../config/environment";
import { useClientPagination } from "../../../../hooks/useClientPagination";
import TablePaginationBar from "../../../common/TablePaginationBar";
import { formatISTDateTime } from "../../../../utils/dateTimeIST";

const apiBaseURL = config.apiBaseUrl;

const ensureImageUrl = (value) => {
     if (!value) return null;
     const trimmed = String(value).trim();
     if (/^(data:|https?:\/\/)/i.test(trimmed)) return trimmed;
     return `${apiBaseURL}/${trimmed.replace(/^\/+/, "")}`;
};

const UsersManagement = ({
     users = [],
     projects = [],
     loading,
     onUpdateUsers,
     pendingRequests = [],
     onResolveRequest,
     loadUsers,
     readOnly = false
}) => {
     const { isSuperAdmin, user: authUser } = useAuth();
     const [assigningUser, setAssigningUser] = useState(null);
     const [isAssigningNewUser, setIsAssigningNewUser] = useState(false);
     const [showUserFormModal, setShowUserFormModal] = useState(false);
     const [editUserId, setEditUserId] = useState(null);
     // Removed editingUserId and isEditMode (update user logic)
     const [userPermissions, setUserPermissions] = useState({
          user_creation_permission: 0,
          project_creation_permission: 0,
     });
     const [formErrors, setFormErrors] = useState({});
     const [profilePreview, setProfilePreview] = useState(null);
     const [profilePictureFile, setProfilePictureFile] = useState(null);
     const [userToDelete, setUserToDelete] = useState(null);
     const [isDeleting, setIsDeleting] = useState(false);
     const [isSubmitting, setIsSubmitting] = useState(false);


     // Dropdown state for roles, designations, managers, QAs, teams
     const [roleOptions, setRoleOptions] = useState([]);
     const [asstManagerOptions, setAsstManagerOptions] = useState([]);
     const [designationOptions, setDesignationOptions] = useState([]);
     const [projectManagerOptions, setProjectManagerOptions] = useState([]);
     const [qaOptions, setQaOptions] = useState([]);
     const [teamOptions, setTeamOptions] = useState([]);
     const [dropdownLoading, setDropdownLoading] = useState(false);

     useEffect(() => {
          const fetchDropdowns = async () => {
               setDropdownLoading(true);
               try {
                    const userId = authUser?.user_id;
                    const [rolesRes, asstMgrRes, projectMgrRes, qaRes, teamRes, designationRes] = await Promise.all([
                         fetchDropdownOptions("user roles", userId),
                         fetchDropdownOptions("assistant manager", userId),
                         fetchDropdownOptions("project manager", userId),
                         fetchDropdownOptions("qa", userId),
                         fetchDropdownOptions("teams", userId),
                         fetchDropdownOptions("designations", userId)
                    ]);
                    setRoleOptions(rolesRes?.data || []);
                    setAsstManagerOptions(asstMgrRes?.data || []);
                    setProjectManagerOptions(projectMgrRes?.data || []);
                    setQaOptions(qaRes?.data || []);
                    setTeamOptions(teamRes?.data || []);
                    setDesignationOptions(designationRes?.data || []);
               } catch (err) {
                    toast.error("Failed to load dropdowns");
               } finally {
                    setDropdownLoading(false);
               }
          };
          fetchDropdowns();
     }, []);

     const deviceInfo = useDeviceInfo();

     // Check permissions on component mount
     useEffect(() => {
          const userData = JSON.parse(sessionStorage.getItem("user") || "{}");
          if (userData) {
               setUserPermissions({
                    user_creation_permission: userData.user_creation_permission || 0,
                    project_creation_permission:
                         userData.project_creation_permission || 0,
               });
          }
     }, []);

     const initialNewUserState = {
          role: "",
          password: "",
          designation: "",
          projectManager: "",
          assistantManager: "",
          qualityAnalyst: "",
          projectManagers: [], // Array for multi-select
          assistantManagers: [], // Array for multi-select
          qualityAnalysts: [], // Array for multi-select
          team: "",
          email: "",
          name: "",
          phone: "",
          address: "",
          tenure: "",
          joining_date: "",
          profile_picture: null,
     };

     const [filterUser, setFilterUser] = useState({
          empId: "",
          name: "",
          email: "",
          reportingManager: "",
          role: "",
          assignedTasks: [],
     });

     const [newUser, setNewUser] = useState(initialNewUserState);
     // Edit user modal handlers
     const handleOpenEditUserModal = (user) => {
          console.log('[UsersManagement] Editing user:', user);
          // Set fallback for EditUserFormModal in case backend fetch fails
          if (typeof window !== 'undefined') {
               window.__frontendUserForEdit = user;
          }
          // Always pass user_id for backend API, not id
          setEditUserId(user.user_id || user.id);
     };
     const handleCloseEditUserModal = () => {
          setEditUserId(null);
     };
     // Removed editFormData (update user logic)

     const potentialManagers = useMemo(
          () =>
               users.filter(
                    (u) =>
                         [
                              "Ops Manager",
                              "Asst. Project Manager",
                              "CEO",
                              "Project Manager",
                         ].includes(u.designation || "") ||
                         u.role === "ADMIN" ||
                         u.role === "PROJECT_MANAGER"
               ),
          [users]
     );

     const filteredUsers = useMemo(() => {
          return users.filter((u) => {
               const matchesName = filterUser.name
                    ? u.name?.toLowerCase().includes(filterUser.name.toLowerCase())
                    : true;

               const matchesEmail = filterUser.email
                    ? u.email?.toLowerCase().includes(filterUser.email.toLowerCase())
                    : true;

               // Filter by selected Assistant Manager (exact match by value or name)
               const asstManagerValue = u.assistantManager || u.assistant_manager || u.project_manager_name || u.reportingManager || "";
               const matchesManager = filterUser.reportingManager
                    ? (asstManagerValue === filterUser.reportingManager || asstManagerValue === filterUser.reportingManager?.name)
                    : true;


               // Filter by selected Role (case-insensitive, match value or label)
               const userRole = (u.role || u.user_role || "").toString().toLowerCase();
               const selectedRole = (filterUser.role || "").toString().toLowerCase();
               const matchesRole = selectedRole
                    ? (userRole === selectedRole)
                    : true;

               return matchesName && matchesEmail && matchesManager && matchesRole;
          });
     }, [users, filterUser]);

     const userPagination = useClientPagination(filteredUsers, {
          resetKeys: [filterUser.name, filterUser.email, filterUser.reportingManager, filterUser.role],
     });

     const clearFieldError = (field) => {
          setFormErrors((prev) => {
               if (!prev[field]) return prev;
               const updated = { ...prev };
               delete updated[field];
               return updated;
          });
     };

     // Function to convert image to base64
     // const convertToBase64 = (file) => {
     //      return new Promise((resolve, reject) => {
     //           const reader = new FileReader();
     //           reader.readAsDataURL(file);
     //           reader.onload = () => resolve(reader.result);
     //           reader.onerror = error => reject(error);
     //      });
     // };

     // Handle profile picture change
     const handleProfilePictureChange = async (file) => {
          if (!file) return;

          // Validate file type
          const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
          if (!validTypes.includes(file.type)) {
               toast.error("Please select a valid image file (JPEG, PNG, GIF, WebP)");
               return;
          }

          // Validate file size (2MB max for profile pictures)
          if (file.size > 2 * 1024 * 1024) {
               toast.error("Image size should be less than 2MB");
               return;
          }

          // Create preview URL
          const previewUrl = URL.createObjectURL(file);
          setProfilePreview(previewUrl);

          // Store file object directly for FormData upload
          setProfilePictureFile(file);
          toast.success(`Profile picture selected: ${file.name}`);
          log('[UsersManagement] Profile picture selected:', file.name);
     };

     // Handle profile picture removal
     const handleRemoveProfilePicture = () => {
          if (profilePreview) {
               URL.revokeObjectURL(profilePreview); // Clean up memory
          }
          setProfilePreview(null);
          setProfilePictureFile(null);
          setNewUser((prev) => ({ ...prev, profile_picture: null }));
     };

     // Clean up preview URLs on unmount
     useEffect(() => {
          return () => {
               if (profilePreview) {
                    URL.revokeObjectURL(profilePreview);
               }
          };
     }, [profilePreview]);

     // Updated handleAddUser function with API call
     const handleAddUser = async () => {
          const errors = {};

          if (!newUser.name?.trim()) {
               errors.name = "Please enter name";
          }

          if (!newUser.email?.trim()) {
               errors.email = "Please enter email";
          } else if (!/^\S+@\S+\.\S+$/.test(newUser.email)) {
               errors.email = "Enter a valid email address";
          }

          if (!newUser.role) {
               errors.role = "Please enter role";
          }

          const roleId = Number(newUser.role);
          if ((roleId === 5 || roleId === 6) && !newUser.joining_date?.trim()) {
               errors.joining_date = "Joining date is required for Agent and QA";
          }

          if (!newUser.password?.trim()) {
               errors.password = "Please enter password";
          } else if (newUser.password.length < 6) {
               errors.password = "Password must be at least 6 characters";
          }

          // Stop here if validation fails
          if (Object.keys(errors).length > 0) {
               setFormErrors(errors);
               return;
          }

          // Clear errors if valid
          setFormErrors({});
          setIsSubmitting(true);

          // Create FormData for multipart/form-data upload
          const formData = new FormData();
          formData.append('user_name', newUser.name);
          formData.append('user_email', newUser.email);
          formData.append('user_password', newUser.password);
          formData.append('role_id', newUser.role);
          formData.append('designation_id', newUser.designation);
          
          // Handle arrays for project_manager, assistant_manager, qa
          const projectManagers = Array.isArray(newUser.projectManagers) && newUser.projectManagers.length > 0
               ? newUser.projectManagers
               : (newUser.projectManager ? [newUser.projectManager] : []);
          const assistantManagers = Array.isArray(newUser.assistantManagers) && newUser.assistantManagers.length > 0
               ? newUser.assistantManagers
               : (newUser.assistantManager ? [newUser.assistantManager] : []);
          const qualityAnalysts = Array.isArray(newUser.qualityAnalysts) && newUser.qualityAnalysts.length > 0
               ? newUser.qualityAnalysts
               : (newUser.qualityAnalyst ? [newUser.qualityAnalyst] : []);
          
          log('[UsersManagement] Project Managers array:', projectManagers);
          log('[UsersManagement] Assistant Managers array:', assistantManagers);
          log('[UsersManagement] Quality Analysts array:', qualityAnalysts);
          
          // Append arrays as JSON strings
          formData.append('project_manager', JSON.stringify(projectManagers));
          formData.append('assistant_manager', JSON.stringify(assistantManagers));
          formData.append('qa', JSON.stringify(qualityAnalysts));
          
          formData.append('team', newUser.team || '');
          formData.append('user_number', newUser.phone || '');
          formData.append('user_address', newUser.address || '');
          formData.append('user_tenure', newUser.tenure || '');
          if (newUser.joining_date) {
               formData.append('joining_date', newUser.joining_date);
          }
          formData.append('device_id', deviceInfo.device_id);
          formData.append('device_type', deviceInfo.device_type);

          // Add profile picture file if selected
          if (profilePictureFile) {
               formData.append('profile_picture', profilePictureFile);
               log('[UsersManagement] Uploading profile picture:', profilePictureFile.name);
          }

          try {
               log('[UsersManagement] Creating user with FormData');
               const response = await addUser(formData);

               if (response.status === 200 || response.status === 201) {
                    setShowUserFormModal(false);

                    // Show success message
                    toast.success("User created successfully!", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });

                    // Reset form and close modal
                    setNewUser(initialNewUserState);
                    handleRemoveProfilePicture(); // Clear profile picture
                    
                    // Clear all filters to ensure new user is visible
                    setFilterUser({
                         empId: "",
                         name: "",
                         email: "",
                         reportingManager: "",
                         role: "",
                         assignedTasks: [],
                    });
                    
                    // Refresh the users list after a brief delay to ensure backend is updated
                    setTimeout(() => {
                         log('[UsersManagement] Refreshing users list after add');
                         loadUsers();
                    }, 500);
               } else {
                    throw new Error(response.message || "Failed to create user");
               }
          } catch (error) {
               console.error("Error adding user:", error);
               console.error("Full error object:", JSON.stringify(error, null, 2));
               console.error("Response status:", error.response?.status);
               console.error("Response data:", error.response?.data);
               console.error("Response headers:", error.response?.headers);
               
               // Extract error message from response
               const errorMessage = error.response?.data?.message 
                    || error.response?.data?.error 
                    || error.message 
                    || "Failed to create user";
               
               toast.error(`Error: ${errorMessage}`, {
                    className: "toast-error toast-animate",
                    duration: 6000,
               });
          } finally {
               setIsSubmitting(false);
          }
     };

     const handleCloseUserModal = () => {
          setShowUserFormModal(false);
          setFormErrors({});
          setNewUser(initialNewUserState);
          setProfilePictureFile(null);
          setProfilePreview(null);
          handleRemoveProfilePicture();
     };

     // Open user form modal
     const openUserFormModal = async () => {
          setNewUser(initialNewUserState);
          setProfilePictureFile(null);
          setProfilePreview(null);
          setFormErrors({});
          setShowUserFormModal(true);
          // fetchDropdowns is already called on mount, so no need to call again
     };

     // Removed openEditUserModal (update user logic)

     // Removed handleUpdateUser (update user logic)

     const handleDeleteUser = (targetUser) => {
          // Allow delete if: SuperAdmin OR ADMIN-like role OR explicit delete_permission = 1
          const authRoleCandidates = [
               String(authUser?.role || ""),
               String(authUser?.role_name || ""),
               String(authUser?.user_role || ""),
          ].map((r) => r.trim().toUpperCase());

          const isAdminLike = authRoleCandidates.includes("ADMIN");

          const canDeleteExplicit = Number(userPermissions?.delete_permission) === 1;
          const canDelete = isSuperAdmin || isAdminLike || canDeleteExplicit;

          if (!canDelete) {
               toast.error("You don't have permission to delete users");
               return;
          }

          setUserToDelete(targetUser);
     };

     const confirmDeleteUser = async () => {
          if (!userToDelete) return;

          try {
               setIsDeleting(true);

               const res = await deleteUser(userToDelete.id, {
                    device_id: deviceInfo.device_id,
                    device_type: deviceInfo.device_type,
                    device_name: deviceInfo.device_name,
               });

               const statusCode = res?.status ?? res?.data?.status;
               const isSuccess =
                    statusCode === 200 ||
                    statusCode === 201 ||
                    statusCode === 204 ||
                    statusCode === "success";

               if (isSuccess) {
                    toast.success("User deleted successfully!", {
                         className: "toast-success toast-animate",
                         duration: 4000,
                    });
                    setUserToDelete(null);

                    // 🔁 Refresh list from backend
                    loadUsers();
               } else {
                    throw new Error(res.message);
               }
          } catch (err) {
               console.error(err);
               toast.error("Failed to delete user");
          } finally {
               setIsDeleting(false);
          }
     };

     // Toggle user active/inactive status
     const handleToggleStatus = async (user) => {
          try {
               console.log('[UsersManagement] User object received:', JSON.stringify(user, null, 2));
               
               // Get user_id from various possible fields
               const userId = user.user_id || user.id;
               
               console.log('[UsersManagement] Extracted userId:', userId);
               
               if (!userId) {
                    logError('[UsersManagement] User ID not found in user object:', user);
                    toast.error('Unable to update user: User ID not found');
                    return;
               }
               
               // Convert to number and handle both undefined and actual 0 values
               const currentStatus = (user.is_active !== undefined && user.is_active !== null) 
                    ? Number(user.is_active) 
                    : 1;
               const newStatus = currentStatus === 1 ? 0 : 1;
               const userName = user.user_name || user.name || user.email || 'User';
               log('[UsersManagement] Toggling user status for:', userName, 'userId:', userId, 'from:', currentStatus, 'to:', newStatus);
               
               // Convert payload to FormData
               const formData = new FormData();
               formData.append('user_id', String(userId));
               formData.append('device_id', deviceInfo.device_id || 'web');
               formData.append('device_type', deviceInfo.device_type || 'Laptop');
               formData.append('is_active', String(newStatus));
               
               console.log('[UsersManagement] Update FormData created with:');
               console.log('  - user_id:', String(userId));
               console.log('  - device_id:', deviceInfo.device_id || 'web');
               console.log('  - device_type:', deviceInfo.device_type || 'Laptop');
               console.log('  - is_active:', String(newStatus));

               await updateUser(formData);
               
               toast.success(`User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`);
               
               // Reload users list
               if (loadUsers) {
                    loadUsers();
               }
          } catch (error) {
               logError('[UsersManagement] Failed to toggle user status:', error);
               toast.error(error.message || 'Failed to update user status');
          }
     };

     const handleToggleTaskAssignment = (projectId, taskId) => {
          if (!assigningUser) return;

          const currentAssignments = assigningUser.assignedTasks || [];
          const exists = currentAssignments.some(
               (a) => a.projectId === projectId && a.taskId === taskId
          );

          let newAssignments;
          if (exists) {
               newAssignments = currentAssignments.filter(
                    (a) => !(a.projectId === projectId && a.taskId === taskId)
               );
          } else {
               newAssignments = [...currentAssignments, { projectId, taskId }];
          }

          setAssigningUser({ ...assigningUser, assignedTasks: newAssignments });

          const updatedUsers = users.map((u) =>
               u.id === assigningUser.id ? { ...u, assignedTasks: newAssignments } : u
          );

          onUpdateUsers(updatedUsers);
     };

     const handleToggleNewUserTask = (projectId, taskId) => {
          const currentAssignments = newUser.assignedTasks || [];
          const exists = currentAssignments.some(
               (a) => a.projectId === projectId && a.taskId === taskId
          );

          let newAssignments;
          if (exists) {
               newAssignments = currentAssignments.filter(
                    (a) => !(a.projectId === projectId && a.taskId === taskId)
               );
          } else {
               newAssignments = [...currentAssignments, { projectId, taskId }];
          }

          setNewUser({ ...newUser, assignedTasks: newAssignments });
     };

     return (
          <div className="space-y-6 animate-fade-in p-4 md:p-0 overflow-x-hidden">
               {/* Modern Header with Gradient */}
               <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                              <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                                   <Users className="w-6 h-6" />
                              </div>
                              <div>
                                   <h2 className="text-2xl font-bold">User Management</h2>
                                   <p className="text-blue-100 text-sm">Manage team members and permissions</p>
                              </div>
                         </div>
                         <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
                              <Shield className="w-5 h-5" />
                              <span className="font-semibold">{filteredUsers.length} Users</span>
                         </div>
                    </div>
               </div>

               {/* Password Requests Section */}
               {isSuperAdmin && pendingRequests.length > 0 && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-5 shadow-md">
                         <h3 className="text-sm font-bold text-yellow-800 mb-3 flex items-center gap-2">
                              <Key className="w-5 h-5" /> Pending Password Reset Requests
                         </h3>
                         <div className="space-y-3">
                              {pendingRequests.map((req) => (
                                   <div
                                        key={req.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg border border-yellow-100 shadow-sm hover:shadow-md transition-shadow gap-3 sm:gap-0"
                                   >
                                        <div className="text-sm">
                                             <span className="font-bold text-slate-700">
                                                  {req.email}
                                             </span>
                                             <span className="text-slate-500 mx-2">•</span>
                                             <span className="text-blue-600 font-medium">
                                                  {req.email}
                                             </span>
                                             <span className="text-slate-400 ml-2 block sm:inline text-xs">
                                                  {formatISTDateTime(req.timestamp)}
                                             </span>
                                        </div>
                                        <button
                                             onClick={() => onResolveRequest(req)}
                                             className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm px-4 py-2 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg self-end sm:self-center"
                                        >
                                             Reset & Notify
                                        </button>
                                   </div>
                              ))}
                         </div>
                    </div>
               )}

               {/* Modern Filter Bar */}
               <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                         <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-lg">
                              <Filter className="w-5 h-5 text-white" />
                         </div>
                         <h3 className="text-lg font-bold text-slate-800">Filter Users</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                         <div className="col-span-1">
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                   Full Name
                              </label>
                              <input
                                   type="text"
                                   className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                   placeholder="e.g. John Doe"
                                   value={filterUser.name}
                                   onChange={(e) => setFilterUser({ ...filterUser, name: e.target.value })}
                                   required
                              />
                         </div>
                         <div className="col-span-1">
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                   Email
                              </label>
                              <input
                                   type="email"
                                   className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                   placeholder="user@co.com"
                                   value={filterUser.email}
                                   onChange={(e) =>
                                        setFilterUser({ ...filterUser, email: e.target.value })
                                   }
                              />
                         </div>
                         <div className="col-span-1">
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                   Assistant Manager
                              </label>
                              <SearchableSelect
                                   value={filterUser.reportingManager}
                                   onChange={(value) => setFilterUser({ ...filterUser, reportingManager: value })}
                                   options={[
                                        { value: '', label: 'All Managers' },
                                        ...asstManagerOptions.map((mgr, idx) => ({
                                             value: mgr.value || mgr.name || mgr.id,
                                             label: mgr.label || mgr.name || mgr.value
                                        }))
                                   ]}
                                   icon={Briefcase}
                                   placeholder="Select Manager"
                              />
                         </div>
                         <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                   Role
                              </label>
                              <SearchableSelect
                                   value={filterUser.role}
                                   onChange={(value) => setFilterUser({ ...filterUser, role: value })}
                                   options={[
                                        { value: '', label: 'All Roles' },
                                        ...roleOptions.map((role, idx) => ({
                                             value: role.value || role.name || role.id,
                                             label: role.label || role.name || role.value
                                        }))
                                   ]}
                                   icon={Shield}
                                   placeholder="Select Role"
                              />
                         </div>
                         <div className="flex gap-2 col-span-1">
                              {/* Only show Add User button if user has user_creation_permission = 1 and not in readOnly mode */}
                              {userPermissions.user_creation_permission === 1 && !readOnly && (
                                   <button
                                        onClick={openUserFormModal}
                                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg w-full flex items-center justify-center gap-2"
                                   >
                                        <Plus className="w-4 h-4" /> Add User
                                   </button>
                              )}
                              {readOnly && (
                                   <div className="bg-slate-100 text-slate-400 px-6 py-2.5 rounded-lg text-sm font-medium w-full flex items-center justify-center gap-2 cursor-not-allowed" title="View only access">
                                        <Plus className="w-4 h-4" /> Add User (View Only)
                                   </div>
                              )}
                         </div>
                    </div>
               </div>

               {/* Users Content Area */}
               {loading ? (
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12">
                         <div className="flex flex-col items-center justify-center">
                              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                              <p className="text-slate-600 font-medium">Loading users...</p>
                         </div>
                    </div>
               ) : filteredUsers.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12">
                         <div className="text-center">
                              <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                   <Users className="w-10 h-10 text-slate-400" />
                              </div>
                              <h3 className="text-lg font-bold text-slate-700 mb-2">No users found</h3>
                              <p className="text-slate-500">Try adjusting your filters or add a new user</p>
                         </div>
                    </div>
               ) : (
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                         <UsersTable
                              users={userPagination.pagedItems}
                              handleDeleteUser={handleDeleteUser}
                              openEditUserModal={handleOpenEditUserModal}
                              handleToggleStatus={handleToggleStatus}
                              readOnly={readOnly}
                         />
                         <TablePaginationBar {...userPagination} itemLabel="users" />
                    </div>
               )}

               {/* Add User Modal */}
               {showUserFormModal && (
                    <AddUserFormModal
                         newUser={newUser}
                         setNewUser={setNewUser}
                         handleAddUser={handleAddUser}
                         roles={roleOptions}
                         projectManagers={projectManagerOptions}
                         assistantManagers={asstManagerOptions}
                         qas={qaOptions}
                         teams={teamOptions}
                         designations={designationOptions}
                         isDropdownLoading={dropdownLoading}
                         isSuperAdmin={isSuperAdmin}
                         isSubmitting={isSubmitting}
                         formErrors={formErrors}
                         clearFieldError={clearFieldError}
                         handleCloseUserModal={handleCloseUserModal}
                         handleProfilePictureChange={handleProfilePictureChange}
                         handleRemoveProfilePicture={handleRemoveProfilePicture}
                         profilePreview={profilePreview}
                    />
               )}
               {/* Edit User Modal */}
               {editUserId && (
                    <EditUserFormModal
                         userId={editUserId}
                         isOpen={!!editUserId}
                         onClose={handleCloseEditUserModal}
                         onUserUpdated={loadUsers}
                         deviceId={deviceInfo.device_id}
                         deviceType={deviceInfo.device_type}
                         isSuperAdmin={isSuperAdmin}
                    />
               )}

               {/* Task Assignment Modal */}
               {(assigningUser || isAssigningNewUser) && (
                    <TaskAssignmentModal
                         assigningUser={assigningUser}
                         isAssigningNewUser={isAssigningNewUser}
                         projects={projects}
                         newUser={newUser}
                         onToggleTaskAssignment={handleToggleTaskAssignment}
                         onToggleNewUserTask={handleToggleNewUserTask}
                         onClose={() => {
                              setAssigningUser(null);
                              setIsAssigningNewUser(false);
                         }}
                    />
               )}

               {/* Delete Modal */}
               {userToDelete && (
                    <DeleteUserModal
                         user={userToDelete}
                         onClose={() => setUserToDelete(null)}
                         onConfirm={confirmDeleteUser}
                         isDeleting={isDeleting}
                    />
               )}

          </div>
     );
};

export default UsersManagement;