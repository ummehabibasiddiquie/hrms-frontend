// src/utils/errorMessages.js
// Maps backend error codes/messages to user-friendly messages

const errorMap = {
  'NETWORK_ERROR': 'Unable to connect. Please check your internet connection.',
  'INVALID_CREDENTIALS': 'Incorrect username or password.',
  'USER_NOT_FOUND': 'User not found. Please check the details and try again.',
  'PROJECT_NOT_FOUND': 'Project not found. Please refresh or contact support.',
  'VALIDATION_ERROR': 'Some fields are invalid. Please review and try again.',
  'SERVER_ERROR': 'Something went wrong on our end. Please try again later.',
  // Add more mappings as needed
};

export function getFriendlyErrorMessage(error) {
  if (!error) return 'An unknown error occurred.';

  // Axios / API error — prefer backend message
  const backendMessage =
    error.response?.data?.message ||
    (typeof error.response?.data === 'string' ? error.response.data : null);
  if (backendMessage && typeof backendMessage === 'string') {
    return backendMessage;
  }

  if (error.friendlyMessage && typeof error.friendlyMessage === 'string') {
    return error.friendlyMessage;
  }

  // Plain string (may be a known code or a backend message)
  if (typeof error === 'string') {
    if (errorMap[error]) return errorMap[error];
    if (!error.startsWith('Request failed with status code')) return error;
  }

  // Error object
  if (error.code && errorMap[error.code]) {
    return errorMap[error.code];
  }

  if (error.message) {
    if (errorMap[error.message]) return errorMap[error.message];
    if (!error.message.startsWith('Request failed with status code')) {
      return error.message;
    }
  }

  return 'An error occurred. Please try again.';
}
