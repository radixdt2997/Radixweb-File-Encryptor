/**
 * Standard API error response shape.
 * All error responses from the server use this structure so the frontend can parse them consistently.
 */

import type { Response } from "express";
import type { ApiErrorResponse } from "../types/api";

/**
 * Send a JSON error response with the standard structure.
 *
 * @param res - Express response object
 * @param status - HTTP status code (4xx or 5xx)
 * @param errorCode - Short error identifier
 * @param message - User-facing message
 * @param details - Optional details (included only if provided)
 * @returns Express response object
 */
export function sendError(
  res: Response,
  status: number,
  errorCode: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiErrorResponse = { error: errorCode, message };
  if (details !== undefined && details !== null) {
    body.details = details;
  }
  return res.status(status).json(body);
}
