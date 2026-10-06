/**
 * Environment Configuration
 * Central configuration for all environment variables
 */

const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000",
  apiNodeBaseUrl: import.meta.env.DEV
    ? "/api/v1"
    : import.meta.env.VITE_API_NODE_BASE_URL || "http://127.0.0.1:8000/api/v1",
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,

  // App Configuration
  appName: import.meta.env.VITE_APP_NAME || "TFS Ops Tracker",
  appEnv: import.meta.env.VITE_APP_ENV || "development",
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,

  // Authentication
  tokenKey: import.meta.env.VITE_TOKEN_KEY || "tfs_auth_token",
  userKey: import.meta.env.VITE_USER_KEY || "tfs_user_data",

  // File Upload
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE) || 5242880, // 5MB
  allowedFileTypes: import.meta.env.VITE_ALLOWED_FILE_TYPES?.split(",") || [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
  ],

  // Device Tracking
  deviceIdKey: import.meta.env.VITE_DEVICE_ID_KEY || "tfs_device_id",
  deviceType: import.meta.env.VITE_DEVICE_TYPE || "Laptop",

  // Debugging
  debugMode: import.meta.env.VITE_DEBUG_MODE === "true",
  consoleLogs: import.meta.env.VITE_CONSOLE_LOGS === "true",
};

// Helper function for conditional logging
export const log = (...args) => {
  if (config.consoleLogs) {
    console.log(...args);
  }
};

export const logError = (...args) => {
  if (config.consoleLogs) {
    console.error(...args);
  }
};

export const logWarn = (...args) => {
  if (config.consoleLogs) {
    console.warn(...args);
  }
};

export default config;
