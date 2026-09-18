import api from "./api";

function loggedInUserId() {
  try {
    return JSON.parse(sessionStorage.getItem("user"))?.user_id;
  } catch {
    return null;
  }
}

function withActor(payload = {}) {
  return { logged_in_user_id: loggedInUserId(), ...payload };
}

export const fetchKraUsers = async () => {
  const res = await api.post("/kra/users", withActor());
  return res.data;
};

export const fetchKraReport = async (payload) => {
  const res = await api.post("/kra/report", withActor(payload));
  return res.data;
};

export const saveKraNotes = async (payload) => {
  const res = await api.post("/kra/save_notes", withActor(payload));
  return res.data;
};

export const exportKraReport = async (payload) => {
  const res = await api.post("/kra/export", withActor(payload), { responseType: "blob" });
  return res;
};
