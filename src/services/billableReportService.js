import api from "./api";

function getLoggedInUserId() {
  // Try to get user from sessionStorage
  let user = null;
  try {
    user = JSON.parse(sessionStorage.getItem("user"));
  } catch {
    // Ignore JSON parse errors
  }
  return user?.user_id;
}

export const fetchDailyBillableReport = async (payload = {}) => {
  const user_id = getLoggedInUserId();
  const reqBody = { logged_in_user_id: user_id, ...payload };
  // Debug: log the payload being sent
  if (process.env.NODE_ENV !== 'production') {
    console.log('[fetchDailyBillableReport] Payload:', reqBody);
  }
  const res = await api.post("/tracker/view_daily", reqBody);
  return res.data;
};

export const fetchMonthlyBillableReport = async (payload = {}) => {
  const user_id = getLoggedInUserId();
  const reqBody = { logged_in_user_id: user_id, ...payload };
  const res = await api.post("/user_monthly_report/list", reqBody);
  return res.data;
};
