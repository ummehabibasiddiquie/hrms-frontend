import axios from "axios";
import config, { log, logError } from "../config/environment";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

const nodeApi = axios.create({
  baseURL: config.apiNodeBaseUrl,
  timeout: config.apiTimeout,
  headers: {
    "Content-Type": "application/json",
  },
});

nodeApi.interceptors.request.use(
  (requestConfig) => {
    const token = sessionStorage.getItem(config.tokenKey) || localStorage.getItem(config.tokenKey);
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('[Node API] No auth token found in session or local storage');
    }

    if (requestConfig.data instanceof FormData) {
      delete requestConfig.headers["Content-Type"];
      log("[Node API Request] Detected FormData, removed Content-Type header");
    }

    log(`[Node API Request] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
    log(`[Node API Request] Payload:`, requestConfig.data);

    return requestConfig;
  },
  (error) => {
    logError("[Node API Request Error]", error);
    return Promise.reject(error);
  }
);

nodeApi.interceptors.response.use(
  (response) => {
    log(`[Node API Response] ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    logError("[Node API Response Error]", error.response?.status, error.message);

    const isAuthEndpoint = error.config?.url?.includes("/auth/");
    const isLoginPage = window.location.pathname === "/login" || window.location.pathname === "/";

    if (error.response?.status === 401 && !isAuthEndpoint && !isLoginPage) {
      localStorage.removeItem(config.tokenKey);
      localStorage.removeItem(config.userKey);
      sessionStorage.clear();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    let friendlyMessage = getFriendlyErrorMessage(
      error.response?.data?.code || error.response?.data?.message || error.message
    );
    error.friendlyMessage = friendlyMessage;

    return Promise.reject(error);
  }
);

export default nodeApi;
