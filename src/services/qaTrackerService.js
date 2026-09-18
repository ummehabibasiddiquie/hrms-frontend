import api from "./api";
import { log, logError } from "../config/environment";

export const fetchQATrackerDay = async (payload) => {
  try {
    log("[QA Tracker] Fetching day", payload);
    const response = await api.post("/qa_tracker/day", payload);
    return response.data;
  } catch (error) {
    logError("[QA Tracker] Day fetch failed", error);
    throw error;
  }
};

export const addQATrackerEntry = async (payload) => {
  try {
    log("[QA Tracker] Adding entry", payload);
    const response = await api.post("/qa_tracker/add_entry", payload);
    return response.data;
  } catch (error) {
    logError("[QA Tracker] Add entry failed", error);
    throw error;
  }
};

export const deleteQATrackerEntry = async (payload) => {
  try {
    log("[QA Tracker] Deleting entry", payload);
    const response = await api.post("/qa_tracker/delete_entry", payload);
    return response.data;
  } catch (error) {
    logError("[QA Tracker] Delete entry failed", error);
    throw error;
  }
};

export const fetchQATrackerList = async (payload) => {
  try {
    log("[QA Tracker] Fetching list", payload);
    const response = await api.post("/qa_tracker/list", payload);
    return response.data;
  } catch (error) {
    logError("[QA Tracker] List fetch failed", error);
    throw error;
  }
};

export const fetchQATrackerMonthly = async (payload) => {
  try {
    log("[QA Tracker] Fetching monthly", payload);
    const response = await api.post("/qa_tracker/monthly", payload);
    return response.data;
  } catch (error) {
    logError("[QA Tracker] Monthly fetch failed", error);
    throw error;
  }
};

export const fetchQATrackerEntries = async (payload) => {
  try {
    log("[QA Tracker] Fetching entries", payload);
    const response = await api.post("/qa_tracker/entries", payload);
    return response.data;
  } catch (error) {
    logError("[QA Tracker] Entries fetch failed", error);
    throw error;
  }
};

export const updateQATrackerEntry = async (payload) => {
  try {
    log("[QA Tracker] Updating entry", payload);
    const response = await api.post("/qa_tracker/update_entry", payload);
    return response.data;
  } catch (error) {
    logError("[QA Tracker] Update entry failed", error);
    throw error;
  }
};
