/**
 * File: AuthContext.jsx
 * Author: Naitik Maisuriya
 * Description:
 * This file manages authentication and authorization state
 * across the application using React Context API.
 * 
 * It:
 * - Stores logged-in user data in sessionStorage
 * - Provides login and logout functionality
 * - Exposes role-based and permission-based helpers
 * - Makes auth data available to all components
 * - Implements cross-tab login detection (only one active session per browser)
 */

import { createContext, useState, useContext, useMemo, useEffect } from "react";

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {

  // Initialize user state from sessionStorage and normalize user_id
  const [user, setUser] = useState(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsed = JSON.parse(storedUser);
        // Normalize: always have user_id
        if (parsed && !parsed.user_id && parsed.id) {
          parsed.user_id = parsed.id;
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Cross-tab login detection using localStorage as communication channel
  useEffect(() => {
    const handleStorageChange = (e) => {
      // When a new login happens in another tab
      if (e.key === 'new_login_trigger' && e.newValue) {
        try {
          const newLoginData = JSON.parse(e.newValue);
          const currentSessionId = sessionStorage.getItem('session_id');
          const currentUserId = user?.user_id;
          
          // Logout this tab if EITHER:
          // 1. Same user but different session (multiple tabs with same user)
          // 2. Different user (switching users)
          const isDifferentSession = currentSessionId && newLoginData.session_id !== currentSessionId;
          const isDifferentUser = currentUserId && newLoginData.user_id !== currentUserId;
          
          if (isDifferentSession || isDifferentUser) {
            console.log('[Auth] New login detected in another tab:', {
              reason: isDifferentUser ? 'Different user' : 'Different session',
              currentUser: currentUserId,
              newUser: newLoginData.user_id
            });
            
            // Clear session data
            setUser(null);
            sessionStorage.removeItem("user");
            sessionStorage.removeItem("session_id");
            sessionStorage.removeItem("token");
            
            // Show appropriate message
            const message = isDifferentUser 
              ? `You have been logged out because another user (User ID: ${newLoginData.user_id}) logged in.`
              : 'You have been logged out because a new login was detected in another tab.';
            
            alert(message);
            window.location.href = '/login';
          }
        } catch (error) {
          console.error('[Auth] Error handling new login trigger:', error);
        }
      }

      // When logout happens in another tab
      if (e.key === 'logout_trigger' && e.newValue) {
        console.log('[Auth] Logout detected in another tab');
        setUser(null);
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("session_id");
        sessionStorage.removeItem("token");
        window.location.href = '/login';
      }
    };

    // Listen for storage events (only fires in OTHER tabs)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user?.user_id]);

  // Login: save user data in state and sessionStorage, normalize user_id
  const login = (userData) => {
    let normalized = { ...userData };
    if (!normalized.user_id && normalized.id) {
      normalized.user_id = normalized.id;
    }
    
    // Generate unique session ID for this tab
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setUser(normalized);
    sessionStorage.setItem("user", JSON.stringify(normalized));
    sessionStorage.setItem("session_id", sessionId);
    
    // Trigger cross-tab notification using localStorage
    // Include BOTH session_id AND user_id for proper detection
    localStorage.setItem('new_login_trigger', JSON.stringify({
      session_id: sessionId,
      user_id: normalized.user_id,
      email: normalized.email,
      timestamp: Date.now()
    }));
    
    // Clean up the trigger immediately (it's just for event notification)
    setTimeout(() => {
      localStorage.removeItem('new_login_trigger');
    }, 100);
  };

  // Logout: clear user state and sessionStorage
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("session_id");
    sessionStorage.removeItem("token");
    
    // Trigger cross-tab logout notification
    localStorage.setItem('logout_trigger', Date.now().toString());
    setTimeout(() => {
      localStorage.removeItem('logout_trigger');
    }, 100);
  };

  // Generic permission checker (1 = allowed, 0 = denied)
  const hasPermission = (permissionKey) => {
    if (!user) return false;
    return user[permissionKey] === 1;
  };

  // Check if user can perform action (PURE permission-based - NO role restrictions)
  const canPerformAction = (targetUser, action) => {
    if (!user) return false;
    
    // Check permission flags based on action type
    const permissionMap = {
      edit: "user_creation_permission",
      delete: "user_creation_permission",
      create: "user_creation_permission",
      manage_projects: "project_creation_permission",
      edit_project: "project_creation_permission",
      delete_project: "project_creation_permission",
      create_project: "project_creation_permission",
    };

    const permissionKey = permissionMap[action];
    if (!permissionKey) return false;

    // PURE PERMISSION-BASED: If user has the permission flag, they can do the action
    return user[permissionKey] === 1 || user[permissionKey] === "1";
  };

  // Derived permissions based on permission flags from login response
  const permissions = useMemo(() => {
    if (!user) return {};

    // Get role_id for role-based checks - ensure proper type conversion
    const roleId = Number(user.role_id || user.user_role_id || 0);
    const designation = String(user.designation || user.user_designation || '').toLowerCase().trim();
    const roleName = String(user.role_name || user.user_role || '').toLowerCase().trim();

    // Check if user is Admin, Project Manager, or Assistant Manager
    // PRIORITY: roleId check first (most reliable), then fallback to name checks
    const isAdmin = 
      roleId === 1 || 
      roleName === 'admin' || 
      designation === 'admin';
    
    const isProjectManager = 
      roleId === 3 || 
      roleName.includes('project manager') || 
      designation.includes('project manager');
    
    const isAssistantManager = 
      roleId === 4 || 
      designation.includes('assistant') || 
      designation.includes('asst') ||
      roleName.includes('assistant') ||
      roleName.includes('asst');

    // Calculate permissions
    const calculatedPermissions = {
      // Can create/manage users - based on user_creation_permission flag OR Admin role
      canManageUsers:
        user.user_creation_permission === 1 ||
        user.user_creation_permission === "1" ||
        roleId === 1 ||  // Super Admin
        roleId === 2,    // Admin

      // Can create/manage projects - based on project_creation_permission flag OR role
      // Accessible to: Admin (1), Project Manager (3), Assistant Manager (4)
      canManageProjects:
        user.project_creation_permission === 1 ||
        user.project_creation_permission === "1" ||
        roleId === 1 ||  // Admin
        roleId === 3 ||  // Project Manager  
        roleId === 4 ||  // Assistant Manager - EXPLICIT CHECK
        isAdmin ||
        isProjectManager ||
        isAssistantManager,

      // Super Admin check - strictly based on role_id === 1
      isSuperAdmin: roleId === 1,

      // Can view salary details
      canViewSalary:
        String(user.role_name || "").toLowerCase() === "admin" ||
        String(user.user_role || "").toUpperCase() === "FINANCE_HR",
    };

    // Debug logging for permission checks
    console.log('[AuthContext] Permission Check:', {
      userId: user.user_id,
      roleId,
      designation,
      roleName,
      isAdmin,
      isProjectManager,
      isAssistantManager,
      canManageProjects: calculatedPermissions.canManageProjects,
      project_creation_permission: user.project_creation_permission,
      roleIdType: typeof roleId
    });

    return calculatedPermissions;
  }, [user]);

  // Provide auth data and helpers to entire app
  return (
    <AuthContext.Provider
      value={{
        user,          // Logged-in user object
        login,         // Login function
        logout,        // Logout function
        ...permissions,// Derived permission flags
        hasPermission, // Generic permission checker
        canPerformAction, // Column-wise action permission checker
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use Auth Context
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
