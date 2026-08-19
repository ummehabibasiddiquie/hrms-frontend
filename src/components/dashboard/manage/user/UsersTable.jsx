import React from "react";
import {
  Trash2,
  Edit,
  Mail,
  User,
  Briefcase,
  UserCheck,
  UserX,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";

const UsersTable = ({
  users,
  handleDeleteUser,
  openEditUserModal,
  handleToggleStatus,
  readOnly = false
}) => {
  useAuth();

  // Capitalize first letter utility
  const capitalize = (str) =>
    typeof str === "string" && str.length > 0
      ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
      : str;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white">
            <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide">User</th>
            <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide">Designation</th>
            <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide">Reporting To</th>
            <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-center">Role</th>
            <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-center">Status</th>
            <th className="px-6 py-4 text-sm font-bold uppercase tracking-wide text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {users.map((u) => {
            const roleLabel = capitalize((u.role || "").replace("_", " "));
            const rowKey = u.user_id || u.id || u.email;
            const isActive = (u.is_active !== undefined && u.is_active !== null) ? Number(u.is_active) : 1;
            
            return (
              <tr key={rowKey} className="hover:bg-blue-50 transition-colors duration-150">
                {/* User Column with Avatar */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {u.profile_image ? (
                        <img
                          src={u.profile_image}
                          alt={u.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-blue-200">
                          {(() => {
                            if (!u.name) return "?";
                            const parts = u.name.split(" ");
                            if (parts.length >= 2) {
                              return (parts[0][0] + parts[1][0]).toUpperCase();
                            }
                            return u.name.substring(0, 2).toUpperCase();
                          })()}
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        isActive === 1 ? "bg-green-500" : "bg-gray-400"
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{capitalize(u.name)}</div>
                      <div className="flex items-center gap-1 text-xs text-blue-600 mt-0.5">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{u.email ? u.email.toLowerCase() : <span className="text-slate-400 italic">No Email</span>}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Designation Column */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-1.5 rounded-lg">
                      <Briefcase className="w-4 h-4 text-blue-700" />
                    </div>
                    <span className="text-sm text-slate-700 font-medium">{capitalize(u.designation) || "-"}</span>
                  </div>
                </td>

                {/* Reporting To Column */}
                <td className="px-6 py-4">
                  {(() => {
                    const role = (u.role || "").toUpperCase();
                    
                    const renderNames = (namesArray) => {
                      if (!namesArray || namesArray.length === 0) return <span className="text-slate-400 text-xs italic">-</span>;
                      return (
                        <div className="flex flex-wrap gap-1">
                          {namesArray.map((name, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                              {capitalize(name)}
                            </span>
                          ))}
                        </div>
                      );
                    };
                    
                    const parseNamesString = (namesStr) => {
                      if (!namesStr) return [];
                      return namesStr.split(',').map(name => name.trim()).filter(Boolean);
                    };
                    
                    const findUserByRole = (targetRole) => {
                      const normalizedRole = targetRole.toUpperCase().replace(/[_\s]/g, '');
                      const found = users.find(user => {
                        const userRole = (user.role || "").toUpperCase().replace(/[_\s]/g, '');
                        return userRole === normalizedRole;
                      });
                      return found ? capitalize(found.name || found.user_name) : null;
                    };
                    
                    if (["SUPER_ADMIN", "SUPERADMIN", "SUPER ADMIN"].includes(role.replace(/[_\s]/g, ''))) {
                      return <span className="text-slate-400 text-xs italic">-</span>;
                    }
                    
                    if (["ADMIN"].includes(role)) {
                      const superAdminName = findUserByRole("SUPER_ADMIN");
                      return superAdminName ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">{superAdminName}</span>
                      ) : <span className="text-slate-400 text-xs italic">-</span>;
                    }
                    
                    if (["PROJECT_MANAGER", "PROJECTMANAGER"].includes(role.replace(/[_\s]/g, ''))) {
                      const adminName = findUserByRole("ADMIN");
                      return adminName ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">{adminName}</span>
                      ) : <span className="text-slate-400 text-xs italic">-</span>;
                    }
                    
                    if (["ASSISTANT_MANAGER", "ASSISTANTMANAGER", "ASSISTANT MANAGER"].includes(role.replace(/[_\s]/g, ''))) {
                      if (u.project_manager_names) {
                        const names = parseNamesString(u.project_manager_names);
                        if (names.length > 0) return renderNames(names);
                      }
                      if (u.project_managers && Array.isArray(u.project_managers) && u.project_managers.length > 0) {
                        const names = u.project_managers.map(pm => pm.user_name || pm.name).filter(Boolean);
                        if (names.length > 0) return renderNames(names);
                      }
                      return <span className="text-slate-400 text-xs italic">-</span>;
                    }
                    
                    if (["QA", "QA_AGENT", "QAAGENT", "QA AGENT", "AGENT"].includes(role.replace(/[_\s]/g, ''))) {
                      if (u.asst_manager_names) {
                        const names = parseNamesString(u.asst_manager_names);
                        if (names.length > 0) return renderNames(names);
                      }
                      if (u.asst_managers && Array.isArray(u.asst_managers) && u.asst_managers.length > 0) {
                        const names = u.asst_managers.map(am => am.user_name || am.name).filter(Boolean);
                        if (names.length > 0) return renderNames(names);
                      }
                      return <span className="text-slate-400 text-xs italic">-</span>;
                    }
                    
                    return <span className="text-slate-400 text-xs italic">-</span>;
                  })()}
                </td>

                {/* Role Badge Column */}
                <td className="px-6 py-4 text-center">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                    {roleLabel || "-"}
                  </span>
                </td>

                {/* Status Toggle Column */}
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => !readOnly && handleToggleStatus(u)}
                      disabled={readOnly}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm ${
                        isActive === 1
                          ? "bg-green-500 focus:ring-green-500"
                          : "bg-gray-300 focus:ring-gray-400"
                      } ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                      title={readOnly ? "View only access" : (isActive === 1 ? "Active - Click to deactivate" : "Inactive - Click to activate")}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          isActive === 1 ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    {isActive === 1 ? (
                      <UserCheck className="w-4 h-4 text-green-600" />
                    ) : (
                      <UserX className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </td>

                {/* Actions Column */}
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {readOnly ? (
                      <>
                        <div className="p-2 opacity-50 cursor-not-allowed bg-blue-50 rounded-lg" title="View only access">
                          <Edit className="w-4 h-4 text-blue-300" />
                        </div>
                        <div className="p-2 opacity-50 cursor-not-allowed bg-red-50 rounded-lg" title="View only access">
                          <Trash2 className="w-4 h-4 text-red-300" />
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEditUserModal(u)}
                          className="p-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Edit User"
                          aria-label="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Delete User"
                          aria-label="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UsersTable;