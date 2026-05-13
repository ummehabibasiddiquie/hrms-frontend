/**
 * File Name: qcService.js
 * Author: Naitik Maisuriya
 * Description: API service for QC (Quality Control) operations
 */

import api from "./api";
import nodeApi from "./nodeApi";
import { log, logError } from "../config/environment";

/**
 * Save temporary QC data for a user
 * @param {Object} payload - Request payload containing user_id, date, and optional assigned_hours and qc_score
 * @returns {Promise} Response data
 */
export const saveTempQC = async (payload) => {
  try {
    log(
      `[QC Service] Saving temp QC for user ${payload.user_id} on ${payload.date}`,
    );

    console.log("[QC Service] Request payload:", payload);

    const response = await api.post("/qc/temp-qc", payload);

    log(`[QC Service] Temp QC saved successfully:`, response.data);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error saving temp QC:", error);
    console.error("[QC Service] Error details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

/**
 * Fetch AFD (Attribute/Feature/Defect) data for a project category
 * @param {number} project_category_id - Project category ID
 * @returns {Promise} AFD data with categories and subcategories
 */
export const fetchProjectCategoryAFD = async (project_category_id) => {
  try {
    log(
      `[QC Service] Fetching AFD for project category ${project_category_id}`,
    );

    const response = await api.post("/project_category/list", {
      project_category_id,
    });

    log(`[QC Service] AFD data fetched successfully:`, response.data);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching project category AFD:", error);
    throw error;
  }
};

/**
 * Fetch QC AFD (Attribute/Feature/Defect) list from Node API
 * @returns {Promise} AFD data with categories and subcategories
 */
export const fetchQCAFDList = async () => {
  try {
    log(`[QC Service] Fetching QC AFD list from Node API`);

    const response = await nodeApi.get("/qc-afd/list");

    log(`[QC Service] QC AFD data fetched successfully:`, response.data);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching QC AFD list:", error);
    throw error;
  }
};

/**
 * Generate sample data from tracker file
 * @param {number} tracker_id - Tracker ID
 * @param {number} logged_in_user_id - Logged in user ID
 * @param {number} sampling_percentage - Sampling percentage (optional, defaults to 10 if not provided)
 * @returns {Promise} Sample data response with file URL and records
 */
export const generateQCSample = async (
  tracker_id,
  logged_in_user_id,
  sampling_percentage = 10,
) => {
  try {
    log(
      `[QC Service] Generating sample for tracker ${tracker_id} with sampling percentage ${sampling_percentage}%`,
    );

    const response = await nodeApi.post("/qc-records/generate-sample", {
      tracker_id,
      logged_in_user_id,
      sampling_percentage,
    });

    log(`[QC Service] Sample generated successfully:`, response.data);
    log(
      `[QC Service] Full response structure:`,
      JSON.stringify(response.data, null, 2),
    );
    log(`[QC Service] File path check:`, {
      "response.data.file_path": response.data?.file_path,
      'response.data["10%_file_path"]': response.data?.["10%_file_path"],
      "response.data.data.file_path": response.data?.data?.file_path,
      'response.data.data["10%_file_path"]':
        response.data?.data?.["10%_file_path"],
    });
    return response.data;
  } catch (error) {
    logError("[QC Service] Error generating QC sample:", error);
    throw error;
  }
};

/**
 * Save QC Record - Routes to appropriate endpoint based on status
 * @param {Object} payload - QC form data
 * @param {number} payload.logged_in_user_id - Logged in user ID
 * @param {number} payload.tracker_id - Tracker ID
 * @param {number} payload.ass_manager_id - Assistant Manager ID
 * @param {number} payload.qc_user_id - QC User ID
 * @param {number} payload.agent_user_id - Agent User ID
 * @param {number} payload.project_id - Project ID
 * @param {number} payload.task_id - Task ID
 * @param {string} payload.whole_file_path - File path/URL of the full tracker
 * @param {string} payload.qc_file_path - File path/URL of the sampled QC file
 * @param {string} payload.date_of_file_submission - Date of file submission (YYYY-MM-DD)
 * @param {number} payload.qc_score - Final QC Score (0-100)
 * @param {string} payload.status - Status (Approved/Rework/Correction)
 * @param {number} payload.file_record_count - Total records in file
 * @param {number} payload.qc_generated_count - QC sample data generated count
 * @param {Array} payload.qc_file_records - The sampled records data
 * @param {Array} payload.error_list - List of errors with category, subcategory, row, points
 * @param {string} payload.comments - QC comments
 * @returns {Promise} Response data
 */
export const saveQCRecord = async (payload) => {
  try {
    log(`[QC Service] Saving QC record for tracker ${payload.tracker_id}`);
    console.log("[QC Service] Payload structure:", {
      logged_in_user_id: payload.logged_in_user_id,
      tracker_id: payload.tracker_id,
      ass_manager_id: payload.ass_manager_id,
      qc_user_id: payload.qc_user_id,
      agent_user_id: payload.agent_user_id,
      project_id: payload.project_id,
      task_id: payload.task_id,
      date_of_file_submission: payload.date_of_file_submission,
      qc_score: payload.qc_score,
      status: payload.status,
      file_record_count: payload.file_record_count,
      data_generated_count: payload.data_generated_count,
      qc_file_records: payload.qc_file_records,
      error_score: payload.error_score,
      error_list_length: payload.error_list?.length || 0,
      has_comments: !!payload.comments,
    });

    // Route to appropriate endpoint based on status
    let endpoint;
    switch (payload.status) {
      case "regular":
        endpoint = "/qc-regular/save";
        break;
      case "correction":
        endpoint = "/qc-correction/save";
        break;
      case "rework":
        endpoint = "/qc-rework/save";
        break;
      default:
        throw new Error(
          `Invalid status: ${payload.status}. Must be 'regular', 'correction', or 'rework'.`,
        );
    }

    const response = await nodeApi.post(endpoint, payload);

    log(
      `[QC Service] QC record saved successfully via ${endpoint}:`,
      response.data,
    );
    return response.data;
  } catch (error) {
    logError("[QC Service] Error saving QC record:", error);
    console.error("[QC Service] Error details:", {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data,
    });
    throw error;
  }
};

/**
 * Fetch QC Form Records
 * @param {number|null} logged_in_user_id - Optional user ID to filter records for agent view
 * @returns {Promise} List of QC records
 */
export const getQCRecordsList = async (logged_in_user_id = null) => {
  try {
    log(`[QC Service] Fetching QC records list`);

    // Construct query params if logged_in_user_id is provided
    const url = logged_in_user_id
      ? `/qc-records/list?logged_in_user_id=${logged_in_user_id}`
      : "/qc-records/list";

    const response = await nodeApi.get(url);

    log(`[QC Service] QC records fetched successfully:`, response.data);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching QC records:", error);
    throw error;
  }
};

/**
 * Get QC records for a specific agent
 * @param {number} agent_id - Agent user ID
 * @returns {Promise} Agent's QC records with history
 */
export const getAgentQCRecords = async (agent_id) => {
  try {
    log(`[QC Service] Fetching QC records for agent ${agent_id}`);
    const response = await nodeApi.get(`/qc-records/agent/${agent_id}`);
    log(`[QC Service] Agent QC records fetched successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching agent QC records:", error);
    throw error;
  }
};

/**
 * Get QC records submitted by a specific QA agent
 * @param {number} qa_user_id - QA user ID
 * @returns {Promise} QA agent's submitted QC records
 */
export const getQAAgentQCRecords = async (qa_user_id) => {
  try {
    log(`[QC Service] Fetching QC records for QA agent ${qa_user_id}`);
    const response = await nodeApi.get(`/qc-records/qa-agent/${qa_user_id}`);
    log(`[QC Service] QA agent QC records fetched successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching QA agent QC records:", error);
    throw error;
  }
};

/**
 * Get pending rework/correction reviews for QA agent
 * @param {number} qa_user_id - QA user ID
 * @returns {Promise} Pending reviews list
 */
export const getPendingReviews = async (qa_user_id) => {
  try {
    log(`[QC Service] Fetching pending reviews for QA agent ${qa_user_id}`);
    const response = await nodeApi.get(
      `/qc-records/pending-review/${qa_user_id}`,
    );
    log(`[QC Service] Pending reviews fetched successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching pending reviews:", error);
    throw error;
  }
};

/**
 * Upload rework file
 * @param {FormData} formData - Form data with file and metadata
 * @returns {Promise} Upload response
 */
export const uploadReworkFile = async (formData) => {
  try {
    log(`[QC Service] Uploading rework file`);
    const response = await nodeApi.post("/qc-records/upload-rework", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    log(`[QC Service] Rework file uploaded successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error uploading rework file:", error);
    throw error;
  }
};

/**
 * Upload correction file
 * @param {FormData} formData - Form data with file and metadata
 * @returns {Promise} Upload response
 */
export const uploadCorrectionFile = async (formData) => {
  try {
    log(`[QC Service] Uploading correction file`);
    const response = await nodeApi.post(
      "/qc-records/upload-correction",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    log(`[QC Service] Correction file uploaded successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error uploading correction file:", error);
    throw error;
  }
};

/**
 * Get all QC records for managers/admins
 * @param {Object} filters - Optional filters
 * @returns {Promise} All QC records
 */
export const getAllQCRecords = async (filters = {}) => {
  try {
    log(`[QC Service] Fetching all QC records with filters:`, filters);
    const response = await nodeApi.get("/qc-records/all", { params: filters });
    log(`[QC Service] All QC records fetched successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching all QC records:", error);
    throw error;
  }
};

/**
 * Get QC statistics
 * @returns {Promise} QC statistics data
 */
export const getQCStatistics = async () => {
  try {
    log(`[QC Service] Fetching QC statistics`);
    const response = await nodeApi.get("/qc-records/statistics");
    log(`[QC Service] QC statistics fetched successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error fetching QC statistics:", error);
    throw error;
  }
};

/**
 * Submit QC for rework file
 * @param {Object} payload - QC form data for rework review
 * @returns {Promise} Response data
 */
export const submitReworkQC = async (payload) => {
  try {
    log(`[QC Service] Submitting QC for rework file`);
    const response = await nodeApi.post("/qc-records/review-rework", payload);
    log(`[QC Service] Rework QC submitted successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error submitting rework QC:", error);
    throw error;
  }
};

/**
 * Submit QC for correction file
 * @param {Object} payload - QC form data for correction review
 * @returns {Promise} Response data
 */
export const submitCorrectionQC = async (payload) => {
  try {
    log(`[QC Service] Submitting QC for correction file`);
    const response = await nodeApi.post(
      "/qc-records/review-correction",
      payload,
    );
    log(`[QC Service] Correction QC submitted successfully`);
    return response.data;
  } catch (error) {
    logError("[QC Service] Error submitting correction QC:", error);
    throw error;
  }
};
