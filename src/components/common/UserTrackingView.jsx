import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Filter, Shield, CheckCircle2, XCircle, UserCog, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import SearchableSelect from './SearchableSelect';

const UserTrackingView = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [roleOptions, setRoleOptions] = useState([]);
  const [updatingPermission, setUpdatingPermission] = useState(null);

  // Fetch users and roles on mount
  useEffect(() => {
    fetchUsers();
    fetchRoleDropdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch users by role when roleFilter changes (except 'all')
  useEffect(() => {
    if (roleFilter === 'all') {
      fetchUsers();
    } else {
      fetchUsersByRole(roleFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  // Fetch users by role
  const fetchUsersByRole = async (roleId) => {
    try {
      setLoading(true);
      const selectedRole = roleOptions.find(opt => String(opt.role_id) === String(roleId));
      const roleLabel = selectedRole ? selectedRole.label : '';
      if (!user?.user_id || !roleLabel) {
        setUsers([]);
        setLoading(false);
        return;
      }
      const response = await api.post('/permission/user_list', {
        logged_in_user_id: user.user_id,
        role: roleLabel
      });
      let userArray = [];
      if (response.data?.status === 200) {
        const innerData = response.data.data;
        if (Array.isArray(innerData)) {
          userArray = innerData;
        } else if (innerData && Array.isArray(innerData.users)) {
          userArray = innerData.users;
        } else if (innerData && Array.isArray(innerData.user_list)) {
          userArray = innerData.user_list;
        } else {
          for (const key in innerData) {
            if (Array.isArray(innerData[key])) {
              userArray = innerData[key];
              break;
            }
          }
        }
        setUsers(userArray);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users by role:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch role dropdown data from API
  const fetchRoleDropdown = async () => {
    try {
      const response = await api.post('/dropdown/get', { dropdown_type: 'user roles' });
      if (response.data?.status === 200 && Array.isArray(response.data.data)) {
        setRoleOptions(response.data.data);
      } else {
        setRoleOptions([]);
      }
    } catch (error) {
      console.error('Error fetching role dropdown:', error);
      setRoleOptions([]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Log user_id and token for debugging
      const token = sessionStorage.getItem('tfs_auth_token');
      console.log('Sending user_id:', user?.user_id, 'Token:', token);

      if (!user?.user_id) {
        toast.error('User ID missing. Please login again.');
        setUsers([]);
        setLoading(false);
        return;
      }

      const response = await api.post('/permission/user_list', {
        logged_in_user_id: user.user_id
      });

      console.log('API /permission/user_list response:', response.data);
      console.log('API /permission/user_list inner data:', response.data?.data);
      let userArray = [];
      if (response.data?.status === 200) {
        const innerData = response.data.data;
        if (Array.isArray(innerData)) {
          userArray = innerData;
        } else if (innerData && Array.isArray(innerData.users)) {
          userArray = innerData.users;
        } else if (innerData && Array.isArray(innerData.user_list)) {
          userArray = innerData.user_list;
        } else {
          // Try to find any array property
          for (const key in innerData) {
            if (Array.isArray(innerData[key])) {
              userArray = innerData[key];
              break;
            }
          }
        }
        if (userArray.length > 0) {
          setUsers(userArray);
        } else {
          toast.error('API returned success but no user array found.');
          setUsers([]);
        }
      } else {
        toast.error('Failed to load users');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter users: search only by name and email (role filter now handled by API)
  const filteredUsers = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    return safeUsers.filter(userData => {
      return (
        userData.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        userData.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [users, searchQuery]);

  // Handle permission toggle
  const handlePermissionToggle = async (targetUserId, permissionType, currentValue) => {
    const permissionKey = `${targetUserId}-${permissionType}`;
    setUpdatingPermission(permissionKey);

    try {
      // Find the target user to get both permission values
      const targetUser = users.find(u => u.user_id === targetUserId);
      
      const payload = {
        user_id: user.user_id,
        target_user_id: targetUserId,
        project_creation_permission: permissionType === 'project' 
          ? (currentValue === 1 ? 0 : 1) 
          : (targetUser?.project_creation_permission || 0),
        user_creation_permission: permissionType === 'user' 
          ? (currentValue === 1 ? 0 : 1) 
          : (targetUser?.user_creation_permission || 0)
      };

      const response = await api.post('/permission/update', payload);
      
      if (response.data) {
        // Update local state
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.user_id === targetUserId 
              ? {
                  ...u,
                  [permissionType === 'project' ? 'project_creation_permission' : 'user_creation_permission']: currentValue === 1 ? 0 : 1
                }
              : u
          )
        );
        toast.success(`Permission ${currentValue === 1 ? 'revoked' : 'granted'} successfully!`);
      }
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error(error.response?.data?.message || 'Failed to update permission');
    } finally {
      setUpdatingPermission(null);
    }
  };

  // Format role options for SearchableSelect
  const formattedRoleOptions = [
    { value: 'all', label: 'All Roles' },
    ...roleOptions.map(role => ({ value: String(role.role_id), label: role.label }))
  ];

  // Calculate statistics
  const stats = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    return {
      totalUsers: safeUsers.length,
      userCreationEnabled: safeUsers.filter(u => u.user_creation_permission === 1).length,
      projectCreationEnabled: safeUsers.filter(u => u.project_creation_permission === 1).length,
      bothPermissionsEnabled: safeUsers.filter(u => u.user_creation_permission === 1 && u.project_creation_permission === 1).length
    };
  }, [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">User Permissions Manager</h2>
                <p className="text-blue-100 text-sm mt-1">Control and monitor user access rights across the platform</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
              <Shield className="w-5 h-5" />
              <span className="font-semibold">{stats.totalUsers} Users</span>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Users */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">Total Users</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalUsers}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <Users className="w-7 h-7 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Active in system</p>
            </div>
          </div>

          {/* User Creation Permission */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">User Creation</p>
                <p className="text-3xl font-bold text-green-600">{stats.userCreationEnabled}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                <UserCog className="w-7 h-7 text-green-600" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Users with permission</p>
            </div>
          </div>

          {/* Project Creation Permission */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">Project Creation</p>
                <p className="text-3xl font-bold text-purple-600">{stats.projectCreationEnabled}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                <Activity className="w-7 h-7 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Users with permission</p>
            </div>
          </div>

          {/* Full Access */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">Full Access</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.bothPermissionsEnabled}</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-indigo-600" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Both permissions enabled</p>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Search Users
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-all font-medium"
                />
              </div>
            </div>

            {/* Role Filter Dropdown */}
            <div className="w-full lg:w-64">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Filter by Role
              </label>
              <SearchableSelect
                value={roleFilter}
                onChange={setRoleFilter}
                options={formattedRoleOptions}
                icon={Filter}
                placeholder="All Roles"
                isClearable={false}
              />
            </div>
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg text-center py-20 border border-slate-200">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Users Found</h3>
            <p className="text-slate-500 text-sm font-medium">Try adjusting your search criteria or filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700">
                    <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                      User Details
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Email Address
                    </th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-2">
                        <UserCog className="w-4 h-4" />
                        User Creation
                      </div>
                    </th>
                    <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-2">
                        <Activity className="w-4 h-4" />
                        Project Creation
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((userData, index) => (
                    <tr 
                      key={userData.user_id} 
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 group"
                    >
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-700">{index + 1}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {userData.user_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{userData.user_name}</div>
                            {userData.designation && (
                              <div className="text-xs text-slate-500 font-medium mt-0.5">{userData.designation}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="text-sm text-slate-600 font-medium">{userData.user_email}</span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-bold shadow-sm border-2 ${
                          userData.role === 'Admin' 
                            ? 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200' 
                            : userData.role === 'Manager' 
                            ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200' 
                            : 'bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200'
                        }`}>
                          {userData.role}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handlePermissionToggle(userData.user_id, 'user', userData.user_creation_permission)}
                            disabled={updatingPermission === `${userData.user_id}-user`}
                            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 ${
                              userData.user_creation_permission === 1 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                                : 'bg-gradient-to-r from-slate-300 to-slate-400'
                            }`}
                            title={userData.user_creation_permission === 1 ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                          >
                            <span
                              className={`inline-flex items-center justify-center h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                                userData.user_creation_permission === 1 ? 'translate-x-9' : 'translate-x-1'
                              }`}
                            >
                              {userData.user_creation_permission === 1 ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-400" />
                              )}
                            </span>
                          </button>
                          {updatingPermission === `${userData.user_id}-user` && (
                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handlePermissionToggle(userData.user_id, 'project', userData.project_creation_permission)}
                            disabled={updatingPermission === `${userData.user_id}-project`}
                            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 ${
                              userData.project_creation_permission === 1 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                                : 'bg-gradient-to-r from-slate-300 to-slate-400'
                            }`}
                            title={userData.project_creation_permission === 1 ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                          >
                            <span
                              className={`inline-flex items-center justify-center h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                                userData.project_creation_permission === 1 ? 'translate-x-9' : 'translate-x-1'
                              }`}
                            >
                              {userData.project_creation_permission === 1 ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-400" />
                              )}
                            </span>
                          </button>
                          {updatingPermission === `${userData.user_id}-project` && (
                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with Results Count */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 border-t-2 border-slate-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                  <p className="text-sm text-slate-700 font-semibold">
                    Showing <span className="text-blue-700 font-bold">{filteredUsers.length}</span> of <span className="text-blue-700 font-bold">{stats.totalUsers}</span> users
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wide">Real-time Data</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserTrackingView;