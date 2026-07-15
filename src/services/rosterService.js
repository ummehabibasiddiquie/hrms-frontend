import api from "./api";

const ROSTER_TIMEOUT_MS = 120000;
const ROSTER_HEAVY_TIMEOUT_MS = 300000;

function getLoggedInUserId() {
  try {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    return user?.user_id;
  } catch {
    return null;
  }
}

function withUser(payload = {}) {
  return { logged_in_user_id: getLoggedInUserId(), ...payload };
}

function unwrap(response) {
  const body = response?.data;
  if (!body) throw new Error("No response from server");
  if (body.status && body.status >= 400) {
    const err = new Error(body.message || "Request failed");
    err.response = { data: body };
    throw err;
  }
  return body;
}

async function rosterPost(url, payload = {}, timeout = ROSTER_TIMEOUT_MS) {
  const res = await api.post(url, withUser(payload), { timeout });
  return unwrap(res);
}

export async function canGenerateRoster(payload = {}) {
  return rosterPost("/roster/can_generate", payload);
}

export async function generateRoster(payload = {}) {
  return rosterPost("/roster/generate", payload, ROSTER_HEAVY_TIMEOUT_MS);
}

export async function generateEmployeeRoster(payload) {
  return rosterPost("/roster/generate_employee", payload, ROSTER_HEAVY_TIMEOUT_MS);
}

export async function resetRegenerateRoster(payload) {
  return rosterPost("/roster/reset_regenerate", payload, ROSTER_HEAVY_TIMEOUT_MS);
}

export async function resetRegenerateEmployeeRoster(payload) {
  return rosterPost("/roster/reset_regenerate_employee", payload, ROSTER_HEAVY_TIMEOUT_MS);
}

export async function listRosters(payload) {
  return rosterPost("/roster/list", payload);
}

export async function listRosterEmployees(payload) {
  return rosterPost("/roster/list_employees", payload);
}

export async function weekoffSwapPreview(payload) {
  return rosterPost("/roster/weekoff/swap_preview", payload);
}

export async function createChangeRequest(payload) {
  return rosterPost("/roster/change_request/create", payload);
}

export async function submitRosterBatch(payload) {
  return rosterPost("/roster/submit", payload);
}

export async function withdrawRosterSubmission(payload) {
  return rosterPost("/roster/withdraw", payload);
}

export async function withdrawDraftChangeRequest(payload) {
  return rosterPost("/roster/change_request/withdraw_draft", payload);
}

export async function approveChangeRequest(payload) {
  return rosterPost("/roster/requests/approve", payload);
}

export async function rejectChangeRequest(payload) {
  return rosterPost("/roster/requests/reject", payload);
}

export async function listChangeRequests(payload = {}) {
  return rosterPost("/roster/requests/list", payload);
}

export async function listRosterLeaves(payload) {
  return rosterPost("/roster/leave/list", payload);
}

export async function lockRosterMonth(payload) {
  return rosterPost("/roster/lock", payload);
}

export async function unlockRosterMonth(payload) {
  return rosterPost("/roster/unlock", payload);
}

export async function listRosterVersions(payload) {
  return rosterPost("/roster/versions/list", payload);
}

export async function getRosterVersionDetail(payload) {
  return rosterPost("/roster/versions/detail", payload);
}

export async function listRosterAudit(payload = {}) {
  return rosterPost("/roster/audit/list", payload);
}

export async function recalculateRosterPreview(payload) {
  return rosterPost("/roster/recalculate", payload);
}
