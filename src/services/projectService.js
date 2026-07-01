// src/services/projectService.js
import api from "./api";

/**
 * Create Task API
 * @param {Object|FormData} payload
 */
export const addTask = async (payload) => {
  // If payload is FormData, set Content-Type to undefined to let browser set boundary
  if (payload instanceof FormData) {
    if (payload.get('qcPercentage')) {
      payload.append('qc_percentage', payload.get('qcPercentage'));
      payload.delete('qcPercentage');
    }
    const headers = { 'Content-Type': undefined };
    const res = await api.post("/task/add", payload, { headers });
    return res.data;
  } else {
    let finalPayload = { ...payload };
    if (payload.qcPercentage) {
      finalPayload.qc_percentage = payload.qcPercentage;
      delete finalPayload.qcPercentage;
    }
    const headers = {};
    const res = await api.post("/task/add", finalPayload, { headers });
    return res.data;
  }
};

/**
 * Fetch project tasks API
 * @param {number} projectId - Used for filtering on client side (not sent to API)
 * @param {number} userId - Logged in user ID
 * @param {string} deviceId - Device ID
 * @param {string} deviceType - Device type (e.g., LAPTOP)
 */
export const fetchProjectTasks = async (projectId, userId, deviceId, deviceType) => {
  const payload = {};
  // API expects user_id, device_id, and device_type (NOT project_id)
  if (userId) payload.user_id = userId;
  if (deviceId) payload.device_id = deviceId || 'web';
  if (deviceType) payload.device_type = deviceType || 'Laptop';
  
  const res = await api.post("/task/list", payload);
  return res.data;
};

/**
 * Update task API
 * @param {Object|FormData} payload
 */
export const updateTask = async (payload) => {
  // If payload is FormData, set Content-Type to undefined to let browser set boundary
  if (payload instanceof FormData) {
    if (payload.get('qcPercentage')) {
      payload.append('qc_percentage', payload.get('qcPercentage'));
      payload.delete('qcPercentage');
    }
    const headers = { 'Content-Type': undefined };
    const res = await api.post("/task/update", payload, { headers });
    return res.data;
  } else {
    let finalPayload = { ...payload };
    if (payload.qcPercentage) {
      finalPayload.qc_percentage = payload.qcPercentage;
      delete finalPayload.qcPercentage;
    }
    const headers = {};
    const res = await api.post("/task/update", finalPayload, { headers });
    return res.data;
  }
};

/**
 * Delete task API
 * @param {Object} payload
 */
export const deleteTask = async (projectId, taskId, qcPercentage) => {
  const payload = {
    project_id: projectId,
    task_id: taskId,
  };
  if (qcPercentage) payload.qc_percentage = qcPercentage;
  console.log('[deleteTask] Sending payload:', payload);
  const res = await api.put("/task/delete", payload);
  console.log('[deleteTask] Response:', res);
  return res.data;
};

/**
 * Create Project API
 * @param {Object} payload
 */
export const createProject = async (payload) => {
  // If payload is FormData, set Content-Type to undefined to let browser set boundary
  const headers = payload instanceof FormData ? { 'Content-Type': undefined } : {};
  const res = await api.post("/project/create", payload, { headers });
  return res.data;
};

/**
 * Fetch Projects List API
 * @param {number} logged_in_user_id - The logged-in user's ID for filtering projects
 * @returns {Promise} Project list response
 */
export const fetchProjectsList = async (logged_in_user_id) => {
  console.log('[projectService] Fetching projects for user:', logged_in_user_id);
  const res = await api.post("/project/list", { logged_in_user_id });
  console.log('[projectService] Projects API response:', res);
  console.log('[projectService] Projects data:', res.data);
  return res.data;
};

/**
 * Update Project API
 * @param {number} projectId
 * @param {Object} payload
 */
export const updateProject = async (projectId, payload) => {
  // If payload is FormData, set Content-Type to undefined to let browser set boundary
  const headers = payload instanceof FormData ? { 'Content-Type': undefined } : {};
  
  // For FormData, append project_id instead of spreading
  if (payload instanceof FormData) {
    payload.append('project_id', projectId);
    const res = await api.post("/project/update", payload, { headers });
    return res.data;
  }
  
  // For regular objects, use the original logic
  const res = await api.post("/project/update", {
    project_id: projectId,
    ...payload
  }, { headers });
  return res.data;
};

/**
 * Delete Project API
 * @param {number} projectId
 */
export const deleteProject = async (projectId) => {
  const res = await api.post("/project/delete", {
    project_id: projectId
  });
  return res.data;
};
