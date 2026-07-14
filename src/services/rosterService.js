import api from "./api";

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

export async function canGenerateRoster(payload = {}) {
  const res = await api.post("/roster/can_generate", withUser(payload));
  return unwrap(res);
}

export async function generateRoster(payload = {}) {
  const res = await api.post("/roster/generate", withUser(payload));
  return unwrap(res);
}

export async function generateEmployeeRoster(payload) {
  const res = await api.post("/roster/generate_employee", withUser(payload));
  return unwrap(res);
}

export async function resetRegenerateRoster(payload) {
  const res = await api.post("/roster/reset_regenerate", withUser(payload));
  return unwrap(res);
}

export async function listRosters(payload) {
  const res = await api.post("/roster/list", withUser(payload));
  return unwrap(res);
}

export async function listRosterEmployees(payload) {
  const res = await api.post("/roster/list_employees", withUser(payload));
  return unwrap(res);
}

export async function weekoffSwapPreview(payload) {
  const res = await api.post("/roster/weekoff/swap_preview", withUser(payload));
  return unwrap(res);
}

export async function createChangeRequest(payload) {
  const res = await api.post("/roster/change_request/create", withUser(payload));
  return unwrap(res);
}

export async function submitRosterBatch(payload) {
  const res = await api.post("/roster/submit", withUser(payload));
  return unwrap(res);
}

export async function withdrawRosterSubmission(payload) {
  const res = await api.post("/roster/withdraw", withUser(payload));
  return unwrap(res);
}

export async function approveChangeRequest(payload) {
  const res = await api.post("/roster/requests/approve", withUser(payload));
  return unwrap(res);
}

export async function rejectChangeRequest(payload) {
  const res = await api.post("/roster/requests/reject", withUser(payload));
  return unwrap(res);
}

export async function listChangeRequests(payload = {}) {
  const res = await api.post("/roster/requests/list", withUser(payload));
  return unwrap(res);
}

export async function listRosterLeaves(payload) {
  const res = await api.post("/roster/leave/list", withUser(payload));
  return unwrap(res);
}

export async function lockRosterMonth(payload) {
  const res = await api.post("/roster/lock", withUser(payload));
  return unwrap(res);
}

export async function unlockRosterMonth(payload) {
  const res = await api.post("/roster/unlock", withUser(payload));
  return unwrap(res);
}

export async function listRosterVersions(payload) {
  const res = await api.post("/roster/versions/list", withUser(payload));
  return unwrap(res);
}

export async function getRosterVersionDetail(payload) {
  const res = await api.post("/roster/versions/detail", withUser(payload));
  return unwrap(res);
}

export async function listRosterAudit(payload = {}) {
  const res = await api.post("/roster/audit/list", withUser(payload));
  return unwrap(res);
}

export async function recalculateRosterPreview(payload) {
  const res = await api.post("/roster/recalculate", withUser(payload));
  return unwrap(res);
}
