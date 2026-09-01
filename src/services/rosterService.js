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

export async function approveChangeRequestsBulk(payload) {
  return rosterPost("/roster/requests/approve_bulk", payload, ROSTER_HEAVY_TIMEOUT_MS);
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

export async function lockRosterWeek(payload) {
  return rosterPost("/roster/week/lock", payload);
}

export async function unlockRosterWeek(payload) {
  return rosterPost("/roster/week/unlock", payload);
}

export async function emailRosterWeek(payload) {
  return rosterPost("/roster/week/email", payload);
}

export async function listRosterAudit(payload = {}) {
  return rosterPost("/roster/audit/list", payload);
}

export async function recalculateRosterPreview(payload) {
  return rosterPost("/roster/recalculate", payload);
}

export async function listRosterExcelWeeks(payload) {
  return rosterPost("/roster/excel/weeks", payload);
}

export async function downloadRosterExcelTemplate(payload = {}) {
  try {
    const res = await api.post("/roster/excel/template", withUser(payload), {
      responseType: "blob",
      timeout: ROSTER_TIMEOUT_MS,
    });
    const contentType = res.headers?.["content-type"] || "";
    if (contentType.includes("application/json")) {
      const text = await res.data.text();
      const body = JSON.parse(text);
      const err = new Error(body.message || "Template download failed");
      err.response = { data: body };
      throw err;
    }
    return res.data;
  } catch (err) {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const body = JSON.parse(await blob.text());
        const parsed = new Error(body.message || "Template download failed");
        parsed.response = { data: body };
        throw parsed;
      } catch (inner) {
        if (inner?.response) throw inner;
      }
    }
    throw err;
  }
}

export async function previewRosterExcel(file, payload = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("logged_in_user_id", getLoggedInUserId());
  if (payload.team_id != null && payload.team_id !== "" && payload.team_id !== "all") {
    formData.append("team_id", String(payload.team_id));
  }
  const res = await api.post("/roster/excel/preview", formData, {
    timeout: ROSTER_HEAVY_TIMEOUT_MS,
    signal: payload.signal,
  });
  return unwrap(res);
}

export async function applyRosterExcelChanges(payload) {
  return rosterPost("/roster/excel/apply", payload, ROSTER_HEAVY_TIMEOUT_MS);
}
