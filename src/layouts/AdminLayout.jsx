import React from "react";
import { Settings, RefreshCw, Users, FolderKanban, File, FolderOpen, Shield, Calendar } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const AdminLayout = ({
     children,
     activeTab,
     setActiveTab,
     onFactoryReset,
}) => {
     const { canManageUsers, canManageProjects, isSuperAdmin, user } = useAuth();

     const showUsersTab = canManageUsers;
     const showProjectsTab = canManageProjects;
     const showRosterTab = user && [2, 3, 4].includes(Number(user.role_id)); // Admin, Project Manager, Assistant Manager
     
     // Debug: Log role and tab visibility
     console.log('🔍 AdminLayout - Role Detection:', { 
       user, 
       roleId: user?.role_id, 
       showRosterTab,
       'role_id type': typeof user?.role_id,
       'Number(roleId)': Number(user?.role_id),
       'includes check': [2, 3, 4].includes(Number(user?.role_id)),
       'canManageUsers': canManageUsers,
       'canManageProjects': canManageProjects,
       'isSuperAdmin': isSuperAdmin
     });
     
     // Also log to window for easier debugging
     window.debugAdminLayout = {
       user, 
       roleId: user?.role_id, 
       showRosterTab,
       'role_id type': typeof user?.role_id,
       'Number(roleId)': Number(user?.role_id),
       'includes check': [2, 3, 4].includes(Number(user?.role_id))
     };
     console.log('🔍 Debug data available in window.debugAdminLayout');

     return (
               <div className="max-w-7xl mx-auto space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                         {/* Header */}
                         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                              <div className="flex items-center gap-3">
                                   <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                        <Settings className="w-6 h-6" />
                                   </div>
                                   <div>
                                        <h2 className="text-xl font-bold text-slate-800">
                                             Administration & Management
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                             Manage organization resources, users, and targets.
                                        </p>
                                   </div>
                              </div>
                         </div>

                         {/* Tabs */}
                         {(showUsersTab || showProjectsTab) && (
                              <div className="flex overflow-x-auto border-b border-slate-200 mb-6 scrollbar-hide">
                                   {showUsersTab && (
                                        <button
                                             onClick={() => setActiveTab("users")}
                                             className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                                                  activeTab === "users"
                                                       ? "text-blue-600 bg-blue-50"
                                                       : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                                             }`}
                                        >
                                             <div className="flex items-center justify-center gap-2">
                                                  <Users className="w-4 h-4" />
                                                  <span>User Management</span>
                                             </div>
                                             {activeTab === "users" && (
                                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                                             )}
                                        </button>
                                   )}

                                   {showProjectsTab && (
                                        <button
                                             onClick={() => setActiveTab("projects")}
                                             className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                                                  activeTab === "projects"
                                                       ? "text-blue-600 bg-blue-50"
                                                       : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                                             }`}
                                        >
                                             <div className="flex items-center justify-center gap-2">
                                                  <FolderKanban className="w-4 h-4" />
                                                  <span>Projects & Targets</span>
                                             </div>
                                             {activeTab === "projects" && (
                                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                                             )}
                                        </button>
                                   )}

                                   {showProjectsTab && (
                                        <button
                                             onClick={() => setActiveTab("afd")}
                                             className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                                                  activeTab === "afd"
                                                       ? "text-blue-600 bg-blue-50"
                                                       : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                                             }`}
                                        >
                                             <div className="flex items-center justify-center gap-2">
                                                  <File className="w-4 h-4" />
                                                  <span>AFD Management</span>
                                             </div>
                                             {activeTab === "afd" && (
                                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                                             )}
                                        </button>
                                   )}

                                   {showProjectsTab && (
                                        <button
                                             onClick={() => setActiveTab("category")}
                                             className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                                                  activeTab === "category"
                                                       ? "text-blue-600 bg-blue-50"
                                                       : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                                             }`}
                                        >
                                             <div className="flex items-center justify-center gap-2">
                                                  <FolderOpen className="w-4 h-4" />
                                                  <span>Project Category</span>
                                             </div>
                                             {activeTab === "category" && (
                                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                                             )}
                                        </button>
                                   )}

                                   <button
                                        onClick={() => setActiveTab("permissions")}
                                        className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                                             activeTab === "permissions"
                                                  ? "text-blue-600 bg-blue-50"
                                                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                                        }`}
                                   >
                                        <div className="flex items-center justify-center gap-2">
                                             <Shield className="w-4 h-4" />
                                             <span>User Permission</span>
                                        </div>
                                        {activeTab === "permissions" && (
                                             <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                                        )}
                                   </button>

                                   {/* Roster - Admin, Project Manager, Assistant Manager */}
                                   {showRosterTab && (
                                        <button
                                             onClick={() => setActiveTab("roster")}
                                             className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                                                  activeTab === "roster"
                                                       ? "text-blue-600 bg-blue-50"
                                                       : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                                             }`}
                                        >
                                             <div className="flex items-center justify-center gap-2">
                                                  <Calendar className="w-4 h-4" />
                                                  <span>Roster</span>
                                             </div>
                                             {activeTab === "roster" && (
                                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                                             )}
                                        </button>
                                   )}

                                   {/* Roster Management - Super Admin Only */}
                                   {isSuperAdmin && (
                                        <button
                                             onClick={() => setActiveTab("roster-management")}
                                             className={`flex-1 px-6 py-4 text-sm font-bold transition-all relative ${
                                                  activeTab === "roster-management"
                                                       ? "text-blue-600 bg-blue-50"
                                                       : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                                             }`}
                                        >
                                             <div className="flex items-center justify-center gap-2">
                                                  <Calendar className="w-4 h-4" />
                                                  <span>Roster Management</span>
                                             </div>
                                             {activeTab === "roster-management" && (
                                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                                             )}
                                        </button>
                                   )}
                              </div>
                         )}

                         {/* Content */}
                         <div>{children}</div>
                    </div>
               </div>
          );
     };

     export default AdminLayout;
