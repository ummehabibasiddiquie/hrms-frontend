import React, { useEffect, useState } from "react";
import AddUserFormModal from "./AddUserFormModal";
import { fetchUserDropdowns } from "../../../../services/dropdownService";
import { fetchUserById, updateUser } from "../../../../services/userService";
import { log, logError, logWarn } from "../../../../config/environment";
import { toast } from "react-hot-toast";

const EditUserFormModal = ({
  userId,
  isOpen,
  onClose,
  onUserUpdated,
  isSuperAdmin = false,
  deviceId = "",
  deviceType = "Laptop"
}) => {
  const [userData, setUserData] = useState(null);
  const [originalUserData, setOriginalUserData] = useState(null); // Store original data to compare changes
  const [dropdowns, setDropdowns] = useState({ roles: [], designations: [], projectManagers: [], assistantManagers: [], qas: [], teams: [] });
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [profilePreview, setProfilePreview] = useState(null);
  const [profileFile, setProfileFile] = useState(null);

  // Fetch user data and dropdowns on open
  useEffect(() => {
    let isMounted = true; // Cleanup flag to prevent memory leaks
    
    if (isOpen && userId) {
      setIsDropdownLoading(true);
      
      Promise.all([
        fetchUserById(userId, deviceId, deviceType),
        fetchUserDropdowns()
      ])
        .then(([user, dropdownData]) => {
          // Only update state if component is still mounted
          if (!isMounted) return;
          
          log('[EditUserFormModal] Fetched user:', user);
          log('[EditUserFormModal] Fetched dropdownData:', dropdownData);
          
          if (!user) {
            // Fallback: try to get user data from window
            if (typeof window !== 'undefined' && window.__frontendUserForEdit) {
              logWarn('[EditUserFormModal] No user found in backend, using frontend data');
              user = window.__frontendUserForEdit;
            } else {
              logWarn('[EditUserFormModal] No user found for userId:', userId);
              setUserData(null);
              setDropdowns(dropdownData);
              setIsDropdownLoading(false);
              return;
            }
          }
          
          // Map user fields to dropdown IDs/values for correct display
          const getIdByLabel = (arr, label, idKey = 'id', labelKey = 'label') => {
            if (!label || !arr || !Array.isArray(arr)) return '';
            const norm = (v) => (v === null || v === undefined) ? '' : String(v).trim().toLowerCase();
            const result = arr.find(item => norm(item[labelKey]) === norm(label))?.[idKey] || '';
            return result;
          };
          
          // Helper to extract all IDs from array string like "[110, 111]" or from array [110, 111]
          const extractAllIds = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value.map(id => String(id));
            const str = String(value);
            // Match all numbers in the string
            const matches = str.match(/\d+/g);
            return matches ? matches : [];
          };
          
          // Extract role_id
          let roleValue = user.role_id || '';
          if (!roleValue && user.role && dropdownData.roles) {
            roleValue = getIdByLabel(dropdownData.roles, user.role, 'role_id', 'label') ||
                       getIdByLabel(dropdownData.roles, user.role, 'role_id', 'role_name') ||
                       '';
          }
          
          // Extract team_id
          let teamValue = user.team_id || '';
          if (!teamValue && dropdownData.teams) {
            teamValue = getIdByLabel(dropdownData.teams, user.team_name, 'team_id', 'label') ||
                       getIdByLabel(dropdownData.teams, user.team_name, 'team_id', 'team_name') ||
                       getIdByLabel(dropdownData.teams, user.team, 'team_id', 'label') ||
                       '';
          }
          
          // Extract project_manager_id (could be "[110]" or "[110,111]" or array)
          const projectManagerIds = extractAllIds(user.project_manager_id);
          
          // Extract asst_manager_id (could be "[111]" or "[111,113]" or array)
          const assistantManagerIds = extractAllIds(user.asst_manager_id);
          
          // Extract qa_id (could be "[116]" or "[116,114]" or array)
          const qaIds = extractAllIds(user.qa_id);
          
          log('[EditUserFormModal] Role mapping - input:', user.role, 'role_id:', user.role_id, 'mapped:', roleValue);
          log('[EditUserFormModal] Team mapping - input:', user.team_name, 'team_id:', user.team_id, 'mapped:', teamValue);
          log('[EditUserFormModal] Project Manager IDs extracted:', projectManagerIds, 'from:', user.project_manager_id);
          log('[EditUserFormModal] Assistant Manager IDs extracted:', assistantManagerIds, 'from:', user.asst_manager_id);
          log('[EditUserFormModal] QA IDs extracted:', qaIds, 'from:', user.qa_id);
          log('[EditUserFormModal] Available roles:', dropdownData.roles);
          log('[EditUserFormModal] Available teams:', dropdownData.teams);
          
          const newUserData = {
            ...user,
            name: user.user_name,
            email: user.user_email,
            phone: user.user_number,
            password: user.user_password || "", // Show existing password for edit
            role: String(roleValue || ''), // Convert to string for select element
            designation: String(
              user.designation_id ||
              getIdByLabel(dropdownData.designations, user.designation, 'designation_id', 'label') ||
              ''
            ),
            projectManager: projectManagerIds[0] || '', // Keep for backward compatibility
            assistantManager: assistantManagerIds[0] || '', // Keep for backward compatibility
            qualityAnalyst: qaIds[0] || '', // Keep for backward compatibility
            projectManagers: projectManagerIds, // Array for multi-select
            assistantManagers: assistantManagerIds, // Array for multi-select
            qualityAnalysts: qaIds, // Array for multi-select
            team: String(teamValue || ''), // Convert to string for select element
            tenure: user.user_tenure || user.tenure || "",
            address: user.user_address || user.address || "",
          };
          
          log('[EditUserFormModal] Final userData being set:', newUserData);
          log('[EditUserFormModal] userData.role:', newUserData.role, 'type:', typeof newUserData.role);
          log('[EditUserFormModal] userData.designation:', newUserData.designation);
          log('[EditUserFormModal] userData.projectManagers:', newUserData.projectManagers);
          log('[EditUserFormModal] userData.assistantManagers:', newUserData.assistantManagers);
          log('[EditUserFormModal] userData.qualityAnalysts:', newUserData.qualityAnalysts);
          log('[EditUserFormModal] userData.team:', newUserData.team, 'type:', typeof newUserData.team);
          
          setUserData(newUserData);
          setOriginalUserData(newUserData); // Store original data for comparison
          
          setProfilePreview(user.profile_picture || null);
          setDropdowns(dropdownData);
        })
        .catch((error) => {
          if (!isMounted) return;
          logError('[EditUserFormModal] Error fetching data:', error);
          setFormErrors({ general: error.message || 'Failed to load user data' });
        })
        .finally(() => {
          if (isMounted) {
            setIsDropdownLoading(false);
          }
        });
    }
    
    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, deviceId, deviceType]);

  // Handle update user
  const handleUpdateUser = async () => {
    if (!userData || !userData.user_id) {
      toast.error('User ID is required');
      return;
    }
    
    setIsSubmitting(true);
    setFormErrors({});
    
    try {
      // Build payload with user_id (required) and only changed fields
      const payload = { 
        user_id: userData.user_id,
        device_id: deviceId,
        device_type: deviceType
      };
      
      // Map frontend field names to backend field names (match exact database column names)
      const fieldMapping = {
        name: 'user_name',
        email: 'user_email',
        phone: 'user_number',
        password: 'user_password',
        tenure: 'user_tenure',
        address: 'user_address',
        role: 'role_id',
        designation: 'designation_id',
        projectManagers: 'project_manager_id', // Array field
        assistantManagers: 'asst_manager_id',  // Array field
        qualityAnalysts: 'qa_id', // Array field
        team: 'team_id'
      };
      
      // Fields that need to be sent as arrays
      const arrayFields = ['project_manager_id', 'asst_manager_id', 'qa_id'];
      
      // Fields that should be converted to numbers
      const numberFields = ['role_id', 'designation_id', 'team_id', 'user_tenure'];
      
      // Add only changed fields to payload
      const changedFieldsLog = [];
      Object.entries(fieldMapping).forEach(([frontendKey, backendKey]) => {
        const currentValue = userData[frontendKey];
        const originalValue = originalUserData?.[frontendKey];
        
        // Special handling for array fields
        if (arrayFields.includes(backendKey)) {
          const currentArray = Array.isArray(currentValue) ? currentValue : [];
          const originalArray = Array.isArray(originalValue) ? originalValue : [];
          const hasChanged = JSON.stringify(currentArray.sort()) !== JSON.stringify(originalArray.sort());
          
          if (hasChanged || currentArray.length > 0) {
            payload[backendKey] = currentArray.map(id => Number(id));
            changedFieldsLog.push(`${frontendKey} → ${backendKey}: ${JSON.stringify(originalArray)} → ${JSON.stringify(payload[backendKey])} (array)`);
          }
          return;
        }
        
        // Normalize values to strings for comparison (to handle "3" vs 3)
        const currentStr = String(currentValue || '');
        const originalStr = String(originalValue || '');
        const hasChanged = currentStr !== originalStr;
        
        // Special handling for password - only include if it was actually changed
        if (frontendKey === 'password') {
          if (hasChanged && currentValue && String(currentValue).trim() !== "") {
            payload[backendKey] = currentValue;
            changedFieldsLog.push(`${frontendKey} → ${backendKey}: [REDACTED]`);
          }
          return;
        }
        
        // Only include if value has changed and is not empty
        if (hasChanged && currentValue !== null && currentValue !== undefined && currentValue !== "") {
          // Convert to NUMBER if this field should be numeric
          if (numberFields.includes(backendKey)) {
            payload[backendKey] = Number(currentValue);
            changedFieldsLog.push(`${frontendKey} → ${backendKey}: "${originalValue}" → ${Number(currentValue)} (number)`);
          } 
          // Keep as string for text fields
          else {
            payload[backendKey] = currentValue;
            changedFieldsLog.push(`${frontendKey} → ${backendKey}: "${originalValue}" → "${currentValue}"`);
          }
        }
      });
      
      if (changedFieldsLog.length > 0) {
        log('[EditUserFormModal] 📝 Fields being updated:', changedFieldsLog);
      }
      
      // Track if profile picture changed (will be added to FormData later)
      const hasProfilePictureChanged = profileFile !== null;
      if (hasProfilePictureChanged) {
        log('[EditUserFormModal] 📷 Profile picture changed - will upload file');
      }
      
      // If only user_id, device_id, device_type are present, no changes were made
      const essentialKeys = ['user_id', 'device_id', 'device_type'];
      const changedFields = Object.keys(payload).filter(key => !essentialKeys.includes(key));
      
      if (changedFields.length === 0) {
        toast('No changes detected', { icon: 'ℹ️' });
        setIsSubmitting(false);
        return;
      }
      
      log('[EditUserFormModal] 📤 Complete payload being sent:', JSON.stringify(payload, null, 2));
      log('[EditUserFormModal] 📋 Changed field keys:', changedFields);
      
      // Convert payload to FormData for multipart/form-data submission
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // Send arrays as JSON string
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value);
        }
      });
      
      // Add profile picture file if changed
      if (profileFile) {
        formData.append('profile_picture', profileFile);
        log('[EditUserFormModal] 📷 Appending profile picture file:', profileFile.name);
      }
      
      log('[EditUserFormModal] 📤 Sending as FormData');
      const res = await updateUser(formData);
      
      if (res.status === 200) {
        log('[EditUserFormModal] ✅ Backend returned success');
        log('[EditUserFormModal] ⚠️ NOTE: If changes don\'t appear after reopening, the backend may not be saving these fields to the database.');
        log('[EditUserFormModal] 🔍 Check backend logs/database to verify these fields were actually updated:', changedFields);
        
        toast.success('User updated successfully!', {
          duration: 3000,
        });
        onUserUpdated && onUserUpdated();
        onClose();
      } else {
        setFormErrors({ general: res.message || "Update failed" });
        toast.error(res.message || 'Failed to update user');
      }
    } catch (err) {
      logError('[EditUserFormModal] Update error:', err);
      logError('[EditUserFormModal] Error response:', err.response?.data);
      const errorMessage = err.message || 'Failed to update user';
      setFormErrors({ general: errorMessage });
      toast.error(errorMessage, {
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Profile picture change
  const handleProfilePictureChange = (file) => {
    if (!file) return;
    // Store the File object for upload
    setProfileFile(file);
    // Create preview URL for display
    const reader = new FileReader();
    reader.onloadend = () => setProfilePreview(reader.result);
    reader.readAsDataURL(file);
  };
  const handleRemoveProfilePicture = () => {
    setProfilePreview(null);
    setProfileFile(null);
  };

  if (!isOpen || !userData) return null;

  return (
    <AddUserFormModal
      newUser={userData}
      setNewUser={setUserData}
      handleUpdateUser={handleUpdateUser}
      roles={dropdowns.roles}
      designations={dropdowns.designations}
      projectManagers={dropdowns.projectManagers}
      assistantManagers={dropdowns.assistantManagers}
      qas={dropdowns.qas}
      teams={dropdowns.teams}
      isDropdownLoading={isDropdownLoading}
      isSuperAdmin={isSuperAdmin}
      handleCloseUserModal={onClose}
      isSubmitting={isSubmitting}
      formErrors={formErrors}
      clearFieldError={(field) => setFormErrors((prev) => ({ ...prev, [field]: undefined }))}
      handleProfilePictureChange={handleProfilePictureChange}
      handleRemoveProfilePicture={handleRemoveProfilePicture}
      profilePreview={profilePreview}
      isEditMode={true}
    />
  );
};

export default EditUserFormModal;
