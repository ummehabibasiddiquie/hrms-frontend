/**
 * File Name: dropdownService.js
 * Author: Naitik Maisuriya
 * Description: Service for fetching dynamic dropdown data used in user management forms.
 */

import api from "./api";

/**
 * Fetches data for a specific dropdown category from the backend.
 * @param {string} dropdownType - The type of data to retrieve.
 * @param {number} userId - The logged in user ID.
 * @param {number} projectId - Optional project ID filter.
 * @param {number} teamId - Optional team ID filter.
 */
export const fetchDropdown = async (dropdownType, userId = null, projectId = null, teamId = null) => {
     try {
          console.log(`[dropdownService] fetchDropdown called with:`, {
               dropdownType,
               userId,
               projectId,
               teamId
          });
          
          const payload = { 
               dropdown_type: dropdownType
          };
          
          // Add logged_in_user_id if provided
          if (userId) payload.logged_in_user_id = userId;
          
          // Add optional filters
          if (projectId) payload.project_id = projectId;
          if (teamId) payload.team_id = teamId;
          
          const response = await api.post("dropdown/get", payload);
          const data = response.data?.data || [];
          console.log(`[dropdownService] Fetched ${dropdownType}:`, data.length, 'items');
          // Returns the data array or an empty array as a fallback
          return data;
     } catch (error) {
          console.error(`❌ Error fetching ${dropdownType}:`, error.response?.data || error.message);
          return [];
     }
};

/**
 * Executes concurrent API calls to retrieve all metadata required for user profiles.
 * Optimized with Promise.all for faster loading.
 * @param {number} userId - The logged in user ID.
 */
export const fetchUserDropdowns = async (userId = null) => {
     try {
          console.log('[dropdownService] fetchUserDropdowns called with userId:', userId);
          
          const [
               roles,
               designations,
               teams,
               projectManagers,
               assistantManagers,
               teamLeaders,
               qas,
               agents,
               projectCategories,
          ] = await Promise.all([
               fetchDropdown("user roles", userId),
               fetchDropdown("designations", userId),
               fetchDropdown("teams", userId),
               fetchDropdown("project manager", userId),
               fetchDropdown("assistant manager", userId),
               fetchDropdown("team leader", userId),
               fetchDropdown("qa", userId),
               fetchDropdown("agent", userId),
               fetchDropdown("project categories", userId),
          ]);

          const result = {
               roles,
               designations,
               teams,
               projectManagers,
               assistantManagers,
               teamLeaders,
               qas,
               agents,
               projectCategories,
          };

          console.log('[dropdownService] fetchUserDropdowns result:', result);
          
          return result;
     } catch (error) {
          console.error("❌ Error fetching user dropdowns:", error);
          return {
               roles: [],
               designations: [],
               teams: [],
               projectManagers: [],
               assistantManagers: [],
               teamLeaders: [],
               qas: [],
               agents: [],
               projectCategories: [],
          };
     }
};