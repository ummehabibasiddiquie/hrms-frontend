import axios from "axios";
import config, { log, logError } from "../config/environment";
import { getFriendlyErrorMessage } from "../utils/errorMessages";

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.apiTimeout,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token to all requests
api.interceptors.request.use(
  (requestConfig) => {
    const token = localStorage.getItem(config.tokenKey);
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    // If the request data is FormData, remove Content-Type to let browser set it with boundary
    if (requestConfig.data instanceof FormData) {
      delete requestConfig.headers['Content-Type'];
      log('[API Request] Detected FormData, removed Content-Type header');
    }
    
    log(`[API Request] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
    
    return requestConfig;
  },
  (error) => {
    logError('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    log(`[API Response] ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    logError('[API Response Error]', error.response?.status, error.message);

    // Handle 401 unauthorized - token expired or invalid
    // BUT: Don't redirect if we're on the login page or calling the auth endpoint
    const isAuthEndpoint = error.config?.url?.includes('/auth/');
    const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
    
    if (error.response?.status === 401 && !isAuthEndpoint && !isLoginPage) {
      console.log('[API] 401 detected, redirecting to login');
      localStorage.removeItem(config.tokenKey);
      localStorage.removeItem(config.userKey);
      sessionStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Handle 403 forbidden - insufficient permissions
    if (error.response?.status === 403) {
      logError('[API] Access forbidden - Insufficient permissions');
    }

    // Handle 500 server errors
    if (error.response?.status >= 500) {
      logError('[API] Server error occurred');
    }

    // Map backend error to friendly message
    let friendlyMessage = getFriendlyErrorMessage(
      error.response?.data?.code || error.response?.data?.message || error.message
    );
    error.friendlyMessage = friendlyMessage;

    return Promise.reject(error);
  }
);

export default api;
