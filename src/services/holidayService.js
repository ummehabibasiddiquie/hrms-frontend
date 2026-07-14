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

export async function listHolidays(payload = {}) {
  const res = await api.post("/holiday/list", withUser(payload));
  return unwrap(res);
}

export async function addHoliday(payload) {
  const res = await api.post("/holiday/add", withUser(payload));
  return unwrap(res);
}

export async function updateHoliday(payload) {
  const res = await api.post("/holiday/update", withUser(payload));
  return unwrap(res);
}

export async function deactivateHoliday(payload) {
  const res = await api.post("/holiday/delete", withUser(payload));
  return unwrap(res);
}

export async function uploadHolidayExcel(file, calendarYear) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("logged_in_user_id", getLoggedInUserId());
  if (calendarYear) {
    formData.append("calendar_year", String(calendarYear));
  }
  const res = await api.post("/holiday/upload", formData);
  return unwrap(res);
}
