import React, { useEffect, useState, useCallback } from "react";
// import AdminLayout from "./AdminLayout";
import UsersManagement from "./UsersManagement";
import ProjectsManagement from ".././project/ProjectsManagement";
import AFDManagement from "../afd/AFDManagement";
import ProjectCategory from "../category/ProjectCategory";
import UserTrackingView from "../../../common/UserTrackingView";
import SuperAdminApproval from "../../../../pages/SuperAdminApproval";
import AssistantManagerRoster from "../../../../pages/AssistantManagerRoster";
import { fetchUsersList } from "../../../../services/authService";
import { fetchProjectsList } from "../../../../services/projectService";
import { useAuth } from "../../../../context/AuthContext";
import { useDeviceInfo } from "../../../../hooks/useDeviceInfo";
import { toast } from "react-hot-toast";

// Keep a single source of truth for API base URL so we can build image URLs
const apiBaseURL = import.meta?.env?.VITE_API_URL;

const normalizeProfilePicture = (value) => {
     if (!value) return null;
     const trimmed = String(value).trim();
     if (/^(data:|https?:\/\/)/i.test(trimmed)) return trimmed;
     return `${apiBaseURL}/${trimmed.replace(/^\/+/, "")}`;
};

const ManageModule = ({ activeTab }) => {
     const [users, setUsers] = useState([]);
     const [projects, setProjects] = useState([]);
     const [loadingUsers, setLoadingUsers] = useState(false);
     const [loadingProjects, setLoadingProjects] = useState(false);
     const hasFetchedUsersRef = React.useRef(false);
     const hasFetchedProjectsRef = React.useRef(false);
     const { user, canManageUsers, canManageProjects } = useAuth();
     const { device_id, device_type } = useDeviceInfo();
     const userId = user?.user_id || user?.id;

     const loadUsers = useCallback(async () => {
          if (!userId) return;
          try {
               setLoadingUsers(true);

               const res = await fetchUsersList(userId, device_id, device_type);

               if (res.status === 200) {
                    const formattedUsers = (res.data || []).map((u) => {
                         const teamId = u.team_id ?? u.team ?? u.user_team_id ?? "";
                         const profileRaw = u.profile_picture || u.profile_image || u.profileImage || "";
                         const password = u.user_password || u.password || u.user_password_plain || u.password_plain || "";

                         return {
                              id: u.user_id,
                              user_id: u.user_id, // Include user_id for API calls
                              name: u.user_name,
                              email: u.user_email,
                              phone: u.user_number,
                              role: (u.role || u.role_name || "").toUpperCase().replace(/\s+/g, "_"),
                              role_id: u.role_id ?? null,
                              designation: u.designation || "",
                              designation_id: u.designation_id ?? null,
                              reportingManager: u.project_manager || "",
                              project_manager_name: u.project_manager || "",
                              project_manager_id: u.project_manager_id ?? null,
                              assistantManager: u.assistant_manager_id ?? u.asst_manager ?? "",
                              qualityAnalyst: u.qa_id ?? u.qa ?? "",
                              team: teamId,
                              team_name: u.team_name || u.team_label || u.team || "",
                              password: password,
                              password_plain: password,
                              address: u.user_address || u.address || u.location || "",
                              tenure: u.user_tenure ?? u.tenure ?? u.user_tenure_years ?? u.total_tenure ?? "",
                              profile_picture: profileRaw || null, // keep raw value for update API
                              profile_picture_url: normalizeProfilePicture(profileRaw),
                              is_active: u.is_active ?? 1,
                              // Include manager fields for reporting hierarchy display
                              asst_manager_names: u.asst_manager_names || u.assistant_manager_names || "",
                              asst_managers: u.asst_managers || u.assistant_managers || [],
                              project_manager_names: u.project_manager_names || "",
                              project_managers: u.project_managers || [],
                              qa_names: u.qa_names || "",
                              qas: u.qas || []
                         };
                    });

                    setUsers(formattedUsers);
               } else {
                    throw new Error(res.message);
               }
          } catch (err) {
               console.error("Fetch users failed", err);
               toast.error("Failed to load users");
          } finally {
               setLoadingUsers(false);
          }
     }, [userId, device_id, device_type]);

     const loadProjects = useCallback(async () => {
          try {
               setLoadingProjects(true);

               const res = await fetchProjectsList(userId);

               if (res.status === 200) {
                    const formattedProjects = (res.data || []).map((p) => {
                         // Helper to ensure arrays are properly formatted
                         const ensureArray = (value) => {
                              if (!value) return [];
                              if (Array.isArray(value)) return value;
                              return [value];
                         };

                         return {
                              id: p.project_id,
                              name: p.project_name,
                              description: p.project_description || "",
                              project_manager_id: p.project_manager_id,
                              project_manager_name: p.project_manager_name || "",
                              asst_project_manager_id: ensureArray(p.asst_project_manager_id),
                              asst_project_manager_names: ensureArray(p.asst_project_manager_names),
                              project_qa_id: ensureArray(p.project_qa_id),
                              project_qa_names: ensureArray(p.project_qa_names),
                              project_team_id: ensureArray(p.project_team_id),
                              project_team_names: ensureArray(p.project_team_names),
                              files: p.files || null,
                              tasks: p.tasks || [],
                              created_at: p.created_at,
                              updated_at: p.updated_at,
                         };
                    });

                    setProjects(formattedProjects);
               } else {
                    throw new Error(res.message || "Failed to fetch projects");
               }
          } catch (err) {
               console.error("Fetch projects failed", err);
               toast.error("Failed to load projects");
          } finally {
               setLoadingProjects(false);
          }
     }, []);

     useEffect(() => {
          if (activeTab === "users" && userId && !hasFetchedUsersRef.current) {
               hasFetchedUsersRef.current = true;
               loadUsers();
          }
     }, [activeTab, loadUsers, userId]);

     useEffect(() => {
          if (activeTab === "projects" && !hasFetchedProjectsRef.current) {
               hasFetchedProjectsRef.current = true;
               loadProjects();
          }
     }, [activeTab, loadProjects]);

     return (
          <>
               {activeTab === "users" && canManageUsers && (
                    <UsersManagement
                         users={users}
                         onUpdateUsers={setUsers}
                         loading={loadingUsers}
                         loadUsers={loadUsers}
                    />
               )}

               {activeTab === "projects" && canManageProjects && (
                    <ProjectsManagement
                         projects={projects}
                         onUpdateProjects={setProjects}
                         loading={loadingProjects}
                         loadProjects={loadProjects}
                    />
               )}

               {activeTab === "afd" && canManageProjects && (
                    <AFDManagement />
               )}

               {activeTab === "category" && canManageProjects && (
                    <ProjectCategory />
               )}

               {activeTab === "permissions" && canManageUsers && (
                    <UserTrackingView />
               )}

               {activeTab === "roster" && user?.role_id === 1 && (
                    <SuperAdminApproval />
               )}

               {activeTab === "roster-management" && user?.role_id === 1 && (
                    <SuperAdminApproval />
               )}

               {activeTab === "roster" && [2, 3, 4].includes(Number(user?.role_id)) && (
                    <AssistantManagerRoster />
               )}
          </>
     );
};

export default ManageModule;
