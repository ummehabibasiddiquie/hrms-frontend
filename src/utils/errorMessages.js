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

  // If error is a string and matches a key
  if (typeof error === 'string' && errorMap[error]) {
    return errorMap[error];
  }

  // If error is an object with code
  if (error.code && errorMap[error.code]) {
    return errorMap[error.code];
  }

  // If error is an object with message
  if (error.message && errorMap[error.message]) {
    return errorMap[error.message];
  }

  // Fallback to generic message
  return 'An error occurred. Please try again.';
}
