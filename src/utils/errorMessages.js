import { toast } from "react-hot-toast";

const MSG_OFFLINE = "No internet. Check your connection.";
const MSG_LOAD_FAILED = "Unable to load data. Please try again.";
const MSG_TIMEOUT = "Request timed out. Try again.";
const MSG_GENERIC = "Something went wrong. Try again.";

const errorMap = {
  NETWORK_ERROR: MSG_LOAD_FAILED,
  ERR_NETWORK: MSG_LOAD_FAILED,
  ERR_INTERNET_DISCONNECTED: MSG_OFFLINE,
  ECONNABORTED: MSG_TIMEOUT,
  INVALID_CREDENTIALS: "Wrong email or password.",
  USER_NOT_FOUND: "Email not found.",
  PROJECT_NOT_FOUND: "Project not found. Refresh and try again.",
  VALIDATION_ERROR: "Some fields are invalid. Check and try again.",
  SERVER_ERROR: "Server error. Try again later.",
};

const AXIOS_JUNK =
  /^(network error|timeout of \d+ms exceeded|request failed with status code \d+)$/i;

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return "";
}

function toastOnce(message) {
  toast.error(message, { id: "app-load-error" });
}

export function isTimeoutError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = asText(typeof error === "string" ? error : error.message).toLowerCase();
  if (code === "ECONNABORTED") return true;
  return msg.includes("timeout") && !msg.includes("network");
}

export function isNetworkError(error) {
  if (isTimeoutError(error)) return false;
  if (!error) return false;
  const status = error.response?.status;
  if (status) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const code = String(
    (typeof error === "object" && (error.code || error.response?.data?.code)) || ""
  );
  if (
    [
      "ERR_NETWORK",
      "ERR_INTERNET_DISCONNECTED",
      "ENOTFOUND",
      "ECONNREFUSED",
      "ECONNRESET",
    ].includes(code)
  ) {
    return true;
  }

  const msg = asText(typeof error === "string" ? error : error.message).toLowerCase();
  if (msg === "network error" || msg.includes("failed to fetch") || msg.includes("network_error")) {
    return true;
  }
  if (typeof error === "object" && error.isAxiosError && !error.response) {
    return !isTimeoutError(error);
  }
  return false;
}

function rawFromError(error) {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  return asText(
    error.response?.data?.message ||
      error.response?.data?.error ||
      error.friendlyMessage ||
      error.message
  );
}

export function getFriendlyErrorMessage(error) {
  if (!error) return MSG_GENERIC;

  const hasHttpResponse = Boolean(error.response?.status);
  if (!hasHttpResponse && typeof navigator !== "undefined" && navigator.onLine === false) {
    return MSG_OFFLINE;
  }
  if (isTimeoutError(error)) return MSG_TIMEOUT;
  if (isNetworkError(error)) return MSG_LOAD_FAILED;
  if (typeof error === "object" && Number(error.response?.status) >= 500) {
    return MSG_LOAD_FAILED;
  }
  if (typeof error === "object" && Number(error.response?.status) >= 500) {
    return MSG_LOAD_FAILED;
  }

  const code =
    (typeof error === "object" &&
      (error.response?.data?.code || error.code)) ||
    "";
  if (code && errorMap[code]) return errorMap[code];

  const raw = rawFromError(error);
  if (raw && errorMap[raw]) return errorMap[raw];
  if (raw && !AXIOS_JUNK.test(raw)) return raw;

  return MSG_GENERIC;
}

export function applyFriendlyNetworkError(error) {
  if (!error || typeof error !== "object") return error;
  if (isNetworkError(error) || isTimeoutError(error)) {
    const msg = getFriendlyErrorMessage(error);
    error.friendlyMessage = msg;
    error.message = msg;
    if (!error.response) {
      error.response = { status: 0, data: { message: msg, code: "NETWORK_ERROR" } };
    }
    reportConnectionIssue(error);
    return error;
  }
  error.friendlyMessage = getFriendlyErrorMessage(error);
  return error;
}

export function isConnectionIssue(error) {
  return (
    isNetworkError(error) ||
    isTimeoutError(error) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  );
}

export function reportConnectionIssue(error) {
  if (!isConnectionIssue(error)) return false;
  toastOnce(getFriendlyErrorMessage(error));
  return true;
}

export function showApiError(error, fallback) {
  if (reportConnectionIssue(error)) return;
  toast.error(
    getFriendlyErrorMessage(error) || fallback || MSG_GENERIC,
    { id: "app-load-error" }
  );
}
