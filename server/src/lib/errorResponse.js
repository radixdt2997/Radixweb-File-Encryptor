/**
 * Standard API error response shape.
 * All error responses from the server use this structure so the frontend can parse them consistently.
 *
 * @typedef {Object} ApiErrorBody
 * @property {string} error   - Short error code (e.g. "Validation Error", "Too Many Attempts")
 * @property {string} message - User-facing description
 * @property {unknown} [details] - Optional extra data (validation array, attemptsRemaining, etc.)
 */

/**
 * Send a JSON error response with the standard structure.
 *
 * @param {import("express").Response} res - Express response
 * @param {number} status - HTTP status code (4xx or 5xx)
 * @param {string} errorCode - Short error identifier
 * @param {string} message - User-facing message
 * @param {unknown} [details] - Optional details (included only if provided)
 * @returns {import("express").Response}
 */
export function sendError(res, status, errorCode, message, details = undefined) {
  const body = { error: errorCode, message };
  if (details !== undefined && details !== null) {
    body.details = details;
  }
  return res.status(status).json(body);
}
